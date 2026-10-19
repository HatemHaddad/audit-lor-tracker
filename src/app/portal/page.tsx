import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { fmtDate, now } from "@/lib/status";
import { StatusPill, Section } from "@/components/ui";
import { UploadForm } from "@/components/UploadForm";

export const dynamic = "force-dynamic";

export default async function Portal({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const { item } = await searchParams;
  const user = await currentUser();
  const isAuditee = user?.role === "AUDITEE";
  const today = now();
  const reqs = await db.requirement.findMany({
    where: { status: { in: ["PENDING", "PARTIAL", "REJECTED", "UPLOADED"] }, ...(isAuditee ? { ownerId: user!.id } : {}) },
    include: { audit: true, owner: true },
    orderBy: [{ dueDate: "asc" }, { refNo: "asc" }],
    take: isAuditee ? undefined : 60,
  });
  const actionNeeded = reqs.filter((r) => r.status !== "UPLOADED");
  const waiting = reqs.filter((r) => r.status === "UPLOADED");

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">{isAuditee ? `Welcome, ${user!.name.split(" ")[0]}` : "Auditee portal"}</h1>
        <p className="text-sm text-ink-2">
          {isAuditee
            ? "These are the documents the audit team has requested from you. Upload against each item — the auditor is notified in Teams."
            : "Preview of the auditee experience (showing the 60 most urgent open items). Switch to an auditee user in the top bar to see a personal view."}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3"><div className="label">Action needed</div><div className="text-2xl font-semibold tnum">{actionNeeded.length}</div></div>
        <div className="card p-3"><div className="label">Overdue</div><div className="text-2xl font-semibold tnum text-[var(--critical)]">{actionNeeded.filter((r) => r.dueDate < today).length}</div></div>
        <div className="card p-3"><div className="label">With auditor</div><div className="text-2xl font-semibold tnum">{waiting.length}</div></div>
      </div>

      <Section title="Action needed">
        <ul className="space-y-3">
          {actionNeeded.map((r) => {
            const overdue = r.dueDate < today;
            return (
              <li key={r.id} id={r.id} className={`rounded-lg border p-3 ${item === r.id ? "border-[var(--series-1)] ring-2 ring-[var(--series-light)]" : "border-line"}`}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex-1 min-w-[240px]">
                    <div className="text-xs text-ink-3">{r.audit.name} · #{r.refNo} · {r.phase.toLowerCase()}{!isAuditee && ` · ${r.owner?.name ?? "unassigned"}`}</div>
                    <div className="font-medium">{r.title}</div>
                  </div>
                  <div className="text-right">
                    <StatusPill status={r.status} />
                    <div className={`text-xs mt-1 tnum ${overdue ? "text-[var(--critical)] font-semibold" : "text-ink-2"}`}>Due {fmtDate(r.dueDate)}{overdue && " · overdue"}</div>
                  </div>
                </div>
                {r.lastComment && r.status !== "PENDING" && (
                  <p className="text-sm mt-2 rounded bg-[#fdeee7] p-2"><b>Auditor:</b> {r.lastComment}</p>
                )}
                <div className="mt-2"><UploadForm requirementId={r.id} compact /></div>
              </li>
            );
          })}
          {!actionNeeded.length && <li className="text-sm text-ink-3">Nothing outstanding — thank you!</li>}
        </ul>
      </Section>

      {waiting.length > 0 && (
        <Section title="Submitted — awaiting auditor review">
          <ul className="divide-y divide-line text-sm">
            {waiting.map((r) => (
              <li key={r.id} className="py-2 flex gap-3">
                <span className="text-ink-3 w-16 shrink-0">#{r.refNo}</span>
                <span className="flex-1">{r.title}</span>
                <span className="text-ink-3 tnum whitespace-nowrap">sent {fmtDate(r.dateReceived)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
