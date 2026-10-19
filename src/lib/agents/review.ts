import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, MODEL, FALLBACK, aiEnabled, describeApiError } from "./client";
import { fileToBlocks } from "../extract";

// Document Review Agent: pre-screens each upload against the requirement so the
// auditor sees a recommendation (and draft comment) in the Teams card.

const ReviewSchema = z.object({
  verdict: z.enum(["SUFFICIENT", "PARTIAL", "INSUFFICIENT", "UNREADABLE"]),
  confidence: z.number().describe("0 to 1"),
  summary: z.string().describe("2-3 sentences: what the file actually contains"),
  gaps: z.array(z.string()).describe("Specific things the requirement asks for that are missing; empty if none"),
  suggestedComment: z.string().describe("A short, polite comment the auditor could send back to the auditee"),
});
export type ReviewResult = z.infer<typeof ReviewSchema>;

const SYSTEM = `You pre-screen evidence that an auditee uploaded in response to an internal-audit document request. You do not make the final decision — a human auditor does — so be precise and calibrated.

Judge only whether the file responds to the request: right document type, right period/years, complete (e.g. all years, signatures/approvals when the request asks for "approved"), readable. Do not audit the content itself.

SUFFICIENT: fully answers the request. PARTIAL: relevant but something requested is missing (name it in gaps). INSUFFICIENT: wrong or irrelevant document. UNREADABLE: empty, corrupt or you cannot see its contents.`;

export async function runReviewAgent(input: {
  requirement: string;
  phase: string;
  previousComments: string | null;
  fileName: string;
  mime: string;
  data: Buffer;
  auditeeNote: string | null;
}): Promise<{ status: "DONE" | "SKIPPED" | "ERROR"; result?: ReviewResult; error?: string }> {
  if (!aiEnabled()) return { status: "SKIPPED", error: "AI not configured" };

  const { blocks, readable } = await fileToBlocks(input.fileName, input.mime, input.data);
  if (!readable) {
    return {
      status: "DONE",
      result: {
        verdict: "UNREADABLE",
        confidence: 1,
        summary: `File type of "${input.fileName}" cannot be pre-screened automatically.`,
        gaps: [],
        suggestedComment: "",
      },
    };
  }

  try {
    const res = await claude().beta.messages.parse({
      model: MODEL,
      max_tokens: 4000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(ReviewSchema) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...blocks,
            {
              type: "text",
              text: [
                `<request phase="${input.phase}">${input.requirement}</request>`,
                input.previousComments ? `<earlier_auditor_feedback>${input.previousComments}</earlier_auditor_feedback>` : "",
                input.auditeeNote ? `<auditee_note>${input.auditeeNote}</auditee_note>` : "",
                `File name: ${input.fileName}`,
              ].join("\n"),
            },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) {
      return { status: "ERROR", error: "Model could not assess this file" };
    }
    return { status: "DONE", result: res.parsed_output };
  } catch (err) {
    return { status: "ERROR", error: describeApiError(err) };
  }
}
