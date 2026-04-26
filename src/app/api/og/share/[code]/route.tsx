/**
 * Server-rendered Open Graph image for the Shift referral share card.
 *
 * Hit pattern: GET /api/og/share/{referralCode} → 1200×630 PNG.
 *
 * Used by the Cloudflare Worker at shift.gogreenstreets.org/refer/{code}
 * (which serves OG meta tags pointing here) so that messaging apps and
 * social platforms render a rich preview when the share URL is pasted.
 *
 * Cache: 5 min user-side, 1 hour CDN. Stats freshness isn't critical for
 * shared artifacts; we accept up-to-1-hour staleness in exchange for
 * cheaper repeat fetches.
 */

import { ImageResponse } from "@vercel/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

/**
 * Fetch a Bricolage Grotesque weight from Google Fonts. Uses the documented
 * Vercel pattern: hit the CSS endpoint, parse the woff/ttf URL, fetch the
 * binary. Edge runtime caches the responses so warm requests are fast.
 */
async function loadBricolage(weight: 400 | 700 | 800): Promise<ArrayBuffer> {
  // Use the legacy /css? endpoint (no `2`) without a UA — it returns TTF
  // URLs by default, which is what Satori needs. The /css2? endpoint
  // returns woff2 for any modern UA, which Satori can't parse.
  const cssUrl = `https://fonts.googleapis.com/css?family=Bricolage+Grotesque:${weight}`;
  const css = await fetch(cssUrl).then((r) => r.text());
  const match = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\('truetype'\)/);
  if (!match) {
    throw new Error(`Could not parse Bricolage Grotesque ${weight} font URL`);
  }
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`Failed to fetch font: ${fontRes.status}`);
  return fontRes.arrayBuffer();
}

/**
 * Load the GSI brand typeface (Trebuchet MS) bundled with the function.
 * Vercel's Edge bundler resolves `new URL(..., import.meta.url)` at build
 * time and inlines the .ttf into the function bundle. The font is private
 * to the rendering pipeline — never served as a public asset.
 */
async function loadTrebuchet(weight: "regular" | "bold"): Promise<ArrayBuffer> {
  const url = new URL(`./fonts/trebuchet-${weight}.ttf`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`Failed to load Trebuchet ${weight}: ${res.status}`);
  return res.arrayBuffer();
}

interface ShareCardData {
  firstName: string;
  lastInitial: string;
  neighborhood: string | null;
  tierId: number;
  tierName: string;
  shiftRate: number;
  lifetimeActive: number;
  streakDays: number;
  activeMiles: number;
  modeBreakdown: ModeShare[];
  referralCode: string;
}

interface ModeShare {
  key: "walk" | "bike" | "transit" | "escooter";
  label: string;
  color: string;
  pct: number; // 0–100
}

// Mirrors MODE_ICON_CONFIG in the Shift app (components/ModeIcon.tsx).
// Walk and Scooter share lime; Bike and Transit share blue. The legend
// icons disambiguate same-colored segments.
const MODE_COLORS = {
  walk: "#BAF14D", // Colors.lime
  bike: "#2966E5", // Colors.blue
  transit: "#2966E5",
  escooter: "#BAF14D",
} as const;

const MODE_LABELS = {
  walk: "Walk",
  bike: "Bike",
  transit: "Transit",
  escooter: "Scooter",
} as const;

// Phosphor "bold" weight SVG paths — sourced from
// phosphor-react-native/lib/module/defs/<Icon>.js so the share card uses
// the same mode glyphs as the in-app ModeIcon component. ViewBox 0 0 256 256.
const ICON_WALK =
  "M152 84a36 36 0 1 0-36-36 36 36 0 0 0 36 36m0-48a12 12 0 1 1-12 12 12 12 0 0 1 12-12m68 112a12 12 0 0 1-12 12c-37 0-55.27-18.47-70-33.3-1.71-1.72-3.36-3.4-5-5l-8.63 19.85L159 166.23a12 12 0 0 1 5 9.77v56a12 12 0 0 1-24 0v-49.83l-25.37-18.12L83 236.78a12 12 0 1 1-22-9.57l50.06-115.13q-10.64.75-25 8.4a159.8 159.8 0 0 0-29.83 21.23 12 12 0 0 1-16.43-17.5c2.61-2.45 64.36-59.67 104.09-25.18 3.94 3.42 7.64 7.16 11.22 10.78C168.43 123.28 181 136 208 136a12 12 0 0 1 12 12";
