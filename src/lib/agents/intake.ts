import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, MODEL, FALLBACK, aiEnabled } from "./client";

// LOR Intake Agent: turns whatever the auditor pastes or uploads (email text,
// Word list, Excel export) into clean, phased, dated requirements.

const IntakeSchema = z.object({
  requirements: z.array(
    z.object({
      title: z.string().describe("The requirement, rewritten as one clear, self-contained request"),
      phase: z.enum(["PLANNING", "EXECUTION", "REPORTING"]),
      dueDate: z.string().describe("YYYY-MM-DD"),
      ownerHint: z.string().describe("Department or role most likely to own this item; empty if unclear"),
    }),
  ),
  notes: z.string().describe("Anything the auditor should double-check (duplicates, vague items); empty if none"),
});
export type IntakeResult = z.infer<typeof IntakeSchema>;

type Window = { planningStart: string; planningEnd: string; executionStart: string; executionEnd: string };

const SYSTEM = `You are the LOR intake assistant for an internal audit team. The auditor gives you a raw List of Requirements (LOR) — the documents they need from the auditee.

Produce one entry per distinct document request, preserving the auditor's order and meaning. Split an item only when it clearly asks for unrelated documents; never invent requests that are not in the source. Keep wording professional and specific (include periods/years mentioned).

Phase assignment: items needed to understand the area (strategy, policies, org charts, DoA, risk registers, prior reports, process descriptions) belong to PLANNING. Items that are samples, transaction evidence, reconciliations, approvals, minutes or detailed testing support belong to EXECUTION. REPORTING is rare (management responses, action plans).

Due dates: PLANNING items are due 5 working days after the planning start; EXECUTION items are due 5 working days after the execution start, unless the source states otherwise. Never set a due date after the phase ends.`;

export async function runIntakeAgent(rawLor: string, win: Window): Promise<IntakeResult> {
  if (!aiEnabled()) return heuristicIntake(rawLor, win);

  const res = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(IntakeSchema) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Audit windows: planning ${win.planningStart} → ${win.planningEnd}; execution ${win.executionStart} → ${win.executionEnd}.\n\n<lor>\n${rawLor}\n</lor>`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined to process this LOR.");
  if (res.stop_reason === "max_tokens") throw new Error("The LOR is too long for one pass — split it into two uploads.");
  if (!res.parsed_output) throw new Error("Could not parse the LOR.");
  return res.parsed_output;
}

// Offline fallback: one requirement per non-empty line, numbering stripped.
function heuristicIntake(raw: string, win: Window): IntakeResult {
  const planningWords = /strateg|polic|procedure|organi[sz]ation|structure|delegation|charter|risk|framework|methodology|kpi|plan\b/i;
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(\d+[.)\-:]?|[-*•])\s*/, "").replace(/^"|"$/g, "").trim())
    .filter((l) => l.length > 8);
  const due = (start: string) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  };
  return {
    requirements: lines.map((title) => {
      const phase = planningWords.test(title) ? "PLANNING" : "EXECUTION";
      return { title, phase, dueDate: due(phase === "PLANNING" ? win.planningStart : win.executionStart), ownerHint: "" };
    }),
    notes: "AI is not configured (no ANTHROPIC_API_KEY) — parsed line by line with keyword-based phases.",
  };
}
