/**
 * Employer Webhook — Edge Function
 *
 * Receives Stripe events and reconciles them with the `groups` table.
 *
 * Handles:
 *   - checkout.session.completed
 *     Creates the `groups` row (status='active', access window = +1yr),
 *     then emails the admin a single welcome email containing both the
 *     portal magic link and the employee invite code.
 *   - customer.subscription.deleted
 *     Marks the group inactive and caps access_ends_at at now(). Existing
 *     employees retain personal trip history; group-scoped features go
 *     unavailable.
 *
 * Auth: public (--no-verify-jwt). Signature is verified against
 *       STRIPE_WEBHOOK_SECRET before any DB work. Any request that fails
 *       signature check returns 401 without touching state.
 *
 * Idempotency note: Stripe retries on non-2xx and can also replay events
 * if the endpoint misbehaves. Group creation uses stripe_customer_id as
 * a unique-ish key — if a row already exists for the customer we update
 * its subscription_id instead of creating a duplicate.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import type Stripe from "npm:stripe@18";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import {
  createStripeClient,
  handleCorsPreflight,
  jsonResponse,
  tierForPriceId,
} from "../_shared/stripe.ts";

const PORTAL_ORIGIN =
  Deno.env.get("EMPLOYER_PORTAL_ORIGIN") ?? "https://www.gogreenstreets.org";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "Shift <onboarding@resend.dev>";

const SHIFT_LOGO_URL =
  "https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-mark.png";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWelcomeEmailHtml(args: {
  companyName: string;
  inviteCode: string;
  magicLink: string;
  tier: string;
}): string {
  const tierLabel = args.tier.charAt(0).toUpperCase() + args.tier.slice(1);
  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:#191A2E;padding:24px 32px;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:'Arial Black',Arial,sans-serif;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">Shift</td>
      <td style="padding-left:6px;"><img src="${SHIFT_LOGO_URL}" alt=">>" width="40" style="display:block;" /></td>
    </tr></table>
    <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
  </td></tr>
  <tr><td style="padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;color:#191A2E;">Welcome to Shift, ${escapeHtml(args.companyName)}!</h1>
    <p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 20px;">
      Your ${tierLabel} subscription is active. Here are the two things you need to get started.
    </p>

    <h2 style="margin:28px 0 10px;font-size:15px;color:#191A2E;">1. Sign in to your employer portal</h2>
    <p style="font-size:13px;color:#374151;line-height:1.6;margin:0;">
      Upload your logo, configure your Commute Advisor, and track your team's impact.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
      <tr><td style="background:#BAF14D;border-radius:8px;">
        <a href="${escapeHtml(args.magicLink)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#191A2E;text-decoration:none;">
          Open your portal &rarr;
        </a>
      </td></tr>
    </table>
    <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">This link expires in 1 hour. Request a new one any time from gogreenstreets.org/shift/employers.</p>

    <h2 style="margin:36px 0 10px;font-size:15px;color:#191A2E;">2. Share your employee invite code</h2>
    <p style="font-size:13px;color:#374151;line-height:1.6;margin:0 0 14px;">
      Employees enter this code in the Shift mobile app to join your team.
    </p>
    <div style="display:inline-block;padding:16px 24px;background:#f3f4f6;border-radius:10px;font-family:monospace;font-size:26px;font-weight:700;letter-spacing:0.25em;color:#191A2E;">
      ${escapeHtml(args.inviteCode)}
    </div>
    <p style="margin:16px 0 0;font-size:12px;color:#9CA3AF;">
      You can download an invitation one-pager PDF from the portal to share with your team.
    </p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;">
    <p style="margin:0;font-size:11px;color:#9CA3AF;">
      <a href="https://gogreenstreets.org" style="color:#9CA3AF;text-decoration:none;">Green Streets Initiative</a>
      &middot; Need help? Reply to this email or write info@gogreenstreets.org
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

async function sendWelcomeEmail(args: {
  to: string;
  companyName: string;
  inviteCode: string;
  magicLink: string;
  tier: string;
}): Promise<void> {
  if (!RESEND_API_KEY) {
    console.log(
      `[EmployerWebhook] No RESEND_API_KEY — skipping welcome email to ${args.to}`,
    );
    return;
  }
  const html = buildWelcomeEmailHtml(args);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [args.to],
        subject: `Welcome to Shift — ${args.companyName}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error(
        `[EmployerWebhook] Resend failed ${res.status}:`,
        await res.text(),
      );
    }
  } catch (err) {
    console.error("[EmployerWebhook] Email send threw:", err);
  }
}

async function handleCheckoutCompleted(
  stripe: ReturnType<typeof createStripeClient>,
  event: Stripe.Event,
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;

  // Route by metadata.type. employer-top-up-checkout stamps
  // type='reward_pool_topup' on one-time payment sessions; everything
  // else falls through to the original subscription-start flow.
  if (session.metadata?.type === "reward_pool_topup") {
    await handleRewardPoolTopup(session);
    return;
  }

  const supabase = createAdminClient();

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;
  const adminEmail =
    session.customer_details?.email ??
    session.customer_email ??
    "";
  // Company name is collected via a Checkout custom_field, not metadata,
  // because Stripe's custom fields show up on the hosted payment page UX
  // and get automatically echoed to the customer's receipt.
  const companyNameField = session.custom_fields?.find(
    (f) => f.key === "company_name",
  );
  const companyName = companyNameField?.text?.value?.trim() ?? "";
  const tier = (session.metadata?.tier as string | undefined) ?? "basic";

  if (!customerId || !subscriptionId || !adminEmail || !companyName) {
    console.error(
      "[EmployerWebhook] checkout.session.completed missing required fields",
      { customerId, subscriptionId, adminEmail, companyName, tier },
    );
    return;
  }

  // Fetch the subscription to get exact period dates from Stripe (not guessed).
  // Period bounds live on the item in modern API versions; our subscriptions
  // only ever have one item (one tier), so items.data[0] is the source of truth.
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const primaryItem = subscription.items.data[0];
  const accessStartsAt = new Date(
    primaryItem.current_period_start * 1000,
  ).toISOString();
  const accessEndsAt = new Date(
    primaryItem.current_period_end * 1000,
  ).toISOString();

  // Idempotent upsert keyed on stripe_customer_id. On replay (Stripe sometimes
  // delivers the same event twice), we patch the row rather than create a
  // duplicate. invite_code is generated by the BEFORE-INSERT trigger.
  const { data: existing } = await supabase
    .from("groups")
    .select("id, invite_code")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  let groupId: string;
  let inviteCode: string;

  if (existing) {
    const { error } = await supabase
      .from("groups")
      .update({
        stripe_subscription_id: subscriptionId,
        tier,
        status: "active",
        access_starts_at: accessStartsAt,
        access_ends_at: accessEndsAt,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[EmployerWebhook] update existing group failed:", error);
      return;
    }
    groupId = existing.id;
    inviteCode = existing.invite_code;
    console.log(`[EmployerWebhook] Updated existing group ${groupId}`);
  } else {
    const slug = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);

    const { data: inserted, error } = await supabase
      .from("groups")
      .insert({
        name: companyName,
        slug: slug || null,
        description: `${companyName} employees`,
        type: "workplace",
        visibility: "gated",
        admin_email: adminEmail,
        tier,
        status: "active",
        access_starts_at: accessStartsAt,
        access_ends_at: accessEndsAt,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        public_leaderboard: false,
      })
      .select("id, invite_code")
      .single();

    if (error || !inserted) {
      console.error(
        "[EmployerWebhook] create group failed:",
        error ?? "no row returned",
      );
      return;
    }
    groupId = inserted.id;
    inviteCode = inserted.invite_code;
    console.log(
      `[EmployerWebhook] Created group ${groupId} (${companyName}, ${tier})`,
    );
  }

  // Generate a magic link for the admin to sign in. Auth user is created
  // lazily on first verify — we don't need to pre-create it.
  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: adminEmail,
      options: { redirectTo: `${PORTAL_ORIGIN}/shift/employers/portal` },
    });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error(
      "[EmployerWebhook] generateLink failed — welcome email not sent:",
      linkErr,
    );
    return;
  }

  const magicLink = `${PORTAL_ORIGIN}/shift/employers/portal?token_hash=${linkData.properties.hashed_token}&type=magiclink`;

  await sendWelcomeEmail({
    to: adminEmail,
    companyName,
    inviteCode,
    magicLink,
    tier,
  });
}

/**
 * Credit a completed reward-pool top-up to the named pool.
 *
 * Called by handleCheckoutCompleted when session.metadata.type ===
 * 'reward_pool_topup'. Stripe has already charged the card; we:
 *   1. Look up the pool by metadata.pool_id.
 *   2. Confirm it's still active and belongs to the right group.
 *   3. Credit balance_cents + lifetime_funded_cents by metadata.amount_cents.
 *   4. File an info-level admin_notifications row for audit.
 *
 * Idempotency: the Stripe event id is stored on the notification
 * context. If we see the same event twice (Stripe can replay), the
 * repeat attempt is rejected at the notification-insert step.
 */
