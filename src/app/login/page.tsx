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

const STEPS = [
  { n: "1", title: "Issue the LOR", text: "Paste or upload the list of requirements. AI splits it into items, assigns the phase and proposes due dates." },
  { n: "2", title: "Auditee uploads", text: "Each owner sees only their requests in the portal and uploads evidence to the shared repository." },
  { n: "3", title: "Review in Teams", text: "The auditor gets a Teams card with an AI pre-screen and accepts, partially accepts or returns the document." },
  { n: "4", title: "Track to closure", text: "Returned items go back to the auditee automatically. Dashboards show completion against the audit timeline." },
];

const FEATURES = [
  { icon: "📊", title: "Live dashboards", text: "Documents requested, received and pending review, completion % and timeline % for every audit, with no manual refresh." },
  { icon: "🗓️", title: "Phase-aware timeline", text: "Planning, Execution and Reporting windows with a today marker, overdue flags and on-track / at-risk / behind health." },
  { icon: "🤖", title: "AI agents", text: "LOR intake, document pre-screening against each request, and a follow-up agent that drafts reminders for you to approve." },
  { icon: "💬", title: "Microsoft Teams workflow", text: "Notifications and approvals where your team already works: upload alerts, decisions and reminders as interactive cards." },
  { icon: "📁", title: "Shared evidence repository", text: "One folder per audit and item, every version kept per review cycle, with a full audit trail of who did what and when." },
  { icon: "📅", title: "Three dates, always", text: "Date requested, date received and date reviewed are recorded for every item and every cycle, ready to export." },
];

export default async function Landing({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;

  return (
    <div className="-mx-4 sm:-mx-6 -mt-6 overflow-x-hidden">
      {/* Hero */}
      <section className="bg-brand text-white">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-10 pb-16 grid lg:grid-cols-[1.25fr_1fr] gap-10 items-center">
          <div>
            <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-medium tracking-wide">Internal Audit · List of Requirements</span>
            <h1 className="mt-4 text-3xl sm:text-5xl font-semibold leading-tight">
              Every audit document, requested, received and reviewed in one place.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-white/80 max-w-xl">
              LOR Tracker replaces spreadsheets and email chasing with one workflow from the first request to the last
              review, connected to Microsoft Teams and supported by AI.
            </p>
            <div className="mt-8 grid grid-cols-3 max-w-md gap-4 text-center">
              {[["3", "audit phases tracked"], ["1", "shared repository"], ["0", "manual status reports"]].map(([v, l]) => (
                <div key={l} className="rounded-lg bg-white/5 py-3">
                  <div className="text-2xl font-semibold tnum">{v}</div>
                  <div className="text-xs text-white/70">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <form action={login} id="signin" className="rounded-2xl bg-white text-ink p-6 sm:p-8 shadow-xl space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Sign in</h2>
              <p className="text-sm text-ink-2 mt-1">Enter the access password provided by the audit team.</p>
            </div>
            <input type="hidden" name="next" value={next ?? "/"} />
            <label className="block">
              <span className="label">Password</span>
              <input type="password" name="password" required autoFocus className="input mt-1" placeholder="••••••••" />
            </label>
            {error && <p className="text-sm text-[var(--critical)]">Incorrect password. Please try again.</p>}
            <button className="btn btn-primary w-full justify-center py-2.5">Sign in</button>
            <p className="text-xs text-ink-3">Auditees: after signing in, open <b>My requests</b> to see the documents assigned to you.</p>
          </form>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 -mt-8">
        <div className="card p-4 sm:p-6 shadow-lg">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { k: "LOR completion", v: "75%", w: 75 },
              { k: "Audit timeline", v: "46%", w: 46 },
              { k: "Pending review", v: "5", w: 20 },
              { k: "Overdue items", v: "3", w: 12 },
            ].map((x) => (
              <div key={x.k} className="rounded-lg bg-surface p-3">
                <div className="text-xs text-ink-2">{x.k}</div>
                <div className="text-2xl font-semibold tnum">{x.v}</div>
                <div className="mt-2 h-1.5 rounded-full bg-[var(--track)]">
                  <div className="h-1.5 rounded-full bg-[var(--series-1)]" style={{ width: `${x.w}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2" aria-hidden>
            {[
              ["Budgeting", 4, 22, 30],
              ["Procurement", 8, 26, 28],
              ["Human Resources", 0, 24, 26],
            ].map(([label, start, p, e]) => (
              <div key={label as string} className="flex items-center gap-3 text-xs">
                <span className="w-20 sm:w-28 shrink-0 text-ink-2 truncate">{label}</span>
                <div className="relative flex-1 h-5">
                  <div className="absolute h-5 rounded bg-[#b7d3f6]" style={{ left: `${start}%`, width: `${Number(p) - Number(start)}%` }} />
                  <div className="absolute h-5 rounded bg-[#5598e7]" style={{ left: `${Number(p) + 1}%`, width: `${e}%` }} />
                  <div className="absolute h-5 rounded bg-[#1c5cab]" style={{ left: `${Number(p) + Number(e) + 2}%`, width: "14%" }} />
                  <span className="absolute top-[-4px] bottom-[-4px] border-l-2 border-[var(--critical)]" style={{ left: "38%" }} />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3 pt-1 sm:pl-[124px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#b7d3f6]" />Planning</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#5598e7]" />Execution</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-[#1c5cab]" />Reporting</span>
              <span className="flex items-center gap-1"><span className="h-2.5 border-l-2 border-[var(--critical)]" />Today</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16">
        <h2 className="text-2xl sm:text-3xl font-semibold text-center">How it works</h2>
        <p className="text-center text-ink-2 mt-2">The same cycle for every requirement, repeated until the auditor accepts the evidence.</p>
        <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s) => (
            <li key={s.n} className="card p-5">
              <span className="grid place-items-center w-9 h-9 rounded-full bg-brand text-white font-semibold">{s.n}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-line">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16">
          <h2 className="text-2xl sm:text-3xl font-semibold text-center">Built for audit teams and auditees</h2>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4">
                <span className="text-2xl shrink-0" aria-hidden>{f.icon}</span>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-ink-2">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-[1200px] px-4 sm:px-6 py-14 text-center">
        <h2 className="text-2xl font-semibold">Ready to check your audit status?</h2>
        <a href="#signin" className="btn btn-primary mt-5 px-6 py-2.5">Sign in to LOR Tracker</a>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 text-xs text-ink-3 flex flex-wrap justify-between gap-2">
          <span>{process.env.ORG_NAME ?? "Internal Audit"} · LOR Tracker</span>
          <span>Confidential: for authorised audit and auditee users only.</span>
        </div>
      </footer>
    </div>
  );
}
