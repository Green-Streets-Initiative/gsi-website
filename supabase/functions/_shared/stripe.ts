// Shared Stripe helpers for the employer platform edge functions.
//
// Pins the API version so future Stripe releases don't silently change
// the webhook payload shape under us. If we need to upgrade, bump here
// in one place and redeploy.

import Stripe from "npm:stripe@18";

// Keep this in sync with the "API version" on each webhook endpoint in the
// Stripe Dashboard (Developers → Webhooks → {endpoint} → edit) so SDK responses
// and webhook payloads share the same shape. As of API version 2024-06-20,
// billing period fields live on subscription items (items.data[i].current_period_*),
// not the subscription itself — any version newer than that works with our code.
// Cast is needed because stripe@18's typed LatestApiVersion lags the preview
// codenames Stripe actually accepts as API headers.
export const STRIPE_API_VERSION = "2026-02-25.clover" as Stripe.LatestApiVersion;

export function createStripeClient(): Stripe {
  // Namespaced key: the employer platform runs independently from any
  // other Stripe integrations GSI may have (donations, future features).
  // Each use case gets its own secret so they can use different modes,
  // accounts, or keys without stepping on each other.
  const key =
    Deno.env.get("STRIPE_SECRET_KEY_EMPLOYER") ??
    Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY_EMPLOYER is not set on the edge function environment.",
    );
  }
  return new Stripe(key, {
    apiVersion: STRIPE_API_VERSION,
  });
}

export type EmployerTier = "basic" | "standard" | "premium";

export function isValidTier(value: unknown): value is EmployerTier {
  return value === "basic" || value === "standard" || value === "premium";
}

/**
 * Resolve the Stripe price ID for a tier. The three IDs are stored as
 * edge function secrets so test/live can be swapped without code changes.
 */
export function priceIdForTier(tier: EmployerTier): string {
  const envKey =
    tier === "basic"
      ? "STRIPE_PRICE_EMPLOYER_BASIC"
      : tier === "standard"
        ? "STRIPE_PRICE_EMPLOYER_STANDARD"
        : "STRIPE_PRICE_EMPLOYER_PREMIUM";
  const id = Deno.env.get(envKey);
  if (!id) {
    throw new Error(`${envKey} is not set on the edge function environment.`);
  }
  return id;
}

/**
 * CORS headers reused across employer edge functions.
 * Origin is left as "*" because the marketing page is public; checkout
 * auth happens inside Stripe, not via our CORS policy.
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey, stripe-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export function handleCorsPreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  return null;
}
