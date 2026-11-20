/**
 * Cloudflare Turnstile check for the website's own form routes (2026-11-20:
 * a data-licensing pitch arrived through the contact form about once a day
 * from rotating domains, and the hidden trap field didn't catch it).
 *
 * The Turnstile secret (TURNSTILE_SECRET_KEY) lives only in Supabase, where
 * Shift's email-subscriptions function already uses it for the sign-up forms.
 * The website's server routes (src/lib/server/human-check.ts) ask this
 * function instead of holding a second copy of the secret in Vercel.
 *
 * Auth: none (--no-verify-jwt). It only says whether a Turnstile token is
 * good, and each token works once, so a stranger calling it learns and gains
 * nothing.
 *
 * POST { token, ip? } → { ok: true } | { ok: false, reason } ; { ok: true,
 * off: true } when no secret is set.
 */

const VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) return json({ ok: true, off: true });

  let body: { token?: unknown; ip?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: "body" }, 400);
  }
  const token = typeof body.token === "string" ? body.token : "";
  if (!token || token.length > 4096) return json({ ok: false, reason: "no-token" });

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (typeof body.ip === "string" && body.ip) form.append("remoteip", body.ip.slice(0, 64));

  try {
    const res = await fetch(VERIFY, { method: "POST", body: form, signal: AbortSignal.timeout(5000) });
    const d = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (d.success) return json({ ok: true });
    const reason = (d["error-codes"] ?? []).join(",") || "refused";
    console.warn("[turnstile-verify] refused:", reason);
    return json({ ok: false, reason });
  } catch (e) {
    // Cloudflare unreachable: say so, and let the caller decide (the website lets the message through).
    console.error("[turnstile-verify] verify error:", (e as Error).message);
    return json({ ok: false, reason: "unreachable" }, 503);
  }
});
