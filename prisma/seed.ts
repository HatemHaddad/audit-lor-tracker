import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const db = new PrismaClient();
const STORAGE = path.resolve(process.env.STORAGE_DIR ?? "./storage");
const TODAY = new Date(process.env.APP_TODAY ?? new Date().toISOString().slice(0, 10));

// Deterministic PRNG so the demo looks the same every time
let s = 42;
const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const d = (iso: string) => new Date(iso + "T00:00:00Z");
const addDays = (dt: Date, n: number) => new Date(dt.getTime() + n * 86_400_000);

const FIN_ITEMS = [
  "Strategy and strategic plan, including defined long-term and short-term plans/goals and objectives; Strategic and Operations KPIs, targets vs actuals.",
  "Policies and procedures.",
  "Organizational structure, list of current staff including names, campus location and responsibilities (JDs).",
  "Delegation of authority (DoA) matrix.",
  "List of departmental committees with their charters, and minutes of the meetings (including presentations to the committees for 2024 and 2025).",
  "List of management performance reports submitted to Senior Management, indicating frequency, content and recipients.",
  "Training plan for staff vs actual (2024–2025), with training attendance records including topics, dates and attendance logs.",
  "Approved department budget and actual expenditures for 2024–2025, including variance explanations if applicable.",
  "Issued budget circulars, guidelines, templates, KPIs and submission timelines communicated to all departments, sectors and affiliates.",
  "Documentation describing the budgeting methodology (top-down, bottom-up, zero-based, rolling, or combination) and related management approval.",
  "Departmental budget submission files for the current and previous budget cycles (2024 & 2025).",
  "Evidence of how budget inputs are collected from departments (tracking logs, submission records, acknowledgments).",
  "Finalized departmental budget summaries showing CAPEX and OPEX breakdowns.",
  "Supporting agreements, contracts, or commitments considered in the budgeting process.",
  "Training materials, presentations, or communication provided by the budgeting team to departments on budget preparation.",
  "Correspondence or meeting minutes showing assistance or clarifications provided during budget preparation.",
  "Budget consolidation worksheets, models, or summary reports used to compile inputs from departments and affiliates.",
  "Evidence of budget review and approval by sector/division leaders (review notes, sign-offs, meeting minutes).",
];

const GENERIC_DOCS = [
  "Policies and procedures manual", "Organization chart and job descriptions", "Risk register and risk assessment",
  "KPI dashboard and performance reports", "Approved annual operating plan", "Committee charters and minutes",
  "Delegation of authority matrix", "Process flowcharts", "System user access listing", "Contracts and service agreements",
  "Vendor list and evaluation records", "Complaints and feedback log", "Training records and attendance logs",
  "Budget vs actual reports", "Internal control self-assessment", "Prior audit recommendations status",
  "Business continuity plan", "Records retention schedule", "Sample of approvals for transactions",
  "Reconciliations and supporting schedules", "Management reports to senior leadership", "Data privacy assessments",
];
const PERIODS = ["for 2024", "for 2025", "for 2024–2025", "for AY 2025/26", "for the last 12 months"];

const AREAS = [
  { code: "FIN-2026", name: "Budgeting and Financial Planning", dept: "Finance", total: 87, received: 65, review: 0, plan: ["2026-09-01", "2026-09-21"], exec: ["2026-09-22", "2026-11-20"], rep: ["2026-11-21", "2026-12-15"] },
  { code: "HR-2026", name: "Human Resources", dept: "Human Resources", total: 115, received: 35, review: 0, plan: ["2026-08-25", "2026-09-15"], exec: ["2026-09-16", "2026-11-05"], rep: ["2026-11-06", "2026-11-30"] },
  { code: "PROC-2026", name: "Procurement", dept: "Procurement", total: 81, received: 42, review: 5, plan: ["2026-09-01", "2026-09-20"], exec: ["2026-09-21", "2026-11-15"], rep: ["2026-11-16", "2026-12-10"] },
  { code: "IT-2026", name: "IT General Controls", dept: "Information Technology", total: 55, received: 0, review: 3, plan: ["2026-10-12", "2026-10-30"], exec: ["2026-11-01", "2026-12-15"], rep: ["2026-12-16", "2027-01-10"] },
  { code: "FAC-2026", name: "Facilities Management", dept: "Facilities", total: 49, received: 0, review: 0, plan: ["2026-10-19", "2026-11-06"], exec: ["2026-11-09", "2026-12-18"], rep: ["2027-01-04", "2027-01-25"] },
  { code: "GOV-2026", name: "Governance and Compliance", dept: "Legal and Compliance", total: 43, received: 0, review: 0, plan: ["2026-11-02", "2026-11-20"], exec: ["2026-11-23", "2027-01-15"], rep: ["2027-01-18", "2027-02-05"] },
  { code: "PR-2026", name: "Projects and Contracts", dept: "Projects Office", total: 38, received: 0, review: 0, plan: ["2026-11-09", "2026-11-27"], exec: ["2026-11-30", "2027-01-22"], rep: ["2027-01-25", "2027-02-12"] },
];

