import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_COOKIE, siteToken } from "@/lib/site-auth";

async function login(formData: FormData) {
  "use server";
  const next = String(formData.get("next") || "/");
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (String(formData.get("password")) !== process.env.APP_PASSWORD) {
    redirect(`/login?error=1&next=${encodeURIComponent(safeNext)}`);
  }
  (await cookies()).set(SITE_COOKIE, await siteToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_URL?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(safeNext);
}

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <form action={login} className="card p-6 max-w-sm mx-auto mt-16 space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <p className="text-sm text-ink-2">Enter the access password for the LOR Tracker.</p>
      <input type="hidden" name="next" value={next ?? "/"} />
      <input type="password" name="password" required autoFocus className="input" placeholder="Password" />
      {error && <p className="text-sm text-[var(--critical)]">Incorrect password.</p>}
      <button className="btn btn-primary w-full justify-center">Continue</button>
    </form>
  );
}
