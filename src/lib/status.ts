// Status vocabulary + the metrics every dashboard is built from.

export const REQ_STATUS = {
  PENDING: { label: "Pending", tone: "critical" },
  UPLOADED: { label: "Uploaded – pending review", tone: "warning" },
  PARTIAL: { label: "Partially received", tone: "serious" },
  REJECTED: { label: "Returned to auditee", tone: "critical" },
  RECEIVED: { label: "Received", tone: "good" },
  NOT_APPLICABLE: { label: "Not applicable", tone: "neutral" },
} as const;
export type ReqStatus = keyof typeof REQ_STATUS;

export const PHASES = ["PLANNING", "EXECUTION", "REPORTING"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_LABEL: Record<Phase, string> = {
  PLANNING: "Planning",
  EXECUTION: "Execution",
  REPORTING: "Reporting",
};

export const REVIEW_DECISIONS = ["ACCEPTED", "PARTIAL", "REJECTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
export const DECISION_LABEL: Record<ReviewDecision, string> = {
  ACCEPTED: "Received (accept)",
  PARTIAL: "Partially received",
  REJECTED: "Reject / not relevant",
};

export type ReqLike = { status: string; dueDate: Date; phase: string };

export type AuditLike = {
  planningStart: Date;
  planningEnd: Date;
  executionStart: Date;
  executionEnd: Date;
  reportingStart: Date;
  reportingEnd: Date;
};

const isClosed = (s: string) => s === "RECEIVED" || s === "NOT_APPLICABLE";
// Outstanding with the auditee (they owe us something)
const isWithAuditee = (s: string) =>
  s === "PENDING" || s === "PARTIAL" || s === "REJECTED";

export function now() {
  return process.env.APP_TODAY ? new Date(process.env.APP_TODAY) : new Date();
}

export function computeMetrics(reqs: ReqLike[], today = now()) {
  const total = reqs.length;
  const received = reqs.filter((r) => isClosed(r.status)).length;
  const pendingReview = reqs.filter((r) => r.status === "UPLOADED").length;
  const withAuditee = reqs.filter((r) => isWithAuditee(r.status)).length;
  const partial = reqs.filter((r) => r.status === "PARTIAL").length;
  const overdue = reqs.filter(
    (r) => isWithAuditee(r.status) && r.dueDate.getTime() < today.getTime(),
  ).length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return {
    total,
    received,
    pendingReview,
    withAuditee,
    partial,
    overdue,
    // LOR completion = documents accepted by the auditor
    completionPct: pct(received),
    pendingPct: pct(withAuditee),
    uploadedPct: pct(received + pendingReview),
  };
}

export function timelinePct(a: AuditLike, today = now()) {
  const start = a.planningStart.getTime();
  const end = a.reportingEnd.getTime();
  if (today.getTime() <= start) return 0;
  if (today.getTime() >= end) return 100;
  return Math.round(((today.getTime() - start) / (end - start)) * 100);
}

export function currentPhase(a: AuditLike, today = now()): Phase | "NOT_STARTED" | "CLOSED" {
  const t = today.getTime();
  if (t < a.planningStart.getTime()) return "NOT_STARTED";
  if (t <= a.planningEnd.getTime()) return "PLANNING";
  if (t <= a.executionEnd.getTime()) return "EXECUTION";
  if (t <= a.reportingEnd.getTime()) return "REPORTING";
  return "CLOSED";
}

// Schedule health: completion should keep pace with elapsed time.
export function healthOf(completionPct: number, timePct: number) {
  const gap = timePct - completionPct;
  if (gap <= 10) return { label: "On track", tone: "good" as const };
  if (gap <= 30) return { label: "At risk", tone: "warning" as const };
  return { label: "Behind", tone: "critical" as const };
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
