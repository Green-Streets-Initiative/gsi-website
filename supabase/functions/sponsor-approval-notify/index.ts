/**
 * Sponsor Approval Notify — Edge Function
 *
 * Sends an approval notification email to a rewards partner when their
 * application is approved by a GSI admin.
 *
 * Called from the admin dashboard via supabase.functions.invoke().
 * Auth: requires a valid Authorization header (admin JWT).
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "Shift Rewards <onboarding@resend.dev>";

const SHIFT_LOGO_URL =
  "https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-mark.png";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ApprovalPayload {
  sponsor_name: string;
  contact_name: string;
  contact_email: string;
  offer_description: string;
  dashboard_url: string;
  // Sticker fulfillment fields (optional — passed from admin when approving)
  sponsor_id?: string;
  sticker_requested?: boolean;
  address_line1?: string;
  city?: string;
  address_state?: string;
  address_zip?: string;
}

// ── Email template ──────────────────────────────────────────

function buildEmailHtml(payload: ApprovalPayload): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <!-- Header -->
  <tr>
    <td style="background:#191A2E;padding:24px 32px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="font-family:'Arial Black',Arial,sans-serif;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.5px;">Shift</td>
        <td style="padding-left:6px;"><img src="${SHIFT_LOGO_URL}" alt=">>" width="40" style="display:block;" /></td>
      </tr></table>
      <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="padding:32px;">
      <h1 style="margin:0 0 24px;font-size:20px;color:#191A2E;">You're approved!</h1>

      <p style="font-size:14px;color:#374151;line-height:1.6;">Hi ${escapeHtml(payload.contact_name)},</p>

      <p style="font-size:14px;color:#374151;line-height:1.6;">Great news &mdash; your application to join the Shift rewards network has been approved! Your offer is now live in the Shift rewards catalog.</p>

      <!-- Offer card -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#f9fafb;padding:16px 20px;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6B7280;font-weight:600;">Your offer</p>
            <p style="margin:0;font-size:14px;color:#191A2E;font-weight:600;line-height:1.5;">${escapeHtml(payload.offer_description)}</p>
          </td>
        </tr>
      </table>

      <!-- CTA button -->
      <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td style="background:#BAF14D;border-radius:8px;">
            <a href="${escapeHtml(payload.dashboard_url)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#191A2E;text-decoration:none;">Go to your partner dashboard &rarr;</a>
          </td>
        </tr>
      </table>

      <!-- How redemption works -->
      <h2 style="margin:32px 0 12px;font-size:16px;color:#191A2E;">How redemption works</h2>
      <p style="font-size:14px;color:#374151;line-height:1.6;margin-bottom:16px;">Shift users earn points by walking, biking, and taking transit. When they have enough points, they can redeem your offer. Here's what happens at the point of sale:</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="background:#f0fdf4;padding:16px 20px;">
            <p style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#2D6A4F;font-weight:700;">3-Step Cashier Guide</p>
            <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;line-height:1.8;">
              <tr><td style="padding:4px 0;"><strong>1.</strong>&nbsp; Customer shows a QR code on their phone</td></tr>
              <tr><td style="padding:4px 0;"><strong>2.</strong>&nbsp; Scan it with your phone's camera app</td></tr>
              <tr><td style="padding:4px 0;"><strong>3.</strong>&nbsp; Tap <strong>"Confirm Redemption"</strong> on the web page that opens</td></tr>
            </table>
            <p style="font-size:13px;color:#6B7280;margin-top:12px;line-height:1.5;">Can't scan? Ask the customer to show the reward details on their screen. Each QR code can only be used once.</p>
          </td>
        </tr>
      </table>

      <!-- Printable guide link -->
      <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
        <tr>
          <td style="background:#f3f4f6;border-radius:8px;">
            <a href="https://gsi-website-ruddy.vercel.app/cashier-guide.html" style="display:inline-block;padding:10px 20px;font-size:13px;font-weight:600;color:#191A2E;text-decoration:none;">🖨️ Print cashier guide for your POS &rarr;</a>
          </td>
        </tr>
      </table>

      <!-- What happens next -->
      <h2 style="margin:32px 0 12px;font-size:16px;color:#191A2E;">What happens next?</h2>
      <table cellpadding="0" cellspacing="0" style="font-size:14px;color:#374151;line-height:1.8;">
        <tr><td style="padding:2px 0;">&bull;&nbsp; Shift users in your area can now see and redeem your offer</td></tr>
        <tr><td style="padding:2px 0;">&bull;&nbsp; You'll receive a monthly report showing redemption activity</td></tr>
        <tr><td style="padding:2px 0;">&bull;&nbsp; Log in to your dashboard anytime to update your offer or contact info</td></tr>
        <tr><td style="padding:2px 0;">&bull;&nbsp; Print the cashier guide above and keep it near the register</td></tr>
      </table>

      <p style="font-size:14px;color:#374151;margin-top:28px;line-height:1.6;">Thank you for supporting active transportation in your community!</p>

      <p style="font-size:13px;color:#9CA3AF;margin-top:24px;">Questions? Reply to this email or contact us at info@gogreenstreets.org</p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;"><a href="https://gogreenstreets.org" style="color:#9CA3AF;text-decoration:none;">Green Streets Initiative</a> &middot; Shift Rewards Program</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Resend email sender ─────────────────────────────────────

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ id?: string; error?: string }> {
  if (!RESEND_API_KEY) {
    console.log(`[SponsorApproval] No RESEND_API_KEY — skipping email to ${to}`);
    return { id: "dry-run-no-key" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `Resend ${res.status}: ${text}` };
  }

  const data = await res.json();
  return { id: data.id };
}

// ── Main handler ────────────────────────────────────────────

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  // Auth — require a valid Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  // Parse body
  let body: ApprovalPayload;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  // Validate required fields
  const required: (keyof ApprovalPayload)[] = [
    "sponsor_name",
    "contact_name",
    "contact_email",
    "offer_description",
    "dashboard_url",
  ];
  const missing = required.filter((f) => !body[f] || typeof body[f] !== "string");
  if (missing.length > 0) {
    return new Response(
      JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  // Build and send email
  const subject = "You're approved! Your Shift rewards listing is live";
  const html = buildEmailHtml(body);

  const { id: messageId, error: sendErr } = await sendEmail(
    body.contact_email,
    subject,
    html
  );

  if (sendErr) {
    console.error(`[SponsorApproval] Failed for ${body.sponsor_name}: ${sendErr}`);
    return new Response(
      JSON.stringify({ success: false, error: sendErr }),
      { status: 502, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  console.log(
    `[SponsorApproval] Sent approval email to ${body.contact_email} for ${body.sponsor_name} (message: ${messageId})`
  );

  // Trigger sticker order if requested
  let stickerResult: { ok?: boolean; error?: string } = {};
  if (body.sticker_requested && body.sponsor_id && body.address_line1 && body.city && body.address_state && body.address_zip) {
    try {
      const stickerRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/trigger-sticker-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            partner_id: body.sponsor_id,
            business_name: body.sponsor_name,
            address_line1: body.address_line1,
            city: body.city,
            state: body.address_state,
            zip: body.address_zip,
          }),
        }
      );
      stickerResult = await stickerRes.json();
      if (stickerRes.ok) {
        console.log(`[SponsorApproval] Sticker order placed for ${body.sponsor_name}`);
      } else {
        console.error(`[SponsorApproval] Sticker order failed for ${body.sponsor_name}:`, stickerResult);
      }
    } catch (e) {
      console.error(`[SponsorApproval] Sticker order error for ${body.sponsor_name}:`, e);
      stickerResult = { error: String(e) };
    }
  }

  return new Response(
    JSON.stringify({ success: true, message_id: messageId, sticker: stickerResult }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
  );
});
