# Audit LOR Tracker

A full-stack replacement for the Power Apps / Power Automate / Power BI setup that runs the
internal-audit **List of Requirements (LOR)** process: the auditor issues requests, the auditee uploads
evidence to a shared repository, the auditor reviews in Microsoft Teams, and dashboards track
completion against the audit timeline (Planning → Execution → Reporting).

**Stack:** Next.js 16 (App Router, TypeScript) · Prisma (SQLite in dev, PostgreSQL in prod) · Tailwind ·
Recharts · Claude AI agents (`@anthropic-ai/sdk`) · Microsoft Teams (Bot Framework + Adaptive Cards).

## The workflow

```
Auditor issues LOR ──► item PENDING  (date requested)
                          │  auditee uploads in the portal
                          ▼
                 UPLOADED – pending review (date received)
                          │  🤖 AI pre-screens the file, Teams card goes to the audit channel
                          ▼
     auditor decides in Teams (or in the app)  (date reviewed)
       ├─ Received ............ RECEIVED (closed)
       ├─ Partially received .. PARTIAL  ─┐ comment sent to the auditee in Teams,
       └─ Reject .............. REJECTED ─┘ cycle + 1, auditee re-uploads … (repeats)
```

Every step is in the audit trail; every file version is kept per cycle.

## What's included

| Area | Where |
|---|---|
| Portfolio dashboard: uploaded gauge, pending review, % pending, LOR completion, timeline %, requested vs received by area, receipt table with health, audit Gantt | `/` |
| Per-audit dashboard: review status, phase breakdown, schedule with today marker, filterable LOR table with the three dates, CSV export, activity | `/audits/[id]` |
| Requirement page: dates, feedback, upload, review, version history, audit trail | `/audits/[id]/requirements/[rid]` |
| Auditee portal: "my requests", overdue, auditor feedback, drag-and-drop upload | `/portal` |
| New audit + AI LOR intake (paste text or upload Excel/CSV) | `/audits/new` |
| Teams card log + integration status | `/teams` |
| Signed one-click review page (from Teams webhook cards) | `/review/[docId]?t=…` |

### AI agents (Claude, `src/lib/agents/`)

- **LOR intake agent** (`intake.ts`): turns a raw LOR (email text, Word list, Excel export) into clean items with a phase and a due date inside the audit windows. Uses structured outputs.
- **Document review agent** (`review.ts`): reads each upload (PDF, Word, Excel, CSV, images) against the request and returns a verdict (sufficient / partial / insufficient / unreadable), the gaps and a draft comment. The verdict pre-selects the status in the Teams card. **A human always makes the decision.**
- **Follow-up agent** (`followup.ts`): a tool-using agent that inspects outstanding items against the timeline, decides who to chase, writes one consolidated reminder per owner and a status brief for the lead auditor. In the app it **drafts** reminders for approval; the daily scheduler (`/api/cron/followup`) sends them.

Without `ANTHROPIC_API_KEY` every agent falls back to rule-based logic, so the app still works.

### Teams (`src/lib/teams/`)

Two delivery options; use either or both:

1. **Teams bot (recommended)**: interactive Adaptive Card with *Select received status* + *Auditor comments* + *Submit decision* (Action.Execute). The card updates in place to show the outcome. Only users whose Teams email matches an auditor account can decide.
2. **Channel webhook**: posts the same card with *Review & decide / Open file / Open item* buttons. The review button opens a signed, expiring link.

Cards sent: new LOR issued, new file uploaded (with AI pre-screen), decision (to the auditee), reminders. Each card is also logged in `/teams`.

## Run locally

```bash
npm install
cp .env.example .env        # optional: add ANTHROPIC_API_KEY
npm run setup               # create the DB and load demo data (7 audits, 380+ items)
npm run dev                 # http://localhost:3000
```

The demo has no login. Use the **user switcher** in the top bar to act as an auditor or an auditee.
(For the demo data to look like your current reports, set `APP_TODAY="2026-10-19"`.)

## Deploy on your own VPS (Docker)

Needs Ubuntu/Debian with ports 80 and 443 open. For HTTPS (required by the Teams bot), point a domain's DNS A record at the server first.

