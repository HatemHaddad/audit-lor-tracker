import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { computeMetrics, timelinePct, healthOf, now, currentPhase, PHASE_LABEL, fmtDate } from "@/lib/status";
import { Donut, Gauge, RequestedVsReceived, Gantt } from "@/components/charts";
import { Kpi, Section, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await currentUser();
  if (user?.role === "AUDITEE") redirect("/portal");

  const today = now();
  const audits = await db.audit.findMany({
    orderBy: { planningStart: "asc" },
    include: { requirements: { select: { status: true, dueDate: true, phase: true } } },
  });
  const activity = await db.activity.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { audit: true } });

  const rows = audits.map((a) => {
    const m = computeMetrics(a.requirements, today);
    const t = timelinePct(a, today);
    return { a, m, t, health: healthOf(m.completionPct, t), phase: currentPhase(a, today) };
  });
  const all = computeMetrics(audits.flatMap((a) => a.requirements), today);
  const programme = audits.length
    ? timelinePct(
        {
          planningStart: new Date(Math.min(...audits.map((a) => a.planningStart.getTime()))),
          reportingEnd: new Date(Math.max(...audits.map((a) => a.reportingEnd.getTime()))),
        } as Parameters<typeof timelinePct>[0],
        today,
      )
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Status of LOR as on {fmtDate(today)}</h1>
          <p className="text-sm text-ink-2">All audit engagements · {audits.length} audits · {all.total} documents requested</p>
        </div>
        <Link href="/audits/new" className="btn btn-primary">+ New audit & LOR</Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi title="Documents uploaded"><Gauge value={all.received + all.pendingReview} max={all.total} /></Kpi>
        <Kpi title="Pending auditor review" value={all.pendingReview} sub="uploaded, awaiting decision" />
        <Kpi title="Documents pending" value={`${all.pendingPct}%`} sub={`${all.withAuditee} with auditees · ${all.overdue} overdue`} />
        <Kpi title="LOR completion"><Donut pct={all.completionPct} color="var(--series-dark)" /></Kpi>
        <Kpi title="Audit timeline"><Donut pct={programme} /></Kpi>
      </div>

      <div className="grid lg:grid-cols-5 gap-4">
        <Section title="Documents requested vs received by audit area" className="lg:col-span-2">
          <RequestedVsReceived data={rows.map(({ a, m }) => ({ name: a.code.replace(/-\d+$/, ""), requested: m.total, received: m.received }))} />
        </Section>
        <Section title="Document receipt status" className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-2 border-b border-line">
                <tr>
                  <th className="py-2 pr-2">Audit area</th>
                  <th className="py-2 px-2">Phase</th>
                  <th className="py-2 px-2 text-right">Requested</th>
                  <th className="py-2 px-2 text-right">Received</th>
                  <th className="py-2 px-2 text-right">Pending</th>
                  <th className="py-2 px-2 text-right">To review</th>
                  <th className="py-2 px-2 text-right">Overdue</th>
                  <th className="py-2 px-2">Completion vs time</th>
                  <th className="py-2 pl-2">Health</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ a, m, t, health, phase }) => (
                  <tr key={a.id} className="border-b border-line/70 last:border-0 hover:bg-surface">
                    <td className="py-2 pr-2"><Link className="font-medium hover:underline" href={`/audits/${a.id}`}>{a.name}</Link></td>
                    <td className="py-2 px-2 text-ink-2 text-xs">{phase in PHASE_LABEL ? PHASE_LABEL[phase as keyof typeof PHASE_LABEL] : phase === "NOT_STARTED" ? "Not started" : "Closed"}</td>
                    <td className="py-2 px-2 text-right tnum">{m.total}</td>
                    <td className="py-2 px-2 text-right tnum">{m.received}</td>
                    <td className="py-2 px-2 text-right tnum">{m.withAuditee}</td>
                    <td className="py-2 px-2 text-right tnum">{m.pendingReview}</td>
                    <td className="py-2 px-2 text-right tnum">{m.overdue || "—"}</td>
                    <td className="py-2 px-2 min-w-[140px]">
                      <div className="relative h-2 rounded-full bg-[var(--track)]" title={`${m.completionPct}% complete · ${t}% of time elapsed`}>
                        <div className="h-2 rounded-full bg-[var(--series-dark)]" style={{ width: `${m.completionPct}%` }} />
                        <span className="absolute -top-1 h-4 border-l-2 border-ink" style={{ left: `${t}%` }} />
                      </div>
                      <div className="text-[11px] text-ink-3 tnum mt-0.5">{m.completionPct}% done · {t}% time</div>
                    </td>
                    <td className="py-2 pl-2">{m.total ? <Pill tone={health.tone}>{health.label}</Pill> : <Pill tone="neutral">LOR not issued</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title="Audit schedule">
        <Gantt
          today={today.toISOString()}
          rows={audits.map((a) => ({
            label: a.name,
            href: `/audits/${a.id}`,
            phases: [
              { name: "Planning", start: a.planningStart.toISOString(), end: a.planningEnd.toISOString() },
              { name: "Execution", start: a.executionStart.toISOString(), end: a.executionEnd.toISOString() },
              { name: "Reporting", start: a.reportingStart.toISOString(), end: a.reportingEnd.toISOString() },
            ],
          }))}
        />
      </Section>

      <Section title="Latest activity">
        <ul className="divide-y divide-line text-sm">
          {activity.map((e) => (
            <li key={e.id} className="py-2 flex gap-3">
              <span className="text-ink-3 w-24 shrink-0 tnum">{fmtDate(e.createdAt)}</span>
              <span className="text-ink-2 w-28 shrink-0 truncate">{e.audit.code}</span>
              <span><b className="font-medium">{e.actor}</b> — {e.message}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
