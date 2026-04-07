/**
 * Employer Magic Link — Edge Function
 *
 * Sends a magic-link login email to an employer admin.
 * Validates that the email belongs to an active employer group before sending.
 * Always returns success to avoid leaking whether an email exists.
 *
 * Called from the /shift/employers marketing page login form.
 * Auth: public (--no-verify-jwt) — anyone can request a link.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "Shift <onboarding@resend.dev>";

const SHIFT_LOGO_URL =
  "https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-mark.png";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(companyName: string, magicLink: string): string {
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
      <h1 style="margin:0 0 24px;font-size:20px;color:#191A2E;">Sign in to your employer portal</h1>
      <p style="font-size:14px;color:#374151;line-height:1.6;">Click the button below to sign in to the ${escapeHtml(companyName)} employer portal on Shift.</p>
      <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td style="background:#BAF14D;border-radius:8px;">
            <a href="${escapeHtml(magicLink)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#191A2E;text-decoration:none;">Sign in to portal &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#9CA3AF;line-height:1.6;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#9CA3AF;"><a href="https://gogreenstreets.org" style="color:#9CA3AF;text-decoration:none;">Green Streets Initiative</a> &middot; Shift Employer Platform</p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

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

  let body: { email?: string; redirect_to?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return new Response(
      JSON.stringify({ error: "Email is required" }),
      { status: 400, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  const redirectTo = body.redirect_to ?? "https://gogreenstreets.org/shift/employers/portal";

  // Always return success to avoid leaking whether email exists
  const successResponse = new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { "Content-Type": "application/json", ...CORS } }
  );

  // Check if email belongs to an active employer group
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, admin_email")
    .eq("admin_email", email)
    .in("status", ["active", "cancelled"])
    .limit(1)
    .single();

  if (!group) {
    console.log(`[EmployerMagicLink] No active group for ${email}`);
    return successResponse;
  }

  // Generate magic link
  const { data: linkData, error: linkErr } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo },
    });

  if (linkErr || !linkData?.properties?.hashed_token) {
    console.error(`[EmployerMagicLink] generateLink failed for ${email}:`, linkErr);
    return successResponse;
  }

  // Build the magic link URL with token
  const token = linkData.properties.hashed_token;
  const magicLink = `${redirectTo}?token_hash=${token}&type=magiclink`;

  // Send email via Resend
  if (RESEND_API_KEY) {
    const html = buildEmailHtml(group.name, magicLink);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [email],
        subject: `Sign in to your ${group.name} employer portal`,
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[EmployerMagicLink] Resend failed: ${res.status} ${text}`);
    } else {
      console.log(`[EmployerMagicLink] Sent magic link to ${email} for ${group.name}`);
    }
  } else {
    console.log(`[EmployerMagicLink] No RESEND_API_KEY — skipping email to ${email}`);
  }

  return successResponse;
});