async function main() {
  // Safety: never wipe a database that already has audits unless forced.
  if ((await db.audit.count()) > 0 && !process.argv.includes("--force")) {
    console.log("Database already has data — skipping demo seed (use --force to reset).");
    return;
  }
  await db.outboxMessage.deleteMany();
  await db.activity.deleteMany();
  await db.document.deleteMany();
  await db.requirement.deleteMany();
  await db.audit.deleteMany();
  await db.teamsConversation.deleteMany();
  await db.user.deleteMany();
  await rm(STORAGE, { recursive: true, force: true });

  const auditors = await Promise.all(
    [
      { name: "Sarah Mitchell", email: "sarah.mitchell@example.com", role: "AUDITOR", department: "Internal Audit" },
      { name: "Daniel Brooks", email: "daniel.brooks@example.com", role: "AUDITOR", department: "Internal Audit" },
    ].map((data) => db.user.create({ data })),
  );
  const auditeeNames = [
    "Emma Clarke", "Liam Turner", "Olivia Bennett", "Noah Walker", "Ava Collins", "Ethan Price", "Mia Foster",
    "Lucas Reed", "Chloe Hayes", "Mason Ward", "Grace Porter", "Henry Shaw", "Isla Morgan", "Jack Ellis",
  ];
  const owners: Record<string, string[]> = {};
  let ai = 0;
  for (const a of AREAS) {
    owners[a.code] = [];
    for (let k = 0; k < 2; k++) {
      const name = auditeeNames[ai++];
      const u = await db.user.create({
        data: { name, email: name.toLowerCase().replace(/ /g, ".") + "@example.com", role: "AUDITEE", department: a.dept },
      });
      owners[a.code].push(u.id);
    }
  }

  for (const [idx, a] of AREAS.entries()) {
    const audit = await db.audit.create({
      data: {
        code: a.code,
        name: a.name,
        auditeeDept: a.dept,
        leadAuditorId: auditors[idx % 2].id,
        planningStart: d(a.plan[0]), planningEnd: d(a.plan[1]),
        executionStart: d(a.exec[0]), executionEnd: d(a.exec[1]),
        reportingStart: d(a.rep[0]), reportingEnd: d(a.rep[1]),
      },
    });
    const requested = d(a.plan[0]);
    if (requested > TODAY) continue; // LOR not issued yet for future audits

    const planCount = Math.round(a.total * 0.35);
    for (let i = 1; i <= a.total; i++) {
      const title =
        a.code === "FIN-2026" && i <= FIN_ITEMS.length
          ? FIN_ITEMS[i - 1]
          : `${GENERIC_DOCS[(i * 7 + idx) % GENERIC_DOCS.length]} ${PERIODS[(i + idx) % PERIODS.length]} (${a.name}, item ${i})`;
      const phase = i <= planCount ? "PLANNING" : "EXECUTION";
      const due = phase === "PLANNING" ? addDays(requested, 7) : addDays(d(a.exec[0]), 7);
      const ownerId = owners[a.code][i % 2];

      // Decide this item's state so totals match the dashboard
      let status = "PENDING";
      if (i <= a.received) status = "RECEIVED";
      else if (i <= a.received + a.review) status = "UPLOADED";
      else if (rnd() < 0.12 && a.received > 0) status = rnd() < 0.5 ? "PARTIAL" : "REJECTED";

      const uploaded = addDays(requested, 3 + Math.floor(rnd() * 25));
      const up = uploaded > TODAY ? addDays(TODAY, -1) : uploaded;
      const reviewed = addDays(up, 1 + Math.floor(rnd() * 4));
      const rv = reviewed > TODAY ? TODAY : reviewed;

      const req = await db.requirement.create({
        data: {
          auditId: audit.id, refNo: i, title, phase, ownerId, dueDate: due, dateRequested: requested, status,
          dateReceived: status === "PENDING" ? null : up,
          dateReviewed: ["RECEIVED", "PARTIAL", "REJECTED"].includes(status) ? rv : null,
          cycle: status === "PARTIAL" || status === "REJECTED" ? 2 : 1,
          lastComment: status === "PARTIAL" ? "Only 2025 provided — please also share the 2024 version." : status === "REJECTED" ? "File does not relate to this request; please upload the approved document." : null,
        },
      });

      if (status !== "PENDING") {
        const fileName = `REQ${i}-${a.code}-evidence.txt`;
        const rel = path.join(a.code, `REQ-${String(i).padStart(3, "0")}`, `c1-${fileName}`);
        await mkdir(path.dirname(path.join(STORAGE, rel)), { recursive: true });
        await writeFile(path.join(STORAGE, rel), `Sample evidence for ${a.code} item ${i}\n\n${title}\n`);
        const reviewStatus = status === "RECEIVED" ? "ACCEPTED" : status === "UPLOADED" ? "PENDING_REVIEW" : status;
        await db.document.create({
          data: {
            requirementId: req.id, cycle: 1, fileName, storedPath: rel, mimeType: "text/plain", size: 200,
            uploadedById: ownerId, uploadedAt: up,
            reviewStatus, reviewedById: reviewStatus === "PENDING_REVIEW" ? null : auditors[idx % 2].id,
            reviewedAt: reviewStatus === "PENDING_REVIEW" ? null : rv, reviewComment: req.lastComment,
            aiStatus: "SKIPPED",
          },
        });
      }
    }
    await db.activity.create({ data: { auditId: audit.id, actor: auditors[idx % 2].name, type: "REQUESTED", message: `Issued ${a.total} LOR items`, createdAt: requested } });
  }
  console.log("Seeded", AREAS.length, "audits");
}

main().finally(() => db.$disconnect());
