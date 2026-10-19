"use client";

import { useActionState } from "react";
import { followUpAction, sendDraftsAction, type FollowUpState } from "@/app/actions";

export function FollowUpPanel({ auditId }: { auditId: string }) {
  const [state, run, running] = useActionState<FollowUpState, FormData>(followUpAction, {});
  const [sent, send, sending] = useActionState<FollowUpState, FormData>(sendDraftsAction, {});
  const r = state.result;

  return (
    <div className="mt-4 rounded-lg border border-line p-3 bg-surface">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <div className="font-medium text-sm">🤖 Follow-up agent</div>
          <div className="text-xs text-ink-2">Reviews outstanding items against the timeline, drafts reminders per owner and writes a status brief. Runs daily on schedule; run it now to preview.</div>
        </div>
        <form action={run}>
          <input type="hidden" name="auditId" value={auditId} />
          <button className="btn" disabled={running}>{running ? "Agent working…" : "Draft reminders & brief"}</button>
        </form>
      </div>
      {state.error && <p className="text-sm text-[var(--critical)] mt-2">{state.error}</p>}
      {r && (
        <div className="mt-3 space-y-3 text-sm">
          {r.error && <p className="text-[var(--critical)]">{r.error}</p>}
          {r.brief && <div className="whitespace-pre-wrap bg-white rounded-md p-3 border border-line">{r.brief}</div>}
          {r.reminders.length > 0 && (
            <>
              <div className="font-medium">{r.reminders.length} reminder draft(s)</div>
              <ul className="space-y-2">
                {r.reminders.map((d) => (
                  <li key={d.ownerEmail} className="bg-white rounded-md p-3 border border-line">
                    <div className="text-xs text-ink-2">To {d.ownerName} · items {d.refNos.join(", ")}</div>
                    <div className="mt-1">{d.message}</div>
                  </li>
                ))}
              </ul>
              {sent.result ? (
                <p className="text-[var(--good)] font-medium">✓ {sent.result.brief}</p>
              ) : (
                <form action={send}>
                  <input type="hidden" name="auditId" value={auditId} />
                  <input type="hidden" name="drafts" value={JSON.stringify(r.reminders)} />
                  <button className="btn btn-primary" disabled={sending}>{sending ? "Sending…" : "Approve & send to Teams"}</button>
                </form>
              )}
              {sent.error && <p className="text-[var(--critical)]">{sent.error}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
