// Lightweight Adaptive Card renderer for the card log (subset of elements we emit).
type El = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function render(el: El, i: number): React.ReactNode {
  switch (el.type) {
    case "TextBlock":
      return (
        <p key={i} className={`whitespace-pre-wrap ${el.weight === "Bolder" ? "font-semibold" : ""} ${el.size === "Medium" ? "text-base" : "text-sm"} ${el.isSubtle ? "text-ink-3 text-xs" : ""}`}>
          {String(el.text).replace(/\*\*/g, "")}
        </p>
      );
    case "FactSet":
      return (
        <dl key={i} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          {el.facts.map((f: El, j: number) => (
            <div key={j} className="contents"><dt className="font-semibold whitespace-nowrap">{f.title}:</dt><dd>{f.value}</dd></div>
          ))}
        </dl>
      );
    case "Container":
      return <div key={i} className="rounded-md bg-[#f3f2f1] p-2 space-y-1">{el.items.map(render)}</div>;
    case "Input.ChoiceSet":
      return (
        <div key={i}><div className="text-sm font-semibold">{el.label}</div>
          <div className="mt-1 rounded border border-[#d1d1d1] px-2 py-1 text-sm bg-white">{el.choices.find((c: El) => c.value === el.value)?.title ?? "Select…"}</div></div>
      );
    case "Input.Text":
      return (
        <div key={i}><div className="text-sm font-semibold">{el.label}</div>
          <div className="mt-1 rounded border border-[#d1d1d1] px-2 py-1 text-sm bg-white min-h-12 text-ink-2">{el.value || el.placeholder}</div></div>
      );
    default:
      return null;
  }
}

export function CardPreview({ card }: { card: El }) {
  return (
    <div className="rounded-lg border border-[#e1dfdd] bg-[#faf9f8] p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-ink-3"><span className="w-5 h-5 rounded bg-brand grid place-items-center text-white text-[9px]">LOR</span> LOR Tracker</div>
      <div className="rounded-md bg-white border border-[#edebe9] p-3 space-y-2">
        {card.body?.map(render)}
        {card.actions?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {card.actions.map((a: El, j: number) => (
              a.url ? <a key={j} href={a.url} className="rounded border border-[#d1d1d1] px-3 py-1 text-sm hover:bg-[#f3f2f1]">{a.title}</a>
                : <span key={j} className="rounded border border-[#d1d1d1] px-3 py-1 text-sm">{a.title}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
