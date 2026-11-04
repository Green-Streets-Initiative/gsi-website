/**
 * Employer Top-Up Checkout — Edge Function
 *
 * Creates a Stripe Checkout Session for an employer admin to fund (or
 * top up) their reward_pool. Called from the portal's "Top up pool"
 * button at /shift/employers/portal.
 *
 * Flow:
 *   1. Verify the caller's Supabase JWT — derive admin email.
 *   2. Find their group by admin_email; require tier standard or above
 *      (rewards moved from Premium-only into Standard on 2026-08-04).
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
 *
 * Funding one challenge (Shift 01291, Keith 2026-10-20): pass draft_id and
 * confirm_cents (the "sets aside now" amount the admin was shown) instead of
 * amount_cents. begin_employer_challenge_payment re-runs the pre-flight check
 * with the caller's identity and returns the amount to charge: exactly the
 * shortfall, $25 at least. The webhook launches the challenge when the money
 * lands. mode:
 *   'checkout'     (default) Stripe page; card or bank payment; the card is
 *                  saved for next time. Response { url }.
 *   'card_on_file' Response { card: { brand, last4 } | null }. Charges nothing.
 *   'saved_card'   Charges the saved card now and launches. Response
 *                  { launched, competition_id } or { needs_checkout, reason }.
 */
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

  let body: { amount_cents?: unknown; origin?: unknown; draft_id?: unknown; confirm_cents?: unknown; mode?: unknown; group_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const draftId = typeof body.draft_id === "string" && body.draft_id ? body.draft_id : null;
  const mode = body.mode === "saved_card" || body.mode === "card_on_file" ? body.mode : "checkout";
  let amountCents =
    typeof body.amount_cents === "number"
      ? Math.round(body.amount_cents)
      : Number(body.amount_cents);
  if (!draftId && (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS)) {
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

  // Funding a challenge: the database re-checks it as this admin and says
  // which workplace it belongs to and what to charge.
  let draftGroupId: string | null = null;
  if (draftId) {
    if (mode === "card_on_file") {
      const { data: d } = await userSupabase
        .from("employer_challenge_drafts")
        .select("group_id")
        .eq("id", draftId)
        .maybeSingle();
      draftGroupId = d?.group_id ?? null;
      amountCents = 0;
    } else {
      const { data: begun, error: beginErr } = await userSupabase.rpc("begin_employer_challenge_payment", {
        p_draft_id: draftId,
        p_confirm_cents: Number(body.confirm_cents),
        p_method: mode,
      });
      const b = begun as { ok?: boolean; reason?: string; group_id?: string; topup_cents?: number; check?: unknown } | null;
      if (beginErr || !b?.ok) {
        return jsonResponse({ error: b?.reason ?? beginErr?.message ?? "Could not start the payment", reason: b?.reason, check: b?.check }, 409);
      }
      draftGroupId = b.group_id ?? null;
      amountCents = Number(b.topup_cents);
      if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
        return jsonResponse({ error: `The amount to add has to be between $${MIN_CENTS / 100} and $${MAX_CENTS / 100}.` }, 400);
      }
    }
    if (!draftGroupId) return jsonResponse({ error: "Draft not found" }, 404);
  }

  let adminQuery = userSupabase
    .from("group_admins")
    .select("group_id, role, groups!inner(id, name, tier, stripe_customer_id, admin_email)")
    .eq("email", email);
  // A plain top-up names the workplace on screen (group_id); without it the
  // caller's first team row is used, as before.
  const askedGroupId =
    typeof body.group_id === "string" && /^[0-9a-f-]{36}$/i.test(body.group_id) ? body.group_id : null;
  if (draftGroupId) adminQuery = adminQuery.eq("group_id", draftGroupId);
  else if (askedGroupId) adminQuery = adminQuery.eq("group_id", askedGroupId);
  const { data: adminRow, error: adminErr } = await adminQuery.limit(1).maybeSingle();
  if (adminErr) {
    console.error("[TopUpCheckout] group lookup failed:", adminErr);
    return jsonResponse({ error: "Lookup failed" }, 500);
  }
  if (!adminRow) {
    return jsonResponse({ error: "No employer group linked" }, 403);
  }
  if (adminRow.role !== "admin") {
    return jsonResponse({ error: "Admin role required for billing" }, 403);
  }
  const group = adminRow.groups as unknown as { id: string; name: string; tier: string; stripe_customer_id: string | null; admin_email: string | null };
  if (group.tier !== "standard" && group.tier !== "premium") {
    return jsonResponse(
      { error: "Reward pool funding requires the Standard plan or above" },
      403,
    );
  }

  let stripe: ReturnType<typeof createStripeClient>;
  try {
    stripe = createStripeClient();
  } catch (err) {
    console.error("[TopUpCheckout] Stripe client init failed:", err);
    return jsonResponse({ error: "Stripe not configured" }, 500);
  }

  const admin = createAdminClient();

  // The sales-demo workplace (billing_type 'demo', Shift migration 01145) is
  // fictional: no Stripe customer, no checkout. Read with the service client,
  // so the employer's own column grants never decide this.
  const { data: billing } = await admin.from("groups").select("billing_type").eq("id", group.id).maybeSingle();
  if (billing?.billing_type === "demo") {
    return jsonResponse({ error: "This is a demo workplace, so adding funds is turned off." }, 409);
  }

  let customerId: string;
  try {
    customerId = await ensureStripeCustomer(stripe, admin, {
      id: group.id,
      name: group.name,
      admin_email: group.admin_email ?? email,
      stripe_customer_id: group.stripe_customer_id,
    });
  } catch (err) {
    console.error("[TopUpCheckout] customer creation failed:", err);
    return jsonResponse({ error: "Could not set up billing" }, 500);
  }

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
        stripe_customer_id: customerId,
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

  const metadata: Record<string, string> = {
    type: "reward_pool_topup",
    pool_id: poolId,
    group_id: group.id,
    amount_cents: String(amountCents),
  };
  if (draftId) metadata.draft_id = draftId;

  // The card on file: the subscription's default, else the newest card.
  async function cardOnFile(): Promise<{ id: string; brand: string; last4: string } | null> {
    const customer = await stripe.customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] });
    if (!("deleted" in customer && customer.deleted)) {
      const def = (customer as { invoice_settings?: { default_payment_method?: unknown } }).invoice_settings?.default_payment_method as
        | { id: string; type: string; card?: { brand: string; last4: string } }
        | null
        | undefined;
      if (def && typeof def === "object" && def.type === "card" && def.card) {
        return { id: def.id, brand: def.card.brand, last4: def.card.last4 };
      }
    }
    const list = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    const pm = list.data[0];
    return pm?.card ? { id: pm.id, brand: pm.card.brand, last4: pm.card.last4 } : null;
  }

  if (draftId && mode === "card_on_file") {
    try {
      const card = await cardOnFile();
      return jsonResponse({ card: card ? { brand: card.brand, last4: card.last4 } : null });
    } catch (err) {
      console.error("[TopUpCheckout] card lookup failed:", err);
      return jsonResponse({ card: null });
    }
  }

  if (draftId && mode === "saved_card") {
    const card = await cardOnFile().catch(() => null);
    if (!card) {
      await admin.rpc("fail_employer_challenge_payment", { p_draft_id: draftId, p_payment_ref: null, p_reason: "no_saved_card" });
      return jsonResponse({ needs_checkout: true, reason: "no_saved_card" });
    }
    let intent;
    try {
      intent = await stripe.paymentIntents.create(
        {
          amount: amountCents,
          currency: "usd",
          customer: customerId,
          payment_method: card.id,
          off_session: true,
          confirm: true,
          description: `Shift reward pool top-up — ${group.name}`,
          metadata: { ...metadata, saved_card: "1" },
        },
        // One charge per agreement: a double click reuses the first attempt.
        { idempotencyKey: `draft-topup-${draftId}-${amountCents}-${Math.floor(Date.now() / 600000)}` },
      );
    } catch (err) {
      const code = (err as { code?: string }).code ?? "card_error";
      console.error("[TopUpCheckout] saved card charge failed:", code);
      await admin.rpc("fail_employer_challenge_payment", { p_draft_id: draftId, p_payment_ref: null, p_reason: code });
      return jsonResponse({ needs_checkout: true, reason: code });
    }
    if (intent.status !== "succeeded") {
      await admin.rpc("fail_employer_challenge_payment", { p_draft_id: draftId, p_payment_ref: null, p_reason: intent.status });
      return jsonResponse({ needs_checkout: true, reason: intent.status });
    }
    await admin.rpc("attach_employer_challenge_payment", { p_draft_id: draftId, p_payment_ref: intent.id, p_method: "saved_card" });
    const { data: credited, error: creditErr } = await admin.rpc("credit_reward_pool_topup", {
      p_pool_id: poolId,
      p_group_id: group.id,
      p_amount_cents: amountCents,
      p_stripe_session_id: intent.id,
    });
    if (creditErr || (credited !== "credited" && credited !== "duplicate")) {
      // Charged but not credited: the webhook's payment_intent.succeeded
      // retries the credit; leave a trail either way.
      console.error("[TopUpCheckout] saved card credit failed:", creditErr ?? credited);
      await admin.from("admin_notifications").insert({
        level: "critical",
        source: "rewards",
        title: "Top-up charged but not credited",
        body: `Saved-card charge ${intent.id} for ${amountCents} cents (pool ${poolId}) was not credited: ${creditErr?.message ?? credited}.`,
        context: { kind: "topup_credit_failed", pool_id: poolId, group_id: group.id, stripe_payment_intent: intent.id, amount_cents: amountCents },
      });
      return jsonResponse({ error: "Your card was charged, but the balance didn't update. GSI has been alerted and will fix it." }, 500);
    }
    const { data: launched } = await admin.rpc("complete_employer_challenge_payment", { p_draft_id: draftId, p_payment_ref: intent.id });
    const l = launched as { ok?: boolean; reason?: string; competition_id?: string; check?: unknown } | null;
    return jsonResponse({ launched: !!l?.ok, competition_id: l?.competition_id ?? null, reason: l?.reason ?? null, charged_cents: amountCents });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: `Shift reward pool top-up — ${group.name}`,
              description:
                "Adds funds to your Shift rewards pool. Redeemable by your employees as gift cards and bank transfers.",
            },
          },
          quantity: 1,
        },
      ],
      metadata,
      // Funding a challenge saves the card, so the next shortfall is one
      // click ("Charge $X to the Visa ending 4242 and launch").
      ...(draftId ? { payment_intent_data: { setup_future_usage: "off_session" as const, metadata } } : {}),
      // Come back to the Billing page with a flag so it can show a
      // confirmation banner and refresh the balance (the portal root only
      // redirected to the dashboard and dropped the flag). Webhook has
      // already credited by then. A challenge's top-up comes back to the
      // Challenges page, which waits for the launch.
      success_url: draftId
        ? `${resolvedOrigin}/shift/employers/portal/challenges?draft=${draftId}&paid=1`
        : `${resolvedOrigin}/shift/employers/portal/billing?topup=success`,
      cancel_url: draftId
        ? `${resolvedOrigin}/shift/employers/portal/challenges?draft=${draftId}&paid=0`
        : `${resolvedOrigin}/shift/employers/portal/billing?topup=canceled`,
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 2,
    });

    if (!session.url) {
      console.error("[TopUpCheckout] session created without URL:", session.id);
      return jsonResponse({ error: "Checkout URL unavailable" }, 502);
    }

    if (draftId) {
      await admin.rpc("attach_employer_challenge_payment", { p_draft_id: draftId, p_payment_ref: session.id, p_method: "checkout" });
    }
    console.log(
      `[TopUpCheckout] Session ${session.id} for pool ${poolId} ($${amountCents / 100})${draftId ? ` draft ${draftId}` : ""}`,
    );
    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("[TopUpCheckout] checkout.sessions.create failed:", err);
    return jsonResponse({ error: "Checkout creation failed" }, 502);
  }
});
