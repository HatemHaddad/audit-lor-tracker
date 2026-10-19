import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { computeMetrics, timelinePct, healthOf, now, fmtDate, currentPhase } from "@/lib/status";
import { Donut, Gauge, Gantt, StatusBars } from "@/components/charts";
import { Kpi, Section, Pill } from "@/components/ui";
import { RequirementTable } from "@/components/RequirementTable";
import { FollowUpPanel } from "@/components/FollowUpPanel";
import { addRequirementAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const today = now();
  const audit = await db.audit.findUnique({
    where: { id },
    include: {
      leadAuditor: true,
      requirements: { orderBy: { refNo: "asc" }, include: { owner: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!audit) notFound();
  const user = await currentUser();
  const isAuditor = user?.role !== "AUDITEE";
  const owners = await db.user.findMany({ where: { role: "AUDITEE" }, orderBy: { name: "asc" } });

  const m = computeMetrics(audit.requirements, today);
  const t = timelinePct(audit, today);
  const h = healthOf(m.completionPct, t);
  const phase = currentPhase(audit, today);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/audits" className="text-sm text-ink-2 hover:underline">← Audits</Link>
          <h1 className="text-2xl font-semibold">Status of {audit.name} as on {fmtDate(today)}</h1>
          <p className="text-sm text-ink-2">
            {audit.code} · Auditee: {audit.auditeeDept} · Lead auditor: {audit.leadAuditor?.name ?? "—"} · Current phase:{" "}
            <b className="font-medium">{phase.replace("_", " ").toLowerCase()}</b>
          </p>
        </div>
        {m.total > 0 && <Pill tone={h.tone}>{h.label}</Pill>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Kpi title="# Documents received"><Gauge value={m.received} max={m.total} /></Kpi>
        <Kpi title="Documents pending" value={`${m.pendingPct}%`} sub={`${m.withAuditee} items with the auditee · ${m.overdue} overdue`} />
        <Kpi title="Pending your review" value={m.pendingReview} sub="uploaded — decide in Teams or here" />
        <Kpi title="LOR completion"><Donut pct={m.completionPct} color="var(--series-dark)" /></Kpi>
        <Kpi title="Audit timeline"><Donut pct={t} /></Kpi>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="Documents review status">
          <StatusBars
            rows={[
              { label: "Received", value: m.received, tone: "good" },
              { label: "Uploaded – pending review", value: m.pendingReview, tone: "warning" },
              { label: "Partially received", value: m.partial, tone: "serious" },
              { label: "Pending with auditee", value: m.withAuditee - m.partial, tone: "critical" },
            ]}
          />
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-ink-2">
            {(["PLANNING", "EXECUTION"] as const).map((p) => {
              const sub = computeMetrics(audit.requirements.filter((r) => r.phase === p), today);
              return (
                <div key={p} className="rounded-lg bg-surface p-2">
                  <div className="font-medium text-ink">{p === "PLANNING" ? "Planning" : "Execution"} items</div>
                  <div className="tnum">{sub.received}/{sub.total} received · {sub.overdue} overdue</div>
                </div>
              );
            })}
          </div>
        </Section>
        <Section title="Audit schedule" className="lg:col-span-2">
          <Gantt
            today={today.toISOString()}
            rows={[
              {
                label: audit.code,
                sub: `${fmtDate(audit.planningStart)} → ${fmtDate(audit.reportingEnd)}`,
                phases: [
                  { name: "Planning", start: audit.planningStart.toISOString(), end: audit.planningEnd.toISOString() },
                  { name: "Execution", start: audit.executionStart.toISOString(), end: audit.executionEnd.toISOString() },
                  { name: "Reporting", start: audit.reportingStart.toISOString(), end: audit.reportingEnd.toISOString() },
                ],
              },
            ]}
          />
          {isAuditor && <FollowUpPanel auditId={audit.id} />}
        </Section>
      </div>

      <Section title="List of requirements">
        <RequirementTable
          auditId={audit.id}
          today={today.toISOString()}
          rows={audit.requirements.map((r) => ({
            id: r.id,
            refNo: r.refNo,
            title: r.title,
            phase: r.phase,
            status: r.status,
            owner: r.owner?.name ?? "—",
            dateRequested: r.dateRequested.toISOString(),
            dueDate: r.dueDate.toISOString(),
            dateReceived: r.dateReceived?.toISOString() ?? null,
            dateReviewed: r.dateReviewed?.toISOString() ?? null,
            cycle: r.cycle,
          }))}
        />
      </Section>

      <div className="grid lg:grid-cols-2 gap-4">
        {isAuditor && (
          <Section title="Add a requirement">
            <form action={addRequirementAction} className="grid sm:grid-cols-2 gap-3">
              <input type="hidden" name="auditId" value={audit.id} />
              <label className="sm:col-span-2"><span className="label">Requirement</span><textarea name="title" required rows={2} className="input mt-1" /></label>
              <label><span className="label">Phase</span>
                <select name="phase" className="input mt-1"><option value="PLANNING">Planning</option><option value="EXECUTION">Execution</option><option value="REPORTING">Reporting</option></select>
              </label>
              <label><span className="label">Due date</span><input type="date" name="dueDate" required className="input mt-1" defaultValue={audit.executionStart.toISOString().slice(0, 10)} /></label>
              <label className="sm:col-span-2"><span className="label">Owner (auditee)</span>
                <select name="ownerId" className="input mt-1"><option value="">— unassigned —</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.department}</option>)}</select>
              </label>
              <div><button className="btn btn-primary">Add & notify in Teams</button></div>
            </form>
          </Section>
        )}
        <Section title="Activity">
          <ul className="divide-y divide-line text-sm">
            {audit.activities.map((e) => (
              <li key={e.id} className="py-2 flex gap-3">
                <span className="text-ink-3 w-24 shrink-0 tnum">{fmtDate(e.createdAt)}</span>
                <span><b className="font-medium">{e.actor}</b> — {e.message}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
