import { appUrl } from "../tokens";
import { DECISION_LABEL, fmtDate, type ReviewDecision } from "../status";

// Adaptive Cards (schema 1.5). "interactive" cards use Action.Execute and are
// only sent through the bot; webhook cards fall back to Action.OpenUrl links.

type Card = Record<string, unknown>;
const card = (body: unknown[], actions: unknown[] = []): Card => ({
  $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
  type: "AdaptiveCard",
  version: "1.5",
  body,
  actions,
});
const fact = (title: string, value: string) => ({ title, value });
const header = (text: string, sub?: string) => [
  { type: "TextBlock", text, weight: "Bolder", size: "Medium", wrap: true },
  ...(sub ? [{ type: "TextBlock", text: sub, isSubtle: true, spacing: "None", wrap: true }] : []),
];

const VERDICT_TEXT: Record<string, string> = {
  SUFFICIENT: "✅ Looks sufficient",
  PARTIAL: "🟠 Partially meets the request",
  INSUFFICIENT: "❌ Does not appear to match the request",
  UNREADABLE: "⚪ Could not be read automatically",
};
export const verdictToDecision = (v?: string | null): ReviewDecision =>
  v === "SUFFICIENT" ? "ACCEPTED" : v === "PARTIAL" ? "PARTIAL" : v === "INSUFFICIENT" ? "REJECTED" : "ACCEPTED";

export type UploadCardInput = {
  docId: string;
  auditCode: string;
  auditName: string;
  auditId: string;
  requirementId: string;
  refNo: number;
  requirement: string;
  cycle: number;
  fileName: string;
  uploadedBy: string;
  auditeeNote?: string | null;
  ai?: { verdict: string; confidence: number; summary: string; gaps: string[]; suggestedComment: string } | null;
  reviewLink: string; // signed
};

