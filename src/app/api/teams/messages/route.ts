import { NextResponse } from "next/server";
import type { Request as BotRequest, Response as BotResponse } from "botbuilder";
import { getAdapter, botConfigured } from "@/lib/teams/bot-adapter";
import { LorBot } from "@/lib/teams/bot";

// Azure Bot "Messaging endpoint": https://<host>/api/teams/messages
const bot = new LorBot();

export async function POST(request: Request) {
  if (!botConfigured()) return NextResponse.json({ error: "Teams bot not configured" }, { status: 503 });

  const body = await request.json();
  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => (headers[k] = v));

  // Minimal Express-style shim so CloudAdapter can authenticate the request
  // (Bot Framework JWT) and write the invoke response.
  let status = 200;
  let payload: unknown = undefined;
  const resHeaders = new Headers();
  const res: BotResponse = {
    socket: null,
    status(code: number) {
      status = code;
      return res;
    },
    header(name: string, value: unknown) {
      resHeaders.set(name, String(value));
      return res;
    },
    send(b?: unknown) {
      payload = b;
      return res;
    },
    end() {
      return res;
    },
  };
  const req: BotRequest = { body, headers, method: "POST" };

  await getAdapter().process(req, res, (ctx) => bot.run(ctx));

  if (payload === undefined || payload === null) return new NextResponse(null, { status, headers: resHeaders });
  return NextResponse.json(payload, { status, headers: resHeaders });
}
