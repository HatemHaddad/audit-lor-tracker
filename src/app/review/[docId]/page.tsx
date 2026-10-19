import { db } from "@/lib/db";
import { verifyReviewToken } from "@/lib/tokens";
import { ReviewForm } from "@/components/ReviewForm";
import { DocumentHistory } from "@/components/DocumentHistory";
import { Section, StatusPill } from "@/components/ui";
import { fmtDate } from "@/lib/status";

export const dynamic = "force-dynamic";

// Landing page for the "Review & decide" button in Teams webhook cards.
export default async function ReviewLink({ params, searchParams }: { params: Promise<{ docId: string }>; searchParams: Promise<{ t?: string; d?: string }> }) {
  const { docId } = await params;
  const { t, d } = await searchParams;
  const ok = t ? verifyReviewToken(t, docId) : null;
  if (!ok) return <p className="card p-6 max-w-xl">This review link is invalid or has expired. Open the item from the LOR tracker instead.</p>;

  const doc = await db.document.findUnique({
    where: { id: docId },
    include: { requirement: { include: { audit: true, documents: { orderBy: { uploadedAt: "desc" }, include: { uploadedBy: true, reviewedBy: true } } } } },
  });
  if (!doc) return <p className="card p-6">Document not found.</p>;
  const r = doc.requirement;

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <div className="text-sm text-ink-2">{r.audit.name} · {r.audit.code}</div>
        <h1 className="text-xl font-semibold">#{r.refNo} · {r.title}</h1>
        <div className="mt-1 flex items-center gap-3 text-sm text-ink-2"><StatusPill status={r.status} /> requested {fmtDate(r.dateRequested)} · due {fmtDate(r.dueDate)}</div>
      </div>
      <Section title="Your decision">
        {doc.reviewStatus === "PENDING_REVIEW" ? (
          <ReviewForm
            docId={doc.id}
            token={t}
            initialDecision={d}
            fileName={doc.fileName}
            ai={doc.aiStatus === "DONE" ? { verdict: doc.aiVerdict, summary: doc.aiSummary, gaps: doc.aiGaps ? JSON.parse(doc.aiGaps) : [], suggested: doc.aiSuggestedComment, confidence: doc.aiConfidence } : null}
          />
        ) : (
          <p className="text-sm">This file was already reviewed: <b>{doc.reviewStatus.toLowerCase()}</b>{doc.reviewComment && ` — ${doc.reviewComment}`}.</p>
        )}
      </Section>
      <Section title="Submission history"><DocumentHistory docs={r.documents} /></Section>
    </div>
  );
}
