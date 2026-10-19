import { db } from "./db";
import { saveFile, readStored } from "./storage";
import { now, type ReviewDecision, REVIEW_DECISIONS } from "./status";
import { runReviewAgent } from "./agents/review";
import { dispatch } from "./teams/notify";
import { uploadCard, decidedCard, auditeeDecisionCard, lorIssuedCard } from "./teams/cards";
import { signReviewToken, appUrl } from "./tokens";

// The LOR cycle:  REQUESTED → (auditee uploads) UPLOADED → (auditor reviews)
//   ACCEPTED ⇒ RECEIVED (closed)
//   PARTIAL / REJECTED ⇒ back to the auditee, cycle + 1 → uploads again …

export class WorkflowError extends Error {}

const MAX_BYTES = 50 * 1024 * 1024;

export async function recordUpload(input: {
  requirementId: string;
  fileName: string;
  mimeType: string;
  data: Buffer;
  uploaderId: string | null;
  note?: string | null;
}) {
  if (!input.data.length) throw new WorkflowError("The file is empty.");
  if (input.data.length > MAX_BYTES) throw new WorkflowError("Files are limited to 50 MB.");

  const req = await db.requirement.findUnique({ where: { id: input.requirementId }, include: { audit: true } });
  if (!req) throw new WorkflowError("Requirement not found.");
  if (req.status === "RECEIVED" || req.status === "NOT_APPLICABLE") {
    throw new WorkflowError(`Item ${req.refNo} is already closed — no further uploads needed.`);
  }

  const storedPath = await saveFile({ auditCode: req.audit.code, refNo: req.refNo, cycle: req.cycle, fileName: input.fileName }, input.data);
  const uploader = input.uploaderId ? await db.user.findUnique({ where: { id: input.uploaderId } }) : null;
  const ts = now();

  const doc = await db.$transaction(async (tx) => {
    const d = await tx.document.create({
      data: {
        requirementId: req.id,
        cycle: req.cycle,
        fileName: input.fileName,
        storedPath,
        mimeType: input.mimeType || "application/octet-stream",
        size: input.data.length,
        uploadedById: uploader?.id,
        note: input.note || null,
        uploadedAt: ts,
      },
    });
    await tx.requirement.update({ where: { id: req.id }, data: { status: "UPLOADED", dateReceived: ts } });
    await tx.activity.create({
      data: {
        auditId: req.auditId,
        requirementId: req.id,
        actor: uploader?.name ?? "Auditee",
        type: "UPLOADED",
        message: `Uploaded "${input.fileName}" for item ${req.refNo}${req.cycle > 1 ? ` (cycle ${req.cycle})` : ""}`,
      },
    });
    return d;
  });
  return doc;
}

// Runs after the upload response is sent: AI pre-screen, then Teams card.
export async function processUpload(docId: string) {
  const doc = await db.document.findUniqueOrThrow({
    where: { id: docId },
    include: { uploadedBy: true, requirement: { include: { audit: true } } },
  });
  const req = doc.requirement;
  const audit = req.audit;

  const data = await readStored(doc.storedPath);
  const ai = await runReviewAgent({
    requirement: req.title,
    phase: req.phase,
    previousComments: req.lastComment,
    fileName: doc.fileName,
    mime: doc.mimeType,
    data,
    auditeeNote: doc.note,
  });
  await db.document.update({
    where: { id: doc.id },
    data: {
      aiStatus: ai.status,
      aiVerdict: ai.result?.verdict,
      aiConfidence: ai.result?.confidence,
      aiSummary: ai.result?.summary ?? (ai.status === "ERROR" ? `AI pre-screen failed: ${ai.error}` : null),
      aiGaps: ai.result ? JSON.stringify(ai.result.gaps) : null,
      aiSuggestedComment: ai.result?.suggestedComment,
    },
  });
  if (ai.result) {
    await db.activity.create({
      data: { auditId: audit.id, requirementId: req.id, actor: "AI Review Agent", type: "AI_REVIEWED", message: `Pre-screened "${doc.fileName}": ${ai.result.verdict}` },
    });
  }

  const reviewerId = audit.leadAuditorId ?? "auditor";
  const input = {
    docId: doc.id,
    auditCode: audit.code,
    auditName: audit.name,
    auditId: audit.id,
    requirementId: req.id,
    refNo: req.refNo,
    requirement: req.title,
    cycle: doc.cycle,
    fileName: doc.fileName,
    uploadedBy: doc.uploadedBy?.name ?? "Auditee",
    auditeeNote: doc.note,
    ai: ai.result ?? null,
    reviewLink: `${appUrl()}/review/${doc.id}?t=${signReviewToken(doc.id, reviewerId)}`,
  };
  await dispatch({
    kind: "UPLOAD",
    auditCode: audit.code,
    title: `Item ${req.refNo}: ${doc.fileName}`,
    interactiveCard: uploadCard(input, true),
    linkCard: uploadCard(input, false),
  });
}

