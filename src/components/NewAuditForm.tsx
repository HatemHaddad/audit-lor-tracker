"use client";

import { useActionState, useState } from "react";
import { intakeAction, createAuditAction, type IntakeState } from "@/app/actions";

type Owner = { id: string; name: string; department: string | null };
type Item = { title: string; phase: string; dueDate: string; ownerId: string; ownerHint?: string };

const plus = (iso: string, days: number) => new Date(new Date(iso).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export function NewAuditForm({ owners, today }: { owners: Owner[]; today: string }) {
  const [dates, setDates] = useState({
    planningStart: today, planningEnd: plus(today, 18),
    executionStart: plus(today, 21), executionEnd: plus(today, 70),
    reportingStart: plus(today, 71), reportingEnd: plus(today, 95),
  });
  const [dept, setDept] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [state, parse, parsing] = useActionState<IntakeState, FormData>(async (prev, fd) => {
    const next = await intakeAction(prev, fd);
    if (next.result) {
      const deptOwners = owners.filter((o) => o.department === dept);
      setItems(
        next.result.requirements.map((r, i) => {
          const hinted = !r.ownerHint ? undefined : owners.find((o) => o.department && r.ownerHint.toLowerCase().includes(o.department.toLowerCase()));
          return { ...r, ownerId: hinted?.id ?? deptOwners[i % Math.max(1, deptOwners.length)]?.id ?? "" };
        }),
      );
    }
    return next;
  }, {});

  const upd = (i: number, patch: Partial<Item>) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const depts = [...new Set(owners.map((o) => o.department).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <section className="card p-4 grid md:grid-cols-3 gap-3">
        <label><span className="label">Audit code</span><input form="create" name="code" required className="input mt-1" placeholder="PROC-2026" /></label>
        <label><span className="label">Audit name</span><input form="create" name="name" required className="input mt-1" placeholder="Procurement" /></label>
        <label><span className="label">Auditee department</span>
          <input form="create" name="auditeeDept" required className="input mt-1" list="depts" value={dept} onChange={(e) => setDept(e.target.value)} />
          <datalist id="depts">{depts.map((d) => <option key={d} value={d} />)}</datalist>
        </label>
        {(["planning", "execution", "reporting"] as const).map((p) => (
          <div key={p} className="grid grid-cols-2 gap-2">
            {(["Start", "End"] as const).map((se) => {
              const k = `${p}${se}` as keyof typeof dates;
              return (
                <label key={k}><span className="label">{p} {se.toLowerCase()}</span>
                  <input form="create" type="date" name={k} required className="input mt-1" value={dates[k]} onChange={(e) => setDates({ ...dates, [k]: e.target.value })} />
                </label>
              );
            })}
          </div>
        ))}
      </section>

      <section className="card p-4 space-y-3">
        <div>
          <h2 className="font-semibold">1 · Paste or upload the LOR</h2>
          <p className="text-sm text-ink-2">The intake agent splits it into individual requests, assigns planning/execution phases and proposes due dates inside your windows. You can edit everything before issuing.</p>
        </div>
        <form action={parse} className="space-y-3">
          {Object.entries(dates).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <textarea name="lorText" rows={8} className="input font-mono text-xs" placeholder={"1. Strategy and strategic plan, including KPIs…\n2. Policies and procedures\n3. Delegation of authority matrix\n…"} />
          <div className="flex flex-wrap items-center gap-3">
            <input type="file" name="lorFile" accept=".xlsx,.xls,.csv,.txt" className="text-sm" />
            <button className="btn btn-primary" disabled={parsing}>{parsing ? "🤖 Reading LOR…" : "🤖 Structure with AI"}</button>
            {state.error && <span className="text-sm text-[var(--critical)]">{state.error}</span>}
          </div>
        </form>
        {state.result?.notes && <p className="text-sm rounded bg-surface p-2">💡 {state.result.notes}</p>}
      </section>

      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">2 · Review items ({items.length})</h2>
          <button className="btn" type="button" onClick={() => setItems([...items, { title: "", phase: "PLANNING", dueDate: plus(dates.planningStart, 7), ownerId: "" }])}>+ Add row</button>
        </div>
        {items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-2 border-b border-line">
                <tr><th className="py-2 w-8">#</th><th>Requirement</th><th className="w-32">Phase</th><th className="w-40">Due</th><th className="w-56">Owner</th><th className="w-8" /></tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-line/70 align-top">
                    <td className="py-2 tnum text-ink-3">{i + 1}</td>
                    <td className="py-1 pr-2"><textarea rows={2} className="input" value={it.title} onChange={(e) => upd(i, { title: e.target.value })} /></td>
                    <td className="py-1 pr-2">
                      <select className="input" value={it.phase} onChange={(e) => upd(i, { phase: e.target.value })}>
                        <option value="PLANNING">Planning</option><option value="EXECUTION">Execution</option><option value="REPORTING">Reporting</option>
                      </select>
                    </td>
                    <td className="py-1 pr-2"><input type="date" className="input" value={it.dueDate} onChange={(e) => upd(i, { dueDate: e.target.value })} /></td>
                    <td className="py-1 pr-2">
                      <select className="input" value={it.ownerId} onChange={(e) => upd(i, { ownerId: e.target.value })}>
                        <option value="">— unassigned —</option>
                        {owners.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.department}</option>)}
                      </select>
                      {it.ownerHint && <div className="text-[11px] text-ink-3 mt-0.5">AI hint: {it.ownerHint}</div>}
                    </td>
                    <td><button type="button" className="text-ink-3 hover:text-[var(--critical)] px-2" onClick={() => setItems(items.filter((_, j) => j !== i))} aria-label="Remove">✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form id="create" action={createAuditAction} className="flex items-center gap-3">
          <input type="hidden" name="items" value={JSON.stringify(items)} />
          <button className="btn btn-primary">Create audit & issue LOR{items.length ? ` (${items.length} items)` : ""}</button>
          <span className="text-xs text-ink-3">Auditees are notified in Teams and see the items in their portal.</span>
        </form>
      </section>
    </div>
  );
}
