import { REQ_STATUS, type ReqStatus } from "@/lib/status";

const TONE_CLASS: Record<string, string> = {
  good: "bg-[#e7f6e7] text-[#0a6b0a] ring-[#0ca30c]/30",
  warning: "bg-[#fff6e0] text-[#8a5a00] ring-[#fab219]/40",
  serious: "bg-[#fdeee7] text-[#9a3f17] ring-[#ec835a]/40",
  critical: "bg-[#fbe9e9] text-[#9b2222] ring-[#d03b3b]/30",
  neutral: "bg-[#eef0f4] text-[#4a5568] ring-[#8a94a6]/30",
};
const TONE_ICON: Record<string, string> = { good: "✓", warning: "◷", serious: "◐", critical: "!", neutral: "–" };

export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 whitespace-nowrap ${TONE_CLASS[tone] ?? TONE_CLASS.neutral}`}>
      <span aria-hidden>{TONE_ICON[tone]}</span>
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const s = REQ_STATUS[status as ReqStatus] ?? { label: status, tone: "neutral" };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function Kpi({ title, value, sub, children }: { title: string; value?: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card p-4 flex flex-col">
      <div className="text-sm font-medium text-ink-2">{title}</div>
      {value !== undefined && <div className="text-3xl font-semibold tnum mt-1">{value}</div>}
      {sub && <div className="text-xs text-ink-3 mt-1">{sub}</div>}
      {children && <div className="flex-1 grid place-items-center mt-2">{children}</div>}
    </div>
  );
}

export function Section({ title, action, children, className = "" }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
