import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import {
  createStripeClient,
  handleCorsPreflight,
  jsonResponse,
} from "../_shared/stripe.ts";
import { ensureStripeCustomer } from "../_shared/ensure-stripe-customer.ts";

const DEFAULT_ORIGIN =
  Deno.env.get("EMPLOYER_PORTAL_ORIGIN") ?? "https://www.gogreenstreets.org";

const ALLOWED_HOSTS = new Set([
  "www.gogreenstreets.org",
  "gogreenstreets.org",
  "www.shiftatwork.org",
  "shiftatwork.org",
  "localhost",
]);

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

  let body: { return_url?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

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

  const { data: group, error: groupErr } = await userSupabase
    .from("groups")
    .select("id, name, tier, stripe_customer_id, admin_email")
    .eq("admin_email", email)
    .limit(1)
    .maybeSingle();
  if (groupErr) {
    console.error("[BillingPortal] group lookup failed:", groupErr);
    return jsonResponse({ error: "Lookup failed" }, 500);
  }
  if (!group) {
    return jsonResponse({ error: "No employer group linked" }, 403);
  }

  let stripe: ReturnType<typeof createStripeClient>;
  try {
    stripe = createStripeClient();
  } catch (err) {
    console.error("[BillingPortal] Stripe client init failed:", err);
    return jsonResponse({ error: "Stripe not configured" }, 500);
  }

  const admin = createAdminClient();

  let customerId: string;
  try {
    customerId = await ensureStripeCustomer(stripe, admin, {
      id: group.id,
      name: group.name,
      admin_email: group.admin_email ?? email,
      stripe_customer_id: group.stripe_customer_id,
    });
  } catch (err) {
    console.error("[BillingPortal] customer creation failed:", err);
    return jsonResponse({ error: "Could not set up billing" }, 500);
  }

  // Resolve return URL
  let returnUrl = `${DEFAULT_ORIGIN}/shift/employers/portal/billing`;
  if (typeof body.return_url === "string") {
    try {
      const u = new URL(body.return_url);
      if (ALLOWED_HOSTS.has(u.hostname)) returnUrl = body.return_url;
    } catch {
      // fall through to default
    }
  }

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    console.log(
      `[BillingPortal] Session for group ${group.id} (${group.name})`,
    );
    return jsonResponse({ url: portalSession.url });
  } catch (err) {
    console.error("[BillingPortal] portal session create failed:", err);
    return jsonResponse({ error: "Could not open billing portal" }, 502);
  }
});