export function uploadCard(i: UploadCardInput, interactive: boolean): Card {
  const reqUrl = `${appUrl()}/audits/${i.auditId}/requirements/${i.requirementId}`;
  const fileUrl = `${appUrl()}/api/files/${i.docId}`;
  const body: unknown[] = [
    ...header(`📂 New file uploaded${i.cycle > 1 ? ` (resubmission #${i.cycle})` : ""}`, `${i.auditName} · ${i.auditCode}`),
    {
      type: "FactSet",
      facts: [
        fact("Item Ref#", String(i.refNo)),
        fact("Requirement", i.requirement),
        fact("File", i.fileName),
        fact("Uploaded by", i.uploadedBy),
        ...(i.auditeeNote ? [fact("Auditee note", i.auditeeNote)] : []),
      ],
    },
  ];
  if (i.ai) {
    body.push({
      type: "Container",
      style: "emphasis",
      spacing: "Medium",
      items: [
        { type: "TextBlock", text: `🤖 AI pre-screen: ${VERDICT_TEXT[i.ai.verdict] ?? i.ai.verdict} (${Math.round(i.ai.confidence * 100)}%)`, weight: "Bolder", wrap: true },
        { type: "TextBlock", text: i.ai.summary, wrap: true, spacing: "Small" },
        ...(i.ai.gaps.length ? [{ type: "TextBlock", text: "Missing: " + i.ai.gaps.map((g) => `\n- ${g}`).join(""), wrap: true, spacing: "Small" }] : []),
      ],
    });
  }

  if (!interactive) {
    return card(body, [
      { type: "Action.OpenUrl", title: "Review & decide", url: i.reviewLink },
      { type: "Action.OpenUrl", title: "📄 Open file", url: fileUrl },
      { type: "Action.OpenUrl", title: "📁 Open item", url: reqUrl },
    ]);
  }

  const suggested = verdictToDecision(i.ai?.verdict);
  body.push(
    {
      type: "Input.ChoiceSet",
      id: "decision",
      label: "Select received status",
      isRequired: true,
      errorMessage: "Choose a status",
      value: suggested,
      choices: (Object.keys(DECISION_LABEL) as ReviewDecision[]).map((k) => ({ title: DECISION_LABEL[k], value: k })),
    },
    {
      type: "Input.Text",
      id: "comment",
      label: "Auditor comments",
      isMultiline: true,
      placeholder: "Enter your comments here…",
      value: i.ai && suggested !== "ACCEPTED" ? i.ai.suggestedComment : "",
    },
  );
  return card(body, [
    { type: "Action.Execute", title: "Submit decision", verb: "review", style: "positive", data: { docId: i.docId } },
    { type: "Action.OpenUrl", title: "📄 Open file", url: fileUrl },
    { type: "Action.OpenUrl", title: "📁 Open item", url: reqUrl },
  ]);
}

export function decidedCard(i: { auditName: string; auditCode: string; refNo: number; requirement: string; fileName: string; decision: ReviewDecision; reviewer: string; comment?: string | null; at: Date }): Card {
  const icon = i.decision === "ACCEPTED" ? "✅" : i.decision === "PARTIAL" ? "🟠" : "↩️";
  return card([
    ...header(`${icon} Item ${i.refNo}: ${DECISION_LABEL[i.decision]}`, `${i.auditName} · ${i.auditCode}`),
    {
      type: "FactSet",
      facts: [
        fact("Requirement", i.requirement),
        fact("File", i.fileName),
        fact("Reviewed by", `${i.reviewer} · ${fmtDate(i.at)}`),
        ...(i.comment ? [fact("Comments", i.comment)] : []),
      ],
    },
  ]);
}

export function auditeeDecisionCard(i: { auditName: string; auditCode: string; auditId: string; requirementId: string; refNo: number; requirement: string; decision: ReviewDecision; comment?: string | null; ownerName?: string }): Card {
  const back = i.decision !== "ACCEPTED";
  return card(
    [
      ...header(back ? `↩️ Action needed on item ${i.refNo}` : `✅ Item ${i.refNo} accepted`, `${i.auditName} · ${i.auditCode}`),
      { type: "TextBlock", text: i.requirement, wrap: true },
      ...(i.comment ? [{ type: "TextBlock", text: `**Auditor:** ${i.comment}`, wrap: true }] : []),
      ...(i.ownerName ? [{ type: "TextBlock", text: `Owner: ${i.ownerName}`, isSubtle: true, wrap: true }] : []),
    ],
    back ? [{ type: "Action.OpenUrl", title: "Upload updated document", url: `${appUrl()}/portal?item=${i.requirementId}` }] : [],
  );
}

export function reminderCard(i: { auditName: string; auditCode: string; ownerName: string; message: string; items: { refNo: number; title: string; dueDate: Date; status: string }[] }): Card {
  return card(
    [
      ...header(`⏰ Reminder for ${i.ownerName}`, `${i.auditName} · ${i.auditCode}`),
      { type: "TextBlock", text: i.message, wrap: true },
      {
        type: "FactSet",
        facts: i.items.map((it) => fact(`#${it.refNo} · due ${fmtDate(it.dueDate)}`, it.title)),
      },
    ],
    [{ type: "Action.OpenUrl", title: "Open my items", url: `${appUrl()}/portal` }],
  );
}

export function lorIssuedCard(i: { auditName: string; auditCode: string; auditId: string; count: number; planning: number; execution: number; firstDue: Date | null }): Card {
  return card(
    [
      ...header(`📋 List of Requirements issued`, `${i.auditName} · ${i.auditCode}`),
      {
        type: "FactSet",
        facts: [
          fact("Items requested", String(i.count)),
          fact("Planning phase", String(i.planning)),
          fact("Execution phase", String(i.execution)),
          fact("First due date", fmtDate(i.firstDue)),
        ],
      },
      { type: "TextBlock", text: "Please upload documents against each item in the audit portal. You will be notified here when items are reviewed.", wrap: true },
    ],
    [{ type: "Action.OpenUrl", title: "Open audit portal", url: `${appUrl()}/portal` }],
  );
}
