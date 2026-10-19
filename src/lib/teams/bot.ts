import { TeamsActivityHandler, TeamsInfo, TurnContext, type AdaptiveCardInvokeValue, type AdaptiveCardInvokeResponse } from "botbuilder";
import { db } from "../db";
import { recordDecision, WorkflowError } from "../workflow";

// Teams bot: remembers the channels/chats it is added to (for proactive cards)
// and handles the in-card "Submit decision" (Action.Execute, verb "review").
export class LorBot extends TeamsActivityHandler {
  constructor() {
    super();
    this.onConversationUpdate(async (ctx, next) => {
      await rememberConversation(ctx);
      await next();
    });
    this.onInstallationUpdate(async (ctx, next) => {
      await rememberConversation(ctx);
      await next();
    });
    this.onMessage(async (ctx, next) => {
      await rememberConversation(ctx);
      const text = TurnContext.removeRecipientMention(ctx.activity)?.trim().toLowerCase() ?? "";
      const m = text.match(/^bind\s+([\w-]+)/);
      if (m) {
        await db.teamsConversation.update({ where: { conversationId: ctx.activity.conversation.id }, data: { auditCode: m[1].toUpperCase() } });
        await ctx.sendActivity(`This conversation will now receive cards for audit **${m[1].toUpperCase()}** only.`);
      } else {
        await ctx.sendActivity("I post LOR uploads, reviews and reminders here. Type `bind <AUDIT-CODE>` to limit this channel to one audit.");
      }
      await next();
    });
  }

  protected async onAdaptiveCardInvoke(ctx: TurnContext, value: AdaptiveCardInvokeValue): Promise<AdaptiveCardInvokeResponse> {
    if (value.action.verb !== "review") {
      return { statusCode: 400, type: "application/vnd.microsoft.error", value: { code: "BadRequest", message: "Unknown action" } as never };
    }
    const data = value.action.data as { docId?: string; decision?: string; comment?: string };
    let email: string | undefined;
    try {
      email = (await TeamsInfo.getMember(ctx, ctx.activity.from.id)).email ?? undefined;
    } catch {
      /* member lookup can fail in group chats without permission */
    }
    const reviewer = email ? await db.user.findUnique({ where: { email: email.toLowerCase() } }) : null;
    if (!reviewer || reviewer.role === "AUDITEE") {
      return message(ctx, "Only members of the audit team can review submissions.");
    }
    try {
      const r = await recordDecision({ docId: data.docId ?? "", decision: data.decision ?? "", comment: data.comment, reviewerId: reviewer.id });
      if (r.alreadyDecided) return message(ctx, `This document was already reviewed (${r.decision}).`);
      return { statusCode: 200, type: "application/vnd.microsoft.card.adaptive", value: r.card };
    } catch (err) {
      if (err instanceof WorkflowError) return message(ctx, err.message);
      throw err;
    }
  }
}

function message(_ctx: TurnContext, text: string): AdaptiveCardInvokeResponse {
  return { statusCode: 200, type: "application/vnd.microsoft.activity.message", value: text as never };
}

async function rememberConversation(ctx: TurnContext) {
  const ref = TurnContext.getConversationReference(ctx.activity);
  const id = ctx.activity.conversation.id;
  await db.teamsConversation.upsert({
    where: { conversationId: id },
    create: { conversationId: id, name: ctx.activity.conversation.name ?? null, reference: JSON.stringify(ref) },
    update: { reference: JSON.stringify(ref) },
  });
}
