import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runFollowUpAgent } from "@/lib/agents/followup";
import { now } from "@/lib/status";

// Daily scheduler hook (Vercel Cron / Azure Functions timer / GitHub Actions):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/followup
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = now();
  const active = await db.audit.findMany({ where: { planningStart: { lte: today }, reportingEnd: { gte: today } } });
  const results = [];
  for (const a of active) {
    const r = await runFollowUpAgent(a.id, { send: true, actor: "Follow-up Agent (scheduled)" });
    results.push({ audit: a.code, reminders: r.reminders.length, error: r.error });
  }
  return NextResponse.json({ ran: results.length, results });
}
