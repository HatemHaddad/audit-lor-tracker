import { db } from "@/lib/db";
import { botConfigured } from "@/lib/teams/bot-adapter";
import { appUrl } from "@/lib/tokens";
import { aiEnabled, MODEL } from "@/lib/agents/client";
import { fmtDate } from "@/lib/status";
import { Section, Pill } from "@/components/ui";
import { CardPreview } from "@/components/CardPreview";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const [outbox, convs] = await Promise.all([
    db.outboxMessage.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    db.teamsConversation.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const webhook = Boolean(process.env.TEAMS_WEBHOOK_URL);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Teams & AI integration</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="flex justify-between"><b>Teams bot</b><Pill tone={botConfigured() ? "good" : "neutral"}>{botConfigured() ? "Connected" : "Not configured"}</Pill></div>
          <p className="text-sm text-ink-2 mt-2">Interactive cards: auditors pick the status and comment and submit inside Teams. Installed in {convs.length} conversation(s).</p>
          <p className="text-xs text-ink-3 mt-2 break-all">Messaging endpoint: {appUrl()}/api/teams/messages</p>
        </div>
        <div className="card p-4">
          <div className="flex justify-between"><b>Channel webhook</b><Pill tone={webhook ? "good" : "neutral"}>{webhook ? "Connected" : "Not configured"}</Pill></div>
          <p className="text-sm text-ink-2 mt-2">Simplest option: cards posted to a channel, with a “Review & decide” button that opens a signed review page.</p>
        </div>
        <div className="card p-4">
          <div className="flex justify-between"><b>AI agents</b><Pill tone={aiEnabled() ? "good" : "warning"}>{aiEnabled() ? "Enabled" : "Fallback mode"}</Pill></div>
          <p className="text-sm text-ink-2 mt-2">LOR intake, document pre-screening and follow-up agents on Claude ({MODEL}). Without an API key the app uses rule-based fallbacks.</p>
        </div>
      </div>

      <Section title="Card log (everything sent to Teams)">
        {!outbox.length && <p className="text-sm text-ink-3">No cards yet. Upload a document or issue an LOR to generate one.</p>}
        <div className="grid lg:grid-cols-2 gap-4">
          {outbox.map((m) => (
            <div key={m.id}>
              <div className="flex items-center gap-2 text-xs text-ink-2 mb-1">
                <span className="tnum">{fmtDate(m.createdAt)} {m.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <span>· {m.auditCode} · {m.kind.toLowerCase().replace("_", " ")}</span>
                <span className="ml-auto">delivered: {m.delivered}</span>
              </div>
              <CardPreview card={JSON.parse(m.card)} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
