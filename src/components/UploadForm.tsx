"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function UploadForm({ requirementId, compact = false }: { requirementId: string; compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!files.length) return setMsg({ ok: false, text: "Choose at least one file." });
    setBusy(true);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    fd.delete("files");
    files.forEach((f) => fd.append("files", f));
    fd.set("requirementId", requirementId);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: json.error ?? "Upload failed." });
    setFiles([]);
    setMsg({ ok: true, text: "Uploaded. The auditor has been notified in Teams; AI pre-screening is running." });
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); setFiles([...files, ...Array.from(e.dataTransfer.files)]); }}
        className={`block border-2 border-dashed rounded-lg text-center cursor-pointer ${compact ? "p-3" : "p-6"} ${drag ? "border-series bg-[#eef5fd]" : "border-line"}`}
      >
        <input type="file" name="files" multiple className="sr-only" onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
        <span className="text-sm text-ink-2">{files.length ? files.map((f) => f.name).join(", ") : "Drop files here or click to browse (PDF, Word, Excel, images · max 50 MB)"}</span>
      </label>
      {!compact && <input name="note" className="input" placeholder="Optional note to the auditor (e.g. “2024 version follows next week”)" />}
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Uploading…" : "Submit to auditor"}</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-[var(--good)]" : "text-[var(--critical)]"}`}>{msg.text}</span>}
      </div>
    </form>
  );
}
