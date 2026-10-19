import type Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import * as XLSX from "xlsx";

type Block = Anthropic.Beta.BetaContentBlockParam;

const MAX_TEXT = 400_000; // chars — well inside the 1M-token context

// Turn an uploaded evidence file into content blocks Claude can read.
export async function fileToBlocks(fileName: string, mime: string, data: Buffer): Promise<{ blocks: Block[]; readable: boolean }> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";

  if (mime === "application/pdf" || ext === "pdf") {
    return {
      readable: true,
      blocks: [{ type: "document", title: fileName, source: { type: "base64", media_type: "application/pdf", data: data.toString("base64") } }],
    };
  }
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    const media = (ext === "jpg" ? "image/jpeg" : `image/${ext}`) as "image/png" | "image/jpeg" | "image/gif" | "image/webp";
    return { readable: true, blocks: [{ type: "image", source: { type: "base64", media_type: media, data: data.toString("base64") } }] };
  }

  let text: string | null = null;
  if (ext === "docx") {
    text = (await mammoth.extractRawText({ buffer: data })).value;
  } else if (["xlsx", "xls", "xlsm", "csv"].includes(ext)) {
    const wb = XLSX.read(data, { type: "buffer" });
    text = wb.SheetNames.map((n) => `### Sheet: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n");
  } else if (["txt", "md", "json", "xml", "html"].includes(ext)) {
    text = data.toString("utf8");
  }

  if (text === null) return { readable: false, blocks: [] };
  if (text.length > MAX_TEXT) {
    // Tell the model explicitly rather than silently truncating.
    text = text.slice(0, MAX_TEXT) + `\n\n[NOTE: file truncated at ${MAX_TEXT} characters of ${text.length}]`;
  }
  return { readable: true, blocks: [{ type: "text", text: `<file name="${fileName}">\n${text}\n</file>` }] };
}

// Parse an uploaded LOR spreadsheet into plain text for the intake agent.
export function spreadsheetToText(data: Buffer) {
  const wb = XLSX.read(data, { type: "buffer" });
  return wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n])).join("\n");
}
