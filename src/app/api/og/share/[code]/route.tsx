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

interface ShareCardData {
  firstName: string;
  lastInitial: string;
  neighborhood: string | null;
  tierName: string;
  shiftRate: number;
  lifetimeActive: number;
  streakDays: number;
  referralCode: string;
}

const TIER_DISPLAY: Record<string, string> = {
  starter: "Starter",
  mover: "Mover",
  shifter: "Shifter",
  leader: "Pacesetter",
  trailblazer: "Trailblazer",
};

const TIER_COLORS: Record<string, string> = {
  starter: "#8A8DA8",
  mover: "#2966E5",
  shifter: "#BAF14D",
  leader: "#EDB93C",
  trailblazer: "#BAF14D",
};

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
      "id, first_name, last_name, home_lat, home_lng, impact_non_car_trips",
    )
    .eq("referral_code", code)
    .maybeSingle();

  if (userErr || !user) return null;

  const userId = user.id as string;

  // Parallel fetch
  const [tierRes, streakRes, rateRes, neighborhoodIdRes] = await Promise.all([
    supabase
      .from("user_tiers")
      .select("status_tiers:current_tier_id(name)")
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
  ]);

  // Tier
  const tierName =
    ((tierRes.data?.status_tiers as { name?: string } | null)?.name) ??
    "starter";

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

  return {
    firstName: (user.first_name as string) || "Friend",
    lastInitial: ((user.last_name as string) || "").charAt(0),
    neighborhood,
    tierName,
    shiftRate,
    lifetimeActive: Number(user.impact_non_car_trips) || 0,
    streakDays,
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

  const [data, fontRegular, fontBold, fontExtra] = await Promise.all([
    loadShareData(code),
    loadBricolage(400),
    loadBricolage(700),
    loadBricolage(800),
  ]);

  const cacheHeaders = {
    "Cache-Control": "public, max-age=300, s-maxage=3600",
  };

  const fonts = [
    { name: "Bricolage Grotesque", data: fontRegular, weight: 400 as const, style: "normal" as const },
    { name: "Bricolage Grotesque", data: fontBold, weight: 700 as const, style: "normal" as const },
    { name: "Bricolage Grotesque", data: fontExtra, weight: 800 as const, style: "normal" as const },
  ];

  if (!data) {
    return new ImageResponse(<FallbackCard />, {
      width: 1200,
      height: 630,
      headers: cacheHeaders,
      fonts,
    });
  }

  const tierDisplay = TIER_DISPLAY[data.tierName] ?? "Starter";
  const tierColor = TIER_COLORS[data.tierName] ?? TIER_COLORS.starter;

  const displayName = data.lastInitial
    ? `${data.firstName} ${data.lastInitial}.`
    : data.firstName;

  // Ring math
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, data.shiftRate)) / 100;
  const dashOffset = circumference * (1 - progress);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          backgroundColor: NAVY,
          display: "flex",
          flexDirection: "column",
          padding: 60,
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
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: -1,
              }}
            >
              Shift
            </span>
            <svg width={56} height={36} viewBox="0 0 40 26">
              <path d="M0,0 L16,13 L0,26 L0,19 L10,13 L0,7Z" fill={LIME} />
              <path d="M20,0 L36,13 L20,26 L20,19 L30,13 L20,7Z" fill={BLUE} />
            </svg>
          </div>
          <span
            style={{
              display: "flex",
              color: "rgba(255,255,255,0.85)",
              fontSize: 24,
              fontWeight: 400,
            }}
          >
            Every trip counts.
          </span>
        </div>

        {/* Body — two columns */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 24,
          }}
        >
          {/* Left column */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span
              style={{
                color: "#fff",
                fontSize: 88,
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
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 30,
                  fontWeight: 500,
                  marginTop: 14,
                }}
              >
                {data.neighborhood}
              </span>
            )}
            {/* Tier badge */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                backgroundColor: "rgba(255,255,255,0.06)",
                padding: "12px 20px",
                borderRadius: 100,
                alignSelf: "flex-start",
                marginTop: 22,
              }}
            >
              <svg width={28} height={28} viewBox="0 0 32 32">
                <path
                  d="M2 5L14 16L2 27L2 22L8 16L2 10Z"
                  fill={tierColor}
                />
                <path
                  d="M17 5L29 16L17 27L17 22L23 16L17 10Z"
                  fill={tierColor}
                />
              </svg>
              <span
                style={{
                  color: "#fff",
                  fontSize: 28,
                  fontWeight: 700,
                }}
              >
                {tierDisplay}
              </span>
            </div>
          </div>

          {/* Right column — Shift rate ring */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 260,
                height: 260,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
              }}
            >
              <svg
                width={260}
                height={260}
                viewBox="0 0 260 260"
                style={{ position: "absolute", top: 0, left: 0 }}
              >
                <circle
                  cx={130}
                  cy={130}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.10)"
                  strokeWidth={18}
                />
                <circle
                  cx={130}
                  cy={130}
                  r={radius}
                  fill="none"
                  stroke={LIME}
                  strokeWidth={18}
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 130 130)"
                />
              </svg>
              <span
                style={{
                  color: "#fff",
                  fontSize: 84,
                  fontWeight: 800,
                  letterSpacing: -2,
                }}
              >
                {data.shiftRate}%
              </span>
            </div>
            <span
              style={{
                display: "flex",
                color: "rgba(255,255,255,0.85)",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1.5,
                marginTop: 14,
              }}
            >
              SHIFT RATE · 60D
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 60,
            marginTop: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
            }}
          >
            <span
              style={{
                color: LIME,
                fontSize: 44,
                fontWeight: 800,
              }}
            >
              {data.lifetimeActive}
            </span>
            <span
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1.5,
              }}
            >
              TRIPS
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
            }}
          >
            <span
              style={{
                color: FIRE,
                fontSize: 44,
                fontWeight: 800,
              }}
            >
              {data.streakDays}
            </span>
            <span
              style={{
                color: "rgba(255,255,255,0.85)",
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: 1.5,
              }}
            >
              DAY STREAK
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            marginTop: 24,
            color: "rgba(255,255,255,0.65)",
            fontSize: 20,
          }}
        >
          Use code {data.referralCode} · shift.gogreenstreets.org
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
