import { db } from "@/lib/db";
import { NewAuditForm } from "@/components/NewAuditForm";
import { now } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function NewAudit() {
  const owners = await db.user.findMany({ where: { role: "AUDITEE" }, orderBy: { name: "asc" }, select: { id: true, name: true, department: true } });
  return (
    <div className="max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">New audit & List of Requirements</h1>
      <NewAuditForm owners={owners} today={now().toISOString().slice(0, 10)} />
    </div>
  );
}
