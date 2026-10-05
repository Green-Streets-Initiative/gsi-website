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

  let body: { return_url?: unknown; flow?: unknown };
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

  const { data: adminRow, error: adminErr } = await userSupabase
    .from("group_admins")
    .select("group_id, role, groups!inner(id, name, tier, stripe_customer_id, stripe_subscription_id, admin_email)")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  if (adminErr) {
    console.error("[BillingPortal] group lookup failed:", adminErr);
    return jsonResponse({ error: "Lookup failed" }, 500);
  }
  if (!adminRow) {
    return jsonResponse({ error: "No employer group linked" }, 403);
  }
  if (adminRow.role !== "admin") {
    return jsonResponse({ error: "Admin role required for billing" }, 403);
  }
  const group = adminRow.groups as unknown as {
    id: string;
    name: string;
    tier: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    admin_email: string | null;
  };

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

  // `flow` opens Stripe's portal on one screen instead of the overview:
  //   cancel          -> cancel the subscription (at period end when the
  //                      portal configuration says so: Settings -> Billing ->
  //                      Customer portal -> Cancellations)
  //   update          -> switch plan (needs "Customers can switch plans" with
  //                      the employer products in that same configuration)
  //   payment_method  -> add or replace the card
  // Stripe refuses a flow its configuration does not allow, or one that needs
  // a subscription the customer does not have. For cancel and update we then
  // say so (`unavailable`) rather than open the overview, which has no way to
  // do what the admin asked; the portal shows a sentence and an email link.
  const flow = body.flow === "cancel" || body.flow === "update" || body.flow === "payment_method"
    ? body.flow
    : null;
  const subscriptionId = group.stripe_subscription_id;
  try {
    let portalSession;
    if (flow === "cancel" || flow === "update") {
      if (!subscriptionId) {
        return jsonResponse({ unavailable: flow, reason: "no_subscription" });
      }
      try {
        portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
          flow_data: flow === "cancel"
            ? {
              type: "subscription_cancel",
              subscription_cancel: { subscription: subscriptionId },
              after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
            }
            : {
              type: "subscription_update",
              subscription_update: { subscription: subscriptionId },
            },
        });
      } catch (err) {
        console.warn(`[BillingPortal] ${flow} flow refused for group ${group.id}:`, err);
        return jsonResponse({ unavailable: flow, reason: "refused" });
      }
    } else if (flow === "payment_method") {
      try {
        portalSession = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: returnUrl,
          flow_data: {
            type: "payment_method_update",
            after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
          },
        });
      } catch (err) {
        // The overview has the payment method too; fall through to it.
        console.warn(`[BillingPortal] payment_method flow refused for group ${group.id}:`, err);
      }
    }
    if (!portalSession) {
      portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
    }
    console.log(
      `[BillingPortal] Session for group ${group.id} (${group.name})${flow ? ` [${flow} flow]` : ""}`,
    );
    return jsonResponse({ url: portalSession.url });
  } catch (err) {
    console.error("[BillingPortal] portal session create failed:", err);
    return jsonResponse({ error: "Could not open billing portal" }, 502);
  }
});