const ICON_BIKE =
  "M204 108a51.8 51.8 0 0 0-15.13 2.25L168.89 76H192a4 4 0 0 1 4 4 12 12 0 0 0 24 0 28 28 0 0 0-28-28h-44a12 12 0 0 0-10.37 18l8.14 14h-36.21L94.37 58A12 12 0 0 0 84 52H52a12 12 0 0 0 0 24h25.11l11.07 19L74 112.89a52.17 52.17 0 1 0 18.8 14.92l8.37-10.57L118 146.05A12 12 0 1 0 138.7 134l-15.14-26h36.21l8.39 14.38A52 52 0 1 0 204 108M80 160a28 28 0 1 1-21.71-27.28l-15.7 19.83a12 12 0 0 0 18.82 14.9l15.7-19.83A27.84 27.84 0 0 1 80 160m124 28a28 28 0 0 1-23.11-43.79l12.74 21.84A12 12 0 0 0 214.37 154l-12.75-21.84c.79-.07 1.58-.11 2.38-.11a28 28 0 0 1 0 56Z";
const ICON_TRANSIT =
  "M184 20H72a36 36 0 0 0-36 36v128a36 36 0 0 0 36 36l-9.6 12.8a12 12 0 1 0 19.2 14.4L102 220h52l20.4 27.2a12 12 0 0 0 19.2-14.4L184 220a36 36 0 0 0 36-36V56a36 36 0 0 0-36-36M60 116V84h56v32Zm80-32h56v32h-56ZM72 44h112a12 12 0 0 1 12 12v4H60v-4a12 12 0 0 1 12-12m112 152H72a12 12 0 0 1-12-12v-44h136v44a12 12 0 0 1-12 12m-80-28a16 16 0 1 1-16-16 16 16 0 0 1 16 16m80 0a16 16 0 1 1-16-16 16 16 0 0 1 16 16";
const ICON_ESCOOTER =
  "M212 132h-.68l-31.94-95.79A12 12 0 0 0 168 28h-32a12 12 0 0 0 0 24h23.35l14.83 44.49L114.59 164H83.2a40 40 0 1 0-2.55 24H120a12 12 0 0 0 9-4.06l54-61.13 5.6 16.81A40 40 0 1 0 212 132M44 188a16 16 0 1 1 16-16 16 16 0 0 1-16 16m168 0a16 16 0 1 1 16-16 16 16 0 0 1-16 16";

const MODE_ICONS = {
  walk: ICON_WALK,
  bike: ICON_BIKE,
  transit: ICON_TRANSIT,
  escooter: ICON_ESCOOTER,
} as const;

// Mirrors lib/tiers.ts in the Shift app.
const TIERS = [
  { id: 1, name: "starter", display: "Starter", tripsRequired: 0, shiftRateMin: 0 },
  { id: 2, name: "mover", display: "Mover", tripsRequired: 25, shiftRateMin: 0.1 },
  { id: 3, name: "shifter", display: "Shifter", tripsRequired: 100, shiftRateMin: 0.2 },
  { id: 4, name: "leader", display: "Pacesetter", tripsRequired: 250, shiftRateMin: 0.3 },
  { id: 5, name: "trailblazer", display: "Trailblazer", tripsRequired: 500, shiftRateMin: 0.5 },
] as const;

const TIER_PIP_COLOR: Record<string, string> = {
  starter: "rgba(138,141,168,0.85)",
  mover: "#2966E5",
  shifter: "#BAF14D",
  leader: "#EDB93C",
  trailblazer: "#BAF14D",
};

const TIER_ICON_BG: Record<string, string> = {
  starter: "rgba(138,141,168,0.18)",
  mover: "rgba(41,102,229,0.18)",
  shifter: "rgba(186,241,77,0.18)",
  leader: "rgba(237,185,60,0.18)",
  trailblazer: "rgba(186,241,77,0.18)",
};

