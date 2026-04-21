/**
 * Employer Customer Portal Session — Edge Function
 *
 * Creates a Stripe Billing Portal Session so the employer admin can
 * update their card, view invoices, or cancel their subscription.
 * Called from the portal's "Manage billing" button.
 *
 * Request body:
 *   { return_url?: string }   // optional; defaults to the portal home
 *
 * Response: { url: string }   // Stripe-hosted portal URL to redirect to
 *
 * Auth: JWT required (deployed WITH jwt verification). We derive the
 *       caller's email from the verified session and look up their
 *       group by admin_email — no user input trusted for identity.
 *
 * Prerequisite: the group must have a stripe_customer_id. Comped /
 * invoiced groups (no Stripe relationship) get a 409 error so the UI
 * can show a "Contact GSI to renew" fallback instead.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createStripeClient,
  handleCorsPreflight,
  jsonResponse,
} from "../_shared/stripe.ts";

const PORTAL_ORIGIN =
  Deno.env.get("EMPLOYER_PORTAL_ORIGIN") ?? "https://www.gogreenstreets.org";

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  // Use the caller's JWT (not service role) so we can't leak across
  // users even if admin_email ever got spoofed upstream.
  const userSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !userData.user?.email) {
    return jsonResponse({ error: "Unauthenticated" }, 401);
  }
  const email = userData.user.email.toLowerCase();

  // Request body (optional return_url override)
  let body: { return_url?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — we'll use the default return URL.
  }

  const { data: group, error: groupErr } = await userSupabase
    .from("groups")
    .select("id, name, stripe_customer_id")
    .eq("admin_email", email)
    .limit(1)
    .maybeSingle();

  if (groupErr) {
    console.error("[EmployerPortalSession] group lookup failed:", groupErr);
    return jsonResponse({ error: "Lookup failed" }, 500);
  }
  if (!group) {
    return jsonResponse({ error: "No employer group linked" }, 403);
  }
  if (!group.stripe_customer_id) {
    // Comped / invoiced group — no Stripe relationship. UI falls back
    // to the "Contact GSI" mailto.
    return jsonResponse({ error: "No Stripe subscription on file" }, 409);
  }

  // Validate return_url against our host allow-list.
  const allowedHosts = new Set([
    "www.gogreenstreets.org",
    "gogreenstreets.org",
    "localhost",
  ]);
  let returnUrl = `${PORTAL_ORIGIN}/shift/employers/portal`;
  if (typeof body.return_url === "string") {
    try {
      const u = new URL(body.return_url);
      if (allowedHosts.has(u.hostname)) {
        returnUrl = body.return_url;
      }
    } catch {
      // invalid — stick with default
    }
  }

  let stripe: ReturnType<typeof createStripeClient>;
  try {
    stripe = createStripeClient();
  } catch (err) {
    console.error("[EmployerPortalSession] Stripe client init failed:", err);
    return jsonResponse({ error: "Stripe not configured" }, 500);
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: group.stripe_customer_id,
      return_url: returnUrl,
    });
    console.log(
      `[EmployerPortalSession] Portal session for ${email} (${group.name})`,
    );
    return jsonResponse({ url: portalSession.url });
  } catch (err) {
    console.error(
      "[EmployerPortalSession] billingPortal.sessions.create failed:",
      err,
    );
    return jsonResponse({ error: "Portal session creation failed" }, 502);
  }
});