export async function recordDecision(input: { docId: string; decision: string; comment?: string | null; reviewerId: string | null; reviewerName?: string }) {
  if (!REVIEW_DECISIONS.includes(input.decision as ReviewDecision)) throw new WorkflowError("Unknown decision.");
  const decision = input.decision as ReviewDecision;
  const comment = input.comment?.trim() || null;
  if (decision !== "ACCEPTED" && !comment) throw new WorkflowError("Please tell the auditee what is missing.");

  const doc = await db.document.findUnique({ where: { id: input.docId }, include: { requirement: { include: { audit: true, owner: true } } } });
  if (!doc) throw new WorkflowError("Document not found.");
  const req = doc.requirement;
  const reviewer = input.reviewerId ? await db.user.findUnique({ where: { id: input.reviewerId } }) : null;
  const reviewerName = reviewer?.name ?? input.reviewerName ?? "Auditor";

  if (doc.reviewStatus !== "PENDING_REVIEW") {
    return { alreadyDecided: true as const, doc, req, decision: doc.reviewStatus as ReviewDecision };
  }

  const ts = now();
  await db.$transaction(async (tx) => {
    // The decision applies to every file submitted in this cycle.
    await tx.document.updateMany({
      where: { requirementId: req.id, cycle: doc.cycle, reviewStatus: "PENDING_REVIEW" },
      data: { reviewStatus: decision, reviewedById: reviewer?.id, reviewedAt: ts, reviewComment: comment },
    });
    await tx.requirement.update({
      where: { id: req.id },
      data:
        decision === "ACCEPTED"
          ? { status: "RECEIVED", dateReviewed: ts, lastComment: comment }
          : { status: decision, dateReviewed: ts, lastComment: comment, cycle: { increment: 1 } },
    });
    await tx.activity.create({
      data: {
        auditId: req.auditId,
        requirementId: req.id,
        actor: reviewerName,
        type: decision,
        message: `Item ${req.refNo} ${decision === "ACCEPTED" ? "accepted" : decision === "PARTIAL" ? "partially received" : "returned"}${comment ? `: ${comment}` : ""}`,
      },
    });
  });

  await dispatch({
    kind: "DECISION",
    auditCode: req.audit.code,
    title: `Item ${req.refNo} → ${decision}`,
    interactiveCard: auditeeDecisionCard({
      auditName: req.audit.name,
      auditCode: req.audit.code,
      auditId: req.auditId,
      requirementId: req.id,
      refNo: req.refNo,
      requirement: req.title,
      decision,
      comment,
      ownerName: req.owner?.name,
    }),
  });

  return {
    alreadyDecided: false as const,
    doc,
    req,
    decision,
    card: decidedCard({ auditName: req.audit.name, auditCode: req.audit.code, refNo: req.refNo, requirement: req.title, fileName: doc.fileName, decision, reviewer: reviewerName, comment, at: ts }),
  };
}

export async function issueLor(auditId: string, items: { title: string; phase: string; dueDate: Date; ownerId: string | null }[], actor: string) {
  const audit = await db.audit.findUniqueOrThrow({ where: { id: auditId } });
  const max = await db.requirement.aggregate({ where: { auditId }, _max: { refNo: true } });
  let ref = max._max.refNo ?? 0;
  const ts = now();
  await db.$transaction([
    ...items.map((it) =>
      db.requirement.create({
        data: { auditId, refNo: ++ref, title: it.title, phase: it.phase, dueDate: it.dueDate, ownerId: it.ownerId, dateRequested: ts },
      }),
    ),
    db.activity.create({ data: { auditId, actor, type: "REQUESTED", message: `Issued ${items.length} LOR items` } }),
  ]);
  const dues = items.map((i) => i.dueDate.getTime()).sort((a, b) => a - b);
  await dispatch({
    kind: "LOR_ISSUED",
    auditCode: audit.code,
    title: `LOR issued: ${items.length} items`,
    interactiveCard: lorIssuedCard({
      auditName: audit.name,
      auditCode: audit.code,
      auditId,
      count: items.length,
      planning: items.filter((i) => i.phase === "PLANNING").length,
      execution: items.filter((i) => i.phase === "EXECUTION").length,
      firstDue: dues.length ? new Date(dues[0]) : null,
    }),
  });
}
