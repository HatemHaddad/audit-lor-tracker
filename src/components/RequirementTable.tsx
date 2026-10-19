"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusPill } from "./ui";

type Row = {
  id: string; refNo: number; title: string; phase: string; status: string; owner: string;
  dateRequested: string; dueDate: string; dateReceived: string | null; dateReviewed: string | null; cycle: number;
};

const f = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—");
const OPEN = ["PENDING", "PARTIAL", "REJECTED"];

export function RequirementTable({ rows, auditId, today }: { rows: Row[]; auditId: string; today: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ALL");
  const [phase, setPhase] = useState("ALL");
  const t = new Date(today).getTime();

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (status === "ALL" || (status === "OVERDUE" ? OPEN.includes(r.status) && new Date(r.dueDate).getTime() < t : r.status === status)) &&
          (phase === "ALL" || r.phase === phase) &&
          (!q || `${r.refNo} ${r.title} ${r.owner}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [rows, q, status, phase, t],
  );

  const exportCsv = () => {
    const head = ["Ref", "Requirement", "Phase", "Owner", "Date requested", "Due", "Date received", "Date reviewed", "Status", "Cycle"];
    const lines = filtered.map((r) =>
      [r.refNo, r.title, r.phase, r.owner, r.dateRequested.slice(0, 10), r.dueDate.slice(0, 10), r.dateReceived?.slice(0, 10) ?? "", r.dateReviewed?.slice(0, 10) ?? "", r.status, r.cycle]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lor-status.csv";
    a.click();
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input className="input max-w-xs" placeholder="Search requirement, owner, ref…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
          <option value="ALL">All statuses</option>
          <option value="OVERDUE">Overdue</option>
          <option value="PENDING">Pending</option>
          <option value="UPLOADED">Pending review</option>
          <option value="PARTIAL">Partially received</option>
          <option value="REJECTED">Returned</option>
          <option value="RECEIVED">Received</option>
        </select>
        <select className="input w-auto" value={phase} onChange={(e) => setPhase(e.target.value)} aria-label="Phase filter">
          <option value="ALL">All phases</option>
          <option value="PLANNING">Planning</option>
          <option value="EXECUTION">Execution</option>
          <option value="REPORTING">Reporting</option>
        </select>
        <span className="text-sm text-ink-3 self-center">{filtered.length} of {rows.length}</span>
        <button className="btn ml-auto" onClick={exportCsv}>Export CSV</button>
      </div>
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto border border-line rounded-lg">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-brand text-white text-left text-xs">
            <tr>
              <th className="py-2 px-2">#</th>
              <th className="py-2 px-2">Requirement</th>
              <th className="py-2 px-2">Phase</th>
              <th className="py-2 px-2">Owner</th>
              <th className="py-2 px-2">Requested</th>
              <th className="py-2 px-2">Due</th>
              <th className="py-2 px-2">Received</th>
              <th className="py-2 px-2">Reviewed</th>
              <th className="py-2 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const overdue = OPEN.includes(r.status) && new Date(r.dueDate).getTime() < t;
              return (
                <tr key={r.id} className="border-t border-line hover:bg-surface align-top">
                  <td className="py-2 px-2 tnum text-ink-2">{r.refNo}</td>
                  <td className="py-2 px-2 min-w-[320px]">
                    <Link href={`/audits/${auditId}/requirements/${r.id}`} className="hover:underline">{r.title}</Link>
                    {r.cycle > 1 && <span className="ml-2 text-xs text-ink-3">cycle {r.cycle}</span>}
                  </td>
                  <td className="py-2 px-2 text-xs text-ink-2">{r.phase.toLowerCase()}</td>
                  <td className="py-2 px-2 text-xs whitespace-nowrap">{r.owner}</td>
                  <td className="py-2 px-2 tnum text-xs whitespace-nowrap">{f(r.dateRequested)}</td>
                  <td className={`py-2 px-2 tnum text-xs whitespace-nowrap ${overdue ? "text-[var(--critical)] font-semibold" : ""}`}>{f(r.dueDate)}{overdue && " ⚠"}</td>
                  <td className="py-2 px-2 tnum text-xs whitespace-nowrap">{f(r.dateReceived)}</td>
                  <td className="py-2 px-2 tnum text-xs whitespace-nowrap">{f(r.dateReviewed)}</td>
                  <td className="py-2 px-2"><StatusPill status={r.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
