"use client";

import { useActionState, useState } from "react";
import { reviewAction, type ActionState } from "@/app/actions";
import { DECISION_LABEL, type ReviewDecision } from "@/lib/status";

type AI = { verdict: string | null; summary: string | null; gaps: string[]; suggested: string | null; confidence: number | null } | null;
const fromVerdict = (v?: string | null): ReviewDecision => (v === "PARTIAL" ? "PARTIAL" : v === "INSUFFICIENT" ? "REJECTED" : "ACCEPTED");

export function ReviewForm({ docId, fileName, ai, token, initialDecision }: { docId: string; fileName: string; ai: AI; token?: string; initialDecision?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(reviewAction, {});
  const start = (initialDecision as ReviewDecision) || fromVerdict(ai?.verdict);
  const [decision, setDecision] = useState<ReviewDecision>(start);
  const [comment, setComment] = useState(start !== "ACCEPTED" ? ai?.suggested ?? "" : "");

  if (state.ok) return <p className="text-[var(--good)] font-medium">✓ {state.message}</p>;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="docId" value={docId} />
      {token && <input type="hidden" name="token" value={token} />}
      <div className="text-sm">
        File: <a className="font-medium hover:underline" href={`/api/files/${docId}`} target="_blank">📄 {fileName}</a>
      </div>
      {ai?.verdict && (
        <div className="rounded-lg bg-surface p-3 text-sm">
          <div className="font-medium">🤖 AI pre-screen: {ai.verdict.toLowerCase()} {ai.confidence != null && <span className="text-ink-3">({Math.round(ai.confidence * 100)}% confidence)</span>}</div>
          {ai.summary && <p className="mt-1">{ai.summary}</p>}
          {ai.gaps.length > 0 && <ul className="mt-1 list-disc pl-5">{ai.gaps.map((g) => <li key={g}>{g}</li>)}</ul>}
        </div>
      )}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="label mb-1">Select received status</legend>
        {(Object.keys(DECISION_LABEL) as ReviewDecision[]).map((k) => (
          <label key={k} className={`btn cursor-pointer ${decision === k ? "ring-2 ring-[var(--series-1)]" : ""}`}>
            <input type="radio" name="decision" value={k} checked={decision === k} onChange={() => { setDecision(k); if (k !== "ACCEPTED" && !comment && ai?.suggested) setComment(ai.suggested); }} className="sr-only" />
            {DECISION_LABEL[k]}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="label">Auditor comments {decision !== "ACCEPTED" && "(required — sent to the auditee)"}</span>
        <textarea name="comment" rows={3} className="input mt-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Enter your comments here…" />
      </label>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Submit decision"}</button>
        {state.error && <span className="text-sm text-[var(--critical)]">{state.error}</span>}
      </div>
    </form>
  );
}
