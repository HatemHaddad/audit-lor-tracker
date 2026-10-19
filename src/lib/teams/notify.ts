import { CardFactory, MessageFactory } from "botbuilder";
import { db } from "../db";
import { getAdapter, botConfigured } from "./bot-adapter";
import { reminderCard } from "./cards";

type Card = Record<string, unknown>;
type Kind = "UPLOAD" | "DECISION" | "REMINDER" | "LOR_ISSUED";

// Delivery order: Teams bot (interactive) → Teams Workflows webhook (links) →
// local outbox only (dev). Every card is written to the outbox for audit trail.
export async function dispatch(opts: {
  kind: Kind;
  auditCode: string;
  title: string;
  interactiveCard: Card;
  linkCard?: Card; // used for webhook delivery when the interactive card needs the bot
}) {
  const delivered: string[] = [];

  if (botConfigured()) {
    const convs = await db.teamsConversation.findMany({
      where: { OR: [{ auditCode: opts.auditCode }, { auditCode: null }] },
    });
    for (const c of convs) {
      try {
        await getAdapter().continueConversationAsync(process.env.MICROSOFT_APP_ID!, JSON.parse(c.reference), async (ctx) => {
          await ctx.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(opts.interactiveCard)));
        });
        delivered.push("bot");
      } catch (err) {
        console.error("[teams] bot delivery failed", c.conversationId, err);
      }
    }
  }

  const webhook = process.env.TEAMS_WEBHOOK_URL;
  if (webhook) {
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: opts.linkCard ?? opts.interactiveCard }],
        }),
      });
      if (res.ok) delivered.push("webhook");
      else console.error("[teams] webhook returned", res.status, await res.text());
    } catch (err) {
      console.error("[teams] webhook failed", err);
    }
  }

  await db.outboxMessage.create({
    data: {
      kind: opts.kind,
      auditCode: opts.auditCode,
      title: opts.title,
      card: JSON.stringify(opts.linkCard ?? opts.interactiveCard),
      delivered: [...new Set(delivered)].join(",") || "local",
    },
  });
}

export async function sendReminderCard(i: {
  audit: { code: string; name: string };
  ownerName: string;
  ownerEmail: string;
  message: string;
  items: { refNo: number; title: string; dueDate: Date; status: string }[];
}) {
  const c = reminderCard({ auditName: i.audit.name, auditCode: i.audit.code, ownerName: i.ownerName, message: i.message, items: i.items });
  await dispatch({ kind: "REMINDER", auditCode: i.audit.code, title: `Reminder → ${i.ownerName}`, interactiveCard: c });
}
