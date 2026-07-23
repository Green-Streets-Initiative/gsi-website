/**
 * Employer Invite — Edge Function
 *
 * Adds (or re-invites) a teammate to an employer group's portal team and
 * sends them a branded invitation email with a sign-in link. This function
 * owns BOTH the group_admins upsert and the email so an invite can never
 * silently create access without telling the person (the pre-2026-07 flow
 * inserted the row client-side and sent nothing).
 *
 * Auth: caller must be a portal admin of the group, or a GSI admin
 * (school_roles.role = 'gsi_admin'). Gateway verify_jwt stays ON.
 *
 * POST { group_id, email, role: 'admin' | 'viewer', name?, variant? }
 *   variant 'welcome' — first-admin welcome email (includes the employee
 *   invite code); default is the teammate-invite email.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from "../_shared/supabase-admin.ts";
import { handleCorsPreflight, jsonResponse } from "../_shared/stripe.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM =
  Deno.env.get("RESEND_FROM_EMAIL") ?? "Shift <onboarding@resend.dev>";
const PORTAL_URL = "https://www.gogreenstreets.org/shift/employers/portal";
const LOGIN_URL = "https://www.gogreenstreets.org/shift/employers/login";

const SHIFT_WORDMARK_URL =
  "https://xyqcpgwbqrhykpgpqbdi.supabase.co/storage/v1/object/public/brand-assets/shift-wordmark-white.png?v=20260422";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildInviteHtml(opts: {
  companyName: string;
  inviterEmail: string;
  role: "admin" | "viewer";
  magicLink: string;
  variant: "invite" | "welcome";
  inviteCode: string | null;
}): string {
  const { companyName, inviterEmail, role, magicLink, variant, inviteCode } = opts;
  const roleLine =
    role === "admin"
      ? "As an <strong>admin</strong> you can manage settings, challenges, prizes, and the team."
      : "As a <strong>viewer</strong> you can see the dashboard, impact data, and reports.";
  const heading =
    variant === "welcome"
      ? `Welcome to Shift — ${escapeHtml(companyName)}`
      : `You've been added to the ${escapeHtml(companyName)} portal`;
  const intro =
    variant === "welcome"
      ? `Your ${escapeHtml(companyName)} employer account is ready. Use the portal to
         set up your company profile, invite your team, and launch your first
         commute challenge.`
      : `${escapeHtml(inviterEmail)} invited you to ${escapeHtml(companyName)}'s employer
         portal on Shift — where your team tracks green commutes, runs challenges,
         and measures its impact.`;
  const inviteCodeSection =
    variant === "welcome" && inviteCode
      ? `<div style="background:#F4F6F1;border-radius:10px;padding:16px 20px;margin:0 0 8px;">
           <p style="margin:0 0 6px;font-size:13px;color:#5A5C6E;">Your employees join with this invite code:</p>
           <p style="margin:0;font-family:monospace;font-size:26px;font-weight:700;letter-spacing:4px;color:#191A2E;">${escapeHtml(inviteCode)}</p>
         </div>`
      : "";
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
  <tr>
    <td style="background:#191A2E;padding:24px 32px;">
      <table cellpadding="0" cellspacing="0"><tr>
        <td><img src="${SHIFT_WORDMARK_URL}" alt="Shift" height="26" style="display:block;" /></td>
      </tr></table>
      <p style="margin:4px 0 0;font-size:12px;"><span style="color:#52B788;font-weight:700;">Green Streets</span> <span style="color:#FFFFFF;">Initiative</span></p>
    </td>
  </tr>
  <tr>
    <td style="padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;color:#191A2E;">${heading}</h1>
      <p style="font-size:14px;color:#374151;line-height:1.6;">${intro}</p>
      <p style="font-size:14px;color:#374151;line-height:1.6;">${roleLine}</p>
      ${inviteCodeSection}
      <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
        <tr>
          <td style="background:#BAF14D;border-radius:8px;">
            <a href="${escapeHtml(magicLink)}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#191A2E;text-decoration:none;">Open the portal &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#9CA3AF;line-height:1.6;">
        This sign-in link expires in 1 hour. After that, get a fresh one any time at
        <a href="${LOGIN_URL}" style="color:#2D6A4F;">${LOGIN_URL.replace("https://", "")}</a>
        — no password needed.
      </p>
    </td>
  </tr>
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
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  let body: {
    group_id?: string;
    email?: string;
    role?: string;
    name?: string;
    variant?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const groupId = body.group_id;
  const inviteeEmail = body.email?.trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "viewer";
  if (!groupId || !inviteeEmail || !inviteeEmail.includes("@")) {
    return jsonResponse({ error: "group_id and a valid email are required" }, 400);
  }

  const userSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !userData.user?.email) {
    return jsonResponse({ error: "Unauthenticated" }, 401);
  }
  const callerEmail = userData.user.email.toLowerCase();

  // Caller must be an admin of THIS group, or a GSI admin.
  const [{ data: callerAdmin }, { data: gsiRole }] = await Promise.all([
    userSupabase
      .from("group_admins")
      .select("role")
      .eq("group_id", groupId)
      .eq("email", callerEmail)
      .maybeSingle(),
    userSupabase
      .from("school_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "gsi_admin")
      .maybeSingle(),
  ]);
  const isGroupAdmin = callerAdmin?.role === "admin";
  const isGsiAdmin = !!gsiRole;
  if (!isGroupAdmin && !isGsiAdmin) {
    return jsonResponse({ error: "Only workspace admins can invite teammates" }, 403);
  }

  const admin = createAdminClient();

  const variant = body.variant === "welcome" ? "welcome" as const : "invite" as const;

  const { data: group } = await admin
    .from("groups")
    .select("id, name, status, invite_code")
    .eq("id", groupId)
    .maybeSingle();
  if (!group || !["active", "cancelled"].includes(group.status)) {
    return jsonResponse({ error: "Group not found or inactive" }, 404);
  }

  // Upsert the access row (re-inviting an existing teammate refreshes role/name
  // and resends the email rather than erroring).
  const { data: adminRow, error: upsertErr } = await admin
    .from("group_admins")
    .upsert(
      {
        group_id: groupId,
        email: inviteeEmail,
        role,
        name: body.name?.trim() || null,
        added_by: userData.user.id,
      },
      { onConflict: "group_id,email" },
    )
    .select("id, group_id, email, role, name, created_at, notification_prefs")
    .single();
  if (upsertErr || !adminRow) {
    console.error("[EmployerInvite] upsert failed:", upsertErr);
    return jsonResponse({ error: "Could not add teammate" }, 500);
  }

  // Sign-in link straight into the portal.
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: inviteeEmail,
    options: { redirectTo: PORTAL_URL },
  });

  let emailSent = false;
  if (!linkErr && linkData?.properties?.hashed_token && RESEND_API_KEY) {
    const magicLink = `${PORTAL_URL}?token_hash=${linkData.properties.hashed_token}&type=magiclink`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [inviteeEmail],
        subject:
          variant === "welcome"
            ? `Welcome to Shift — ${group.name}`
            : `You've been added to ${group.name}'s Shift portal`,
        html: buildInviteHtml({
          companyName: group.name,
          inviterEmail: callerEmail,
          role,
          magicLink,
          variant,
          inviteCode: group.invite_code ?? null,
        }),
      }),
    });
    emailSent = res.ok;
    if (!res.ok) {
      console.error(`[EmployerInvite] Resend failed: ${res.status} ${await res.text()}`);
    }
  } else if (linkErr) {
    console.error("[EmployerInvite] generateLink failed:", linkErr);
  }

  console.log(
    `[EmployerInvite] ${callerEmail} invited ${inviteeEmail} to ${group.name} as ${role} (email ${emailSent ? "sent" : "NOT sent"})`,
  );
  return jsonResponse({ admin_row: adminRow, email_sent: emailSent });
});