// Phosphor "flame" fill icon — 256×256 viewBox. Sourced from
// phosphor-react-native/lib/module/defs/Flame.js (the same icon
// UnifiedStatusCard.tsx renders in the app at weight="fill").
const FLAME_PATH =
  "M173.79 51.48a221.3 221.3 0 0 0-41.67-34.34 8 8 0 0 0-8.24 0 221.3 221.3 0 0 0-41.67 34.34C54.59 80.48 40 112.47 40 144a88 88 0 0 0 176 0c0-31.53-14.59-63.52-42.21-92.52M96 184c0-27.67 22.53-47.28 32-54.3 9.48 7 32 26.63 32 54.3a32 32 0 0 1-64 0";

const NAVY = "#191A2E";
const LIME = "#BAF14D";
const BLUE = "#2966E5";
const FIRE = "#FF8C35";

async function loadShareData(code: string): Promise<ShareCardData | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const supabase = createClient(url, key);

  // Look up user by referral code
  const { data: user, error: userErr } = await supabase
    .from("users")
    .select(
      "id, first_name, last_name, home_lat, home_lng, impact_non_car_trips, impact_distance_miles",
    )
    .eq("referral_code", code)
    .maybeSingle();

  if (userErr || !user) return null;

  const userId = user.id as string;

  // Parallel fetch
  const [tierRes, streakRes, rateRes, neighborhoodIdRes, tripModesRes] =
    await Promise.all([
      supabase
        .from("user_tiers")
        .select("status_tiers:current_tier_id(id, name)")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("streaks")
        .select("current_streak")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase.rpc("get_user_shift_rate", { p_user_id: userId, p_days: 60 }),
      user.home_lat != null && user.home_lng != null
        ? supabase.rpc("find_neighborhood_for_point", {
            p_lat: user.home_lat,
            p_lng: user.home_lng,
          })
        : Promise.resolve({ data: null }),
      supabase
        .from("trips")
        .select("mode")
        .eq("user_id", userId)
        .eq("user_confirmed", true)
        .not("mode", "in", "(drive,carpool,other)")
        .limit(2000),
    ]);

  // Tier
  const tierRow = tierRes.data?.status_tiers as
    | { id?: number; name?: string }
    | null;
  const tierName = tierRow?.name ?? "starter";
  const tierId = tierRow?.id ?? 1;

  // Streak
  const streakDays = Number(streakRes.data?.current_streak) || 0;

  // 60-day shift rate (RPC returns array)
  const rateRow = (rateRes.data as { shift_rate?: number }[] | null)?.[0];
  const shiftRate = Math.round(Number(rateRow?.shift_rate) || 0);

  // Neighborhood — find_neighborhood_for_point returns the neighborhood id;
  // fetch the name from the neighborhoods table if we got one.
  let neighborhood: string | null = null;
  const nbId = (neighborhoodIdRes as { data: string | null }).data;
  if (nbId) {
    const { data: nb } = await supabase
      .from("neighborhoods")
      .select("name")
      .eq("id", nbId)
      .maybeSingle();
    neighborhood = (nb as { name?: string } | null)?.name ?? null;
  }

  // Aggregate active-trip modes into the four buckets the legend shows.
  // transit_bus / transit_train / transit_commuter_rail collapse to "transit".
  const counts = { walk: 0, bike: 0, transit: 0, escooter: 0 };
  const tripRows = (tripModesRes.data as { mode?: string }[] | null) ?? [];
  for (const row of tripRows) {
    const m = row.mode ?? "";
    if (m === "walk") counts.walk++;
    else if (m === "bike") counts.bike++;
    else if (m === "escooter") counts.escooter++;
    else if (m.startsWith("transit_")) counts.transit++;
  }
  const totalActive = counts.walk + counts.bike + counts.transit + counts.escooter;
  const modeBreakdown: ModeShare[] = (["walk", "bike", "transit", "escooter"] as const)
    .map((key) => ({
      key,
      label: MODE_LABELS[key],
      color: MODE_COLORS[key],
      pct: totalActive > 0 ? Math.round((counts[key] / totalActive) * 100) : 0,
    }))
    .filter((m) => m.pct > 0);

  return {
    firstName: (user.first_name as string) || "Friend",
    lastInitial: ((user.last_name as string) || "").charAt(0),
    neighborhood,
    tierId,
    tierName,
    shiftRate,
    lifetimeActive: Number(user.impact_non_car_trips) || 0,
    streakDays,
    activeMiles: Number(user.impact_distance_miles) || 0,
    modeBreakdown,
    referralCode: code,
  };
}

function FallbackCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: NAVY,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Bricolage Grotesque",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -2,
          }}
        >
          Shift
        </span>
        <svg width={96} height={64} viewBox="0 0 40 26">
          <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill={LIME} />
          <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill={BLUE} />
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          color: "rgba(255,255,255,0.85)",
          fontSize: 36,
          fontWeight: 400,
        }}
      >
        Every trip counts.
      </div>
      <div
        style={{
          display: "flex",
          color: "rgba(255,255,255,0.65)",
          fontSize: 24,
          marginTop: 24,
        }}
      >
        shift.gogreenstreets.org
      </div>
    </div>
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const [
    data,
    fontRegular,
    fontBold,
    fontExtra,
    trebuchetRegular,
    trebuchetBold,
  ] = await Promise.all([
    loadShareData(code),
    loadBricolage(400),
    loadBricolage(700),
    loadBricolage(800),
    loadTrebuchet("regular"),
    loadTrebuchet("bold"),
  ]);

  const cacheHeaders = {
    "Cache-Control": "public, max-age=300, s-maxage=3600",
  };

  const fonts = [
    { name: "Bricolage Grotesque", data: fontRegular, weight: 400 as const, style: "normal" as const },
    { name: "Bricolage Grotesque", data: fontBold, weight: 700 as const, style: "normal" as const },
    { name: "Bricolage Grotesque", data: fontExtra, weight: 800 as const, style: "normal" as const },
    { name: "Trebuchet MS", data: trebuchetRegular, weight: 400 as const, style: "normal" as const },
    { name: "Trebuchet MS", data: trebuchetBold, weight: 700 as const, style: "normal" as const },
  ];

  if (!data) {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    });
  }

  const tierIdx = Math.max(0, Math.min(4, data.tierId - 1));
  const currentTier = TIERS[tierIdx];
  const isMax = data.tierId >= 5;
  const nextTier = isMax ? null : TIERS[tierIdx + 1];

  const ratePct = Math.max(0, Math.min(100, data.shiftRate)) / 100;
  const tripsPct =
    !isMax && nextTier && nextTier.tripsRequired > 0
      ? Math.min(1, data.lifetimeActive / nextTier.tripsRequired)
      : 1;

  // For the pip strip: how full is the current tier's segment?
  const progressInCurrent = isMax ? 1 : Math.min(tripsPct, ratePct);

  // On-pace check: current 60d rate clears the next tier's floor (or the
  // Trailblazer floor at max tier).
  const targetRatePct = isMax
    ? currentTier.shiftRateMin
    : nextTier!.shiftRateMin;
  const onPace = ratePct >= targetRatePct;

  const displayName = data.lastInitial
    ? `${data.firstName} ${data.lastInitial}.`
    : data.firstName;

  // Dual-ring geometry — outer = trips toward next tier (blue), inner =
  // 60-day shift rate (lime). Mirrors UnifiedStatusCard.tsx in the app.
  const RING_SIZE = 240;
  const RING_STROKE = 16;
  const OUTER_R = (RING_SIZE - RING_STROKE) / 2;
  const INNER_R = OUTER_R - RING_STROKE - 4;
  const OUTER_C = 2 * Math.PI * OUTER_R;
  const INNER_C = 2 * Math.PI * INNER_R;
  const outerOffset = OUTER_C * (1 - tripsPct);
  const innerOffset = INNER_C * (1 - ratePct);

  const tierPipColor =
    TIER_PIP_COLOR[currentTier.name] ?? TIER_PIP_COLOR.starter;
  const tierIconBg =
    TIER_ICON_BG[currentTier.name] ?? TIER_ICON_BG.starter;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: NAVY,
          display: "flex",
          flexDirection: "column",
          paddingTop: 50,
          paddingBottom: 50,
          paddingLeft: 56,
          paddingRight: 56,
          fontFamily: "Bricolage Grotesque",
        }}
      >
        {/* Top bar — Shift wordmark + tagline */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                color: "#fff",
                fontSize: 38,
                fontWeight: 800,
                letterSpacing: -1,
              }}
            >
              Shift
            </span>
            <svg width={50} height={32} viewBox="0 0 40 26">
              <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill={LIME} />
              <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill={BLUE} />
            </svg>
          </div>
          <span
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.85)",
              fontSize: 22,
              fontWeight: 400,
            }}
          >
            Every trip counts.
          </span>
        </div>

        {/* Identity row: name + neighborhood */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 14,
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.05,
            }}
          >
            {displayName}
          </span>
          {data.neighborhood && (
            <span
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: 24,
                fontWeight: 500,
                marginTop: 6,
              }}
            >
              {data.neighborhood}
            </span>
          )}
        </div>

        {/* Tier row: chevron icon + tier name + Next: ... */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: tierIconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width={22} height={22} viewBox="0 0 32 32">
                <path
                  d="M2 5L14 16L2 27L2 22L8 16L2 10Z"
                  fill={tierPipColor}
                />
                <path
                  d="M17 5L29 16L17 27L17 22L23 16L17 10Z"
                  fill={tierPipColor}
                />
              </svg>
            </div>
            <span
              style={{
                color: "#fff",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: -0.2,
              }}
            >
              {currentTier.display}
            </span>
          </div>
          <span
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.75)",
              fontSize: 20,
              fontWeight: 500,
            }}
          >
            {isMax ? "Top tier" : `Next: ${nextTier!.display}`}
          </span>
        </div>

        {/* Tier pip strip */}
        <div
          style={{
            display: "flex",
            gap: 5,
            marginTop: 12,
          }}
        >
          {TIERS.map((t) => {
            let fill = 0;
            if (t.id < data.tierId) fill = 1;
            else if (t.id === data.tierId)
              fill = Math.max(0.06, progressInCurrent);
            const color = TIER_PIP_COLOR[t.name] ?? TIER_PIP_COLOR.starter;
            return (
              <div
                key={t.name}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  display: "flex",
                  overflow: "hidden",
                }}
              >
                {fill > 0 && (
                  <div
                    style={{
                      width: `${Math.round(fill * 100)}%`,
                      height: "100%",
                      backgroundColor: color,
                      borderRadius: 3,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Body: ring (left) + stats column (right) */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 36,
            marginTop: 30,
          }}
        >
          {/* Dual-ring */}
          <div
            style={{
              width: RING_SIZE,
              height: RING_SIZE,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              style={{ position: "absolute", top: 0, left: 0 }}
            >
              {/* Outer track — trips */}
              {!isMax && (
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={OUTER_R}
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth={RING_STROKE}
                />
              )}
              {/* Outer arc — trips */}
              {!isMax && (
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={OUTER_R}
                  fill="none"
                  stroke={BLUE}
                  strokeWidth={RING_STROKE}
                  strokeDasharray={`${OUTER_C} ${OUTER_C}`}
                  strokeDashoffset={outerOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                />
              )}
              {/* Inner track + arc — shift rate */}
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={isMax ? OUTER_R : INNER_R}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={RING_STROKE}
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={isMax ? OUTER_R : INNER_R}
                fill="none"
                stroke={LIME}
                strokeWidth={RING_STROKE}
                strokeDasharray={`${
                  isMax ? OUTER_C : INNER_C
                } ${isMax ? OUTER_C : INNER_C}`}
                strokeDashoffset={
                  isMax ? OUTER_C * (1 - ratePct) : innerOffset
                }
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </svg>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  color: isMax ? LIME : "#fff",
                  fontSize: 64,
                  fontWeight: 800,
                  letterSpacing: -2,
                  lineHeight: 1,
                }}
              >
                {isMax ? `${data.shiftRate}%` : data.lifetimeActive}
              </span>
              <span
                style={{
                  display: "flex",
                  color: "rgba(255,255,255,0.75)",
                  fontSize: isMax ? 14 : 16,
                  fontWeight: isMax ? 700 : 500,
                  letterSpacing: isMax ? 1.2 : 0,
                  marginTop: isMax ? 6 : 4,
                }}
              >
                {isMax
                  ? "SHIFT RATE · 60D"
                  : `of ${nextTier!.tripsRequired} trips`}
              </span>
            </div>
          </div>

          {/* Stats column */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* Active trips */}
            {!isMax && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: BLUE,
                    marginTop: 11,
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <span
                    style={{
                      color: "rgba(255,255,255,0.75)",
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                    }}
                  >
                    ACTIVE TRIPS
                  </span>
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: -0.5,
                      marginTop: 2,
                    }}
                  >
                    {data.lifetimeActive} / {nextTier!.tripsRequired}
                  </span>
                </div>
              </div>
            )}
            {/* Shift rate */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: LIME,
                  marginTop: 11,
                }}
              />
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <span
                  style={{
                    color: "rgba(255,255,255,0.75)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                  }}
                >
                  SHIFT RATE · 60D
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 2,
                  }}
                >
                  <span
                    style={{
                      color: "#fff",
                      fontSize: 28,
                      fontWeight: 700,
                      letterSpacing: -0.5,
                    }}
                  >
                    {data.shiftRate}%
                  </span>
                  {onPace && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: "rgba(107,232,154,0.18)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg width={12} height={12} viewBox="0 0 24 24">
                          <path
                            d="M5 12 L10 17 L19 7"
                            stroke="#6BE89A"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      </div>
                      <span
                        style={{
                          color: "#6BE89A",
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: 0.8,
                        }}
                      >
                        ON PACE
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Streak + active miles row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width={28} height={28} viewBox="0 0 256 256">
                  <path d={FLAME_PATH} fill={FIRE} fillRule="evenodd" />
                </svg>
                <span
                  style={{
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {data.streakDays}-day streak
                </span>
              </div>
              {data.activeMiles > 0 && (
                <span
                  style={{
                    display: "flex",
                    color: "rgba(255,255,255,0.5)",
                    fontSize: 22,
                    fontWeight: 500,
                  }}
                >
                  ·
                </span>
              )}
              {data.activeMiles > 0 && (
                <span
                  style={{
                    display: "flex",
                    color: "#fff",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {data.activeMiles.toFixed(1)} active mi
                </span>
              )}
            </div>
            {/* By-mode breakdown — stacked bar + icon legend */}
            {data.modeBreakdown.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  marginTop: 10,
                }}
              >
                <span
                  style={{
                    display: "flex",
                    color: "rgba(255,255,255,0.75)",
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                  }}
                >
                  BY MODE
                </span>
                <div
                  style={{
                    display: "flex",
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "rgba(255,255,255,0.08)",
                    overflow: "hidden",
                  }}
                >
                  {data.modeBreakdown.map((m) => (
                    <div
                      key={m.key}
                      style={{
                        width: `${m.pct}%`,
                        height: "100%",
                        backgroundColor: m.color,
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    marginTop: 2,
                  }}
                >
                  {data.modeBreakdown.map((m) => (
                    <div
                      key={m.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <svg width={20} height={20} viewBox="0 0 256 256">
                        <path d={MODE_ICONS[m.key]} fill={m.color} />
                      </svg>
                      <span
                        style={{
                          color: "#fff",
                          fontSize: 18,
                          fontWeight: 700,
                        }}
                      >
                        {m.label}
                      </span>
                      <span
                        style={{
                          color: "rgba(255,255,255,0.75)",
                          fontSize: 18,
                          fontWeight: 500,
                        }}
                      >
                        {m.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer — referral code on the left, GSI wordmark on the right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 30,
          }}
        >
          <span
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.85)",
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            Use code {data.referralCode} · shift.gogreenstreets.org
          </span>
          {/* GSI wordmark — Trebuchet MS bold ("Green Streets") + regular
              ("Initiative"). The .ttf files are bundled with the function
              and loaded server-side; they're never served publicly. */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 6,
              color: "#fff",
              fontFamily: "Trebuchet MS",
              fontSize: 18,
              letterSpacing: 0.4,
            }}
          >
            <span style={{ fontWeight: 700 }}>Green Streets</span>
            <span style={{ fontWeight: 400 }}>Initiative</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    },
  );
}
