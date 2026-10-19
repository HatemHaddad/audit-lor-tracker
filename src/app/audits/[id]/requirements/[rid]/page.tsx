import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDate, now } from "@/lib/status";
import { Section, StatusPill } from "@/components/ui";
import { UploadForm } from "@/components/UploadForm";
import { ReviewForm } from "@/components/ReviewForm";
import { DocumentHistory } from "@/components/DocumentHistory";
import { markNotApplicable } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function RequirementPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const req = await db.requirement.findUnique({
    where: { id: rid },
    include: {
      audit: true,
      owner: true,
      documents: { orderBy: { uploadedAt: "desc" }, include: { uploadedBy: true, reviewedBy: true } },
      activities: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!req || req.auditId !== id) notFound();
  const user = await currentUser();
  const isAuditor = user?.role !== "AUDITEE";
  const pending = req.documents.find((d) => d.reviewStatus === "PENDING_REVIEW");
  const open = !["RECEIVED", "NOT_APPLICABLE"].includes(req.status);
  const overdue = ["PENDING", "PARTIAL", "REJECTED"].includes(req.status) && req.dueDate < now();

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <Link href={`/audits/${id}`} className="text-sm text-ink-2 hover:underline">← {req.audit.name}</Link>
        <div className="flex flex-wrap items-start gap-3 mt-1">
          <h1 className="text-xl font-semibold flex-1">#{req.refNo} · {req.title}</h1>
          <StatusPill status={req.status} />
        </div>
        <p className="text-sm text-ink-2 mt-1">{req.phase.toLowerCase()} phase · owner {req.owner?.name ?? "unassigned"} · review cycle {req.cycle}</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        {[
          ["Date requested", fmtDate(req.dateRequested)],
          ["Due date", fmtDate(req.dueDate) + (overdue ? " ⚠ overdue" : "")],
          ["Date received", fmtDate(req.dateReceived)],
          ["Date reviewed", fmtDate(req.dateReviewed)],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <div className="label">{k}</div>
            <div className={`mt-1 font-semibold tnum ${k === "Due date" && overdue ? "text-[var(--critical)]" : ""}`}>{v}</div>
          </div>
        ))}
      </div>

      {req.lastComment && open && (
        <div className="card p-3 border-l-4" style={{ borderLeftColor: "var(--serious)" }}>
          <div className="label">Latest auditor feedback</div>
          <p className="mt-1 text-sm">{req.lastComment}</p>
        </div>
      )}

      {isAuditor && pending && (
        <Section title="Review submission">
          <ReviewForm
            docId={pending.id}
            fileName={pending.fileName}
            ai={pending.aiStatus === "DONE" ? { verdict: pending.aiVerdict, summary: pending.aiSummary, gaps: pending.aiGaps ? JSON.parse(pending.aiGaps) : [], suggested: pending.aiSuggestedComment, confidence: pending.aiConfidence } : null}
          />
        </Section>
      )}

      {open && (
        <Section title={req.cycle > 1 ? `Upload updated document (cycle ${req.cycle})` : "Upload document"}>
          <UploadForm requirementId={req.id} />
        </Section>
      )}

      <Section title="Submission history">
        <DocumentHistory docs={req.documents} />
      </Section>

      <Section title="Audit trail">
        <ul className="divide-y divide-line text-sm">
          {req.activities.map((e) => (
            <li key={e.id} className="py-2 flex gap-3">
              <span className="text-ink-3 w-24 shrink-0 tnum">{fmtDate(e.createdAt)}</span>
              <span><b className="font-medium">{e.actor}</b> — {e.message}</span>
            </li>
          ))}
          {!req.activities.length && <li className="py-2 text-ink-3">No activity yet.</li>}
        </ul>
      </Section>

      {isAuditor && open && (
        <form action={markNotApplicable}>
          <input type="hidden" name="requirementId" value={req.id} />
          <button className="btn text-ink-2">Mark as not applicable</button>
        </form>
      )}
    </div>
  );
}
