import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight, jsonResponse } from "../_shared/stripe.ts";

const TREMENDOUS_API_URL =
  Deno.env.get("TREMENDOUS_API_URL") ?? "https://www.tremendous.com/api/v2";
const TREMENDOUS_API_KEY = Deno.env.get("TREMENDOUS_API_KEY") ?? "";
const TREMENDOUS_CAMPAIGN_ID = Deno.env.get("TREMENDOUS_CAMPAIGN_ID") ?? "";

serve(async (req: Request) => {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!TREMENDOUS_API_KEY) {
    return jsonResponse({ error: "Tremendous API not configured" }, 503);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  // If a campaign is configured, first fetch which product IDs it allows,
  // then fetch the full product catalog and filter to just those IDs.
  let allowedProductIds: Set<string> | null = null;

  if (TREMENDOUS_CAMPAIGN_ID) {
    const campaignRes = await fetch(
      `${TREMENDOUS_API_URL}/campaigns/${TREMENDOUS_CAMPAIGN_ID}`,
      { headers: { Authorization: `Bearer ${TREMENDOUS_API_KEY}` } },
    );
    if (campaignRes.ok) {
      const campaignData = await campaignRes.json();
      const campaign = campaignData.campaign ?? campaignData;
      const rawProducts = campaign.products ?? [];
      const ids: string[] = rawProducts.map(
        (p: { id: string } | string) => (typeof p === "string" ? p : p.id),
      );
      if (ids.length > 0) {
        allowedProductIds = new Set(ids);
      } else {
        console.error("[Tremendous] campaign returned 0 product IDs");
        return jsonResponse({ error: "Campaign has no products configured" }, 500);
      }
    } else {
      const errText = await campaignRes.text().catch(() => "");
      console.error("[Tremendous] campaign fetch failed:", campaignRes.status, errText);
      return jsonResponse({ error: "Failed to load campaign" }, 502);
    }
  }

  const res = await fetch(`${TREMENDOUS_API_URL}/products`, {
    headers: { Authorization: `Bearer ${TREMENDOUS_API_KEY}` },
  });

  if (!res.ok) {
    console.error("[Tremendous] products fetch failed:", res.status);
    return jsonResponse({ error: "Failed to load products" }, 502);
  }

  const data = await res.json();

  interface TremendousCountry {
    abbr: string;
  }
  interface TremendousSku {
    min: number;
    max: number;
    currency_codes: string[];
  }
  interface TremendousImage {
    src: string;
    type: string;
  }
  interface TremendousRawProduct {
    id: string;
    name: string;
    category?: string;
    countries?: TremendousCountry[];
    skus?: TremendousSku[];
    images?: TremendousImage[];
  }

  const rawProducts: TremendousRawProduct[] = data.products ?? [];

  const products = rawProducts
    .filter((p: TremendousRawProduct) => {
      if (allowedProductIds && !allowedProductIds.has(p.id)) return false;
      return p.countries?.some((c) => c.abbr === "US");
    })
    .map((p: TremendousRawProduct) => {
      const skus = p.skus ?? [];
      const usdSku = skus.find((s) => s.currency_codes?.includes("USD"));
      const sku = usdSku ?? skus[0];

      const images = p.images ?? [];
      const logo = images.find((i) => i.type === "logo") ?? images[0];

      return {
        id: p.id,
        name: p.name,
        image_url: logo?.src ?? null,
        min_value: sku?.min ?? 0,
        max_value: sku?.max ?? 0,
        currency_codes: sku?.currency_codes ?? ["USD"],
        category: p.category ?? "other",
      };
    })
    .sort(
      (a: { name: string }, b: { name: string }) =>
        a.name.localeCompare(b.name),
    );

  return new Response(JSON.stringify({ products }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, content-type, x-client-info, apikey",
      "Cache-Control": "no-cache",
    },
  });
});
