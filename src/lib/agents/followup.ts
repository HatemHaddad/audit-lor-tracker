import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, MODEL, FALLBACK, aiEnabled, describeApiError } from "./client";
import { db } from "../db";
import { computeMetrics, timelinePct, currentPhase, now, fmtDate } from "../status";
import { sendReminderCard } from "../teams/notify";

// Follow-up Agent: an autonomous tool-using agent that looks at an audit's
// outstanding LOR items against the timeline, decides who needs chasing, writes
// tailored reminders (sent to Teams) and returns a status brief for the auditor.

export type Reminder = { ownerName: string; ownerEmail: string; refNos: number[]; message: string };
export type FollowUpResult = { brief: string; reminders: Reminder[]; sent: boolean; usedAI: boolean; error?: string };

const OUTSTANDING = ["PENDING", "PARTIAL", "REJECTED"];

async function loadAudit(auditId: string) {
  return db.audit.findUniqueOrThrow({
    where: { id: auditId },
    include: { leadAuditor: true, requirements: { include: { owner: true }, orderBy: { refNo: "asc" } } },
  });
}

const daysBetween = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / 86_400_000);

export async function runFollowUpAgent(auditId: string, opts: { send: boolean; actor: string }): Promise<FollowUpResult> {
  const audit = await loadAudit(auditId);
  const today = now();
  const reminders: Reminder[] = [];

  async function deliver(r: Reminder) {
    reminders.push(r);
    if (!opts.send) return;
    const reqs = audit.requirements.filter((x) => r.refNos.includes(x.refNo));
    await sendReminderCard({ audit, ownerName: r.ownerName, ownerEmail: r.ownerEmail, message: r.message, items: reqs });
    await db.requirement.updateMany({ where: { id: { in: reqs.map((x) => x.id) } }, data: { lastReminderAt: today } });
    await db.activity.create({
      data: { auditId, actor: opts.actor, type: "REMINDER", message: `Reminder sent to ${r.ownerName} for items ${r.refNos.join(", ")}` },
    });
  }

  const outstanding = audit.requirements.filter((r) => OUTSTANDING.includes(r.status));

  if (!aiEnabled()) {
    // Deterministic fallback: chase every owner with overdue or due-in-3-days items.
    const byOwner = new Map<string, typeof outstanding>();
    for (const r of outstanding) {
      if (!r.owner || daysBetween(r.dueDate, today) > 3) continue;
      byOwner.set(r.owner.email, [...(byOwner.get(r.owner.email) ?? []), r]);
    }
    for (const items of byOwner.values()) {
      const o = items[0].owner!;
      await deliver({
        ownerName: o.name,
        ownerEmail: o.email,
        refNos: items.map((i) => i.refNo),
        message: `Dear ${o.name.split(" ")[0]}, ${items.length} item(s) for the ${audit.name} audit are overdue or due within 3 days. Please upload them to the audit portal or reply in this thread if you need more time.`,
      });
    }
    const m = computeMetrics(audit.requirements, today);
    return {
      usedAI: false,
      sent: opts.send,
      reminders,
      brief: `${m.completionPct}% of ${m.total} items received; ${m.withAuditee} outstanding with the auditee (${m.overdue} overdue), ${m.pendingReview} awaiting your review. Timeline ${timelinePct(audit, today)}% elapsed. (Set ANTHROPIC_API_KEY for an AI-written brief and tailored reminders.)`,
    };
  }

  const getOverview = betaZodTool({
    name: "get_audit_overview",
    description: "Audit dates, current phase, % of timeline elapsed and LOR completion metrics.",
    inputSchema: z.object({}),
    run: async () => {
      const m = computeMetrics(audit.requirements, today);
      return JSON.stringify({
        audit: audit.name,
        code: audit.code,
        today: today.toISOString().slice(0, 10),
        phase: currentPhase(audit, today),
        timelineElapsedPct: timelinePct(audit, today),
        windows: {
          planning: [fmtDate(audit.planningStart), fmtDate(audit.planningEnd)],
          execution: [fmtDate(audit.executionStart), fmtDate(audit.executionEnd)],
          reporting: [fmtDate(audit.reportingStart), fmtDate(audit.reportingEnd)],
        },
        metrics: m,
      });
    },
  });

  const listOutstanding = betaZodTool({
    name: "list_outstanding_items",
    description:
      "LOR items still owed by the auditee (pending, partially received, or returned), with owner, due date, days overdue (negative = days left), review cycle, last auditor comment and when they were last reminded.",
    inputSchema: z.object({}),
    run: async () =>
      JSON.stringify(
        outstanding.map((r) => ({
          refNo: r.refNo,
          title: r.title,
          phase: r.phase,
          status: r.status,
          owner: r.owner ? { name: r.owner.name, email: r.owner.email } : null,
          due: r.dueDate.toISOString().slice(0, 10),
          daysOverdue: daysBetween(today, r.dueDate),
          cycle: r.cycle,
          lastAuditorComment: r.lastComment,
          lastRemindedDaysAgo: r.lastReminderAt ? daysBetween(today, r.lastReminderAt) : null,
        })),
      ),
  });

  const sendReminder = betaZodTool({
    name: "send_reminder",
    description:
      "Send ONE Teams reminder to an auditee owner covering one or more of their outstanding items. Call at most once per owner. The message should be concise, polite, reference the item numbers and what is still missing.",
    inputSchema: z.object({
      ownerEmail: z.string(),
      refNos: z.array(z.number().int()).min(1),
      message: z.string().min(20).max(1200),
    }),
    run: async ({ ownerEmail, refNos, message }) => {
      const items = outstanding.filter((r) => refNos.includes(r.refNo));
      if (items.length !== refNos.length) return "Error: some refNos are not outstanding items.";
      if (items.some((r) => r.owner?.email !== ownerEmail)) return "Error: every item must belong to that owner.";
      if (reminders.some((r) => r.ownerEmail === ownerEmail)) return "Error: this owner was already reminded in this run.";
      await deliver({ ownerName: items[0].owner!.name, ownerEmail, refNos, message });
      return opts.send ? "Reminder sent to Teams." : "Reminder recorded as a draft for auditor approval.";
    },
  });

  try {
    const final = await claude().beta.messages.toolRunner({
      model: MODEL,
      max_tokens: 16000,
      max_iterations: 12,
      ...FALLBACK,
      output_config: { effort: "medium" },
      tools: [getOverview, listOutstanding, sendReminder],
      system: `You are the follow-up coordinator for an internal-audit LOR (List of Requirements) process. Each run you:
1. Check the audit overview and outstanding items.
2. Decide who needs a reminder. Chase items that are overdue or due within 3 days; prioritise items needed for the current phase (planning items block planning; execution items block fieldwork). Skip owners reminded in the last 2 days unless items are badly overdue. Items returned or partially received need the auditor's last comment restated so the auditee knows exactly what is missing.
3. Send one consolidated reminder per owner with send_reminder.
4. Finish with a short status brief for the lead auditor (max ~120 words, plain text): completion vs timeline, biggest risks to the schedule, who was chased, and anything the auditor should escalate.`,
      messages: [{ role: "user", content: `Run today's follow-up for audit ${audit.code}.` }],
    });
    const brief = final.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
    return { usedAI: true, sent: opts.send, reminders, brief: brief || "Follow-up completed." };
  } catch (err) {
    return { usedAI: true, sent: opts.send, reminders, brief: "", error: describeApiError(err) };
  }
}
