import { createHmac, timingSafeEqual } from "node:crypto";

// Signed links embedded in Teams cards so an auditor can open the review
// screen for one document straight from Teams.
const secret = () => process.env.APP_SECRET ?? "dev-secret-change-me";

export function signReviewToken(docId: string, reviewerId: string, ttlHours = 24 * 14) {
  const exp = Math.floor(Date.now() / 1000) + ttlHours * 3600;
  const payload = `${docId}.${reviewerId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function verifyReviewToken(token: string, docId: string) {
  try {
    const [d, reviewerId, exp, sig] = Buffer.from(token, "base64url").toString().split(".");
    if (d !== docId || Number(exp) < Date.now() / 1000) return null;
    const expected = createHmac("sha256", secret()).update(`${d}.${reviewerId}.${exp}`).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    return { reviewerId };
  } catch {
    return null;
  }
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
