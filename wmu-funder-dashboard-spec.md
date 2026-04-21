# What Moves Us — Funder Campaign Dashboard Spec

## Overview

A read-only, publicly accessible dashboard at `gogreenstreets.org/whatmovesus/dashboard/[campaign_slug]` that gives funders/partners visibility into a specific WMU campaign's performance, recruitment assets, and submissions — without admin privileges.

Access is gated by a **magic link** (no account required). Keith generates the link from the admin dashboard; the link contains a signed JWT scoped to a single campaign. Links expire after a configurable TTL (default 90 days) and can be revoked from admin.

---

## Route & Auth

| Concern | Detail |
|---|---|
| **Public route** | `/whatmovesus/dashboard/[campaign_slug]` |
| **Auth mechanism** | Query param `?token=<JWT>` on first visit → sets `httpOnly` cookie for session. No Supabase auth row needed. |
| **JWT payload** | `{ campaign_id, exp, iat, scope: "wmu_funder_readonly" }` |
| **JWT signing** | Supabase Edge Function (`/functions/v1/wmu-funder-token`) using a dedicated secret (`WMU_FUNDER_JWT_SECRET`). |
| **Middleware** | Next.js middleware validates token/cookie on every request to this route. Invalid/expired → redirect to a branded "Link expired — contact GSI" page. |
| **Admin generation** | Admin dashboard gets a "Generate funder link" button per campaign → calls Edge Function → returns full URL with token. Also supports "Revoke all funder links" (rotates the campaign-level nonce stored in `wmu_campaigns.funder_link_nonce`; all previously issued JWTs fail validation). |

---

## Data Access (RLS / Edge Functions)

The funder dashboard does **not** use Supabase client-side auth. All data is fetched via a single **Supabase Edge Function** (`/functions/v1/wmu-funder-dashboard-data`) that:

1. Validates the JWT from the request header.
2. Checks `wmu_campaigns.funder_link_nonce` matches the nonce in the JWT (revocation check).
3. Returns a single JSON payload with all dashboard sections (see below).
4. Uses `service_role` key server-side — no RLS policies needed for this path.

This keeps the blast radius small: one function, one secret, no new RLS surface.

---

## Dashboard Sections

### 1. Campaign Header

Pulled from `wmu_campaigns`.

| Field | Source |
|---|---|
| Campaign title | `title` |
| Campaign status | `status` (active / paused / completed) |
| Date range | `start_date` / `end_date` |
| Description | `description` (first 280 chars) |
| Hero image | `hero_image_url` |

---

### 2. Submission Funnel (summary stats)

Aggregated server-side from `wmu_submissions`.

| Metric | Derivation |
|---|---|
| **Page views** | `wmu_campaign_analytics.page_views` (if tracked; otherwise omit) |
| **Submissions started** | COUNT where `status IN ('draft','submitted','in_review','approved','published')` |
| **Submissions completed** | COUNT where `status IN ('submitted','in_review','approved','published')` |
| **Approved** | COUNT where `status IN ('approved','published')` |
| **Published** | COUNT where `status = 'published'` |

Display as a horizontal funnel bar or simple stat cards. Completion rate (completed / started) shown as a percentage.

---

### 3. Recruit Source Breakdown

Aggregated from `wmu_submissions.recruit_source`.

| Field | Display |
|---|---|
| `recruit_source` | Grouped counts — e.g., `qr_code: 12, email_blast: 8, social_media: 5, direct_link: 3, other: 2` |

Displayed as a donut or horizontal bar chart. If `recruit_source` is NULL, bucket as "Unknown."

Uses existing `recruit_source` values from `wmu_submissions`. Display labels should match the admin dashboard (e.g., "App Targeted", "Deeplink", "Direct", "Trip Prompt").

---

### 4. Recruitment Assets

Static/derived links and embeddable assets for the campaign, so the funder can easily grab and share them.

| Asset | Source / Generation |
|---|---|
| **Submission intake URL** | `https://gogreenstreets.org/whatmovesus/submit/[campaign_slug]` |
| **QR code (SVG)** | Generated server-side (Edge Function) encoding the intake URL with `?src=qr_code`. Rendered inline; download button. |
| **Embeddable social share text** | Stored in `wmu_campaigns.social_share_text` — displayed in a copy-to-clipboard box. |
| **Campaign flyer (PDF)** | `wmu_campaigns.flyer_url` — download link if present, otherwise hidden. |

Each asset has a one-click **Copy** button.

