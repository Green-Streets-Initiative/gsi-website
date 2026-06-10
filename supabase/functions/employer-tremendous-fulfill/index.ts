import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/stripe.ts";

const TREMENDOUS_API_URL =
  Deno.env.get("TREMENDOUS_API_URL") ?? "https://www.tremendous.com/api/v2";
const TREMENDOUS_API_KEY = Deno.env.get("TREMENDOUS_API_KEY") ?? "";
const TREMENDOUS_FUNDING_SOURCE_ID =
  Deno.env.get("TREMENDOUS_FUNDING_SOURCE_ID") ?? "";

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!TREMENDOUS_API_KEY || !TREMENDOUS_FUNDING_SOURCE_ID) {
    return jsonResponse({ error: "Tremendous API not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: { prize_id?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const prizeId = body.prize_id;
  if (!prizeId || typeof prizeId !== "string") {
    return jsonResponse({ error: "prize_id required" }, 400);
  }

  const userSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } =
    await userSupabase.auth.getUser();
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const admin = createAdminClient();

  // Load prize via user's session (RLS ensures they own it)
  const { data: prize, error: prizeErr } = await userSupabase
    .from("employer_challenge_prizes")
    .select("*")
    .eq("id", prizeId)
    .single();

  if (prizeErr || !prize) {
    return jsonResponse({ error: "Prize not found" }, 404);
  }

  if (!prize.funded_from_pool) {
    return jsonResponse({ error: "Prize is not pool-funded" }, 400);
  }

  if (prize.draw_status === "pending") {
    return jsonResponse(
      { error: "Winners have not been drawn yet" },
      400,
    );
  }

  if (prize.draw_status === "fulfilled") {
    return jsonResponse({ error: "Prizes already fulfilled" }, 400);
  }

  const productId = prize.tremendous_product_id;
  if (!productId) {
    return jsonResponse(
      { error: "No Tremendous product selected for this prize" },
      400,
    );
  }

  const { data: winners } = await userSupabase
    .from("employer_prize_winners")
    .select("id, user_id, amount_cents, fulfillment_status")
    .eq("prize_id", prizeId)
    .eq("fulfillment_status", "pending");

  if (!winners || winners.length === 0) {
    return jsonResponse(
      { error: "No pending winners to fulfill" },
      400,
    );
  }

  let fulfilled = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const winner of winners) {
    const { data: authUser } = await admin.auth.admin.getUserById(
      winner.user_id,
    );

    const recipientEmail = authUser?.user?.email;
    if (!recipientEmail) {
      errors.push(`No email for user ${winner.user_id}`);
      failed++;
      continue;
    }

    const recipientName =
      authUser?.user?.user_metadata?.display_name ??
      authUser?.user?.user_metadata?.full_name ??
      recipientEmail.split("@")[0];

    const amountCents =
      winner.amount_cents ?? prize.amount_cents ?? 2500;

    try {
      const orderRes = await fetch(`${TREMENDOUS_API_URL}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TREMENDOUS_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payment: {
            funding_source_id: TREMENDOUS_FUNDING_SOURCE_ID,
          },
          rewards: [
            {
              value: {
                denomination: amountCents / 100,
                currency_code: "USD",
              },
              delivery: {
                method: "EMAIL",
              },
              recipient: {
                name: recipientName,
                email: recipientEmail,
              },
              products: [productId],
            },
          ],
        }),
      });

      if (!orderRes.ok) {
        const errBody = await orderRes.text().catch(() => "");
        console.error(
          `[Tremendous] order failed for ${winner.id}:`,
          orderRes.status,
          errBody,
        );
        errors.push(
          `Order failed for ${recipientEmail}: ${orderRes.status}`,
        );
        failed++;
        continue;
      }

      const orderData = await orderRes.json();
      const orderId = orderData.order?.id ?? null;

      await admin
        .from("employer_prize_winners")
        .update({
          fulfillment_status: "fulfilled",
          fulfilled_at: new Date().toISOString(),
          tremendous_order_id: orderId,
        })
        .eq("id", winner.id);

      fulfilled++;
    } catch (err) {
      console.error(`[Tremendous] order error for ${winner.id}:`, err);
      errors.push(`Network error for ${recipientEmail}`);
      failed++;
    }
  }

  if (fulfilled > 0 && failed === 0) {
    await admin
      .from("employer_challenge_prizes")
      .update({ draw_status: "fulfilled" })
      .eq("id", prizeId);
  }

  return jsonResponse({ fulfilled, failed, errors });
});
