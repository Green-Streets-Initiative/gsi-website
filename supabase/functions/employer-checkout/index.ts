/**
 * Employer Checkout — Edge Function
 *
 * Creates a Stripe Checkout Session for a new employer subscribing to the
 * Shift employer platform. Called from the marketing page pricing cards.
 *
 * Request body:
 *   {
 *     tier: 'basic' | 'standard' | 'premium',
 *     origin?: string         // optional: caller's origin for success/cancel URLs
 *                             //          (lets localhost dev work without redeploy)
 *   }
 *
 * The admin's email and company name are collected inside Stripe Checkout
 * itself — email is Stripe-native, company name uses a custom field. The
 * webhook reads both back off the completed session. This means the
 * marketing page can just be a button click, no pre-checkout form.
 *
 * Response: { url: string } — the Stripe-hosted checkout URL to redirect to.
 *
 * Auth: public (--no-verify-jwt). No Supabase account required at this stage;
 * the auth user is created later by the webhook's magic-link flow.
 *
 * Gotcha: the group row is NOT created here. That happens in the webhook once
 * payment succeeds. Creating it here would leak rows for abandoned checkouts.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createStripeClient,
  handleCorsPreflight,
  isValidTier,
  jsonResponse,
  priceIdForTier,
} from "../_shared/stripe.ts";

const DEFAULT_ORIGIN =
  Deno.env.get("EMPLOYER_PORTAL_ORIGIN") ?? "https://www.gogreenstreets.org";

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: {
    tier?: unknown;
    origin?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  if (!isValidTier(body.tier)) {
    return jsonResponse({ error: "Invalid tier" }, 400);
  }

  // Use caller-supplied origin for redirect URLs so localhost dev works
  // without redeploying. Validate it against an allow-list of hosts to
  // avoid letting arbitrary input control the Stripe redirect.
  const origin = typeof body.origin === "string" ? body.origin : "";
  const allowedHosts = new Set([
    "www.gogreenstreets.org",
    "gogreenstreets.org",
    "localhost",
  ]);
  let resolvedOrigin = DEFAULT_ORIGIN;
  if (origin) {
    try {
      const url = new URL(origin);
      if (allowedHosts.has(url.hostname)) {
        resolvedOrigin = url.origin;
      }
    } catch {
      // fall back to default
    }
  }

  let stripe: ReturnType<typeof createStripeClient>;
  try {
    stripe = createStripeClient();
  } catch (err) {
    console.error("[EmployerCheckout] Stripe client init failed:", err);
    return jsonResponse({ error: "Stripe not configured" }, 500);
  }

  let priceId: string;
  try {
    priceId = priceIdForTier(body.tier);
  } catch (err) {
    console.error("[EmployerCheckout] Missing price ID env var:", err);
    return jsonResponse({ error: "Pricing not configured" }, 500);
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Stripe collects the admin email natively as part of payment.
      // The webhook reads it from session.customer_details.email.
      // Company name is collected via a custom field; the webhook reads
      // it from session.custom_fields[0].text.value.
      custom_fields: [
        {
          key: "company_name",
          label: { type: "custom", custom: "Company name" },
          type: "text",
          text: { minimum_length: 1, maximum_length: 120 },
        },
      ],
      // Tier is the one thing server-set. Stash on both the session and
      // the subscription so we can recover it either way.
      metadata: { tier: body.tier },
      subscription_data: {
        metadata: { tier: body.tier },
      },
      // Land on the marketing page with a success flag rather than the
      // portal directly. The buyer isn't signed in yet (their magic-link
      // email is still on the way) — taking them to the portal would
      // either drop them on a logged-out redirect, or worse, load
      // someone else's group if they happen to have a stale session.
      success_url: `${resolvedOrigin}/shift/employers?checkout=success`,
      cancel_url: `${resolvedOrigin}/shift/employers?canceled=true`,
      billing_address_collection: "required",
      automatic_tax: { enabled: false },
      // 24hr completion window — shorter than Stripe's 7d default so we
      // don't accumulate dormant sessions.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    });

    if (!session.url) {
      console.error("[EmployerCheckout] Session created but no URL returned:", session.id);
      return jsonResponse({ error: "Checkout URL unavailable" }, 502);
    }

    console.log(
      `[EmployerCheckout] Created session ${session.id} (${body.tier})`,
    );
    return jsonResponse({ url: session.url });
  } catch (err) {
    console.error("[EmployerCheckout] checkout.sessions.create failed:", err);
    return jsonResponse({ error: "Checkout creation failed" }, 502);
  }
});