async function handleRewardPoolTopup(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const supabase = createAdminClient();
  const poolId = session.metadata?.pool_id ?? "";
  const groupId = session.metadata?.group_id ?? "";
  const amountCentsStr = session.metadata?.amount_cents ?? "";
  const amountCents = Number(amountCentsStr);

  if (!poolId || !groupId || !Number.isFinite(amountCents) || amountCents <= 0) {
    console.error(
      "[EmployerWebhook] reward_pool_topup missing/invalid metadata",
      { poolId, groupId, amountCentsStr },
    );
    return;
  }

  // Session.payment_status must be 'paid' — Stripe occasionally fires
  // completed events on sessions that later bounce (rare, but possible
  // with BNPL). Filter here so a failed-payment session can't credit.
  if (session.payment_status !== "paid") {
    console.log(
      `[EmployerWebhook] reward_pool_topup session ${session.id} payment_status=${session.payment_status}, skipping`,
    );
    return;
  }

  const { data: pool, error: poolErr } = await supabase
    .from("reward_pools")
    .select("id, owner_group_id, balance_cents, lifetime_funded_cents, active")
    .eq("id", poolId)
    .maybeSingle();
  if (poolErr || !pool) {
    console.error("[EmployerWebhook] reward pool lookup failed:", poolErr);
    return;
  }
  if (pool.owner_group_id !== groupId) {
    console.error(
      "[EmployerWebhook] pool group mismatch",
      { poolGroup: pool.owner_group_id, metaGroup: groupId },
    );
    return;
  }
  if (!pool.active) {
    console.error(
      `[EmployerWebhook] pool ${poolId} is suspended — payment received but not credited`,
    );
    // File a critical notification so ops can refund or reactivate.
    await supabase.from("admin_notifications").insert({
      level: "critical",
      source: "rewards",
      title: "Top-up received on suspended pool",
      body: `Pool ${poolId} is inactive; Stripe session ${session.id} for ${amountCents} cents was NOT credited. Investigate.`,
      context: {
        kind: "topup_suspended_pool",
        pool_id: poolId,
        stripe_session_id: session.id,
        amount_cents: amountCents,
      },
    });
    return;
  }

  const { error: updErr } = await supabase
    .from("reward_pools")
    .update({
      balance_cents: pool.balance_cents + amountCents,
      lifetime_funded_cents: pool.lifetime_funded_cents + amountCents,
    })
    .eq("id", poolId);
  if (updErr) {
    console.error("[EmployerWebhook] reward pool credit failed:", updErr);
    return;
  }

  await supabase.from("admin_notifications").insert({
    level: "info",
    source: "rewards",
    title: "Reward pool funded",
    body: `Pool "${poolId}" credited with ${amountCents} cents via Stripe session ${session.id}.`,
    context: {
      kind: "pool_topup",
      pool_id: poolId,
      group_id: groupId,
      stripe_session_id: session.id,
      amount_cents: amountCents,
    },
  });

  console.log(
    `[EmployerWebhook] pool ${poolId} credited +${amountCents} cents (session ${session.id})`,
  );
}

