import { NextResponse, after } from "next/server";
import { recordUpload, processUpload, WorkflowError } from "@/lib/workflow";
import { currentUser } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  const requirementId = String(form.get("requirementId") ?? "");
  const note = String(form.get("note") ?? "") || null;
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!requirementId || !files.length) return NextResponse.json({ error: "Choose at least one file." }, { status: 400 });

  const user = await currentUser();
  try {
    const docs: Awaited<ReturnType<typeof recordUpload>>[] = [];
    for (const f of files) {
      docs.push(
        await recordUpload({
          requirementId,
          fileName: f.name,
          mimeType: f.type,
          data: Buffer.from(await f.arrayBuffer()),
          uploaderId: user?.id ?? null,
          note,
        }),
      );
    }
    // AI pre-screen + Teams notification run after the response is sent.
    after(async () => {
      for (const d of docs) {
        try {
          await processUpload(d.id);
        } catch (err) {
          console.error("[upload] post-processing failed", d.id, err);
        }
      }
    });
    return NextResponse.json({ ok: true, documents: docs.map((d) => ({ id: d.id, fileName: d.fileName })) });
  } catch (err) {
    if (err instanceof WorkflowError) return NextResponse.json({ error: err.message }, { status: 400 });
    throw err;
  }
}
