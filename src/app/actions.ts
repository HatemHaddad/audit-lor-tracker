"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { recordDecision, issueLor, WorkflowError } from "@/lib/workflow";
import { runIntakeAgent, type IntakeResult } from "@/lib/agents/intake";
import { runFollowUpAgent, type FollowUpResult } from "@/lib/agents/followup";
import { describeApiError } from "@/lib/agents/client";
import { spreadsheetToText } from "@/lib/extract";
import { verifyReviewToken } from "@/lib/tokens";

export async function switchUser(formData: FormData) {
  const jar = await cookies();
  jar.set("uid", String(formData.get("uid")), { httpOnly: true, sameSite: "lax", path: "/" });
  revalidatePath("/", "layout");
}

export type ActionState = { ok?: boolean; error?: string; message?: string };

export async function reviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const docId = String(formData.get("docId"));
  const token = formData.get("token") ? String(formData.get("token")) : null;
  let reviewerId: string | null;
  if (token) {
    const v = verifyReviewToken(token, docId);
    if (!v) return { error: "This review link has expired or is invalid." };
    reviewerId = v.reviewerId;
  } else {
    const u = await currentUser();
    if (!u || u.role === "AUDITEE") return { error: "Only auditors can review submissions." };
    reviewerId = u.id;
  }
  try {
    const r = await recordDecision({ docId, decision: String(formData.get("decision")), comment: String(formData.get("comment") ?? ""), reviewerId });
    revalidatePath("/", "layout");
    if (r.alreadyDecided) return { ok: true, message: `Already reviewed (${r.decision}).` };
    return { ok: true, message: "Decision recorded and the auditee has been notified in Teams." };
  } catch (err) {
    if (err instanceof WorkflowError) return { error: err.message };
    throw err;
  }
}

export async function markNotApplicable(formData: FormData) {
  const u = await currentUser();
  if (!u || u.role === "AUDITEE") return;
  const id = String(formData.get("requirementId"));
  const r = await db.requirement.update({ where: { id }, data: { status: "NOT_APPLICABLE", dateReviewed: new Date(), lastComment: "Marked not applicable by auditor" } });
  await db.activity.create({ data: { auditId: r.auditId, requirementId: id, actor: u.name, type: "ACCEPTED", message: `Item ${r.refNo} marked not applicable` } });
  revalidatePath("/", "layout");
}

// ---- Audit creation + LOR intake ----

export type IntakeState = { error?: string; result?: IntakeResult; rawLength?: number };

export async function intakeAction(_prev: IntakeState, formData: FormData): Promise<IntakeState> {
  let raw = String(formData.get("lorText") ?? "");
  const file = formData.get("lorFile");
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    raw += "\n" + (/\.(xlsx|xls|csv)$/i.test(file.name) ? spreadsheetToText(buf) : buf.toString("utf8"));
  }
  if (raw.trim().length < 10) return { error: "Paste the LOR or upload an Excel/CSV file." };
  const win = {
    planningStart: String(formData.get("planningStart")),
    planningEnd: String(formData.get("planningEnd")),
    executionStart: String(formData.get("executionStart")),
    executionEnd: String(formData.get("executionEnd")),
  };
  if (Object.values(win).some((v) => !v)) return { error: "Set the planning and execution dates first." };
  try {
    return { result: await runIntakeAgent(raw, win), rawLength: raw.length };
  } catch (err) {
    return { error: describeApiError(err) };
  }
}

export async function createAuditAction(formData: FormData) {
  const u = await currentUser();
  if (!u || u.role === "AUDITEE") throw new Error("Only auditors can create audits.");
  const g = (k: string) => String(formData.get(k) ?? "").trim();
  const items = JSON.parse(g("items") || "[]") as { title: string; phase: string; dueDate: string; ownerId: string }[];
  const audit = await db.audit.create({
    data: {
      code: g("code").toUpperCase(),
      name: g("name"),
      auditeeDept: g("auditeeDept"),
      leadAuditorId: u.id,
      planningStart: new Date(g("planningStart")),
      planningEnd: new Date(g("planningEnd")),
      executionStart: new Date(g("executionStart")),
      executionEnd: new Date(g("executionEnd")),
      reportingStart: new Date(g("reportingStart")),
      reportingEnd: new Date(g("reportingEnd")),
    },
  });
  if (items.length) {
    await issueLor(
      audit.id,
      items.filter((i) => i.title.trim()).map((i) => ({ title: i.title.trim(), phase: i.phase, dueDate: new Date(i.dueDate), ownerId: i.ownerId || null })),
      u.name,
    );
  }
  revalidatePath("/", "layout");
  redirect(`/audits/${audit.id}`);
}

export async function addRequirementAction(formData: FormData) {
  const u = await currentUser();
  if (!u || u.role === "AUDITEE") return;
  const auditId = String(formData.get("auditId"));
  await issueLor(
    auditId,
    [{ title: String(formData.get("title")), phase: String(formData.get("phase")), dueDate: new Date(String(formData.get("dueDate"))), ownerId: String(formData.get("ownerId")) || null }],
    u.name,
  );
  revalidatePath(`/audits/${auditId}`);
}

// ---- Follow-up agent ----

export type FollowUpState = { result?: FollowUpResult; error?: string };

export async function followUpAction(_prev: FollowUpState, formData: FormData): Promise<FollowUpState> {
  const u = await currentUser();
  if (!u || u.role === "AUDITEE") return { error: "Only auditors can run the follow-up agent." };
  const auditId = String(formData.get("auditId"));
  const send = formData.get("send") === "1";
  const result = await runFollowUpAgent(auditId, { send, actor: `${u.name} via Follow-up Agent` });
  revalidatePath(`/audits/${auditId}`);
  return { result };
}

// Send the exact reminders the agent drafted (after the auditor approved them).
export async function sendDraftsAction(_prev: FollowUpState, formData: FormData): Promise<FollowUpState> {
  const u = await currentUser();
  if (!u || u.role === "AUDITEE") return { error: "Only auditors can send reminders." };
  const auditId = String(formData.get("auditId"));
  const drafts = JSON.parse(String(formData.get("drafts") ?? "[]")) as FollowUpResult["reminders"];
  const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId }, include: { requirements: true } });
  const { sendReminderCard } = await import("@/lib/teams/notify");
  for (const r of drafts) {
    const items = audit.requirements.filter((x) => r.refNos.includes(x.refNo));
    if (!items.length) continue;
    await sendReminderCard({ audit, ownerName: r.ownerName, ownerEmail: r.ownerEmail, message: r.message, items });
    await db.requirement.updateMany({ where: { id: { in: items.map((i) => i.id) } }, data: { lastReminderAt: new Date() } });
    await db.activity.create({ data: { auditId, actor: u.name, type: "REMINDER", message: `Reminder sent to ${r.ownerName} for items ${r.refNos.join(", ")}` } });
  }
  revalidatePath(`/audits/${auditId}`);
  return { result: { brief: `Sent ${drafts.length} reminder(s) to Teams.`, reminders: drafts, sent: true, usedAI: false } };
}
