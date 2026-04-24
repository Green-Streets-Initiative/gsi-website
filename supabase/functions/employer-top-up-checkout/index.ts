/**
 * Employer Top-Up Checkout — Edge Function
 *
 * Creates a Stripe Checkout Session for an employer admin to fund (or
 * top up) their reward_pool. Called from the portal's "Top up pool"
 * button at /shift/employers/portal.
 *
 * Flow:
 *   1. Verify the caller's Supabase JWT — derive admin email.
 *   2. Find their group by admin_email; require tier='premium' + a
 *      stripe_customer_id (employers on other tiers don't currently
 *      fund reward pools).
 *   3. Find-or-create a reward_pools row for the group (owner_type=
 *      'employer'). A pool is created lazily here so admins don't
 *      need ops to provision it.
 *   4. Create a Stripe Checkout session in mode='payment' (one-time)
 *      tied to the group's existing Stripe customer — invoices then
 *      group under the same customer as the subscription.
 *      line_items: price_data with product "Shift reward pool top-up"
 *      and unit_amount = requested cents.
 *      metadata.type='reward_pool_topup' plus pool_id / group_id /
 *      amount_cents so the webhook can find and credit the pool.
 *   5. 302 via response { url } → Stripe hosts the card entry.
 *
 * Pairing:
 *   - employer-webhook handles `checkout.session.completed` and
 *     switches on metadata.type to route reward_pool_topup sessions
 *     to the pool credit logic (vs subscription-start logic).
 *
 * Auth: JWT required (deployed WITH verify_jwt). We pull the caller's
 *       email from the verified session and look up the group by
 *       admin_email — never trust client-supplied group or pool ids.
 *
 * Request body: { amount_cents: number, origin?: string }
 * Response:     { url: string }  Stripe-hosted checkout URL
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import {
  createStripeClient,
  handleCorsPreflight,
  jsonResponse,
} from "../_shared/stripe.ts";

const DEFAULT_ORIGIN =
  Deno.env.get("EMPLOYER_PORTAL_ORIGIN") ?? "https://www.gogreenstreets.org";

const ALLOWED_HOSTS = new Set([
  "www.gogreenstreets.org",
  "gogreenstreets.org",
  "localhost",
]);

// Guardrails: $25 floor (Stripe fees would eat anything smaller) /
// $10,000 ceiling per top-up. Ops can bump the ceiling later if
// employers routinely fund larger pools.
const MIN_CENTS = 2500;
const MAX_CENTS = 1_000_000;

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

  let body: { amount_cents?: unknown; origin?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const amountCents =
    typeof body.amount_cents === "number"
      ? Math.round(body.amount_cents)
      : Number(body.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return jsonResponse(
      {
        error: `amount_cents must be between ${MIN_CENTS} and ${MAX_CENTS}`,
      },
      400,
    );
  }

  // Verify caller via their JWT — never trust client-supplied identity.
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

  // Group lookup via user JWT (RLS) so cross-employer leaks are
  // impossible even if admin_email somehow collides.
  const { data: group, error: groupErr } = await userSupabase
    .from("groups")
    .select("id, name, tier, stripe_customer_id, admin_email")
    .eq("admin_email", email)
    .limit(1)
    .maybeSingle();
  if (groupErr) {
    console.error("[TopUpCheckout] group lookup failed:", groupErr);
    return jsonResponse({ error: "Lookup failed" }, 500);
  }
  if (!group) {
    return jsonResponse({ error: "No employer group linked" }, 403);
  }
  if (!group.stripe_customer_id) {
    return jsonResponse(
      { error: "Group has no Stripe customer on file" },
      409,
    );
  }
  if (group.tier !== "premium") {
    return jsonResponse(
      { error: "Reward pool funding is a Premium-tier feature" },
      403,
    );
  }

  // Find or lazily create the reward_pool. Writes use the service
  // role because reward_pools has server-only RLS (no employer SELECT/
  // INSERT policies). Lazy create avoids an ops-blocking step.
  const admin = createAdminClient();

  const { data: existingPool, error: poolLookupErr } = await admin
    .from("reward_pools")
    .select("id, active")
    .eq("owner_type", "employer")
    .eq("owner_group_id", group.id)
    .limit(1)
    .maybeSingle();
  if (poolLookupErr) {
    console.error("[TopUpCheckout] pool lookup failed:", poolLookupErr);
    return jsonResponse({ error: "Pool lookup failed" }, 500);
  }

  let poolId: string;
  if (existingPool) {
    if (!existingPool.active) {
      return jsonResponse({ error: "Reward pool is suspended" }, 409);
    }
    poolId = existingPool.id;
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from("reward_pools")
      .insert({
        name: `${group.name} rewards pool`,
        owner_type: "employer",
        owner_group_id: group.id,
        stripe_customer_id: group.stripe_customer_id,
        balance_cents: 0,
        lifetime_funded_cents: 0,
        active: true,
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      console.error("[TopUpCheckout] pool create failed:", insertErr);
      return jsonResponse({ error: "Pool create failed" }, 500);
    }
    poolId = inserted.id;
  }

  // Resolve redirect origin.
  const originRaw = typeof body.origin === "string" ? body.origin : "";
  let resolvedOrigin = DEFAULT_ORIGIN;
  if (originRaw) {
    try {
      const u = new URL(originRaw);
      if (ALLOWED_HOSTS.has(u.hostname)) resolvedOrigin = u.origin;
    } catch {
      // fall through to default
    }
  }

  let stripe: ReturnType<typeof createStripeClient>;
  try {
    stripe = createStripeClient();
  } catch (err) {
    console.error("[TopUpCheckout] Stripe client init failed:", err);
    return jsonResponse({ error: "Stripe not configured" }, 500);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: group.stripe_customer_id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Shift reward pool top-up — ${group.name}`,
              description:
                "Adds funds to your Shift rewards pool. Redeemable by your employees as gift cards and transit passes.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "reward_pool_topup",
        pool_id: poolId,
        group_id: group.id,
        amount_cents: String(amountCents),
      },
      // Come back to the portal with a flag so the UI can show a
      // confirmation banner. Webhook has already credited by then.
      success_url: `${resolvedOrigin}/shift/employers/portal?topup=success`,
      cancel_url: `${resolvedOrigin}/shift/employers/portal?topup=canceled`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 2,
    });

    if (!session.url) {
      console.error("[TopUpCheckout] session created without URL:", session.id);
      return jsonResponse({ error: "Checkout URL unavailable" }, 502);
    }

    console.log(
      `[TopUpCheckout] Session ${session.id} for pool ${poolId} ($${amountCents / 100})`,
    );
    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("[TopUpCheckout] checkout.sessions.create failed:", err);
    return jsonResponse({ error: "Checkout creation failed" }, 502);
  }
});
