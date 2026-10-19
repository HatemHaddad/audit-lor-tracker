import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

// Shared evidence repository. Local disk for dev; swap these two functions for
// Azure Blob Storage / SharePoint (Graph driveItem upload) in production.
const ROOT = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.STORAGE_DIR ?? "storage");

const safe = (s: string) => s.replace(/[^\w.\- ]+/g, "_").slice(0, 120);

export async function saveFile(parts: { auditCode: string; refNo: number; cycle: number; fileName: string }, data: Buffer) {
  const dir = path.join(ROOT, safe(parts.auditCode), `REQ-${String(parts.refNo).padStart(3, "0")}`);
  await mkdir(dir, { recursive: true });
  const stored = path.join(dir, `c${parts.cycle}-${Date.now()}-${safe(parts.fileName)}`);
  await writeFile(stored, data);
  return path.relative(ROOT, stored);
}

export async function readStored(storedPath: string) {
  const full = path.resolve(/* turbopackIgnore: true */ ROOT, storedPath);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid path");
  return readFile(full);
}
