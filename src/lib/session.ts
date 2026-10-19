import { cookies } from "next/headers";
import { db } from "./db";

// Demo identity: "act as" a seeded user via a cookie.
// Production: replace with Microsoft Entra ID SSO (Auth.js / MSAL) and map the
// signed-in UPN to User.email.
export async function currentUser() {
  const jar = await cookies();
  const uid = jar.get("uid")?.value;
  const user = uid ? await db.user.findUnique({ where: { id: uid } }) : null;
  return user ?? (await db.user.findFirst({ where: { role: "AUDITOR" }, orderBy: { name: "asc" } }));
}
