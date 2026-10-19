"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function Donut({ pct, color = "var(--series-1)", size = 132, caption }: { pct: number; color?: string; size?: number; caption?: string }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <figure className="flex flex-col items-center gap-1" role="img" aria-label={`${caption ?? ""} ${v}%`}>
      <svg width={size} height={size} viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--track)" strokeWidth="16" />
        <circle
          cx="64" cy="64" r={r} fill="none" stroke={color} strokeWidth="16"
          strokeDasharray={`${(v / 100) * c} ${c}`} transform="rotate(-90 64 64)"
        />
        <text x="64" y="64" textAnchor="middle" dominantBaseline="central" className="tnum" fontSize="22" fontWeight="600" fill="var(--ink)">
          {v}%
        </text>
      </svg>
      {caption && <figcaption className="text-xs text-ink-2">{caption}</figcaption>}
    </figure>
  );
}

export function Gauge({ value, max }: { value: number; max: number }) {
  const pct = max ? value / max : 0;
  const r = 60;
  const len = Math.PI * r;
  return (
    <div className="flex flex-col items-center" role="img" aria-label={`${value} of ${max}`}>
      <svg width="170" height="100" viewBox="0 0 160 92">
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="var(--track)" strokeWidth="18" />
        <path d="M 20 80 A 60 60 0 0 1 140 80" fill="none" stroke="var(--series-1)" strokeWidth="18" strokeDasharray={`${pct * len} ${len}`} />
        <text x="80" y="72" textAnchor="middle" fontSize="22" fontWeight="600" fill="var(--ink)" className="tnum">{value}</text>
      </svg>
      <div className="flex justify-between w-[150px] -mt-1 text-xs text-ink-3 tnum">
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  good: "var(--good)", warning: "var(--warning)", serious: "var(--serious)", critical: "var(--critical)", neutral: "var(--neutral)",
};

export function StatusBars({ rows }: { rows: { label: string; value: number; tone: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${r.value}`}>
          <div className="flex justify-between text-sm mb-1">
            <span className="flex items-center gap-2 text-ink-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONE[r.tone] }} aria-hidden />
              {r.label}
            </span>
            <span className="font-semibold tnum">{r.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--track)]">
            <div className="h-2.5 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: TONE[r.tone], minWidth: r.value ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function RequestedVsReceived({ data }: { data: { name: string; requested: number; received: number }[] }) {
  return (
    <div className="h-[440px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, left: -16, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-2)" }} interval={0} tickLine={false} axisLine={{ stroke: "var(--line)" }} />
          <YAxis tick={{ fontSize: 11, fill: "var(--ink-3)" }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: "rgba(42,120,214,0.06)" }} contentStyle={{ borderRadius: 8, borderColor: "var(--line)", fontSize: 12 }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: "var(--ink-2)" }} verticalAlign="top" align="left" height={28} formatter={(v) => <span style={{ color: "var(--ink-2)" }}>{v}</span>} />
          <Bar dataKey="requested" name="Documents requested" fill="var(--series-light)" radius={[4, 4, 0, 0]} maxBarSize={28}>
            <LabelList dataKey="requested" position="top" fontSize={11} fill="var(--ink-2)" />
          </Bar>
          <Bar dataKey="received" name="Documents received" fill="var(--series-dark)" radius={[4, 4, 0, 0]} maxBarSize={28}>
            <LabelList dataKey="received" position="top" fontSize={11} fill="var(--ink-2)" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type GanttRow = { label: string; href?: string; sub?: string; phases: { name: string; start: string; end: string }[] };
const PHASE_FILL: Record<string, string> = { Planning: "#b7d3f6", Execution: "#5598e7", Reporting: "#1c5cab" };
const PHASE_INK: Record<string, string> = { Planning: "#0d366b", Execution: "#ffffff", Reporting: "#ffffff" };

export function Gantt({ rows, today }: { rows: GanttRow[]; today: string }) {
  const all = rows.flatMap((r) => r.phases.flatMap((p) => [new Date(p.start).getTime(), new Date(p.end).getTime()]));
  if (!all.length) return null;
  const t0 = Math.min(...all) - 5 * 86_400_000;
  const t1 = Math.max(...all) + 5 * 86_400_000;
  const x = (iso: string | number) => ((new Date(iso).getTime() - t0) / (t1 - t0)) * 100;
  const ticks: { label: string; left: number }[] = [];
  const m = new Date(t0);
  m.setUTCDate(1);
  m.setUTCMonth(m.getUTCMonth() + 1);
  while (m.getTime() < t1) {
    ticks.push({ label: m.toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }), left: x(m.getTime()) });
    m.setUTCMonth(m.getUTCMonth() + 1);
  }
  const todayLeft = x(today);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="flex">
          <div className="w-52 shrink-0" />
          <div className="relative flex-1 h-6 border-b border-line text-[11px] text-ink-3">
            {ticks.map((t) => (
              <span key={t.label} className="absolute -translate-x-1/2 tnum" style={{ left: `${t.left}%` }}>{t.label}</span>
            ))}
          </div>
        </div>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center border-b border-line/70 last:border-0">
            <div className="w-52 shrink-0 py-2 pr-3 text-sm truncate">
              {r.href ? <Link href={r.href} className="hover:underline font-medium">{r.label}</Link> : <span className="font-medium">{r.label}</span>}
              {r.sub && <div className="text-xs text-ink-3">{r.sub}</div>}
            </div>
            <div className="relative flex-1 h-10">
              {ticks.map((t) => (
                <span key={t.label} className="absolute top-0 bottom-0 border-l border-line/60" style={{ left: `${t.left}%` }} />
              ))}
              {r.phases.map((p) => (
                <div
                  key={p.name}
                  title={`${p.name}: ${new Date(p.start).toLocaleDateString("en-GB")} – ${new Date(p.end).toLocaleDateString("en-GB")}`}
                  className="absolute top-2 h-6 rounded-md text-[11px] font-semibold px-2 flex items-center overflow-hidden whitespace-nowrap"
                  style={{ left: `calc(${x(p.start)}% + 1px)`, width: `calc(${x(p.end) - x(p.start)}% - 2px)`, background: PHASE_FILL[p.name], color: PHASE_INK[p.name] }}
                >
                  {p.name}
                </div>
              ))}
              {todayLeft >= 0 && todayLeft <= 100 && (
                <span className="absolute top-0 bottom-0 border-l-2 border-[var(--critical)]" style={{ left: `${todayLeft}%` }} />
              )}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-4 mt-3 text-xs text-ink-2">
          {Object.keys(PHASE_FILL).map((k) => (
            <span key={k} className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: PHASE_FILL[k] }} />{k}</span>
          ))}
          <span className="flex items-center gap-1.5"><span className="w-0 h-3 border-l-2 border-[var(--critical)]" />Today</span>
        </div>
      </div>
    </div>
  );
}
