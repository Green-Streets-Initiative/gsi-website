import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient } from "../_shared/supabase-admin.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "Shift Rewards <onboarding@resend.dev>";
const ADMIN_EMAILS = ["keith@gogreenstreets.org", "info@gogreenstreets.org"];
const ADMIN_DASHBOARD_URL =
  "https://shift-admin.vercel.app/admin/sponsors";

async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
): Promise<void> {
  const recipients = Array.isArray(to) ? to : [to];
  if (!RESEND_API_KEY) {
    console.log(`[SponsorIntake] No RESEND_API_KEY — skipping email to ${recipients.join(", ")}`);
    return;
  }
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: RESEND_FROM, to: recipients, subject, html }),
    });
  } catch (e) {
    console.error(`[SponsorIntake] Email send failed to ${recipients.join(", ")}:`, e);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Public sponsor intake form endpoint.
 *
 * Accepts POST with business info, validates fields, rate-limits by IP,
 * and inserts into sponsor_applications with status 'pending'.
 *
 * Auth: none required (--no-verify-jwt). Public endpoint for the GSI website form.
 * Rate limit: 3 submissions per IP per hour (in-memory, resets on cold start).
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_REFERRAL_SOURCES = [
  "Email from Green Streets",
  "Another business owner",
  "Social media",
  "Community event",
  "AI assistant",
  "Other",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Simple in-memory rate limiter — resets on cold start, acceptable for V1
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS,
  );
  rateLimitMap.set(ip, timestamps);

  if (timestamps.length >= RATE_LIMIT_MAX) return true;

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Rate limiting
  const clientIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("cf-connecting-ip") ??
    "unknown";

  if (isRateLimited(clientIp)) {
    return json(
      { error: "Too many submissions. Please try again later." },
      429,
    );
  }

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  // Validate required fields
  const errors: string[] = [];

  const businessName = String(body.business_name ?? "").trim();
  if (!businessName) errors.push("Business name is required");
  if (businessName.length > 200) errors.push("Business name too long");

  const address = String(body.address ?? "").trim();
  if (!address) errors.push("Address is required");

  const city = String(body.city ?? "").trim();
  if (!city) errors.push("City is required");

  const contactName = String(body.contact_name ?? "").trim();
  if (!contactName) errors.push("Contact name is required");

  const contactEmail = String(body.contact_email ?? "").trim();
  if (!contactEmail) errors.push("Contact email is required");
  else if (!EMAIL_RE.test(contactEmail))
    errors.push("Invalid email format");

  const contactPhone = body.contact_phone
    ? String(body.contact_phone).trim()
    : null;

  // Community Partners cross-promote without a discount, so the discount
  // fields and offer_description aren't required.
  const partnerKind =
    String(body.partner_kind ?? "rewards").trim() === "community"
      ? "community"
      : "rewards";
  const isCommunityPartner = partnerKind === "community";

  const offerDescription = String(body.offer_description ?? "").trim();
  if (!offerDescription && !isCommunityPartner) errors.push("Offer description is required");
  if (offerDescription.length > 1000)
    errors.push("Offer description too long");

  const offerLimits = body.offer_limits
    ? String(body.offer_limits).trim()
    : null;
  if (offerLimits && offerLimits.length > 500)
    errors.push("Offer limits too long");

  const referralSource = body.referral_source
    ? String(body.referral_source).trim()
    : null;
  if (referralSource && !VALID_REFERRAL_SOURCES.includes(referralSource)) {
    errors.push("Invalid referral source");
  }

  const logoUrl = body.logo_url ? String(body.logo_url).trim() : null;
  const websiteUrl = body.website_url ? String(body.website_url).trim() : null;

  // Sticker request + structured address for Printful shipping
  const stickerRequested = body.sticker_requested === true;
  const stickerRequestedAt = stickerRequested
    ? (body.sticker_requested_at ? String(body.sticker_requested_at) : new Date().toISOString())
    : null;
  const addressLine1 = body.address_line1 ? String(body.address_line1).trim() : null;
  const addressState = body.address_state ? String(body.address_state).trim() : null;
  const addressZip = body.address_zip ? String(body.address_zip).trim() : null;

  // Structured offer limits (all optional)
  const VALID_FREQUENCIES = ["daily", "weekly", "monthly"];
  const redemptionFrequency = body.redemption_frequency
    ? String(body.redemption_frequency).trim()
    : null;
  if (redemptionFrequency && !VALID_FREQUENCIES.includes(redemptionFrequency)) {
    errors.push("Invalid redemption frequency");
  }

  const totalRedemptionCap =
    body.total_redemption_cap != null
      ? Math.max(1, Math.floor(Number(body.total_redemption_cap)))
      : null;
  if (body.total_redemption_cap != null && isNaN(Number(body.total_redemption_cap))) {
    errors.push("Total redemption cap must be a number");
  }

  const expirationDate = body.expiration_date
    ? String(body.expiration_date).trim()
    : null;

  // Channel + online discount fields
  const VALID_CHANNELS = ["in_store", "online", "both"];
  const channel = body.channel ? String(body.channel).trim() : "in_store";
  if (!VALID_CHANNELS.includes(channel)) {
    errors.push("Invalid channel value");
  }

  const discountCode = body.discount_code
    ? String(body.discount_code).trim()
    : null;
  const redemptionUrl = body.redemption_url
    ? String(body.redemption_url).trim()
    : null;

  // Online/both channels require a discount code and website URL
  // (Rewards Partners only — Community Partners don't have a discount).
  if (!isCommunityPartner) {
    if ((channel === "online" || channel === "both") && !discountCode) {
      errors.push("Discount code is required for online partners");
    }
    if ((channel === "online" || channel === "both") && !websiteUrl && !redemptionUrl) {
      errors.push("Website URL is required for online partners");
    }
  }

  // New discount fields (from structured form)
  const discountDescription = body.discount_description
    ? String(body.discount_description).trim()
    : null;
  const VALID_DISCOUNT_TYPES = ["percentage", "fixed_amount", "freebie", "custom"];
  const discountType = body.discount_type
    ? String(body.discount_type).trim()
    : null;
  if (discountType && !VALID_DISCOUNT_TYPES.includes(discountType)) {
    errors.push("Invalid discount type");
  }
  const discountValue = body.discount_value != null
    ? Number(body.discount_value)
    : null;

  const preferredMinimumTier = body.preferred_minimum_tier
    ? String(body.preferred_minimum_tier).trim()
    : "mover";

  const VALID_REDEMPTION_LIMITS = ["none", "once_per_visit", "once_per_day", "once_per_week", "once_per_month"];
  const redemptionLimit = body.redemption_limit
    ? String(body.redemption_limit).trim()
    : "none";
  if (!VALID_REDEMPTION_LIMITS.includes(redemptionLimit)) {
    errors.push("Invalid redemption limit");
  }

  // Location coordinates
  const locationLat = body.location_lat != null ? Number(body.location_lat) : null;
  const locationLng = body.location_lng != null ? Number(body.location_lng) : null;

  if (body.agreement_accepted !== true) {
    errors.push("Agreement must be accepted");
  }

  // E-signature fields
  const signerName = String(body.signer_name ?? "").trim();
  if (!signerName) errors.push("Signer name is required");

  const signerTitle = body.signer_title
    ? String(body.signer_title).trim()
    : null;

  if (errors.length > 0) {
    return json({ error: errors.join("; ") }, 400);
  }

  // Insert application
  const supabase = createAdminClient();

  // Build e-signature record
  const agreementData = {
    signer_name: signerName,
    signer_title: signerTitle,
    signed_at: new Date().toISOString(),
    ip_address: clientIp,
    agreement_version: "v1",
  };

  const { error: insertError } = await supabase
    .from("sponsor_applications")
    .insert({
      business_name: businessName,
      address,
      city,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      logo_url: logoUrl,
      offer_description: offerDescription,
      offer_limits: offerLimits,
      referral_source: referralSource,
      website_url: websiteUrl,
      redemption_frequency: redemptionFrequency,
      total_redemption_cap: totalRedemptionCap,
      expiration_date: expirationDate,
      agreement_accepted: true,
      agreement_data: agreementData,
      status: "pending",
      sticker_requested: stickerRequested,
      sticker_requested_at: stickerRequestedAt,
      address_line1: addressLine1,
      address_state: addressState,
      address_zip: addressZip,
      channel,
      discount_code: isCommunityPartner ? null : discountCode,
      redemption_url: redemptionUrl ?? websiteUrl,
      discount_description: isCommunityPartner ? null : discountDescription,
      discount_type: isCommunityPartner ? null : discountType,
      discount_value: isCommunityPartner ? null : discountValue,
      preferred_minimum_tier: preferredMinimumTier,
      redemption_limit: isCommunityPartner ? "none" : redemptionLimit,
      location_lat: locationLat,
      location_lng: locationLng,
      partner_kind: partnerKind,
    });

  if (insertError) {
    console.error("sponsor-intake insert error:", insertError.message);

    // Unique constraint violation — duplicate submission
    if (insertError.code === "23505") {
      return json(
        {
          error:
            "An application for this business and email is already on file. If you need to update it, please contact us.",
        },
        409,
      );
    }

    return json(
      { error: "Failed to submit application. Please try again." },
      500,
    );
  }

  // Fire-and-forget: send confirmation to applicant + notification to admin
  const confirmationHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;color:#374151;">
      <div style="background:#191A2E;padding:20px 24px;border-radius:12px 12px 0 0;">
        <span style="color:#BAF14D;font-weight:800;font-size:18px;">Shift</span>
        <span style="color:#888;font-size:13px;margin-left:4px;">by Green Streets Initiative</span>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 12px 12px;">
        <h2 style="margin:0 0 16px;font-size:18px;color:#191A2E;">We received your application</h2>
        <p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(contactName)},</p>
        <p style="font-size:14px;line-height:1.6;">Thanks for applying to join the Shift rewards network with <strong>${escapeHtml(businessName)}</strong>. We'll review your application within a few business days and be in touch.</p>
        <p style="font-size:13px;color:#9CA3AF;margin-top:20px;">Questions? Reply to this email or contact us at info@gogreenstreets.org</p>
      </div>
    </div>`;

  const adminHtml = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:0 auto;color:#374151;">
      <h2 style="color:#191A2E;">New Rewards Partner Application</h2>
      <table style="font-size:14px;line-height:1.8;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-weight:600;">Business</td><td>${escapeHtml(businessName)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-weight:600;">City</td><td>${escapeHtml(city)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-weight:600;">Contact</td><td>${escapeHtml(contactName)} &lt;${escapeHtml(contactEmail)}&gt;</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-weight:600;">Offer</td><td>${escapeHtml(offerDescription)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-weight:600;">Channel</td><td>${channel === "online" ? "Online" : channel === "both" ? "In-store & Online" : "In-store"}</td></tr>${discountCode ? `
        <tr><td style="padding:4px 12px 4px 0;color:#6B7280;font-weight:600;">Discount Code</td><td style="font-family:monospace;font-weight:700;">${escapeHtml(discountCode)}</td></tr>` : ""}
      </table>
      <p style="margin-top:16px;"><a href="${ADMIN_DASHBOARD_URL}" style="color:#2966E5;">Review in admin dashboard →</a></p>
    </div>`;

  sendEmail(
    contactEmail,
    "We received your Shift rewards partner application",
    confirmationHtml,
  );
  sendEmail(
    ADMIN_EMAILS,
    `New rewards partner application: ${businessName}`,
    adminHtml,
  );

  return json({
    success: true,
    message:
      "Thanks for joining the Shift rewards network! We'll review your application within 48 hours.",
  });
});