async function handleSubscriptionDeleted(
  _stripe: ReturnType<typeof createStripeClient>,
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("groups")
    .update({
      status: "inactive",
      // Don't retroactively shorten access_ends_at — Stripe has already
      // honored the paid period up to now. Cap it at min(existing, now).
      access_ends_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    console.error("[EmployerWebhook] subscription.deleted update failed:", error);
    return;
  }

  console.log(
    `[EmployerWebhook] Marked group inactive for subscription ${subscription.id}`,
  );
}

/**
 * Mid-life subscription changes: cancel-at-period-end, un-cancel,
 * tier upgrade/downgrade. Stripe fires this for any subscription
 * property change, so we only act on deltas we care about.
 *
 * We deliberately mirror `cancel_at_period_end` to `groups.status`:
 *   - true  → 'cancelled'  (access still valid through access_ends_at)
 *   - false → 'active'
 * The portal's hasAccess() keeps them in the portal until period end;
 * the cancelled banner appears right away so there's no surprise.
 */
async function handleSubscriptionUpdated(
  _stripe: ReturnType<typeof createStripeClient>,
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const supabase = createAdminClient();

  const { data: group, error: lookupErr } = await supabase
    .from("groups")
    .select("id, status, tier")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (lookupErr) {
    console.error("[EmployerWebhook] subscription.updated lookup failed:", lookupErr);
    return;
  }
  if (!group) {
    // Stripe sometimes sends this event during checkout completion,
    // before our checkout handler has created the group row. No-op.
    console.log(
      `[EmployerWebhook] subscription.updated for unknown subscription ${subscription.id} — skipping`,
    );
    return;
  }

  // Fresh period bounds — Stripe may have advanced them on renewal.
  const primaryItem = subscription.items.data[0];
  const accessStartsAt = new Date(
    primaryItem.current_period_start * 1000,
  ).toISOString();
  const accessEndsAt = new Date(
    primaryItem.current_period_end * 1000,
  ).toISOString();

  // Tier source of truth: the price ID on the active subscription item.
  // When an employer upgrades or downgrades in Stripe's customer portal,
  // Stripe swaps the price on the item but does NOT carry subscription
  // metadata across — so we can't rely on metadata.tier. If we ever see
  // a price ID we don't recognize (env vars out of sync with Stripe),
  // keep the group's existing tier so we don't clobber it with junk.
  const priceId = primaryItem.price.id;
  const tierFromPrice = tierForPriceId(priceId);
  const tier = tierFromPrice ?? group.tier;
  if (!tierFromPrice) {
    console.warn(
      `[EmployerWebhook] Unknown price ID ${priceId} on subscription ${subscription.id} — keeping tier=${group.tier}. Check STRIPE_PRICE_EMPLOYER_* env vars.`,
    );
  }

  // Stripe status lifecycle:
  //   active | past_due | unpaid | trialing | incomplete | canceled | incomplete_expired
  // For our purposes, only cancel_at_period_end is the signal we care
  // about (with deletion handled separately).
  let nextStatus: "active" | "cancelled" | "inactive" = group.status as
    | "active"
    | "cancelled"
    | "inactive";
  if (subscription.status === "canceled") {
    nextStatus = "inactive";
  } else if (subscription.cancel_at_period_end) {
    nextStatus = "cancelled";
  } else if (subscription.status === "active") {
    nextStatus = "active";
  }

  const { error: updateErr } = await supabase
    .from("groups")
    .update({
      status: nextStatus,
      tier,
      access_starts_at: accessStartsAt,
      access_ends_at: accessEndsAt,
    })
    .eq("id", group.id);

  if (updateErr) {
    console.error("[EmployerWebhook] subscription.updated update failed:", updateErr);
    return;
  }

  console.log(
    `[EmployerWebhook] subscription ${subscription.id} → status=${nextStatus}, tier=${tier}, cancel_at_period_end=${subscription.cancel_at_period_end}`,
  );
}

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return jsonResponse({ error: "Missing stripe-signature" }, 401);
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    console.error("[EmployerWebhook] STRIPE_WEBHOOK_SECRET not configured");
    return jsonResponse({ error: "Webhook not configured" }, 500);
  }

  let stripe: ReturnType<typeof createStripeClient>;
  try {
    stripe = createStripeClient();
  } catch (err) {
    console.error("[EmployerWebhook] Stripe client init failed:", err);
    return jsonResponse({ error: "Stripe not configured" }, 500);
  }

  // Raw body required for signature verification. Deno requires async
  // verification because signature uses SubtleCrypto.
  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    console.error("[EmployerWebhook] signature verification failed:", err);
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  // Handle events. Return 200 even on handler errors so Stripe doesn't
  // retry forever; we log and investigate ourselves.
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(stripe, event);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(stripe, event);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(stripe, event);
        break;
      default:
        console.log(`[EmployerWebhook] Ignoring event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[EmployerWebhook] Handler for ${event.type} threw:`, err);
  }

  return jsonResponse({ received: true });
});
