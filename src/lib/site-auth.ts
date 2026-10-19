// Optional site-wide password (APP_PASSWORD) for internet-facing deployments
// until Entra ID SSO is wired in. Uses Web Crypto so it runs in the proxy.
export const SITE_COOKIE = "lor_site";

export const sitePasswordEnabled = () => Boolean(process.env.APP_PASSWORD);

export async function siteToken() {
  const data = new TextEncoder().encode(`${process.env.APP_PASSWORD}|${process.env.APP_SECRET ?? ""}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}