---

### 5. Submissions List

A read-only view of **all submissions regardless of status**, so funders can watch the campaign fill in real time. **No PII beyond first name and last initial** — funders see a de-identified view.

| Column | Source | Notes |
|---|---|---|
| Display name | `first_name` + last initial of `last_name` | e.g., "Maria T." |
| Submitted at | `submitted_at` | Formatted date |
| Status | `status` | Badge: draft / submitted / in_review / approved / published |
| Neighborhood | `neighborhood` | If captured |
| Primary mode | `primary_mode` | walk / bike / transit |
| Recruit source | `recruit_source` | |

Sorted by `submitted_at DESC`. No edit/delete/approve actions.

#### Inline Submission Detail

Clicking a row expands an inline detail panel (accordion or slide-out) showing the submission content:

| Content type | Display |
|---|---|
| **Video** | Embedded video player (Supabase Storage signed URL, short-lived). |
| **Text response** | Rendered as formatted text. |
| **Photos** | Thumbnail grid (Supabase Storage signed URLs). Click to lightbox. |
| **Prompt/question answered** | Shown as label above each response block for context. |

Signed URLs for media are generated by the Edge Function with a short TTL (e.g., 1 hour) to prevent link sharing. The Edge Function returns these as part of the submission detail payload — fetched on-demand when a row is expanded (not pre-loaded for the full list).

Pagination: server-side, 25 per page. Edge Function accepts `page` param.

---

## UI / Layout

- Uses the existing GSI site layout (nav, footer) — it's a Next.js page, not a standalone app.
- Responsive; works on mobile (funders often check on phones).
- Minimal chrome: the page is a single scrollable dashboard, not a tabbed SPA.
- Section order: Header → Funnel Stats → Recruit Source Chart → Recruitment Assets → Submissions Table.
- Chart library: use Recharts (already available in the Next.js project) for the recruit source chart and funnel visualization.
- Loading state: skeleton shimmer while the Edge Function returns.

---

## New Database Objects

| Object | Type | Detail |
|---|---|---|
| `wmu_campaigns.funder_link_nonce` | `UUID` column, default `gen_random_uuid()` | For link revocation. |
| `wmu_campaigns.social_share_text` | `TEXT` column | Optional campaign share copy. |
| `wmu_campaigns.flyer_url` | `TEXT` column | Optional PDF link. |
| `wmu_campaign_analytics` | Table (optional, V2) | `campaign_id, date, page_views, unique_visitors`. Only if we add analytics tracking to the submit page. |
| Edge Function: `wmu-funder-token` | Supabase Edge Function | Generates signed JWT for a campaign. Called from admin. |
| Edge Function: `wmu-funder-dashboard-data` | Supabase Edge Function | Returns all dashboard data for a valid token. |
| Edge Function: `wmu-funder-submission-detail` | Supabase Edge Function | Returns single submission content + short-lived signed URLs for media. Called on row expand. |

---

## Admin-Side Additions

On the existing WMU admin campaign detail view, add:

1. **"Funder Dashboard" card** with:
   - "Generate Link" button → calls `wmu-funder-token` → displays copyable URL.
   - "Revoke All Links" button → regenerates `funder_link_nonce` → confirms.
   - Shows current link status (active / revoked) and expiry.

---

## Out of Scope (V1)

- Funder login / account system — magic link only.
- Real-time page view analytics — funnel starts at "submissions started."
- Multi-campaign aggregate view — one dashboard per campaign.
- Export / CSV download for funders.
- Funder-side commenting or approval actions.

---

## Implementation Sequence

1. **Schema migration:** Add columns (`funder_link_nonce`, `social_share_text`, `flyer_url`).
2. **Edge Function: `wmu-funder-token`** — JWT generation + admin endpoint.
3. **Edge Function: `wmu-funder-dashboard-data`** — campaign data aggregation + JWT validation. Returns summary stats, recruit source counts, recruitment assets, and paginated submission list.
4. **Edge Function: `wmu-funder-submission-detail`** — Returns submission content (text, video signed URL, photo signed URLs) for a single submission. Called on row expand. Short-lived signed URLs (1hr TTL).
5. **Next.js page:** `/whatmovesus/dashboard/[campaign_slug]` — layout, stat cards, chart, asset section, expandable submissions table with inline content.
6. **Next.js middleware:** Token/cookie validation for the dashboard route.
7. **Admin UI:** Funder link generation card on campaign detail view.
