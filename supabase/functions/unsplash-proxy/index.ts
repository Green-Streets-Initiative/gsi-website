import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

/**
 * Public Unsplash proxy.
 *
 * Holds UNSPLASH_ACCESS_KEY server-side so consumers (gsi-website, Shift
 * mobile app, Shift admin web) don't have to embed it in client bundles.
 *
 * Auth: none required (--no-verify-jwt). Public endpoint.
 *
 * API:
 *   GET ?action=photo&id={photoId}
 *   GET ?action=search&query={q}&per_page=1&orientation=landscape&...
 *
 * Returns the raw Unsplash JSON response (status forwarded).
 *
 * Whitelist limits the proxy to the two endpoints we actually use.
 */

const UNSPLASH_ACCESS_KEY = Deno.env.get("UNSPLASH_ACCESS_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }
  if (!UNSPLASH_ACCESS_KEY) {
    return json({ error: "server_misconfigured" }, 500);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  let upstream: string;
  if (action === "photo") {
    const id = url.searchParams.get("id");
    if (!id || !/^[\w-]+$/.test(id)) {
      return json({ error: "invalid_id" }, 400);
    }
    upstream = `https://api.unsplash.com/photos/${id}`;
  } else if (action === "search") {
    const query = url.searchParams.get("query");
    if (!query) return json({ error: "missing_query" }, 400);
    const params = new URLSearchParams();
    params.set("query", query);
    const perPage = url.searchParams.get("per_page");
    if (perPage) params.set("per_page", perPage);
    const orientation = url.searchParams.get("orientation");
    if (orientation) params.set("orientation", orientation);
    const page = url.searchParams.get("page");
    if (page) params.set("page", page);
    upstream = `https://api.unsplash.com/search/photos?${params}`;
  } else {
    return json({ error: "invalid_action" }, 400);
  }

  try {
    const res = await fetch(upstream, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
    });
    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: "upstream_error", detail: String(e) }, 502);
  }
});
