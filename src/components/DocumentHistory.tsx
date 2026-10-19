import { fmtDate } from "@/lib/status";
import { Pill } from "./ui";

type Doc = {
  id: string; fileName: string; cycle: number; uploadedAt: Date; note: string | null; size: number;
  uploadedBy: { name: string } | null; reviewedBy: { name: string } | null;
  reviewStatus: string; reviewedAt: Date | null; reviewComment: string | null;
  aiStatus: string; aiVerdict: string | null; aiSummary: string | null; aiConfidence: number | null;
};

const REVIEW: Record<string, [string, string]> = {
  PENDING_REVIEW: ["warning", "Pending review"],
  ACCEPTED: ["good", "Accepted"],
  PARTIAL: ["serious", "Partially received"],
  REJECTED: ["critical", "Rejected"],
};
const AI: Record<string, [string, string]> = {
  SUFFICIENT: ["good", "AI: sufficient"],
  PARTIAL: ["serious", "AI: partial"],
  INSUFFICIENT: ["critical", "AI: insufficient"],
  UNREADABLE: ["neutral", "AI: unreadable"],
};

export function DocumentHistory({ docs }: { docs: Doc[] }) {
  if (!docs.length) return <p className="text-sm text-ink-3">Nothing uploaded yet.</p>;
  return (
    <ol className="space-y-3">
      {docs.map((d) => {
        const [tone, label] = REVIEW[d.reviewStatus] ?? ["neutral", d.reviewStatus];
        const ai = d.aiVerdict ? AI[d.aiVerdict] : null;
        return (
          <li key={d.id} className="rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center gap-2">
              <a href={`/api/files/${d.id}`} target="_blank" className="font-medium hover:underline">📄 {d.fileName}</a>
              <span className="text-xs text-ink-3">cycle {d.cycle} · {(d.size / 1024).toFixed(0)} KB</span>
              <span className="ml-auto flex gap-2">
                {ai && <Pill tone={ai[0]}>{ai[1]}</Pill>}
                {d.aiStatus === "QUEUED" && <Pill tone="neutral">AI screening…</Pill>}
                <Pill tone={tone}>{label}</Pill>
              </span>
            </div>
            <div className="text-xs text-ink-2 mt-1">Uploaded by {d.uploadedBy?.name ?? "auditee"} on {fmtDate(d.uploadedAt)}{d.note && ` — “${d.note}”`}</div>
            {d.aiSummary && <div className="text-xs mt-2 bg-surface rounded p-2">🤖 {d.aiSummary}</div>}
            {d.reviewedAt && (
              <div className="text-xs mt-2">
                Reviewed by <b>{d.reviewedBy?.name ?? "auditor"}</b> on {fmtDate(d.reviewedAt)}{d.reviewComment && <>: {d.reviewComment}</>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
