import Link from "next/link";
import { db } from "@/lib/db";
import { computeMetrics, timelinePct, healthOf, now, fmtDate } from "@/lib/status";
import { Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Audits() {
  const today = now();
  const audits = await db.audit.findMany({
    orderBy: { planningStart: "desc" },
    include: { leadAuditor: true, requirements: { select: { status: true, dueDate: true, phase: true } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Audits</h1>
        <Link href="/audits/new" className="btn btn-primary">+ New audit & LOR</Link>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {audits.map((a) => {
          const m = computeMetrics(a.requirements, today);
          const t = timelinePct(a, today);
          const h = healthOf(m.completionPct, t);
          return (
            <Link key={a.id} href={`/audits/${a.id}`} className="card p-4 hover:shadow-md transition-shadow block">
              <div className="flex justify-between gap-2">
                <div>
                  <div className="text-xs text-ink-3">{a.code}</div>
                  <div className="font-semibold">{a.name}</div>
                  <div className="text-xs text-ink-2">{a.auditeeDept} · Lead: {a.leadAuditor?.name ?? "—"}</div>
                </div>
                {m.total ? <Pill tone={h.tone}>{h.label}</Pill> : <Pill tone="neutral">LOR not issued</Pill>}
              </div>
              <div className="mt-3 grid grid-cols-4 text-center text-xs">
                {[["Requested", m.total], ["Received", m.received], ["To review", m.pendingReview], ["Overdue", m.overdue]].map(([k, v]) => (
                  <div key={k as string}><div className="text-lg font-semibold tnum">{v}</div><div className="text-ink-3">{k}</div></div>
                ))}
              </div>
              <div className="mt-3 text-xs text-ink-2 tnum">{fmtDate(a.planningStart)} → {fmtDate(a.reportingEnd)} · {m.completionPct}% complete · {t}% time elapsed</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
