import Stripe from "npm:stripe@18";
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Find or create a Stripe customer for an employer group.
 * Supports both Stripe-originated signups (customer already exists)
 * and manually provisioned accounts (e.g. paid by check).
 *
 * When creating, saves the new customer ID back to the group row
 * so subsequent calls are a no-op lookup.
 *
 * Returns the Stripe customer ID, or throws with a user-facing message.
 */
export async function ensureStripeCustomer(
  stripe: Stripe,
  adminClient: SupabaseClient,
  group: {
    id: string;
    name: string;
    admin_email: string;
    stripe_customer_id: string | null;
  },
): Promise<string> {
  if (group.stripe_customer_id) {
    return group.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: group.admin_email,
    name: group.name,
    metadata: {
      group_id: group.id,
      source: "employer_portal_auto",
    },
  });

  const { error } = await adminClient
    .from("groups")
    .update({ stripe_customer_id: customer.id })
    .eq("id", group.id);

  if (error) {
    console.error("[ensureStripeCustomer] failed to save customer ID:", error);
  }

  return customer.id;
}
