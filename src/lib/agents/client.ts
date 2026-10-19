import Anthropic from "@anthropic-ai/sdk";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

// Server-side refusal fallback: if the model declines for policy reasons the
// API retries on Anthropic's recommended fallback model inside the same call.
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let _client: Anthropic | null = null;
export function claude() {
  _client ??= new Anthropic();
  return _client;
}

export function describeApiError(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return "Claude API key is invalid";
  if (err instanceof Anthropic.RateLimitError) return "Claude API rate limit — try again shortly";
  if (err instanceof Anthropic.BadRequestError) return `Claude rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
