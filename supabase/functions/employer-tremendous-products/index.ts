import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCorsPreflight, jsonResponse } from "../_shared/stripe.ts";

const TREMENDOUS_API_URL =
  Deno.env.get("TREMENDOUS_API_URL") ?? "https://www.tremendous.com/api/v2";
const TREMENDOUS_API_KEY = Deno.env.get("TREMENDOUS_API_KEY") ?? "";

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

  const products = (data.products ?? [])
    .filter((p: TremendousRawProduct) => {
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
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
    },
  });
});
