import { CloudAdapter, ConfigurationBotFrameworkAuthentication } from "botbuilder";

// Azure Bot Service registration (Entra app). Leave unset to run without the bot.
export const botConfigured = () => Boolean(process.env.MICROSOFT_APP_ID && process.env.MICROSOFT_APP_PASSWORD);

let adapter: CloudAdapter | null = null;
export function getAdapter() {
  if (!adapter) {
    const auth = new ConfigurationBotFrameworkAuthentication({
      MicrosoftAppId: process.env.MICROSOFT_APP_ID,
      MicrosoftAppPassword: process.env.MICROSOFT_APP_PASSWORD,
      MicrosoftAppType: process.env.MICROSOFT_APP_TYPE ?? "SingleTenant",
      MicrosoftAppTenantId: process.env.MICROSOFT_APP_TENANT_ID,
    });
    adapter = new CloudAdapter(auth);
    adapter.onTurnError = async (ctx, err) => {
      console.error("[teams] turn error", err);
      await ctx.sendActivity("Sorry — something went wrong processing that action.");
    };
  }
  return adapter;
}