```bash
ssh you@your-server
git clone https://github.com/HatemHaddad/audit-lor-tracker.git
cd audit-lor-tracker
bash deploy.sh lor.yourdomain.com     # or just: bash deploy.sh   (HTTP on the server IP)
```

`deploy.sh` installs Docker if it's missing and creates `.env.production` with random secrets and a **site password**, which it prints. It then starts two containers: the app, and Caddy (automatic Let's Encrypt HTTPS). The database and uploaded files live in the `lor-data` Docker volume.

- **Settings:** edit `.env.production` (API key, Teams, password), then run `docker compose up -d`.
- **Update:** `git pull && bash deploy.sh`
- **Logs:** `docker compose logs -f app`
- **Backup:** `docker run --rm -v audit-lor-tracker_lor-data:/d -v $PWD:/b alpine tar czf /b/lor-backup.tgz -C /d .`
- **Demo data:** loads on first start only when the database is empty (`SEED_DEMO=1`). Set `SEED_DEMO=0` before the first start for a clean system.
- **Daily reminders:** `deploy.sh` prints the crontab line to add.

## Deploy (managed cloud)

1. **Database:** create Azure Database for PostgreSQL (or Neon/Supabase). In `prisma/schema.prisma` set `provider = "postgresql"`, then set `DATABASE_URL` and run `npx prisma db push`.
2. **App:** deploy to Azure App Service / Container Apps (Node 20+) or Vercel. Set the variables from `.env.example`. Set `APP_URL` to the public URL.
3. **File storage:** `src/lib/storage.ts` writes to local disk. On serverless hosting, replace `saveFile`/`readStored` with Azure Blob Storage or SharePoint (Microsoft Graph). It is about 20 lines.
4. **Sign-in:** replace `src/lib/session.ts` (demo cookie) with Microsoft Entra ID SSO (Auth.js `microsoft-entra-id` provider), mapping the user's email to `User.email`.
5. **Scheduler:** call `GET /api/cron/followup` daily with `Authorization: Bearer $CRON_SECRET` (Vercel Cron, an Azure Functions timer, or a GitHub Actions schedule).

### Connect Teams: bot

1. Azure portal → **Azure Bot** → create (single tenant). Copy the App ID, create a client secret and note the tenant ID → set `MICROSOFT_APP_ID`, `MICROSOFT_APP_PASSWORD` and `MICROSOFT_APP_TENANT_ID`.
2. In the bot's Configuration, set the **Messaging endpoint** to `https://<your-host>/api/teams/messages`. Under Channels, enable **Microsoft Teams**.
3. In `teams-app/manifest.json`, replace `{{MICROSOFT_APP_ID}}`, `{{APP_URL}}` and `{{APP_HOST}}`. Zip `manifest.json`, `color.png` and `outline.png`, then upload it in Teams Admin Center (or *Apps → Manage your apps → Upload*).
4. Add the app to the audit team's channel. The bot remembers the channel. Type `@LOR Tracker bind FPM-2026` to restrict a channel to one audit.

### Connect Teams: webhook only

In the Teams channel → **Workflows** → *Post to a channel when a webhook request is received* → copy the URL into `TEAMS_WEBHOOK_URL`.

## Project layout

```
prisma/schema.prisma      data model: User, Audit, Requirement, Document (versions + AI + review), Activity, Teams
prisma/seed.ts            demo data
src/lib/workflow.ts       the LOR state machine (upload, decision, issue LOR)
src/lib/status.ts         statuses + dashboard metrics (completion %, timeline %, health)
src/lib/agents/           Claude agents
src/lib/teams/            Adaptive Cards, delivery, bot
src/app/                  pages, API routes, server actions
teams-app/                Teams app manifest + icons
```

## Metric definitions

- **LOR completion %** = items received (accepted) or N/A ÷ items requested
- **Documents pending %** = items still with the auditee (pending, partial, returned) ÷ requested
- **Audit timeline %** = days elapsed since planning start ÷ total days to reporting end
- **Health**: *On track* if completion is within 10 points of timeline %, *At risk* within 30, otherwise *Behind*
- **Overdue** = still with the auditee and past the due date
