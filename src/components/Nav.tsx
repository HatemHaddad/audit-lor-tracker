import Link from "next/link";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { switchUser } from "@/app/actions";
import { now, fmtDate } from "@/lib/status";

export async function Nav() {
  const [user, users] = await Promise.all([currentUser(), db.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] })]);
  const org = process.env.ORG_NAME ?? "Internal Audit";
  const links =
    user?.role === "AUDITEE"
      ? [{ href: "/portal", label: "My requests" }]
      : [
          { href: "/", label: "Dashboard" },
          { href: "/audits", label: "Audits" },
          { href: "/portal", label: "Auditee portal" },
          { href: "/teams", label: "Teams activity" },
        ];
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold whitespace-nowrap">
          <span className="grid place-items-center w-7 h-7 rounded-md bg-white/15 text-sm">LOR</span>
          <span className="hidden sm:inline">{org} · LOR Tracker</span>
        </Link>
        <nav className="flex gap-1 text-sm overflow-x-auto">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="px-3 py-1.5 rounded-md hover:bg-white/10 whitespace-nowrap">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden md:inline text-white/70">as on {fmtDate(now())}</span>
          <form action={switchUser} className="flex items-center gap-2">
            <select name="uid" defaultValue={user?.id} className="bg-white/10 rounded-md px-2 py-1 text-white text-sm max-w-[220px]" aria-label="Acting as">
              {users.map((u) => (
                <option key={u.id} value={u.id} className="text-black">
                  {u.name} ({u.role.toLowerCase()})
                </option>
              ))}
            </select>
            <button className="px-2 py-1 rounded-md bg-white/15 hover:bg-white/25">Switch</button>
          </form>
        </div>
      </div>
    </header>
  );
}
