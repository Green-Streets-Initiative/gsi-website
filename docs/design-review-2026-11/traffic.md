# Traffic and measurement: gogreenstreets.org

Pulled 2026-11-17 from PostHog (read-only). Source: project **436603 "Default project"**, the only project in the org. The website and the Shift app both send to it, so every website number below is filtered to `$host` = `www.gogreenstreets.org` / `gogreenstreets.org` (the app's `$screen` events and its own custom events are left out).

**Windows.** Website capture starts **2026-08-19**, so "90 days" = 2026-08-19 → 2026-11-17 (the whole history) and "30 days" = 2026-10-18 → 2026-11-17. All counts are in UTC. "Visitors" = unique PostHog persons. Weeks start on Monday. The week of 11-16 has only two days.

**What was excluded** (90-day pageviews, applied in this order):

| Bucket | Pageviews | Visitors |
|---|---:|---:|
| Declared bots (Google Play Store / AdWords checkers, Sogou, WebPageTest, Claude Desktop etc.) | 670 | 638 |
| Internal: the GSI Somerville IP (Keith plus agent browser sessions: 99 "persons" over 71 days) | 875 | 99 |
| Outside the US. This covers CN/SG/HK datacenter crawlers and a headless-Chrome spam bot on residential proxies in Europe that submitted `/events/submit` 668 times. About 700 real foreign visitors go out with them. | 2,879 | 2,482 |
| US cloud datacenters on desktop: Azure (Boydton, Des Moines, San Antonio, Phoenix), AWS/GCP (Columbus, Ashburn, Boardman, Council Bluffs…) and desktop hits with no city. Most look like link scanners (Outlook Safe Links and similar): one pageview, no clicks. | 3,519 | 2,023 |
| **Kept (used below)** | **10,586** | **6,711** |

Not in the raw total at all: about 3,400 localhost dev pageviews, 151 on `gsi-website-ruddy.vercel.app` previews and 269 on `shiftatwork.org`, a mirror of the site whose top page is `/` with 90 visitors. **43% of raw website pageviews were not people in the audience.**

---

## 1. Visitors and pageviews

| Period | Pageviews | Visitors | Sessions | Pages / session | Mobile share of visitors |
|---|---:|---:|---:|---:|---:|
| 90 days (08-19 → 11-17) | 10,585 | 6,710 | 7,587 | 1.40 | 74% |
| Last 30 days (10-18 → 11-17) | 5,826 | 3,714 | 4,196 | 1.39 | 75% |
| Days 31–90 | 4,759 | 3,046 | 3,391 | 1.40 | 73% |

Weekly (clean):

| Week of | Pageviews | Visitors | Sessions | Mobile |
|---|---:|---:|---:|---:|
| 08-17 (from 08-19) | 96 | 50 | 65 | 32% |
| 08-24 | 278 | 116 | 136 | 43% |
| 08-31 | 148 | 97 | 101 | 63% |
| 09-07 | 95 | 63 | 72 | 48% |
| 09-14 | 503 | 320 | 357 | 57% |
| 09-21 | 878 | 574 | 617 | 74% |
| 09-28 | 826 | 513 | 567 | 75% |
| 10-05 | 1,115 | 810 | 842 | 82% |
| 10-12 | 854 | 625 | 663 | 79% |
| 10-19 | 1,086 | 730 | 816 | 73% |
| 10-26 | 1,431 | 983 | 1,066 | 77% |
| 11-02 | 1,057 | 725 | 794 | 73% |
| 11-09 | 1,741 | 1,082 | 1,190 | 76% |
| 11-16 (2 days) | 477 | 283 | 302 | 79% |

The rise from mid-September follows the paid campaigns (section 4), not organic growth.

## 2. Top pages by unique visitors (clean)

Dynamic paths are grouped. "URLs" is how many distinct pages fall in the group. Mobile is the share of the group's visitors on phones.

| # | Page group | Visitors 90d | Pageviews 90d | Visitors 30d | Mobile | URLs |
|---:|---|---:|---:|---:|---:|---:|
| 1 | /shift-your-semester/[school] | 1,283 | 1,562 | 260 | 81% | 13 |
| 2 | /shift | 1,110 | 1,279 | 846 | 93% | 1 |
| 3 | /events/[id] | 1,074 | 1,829 | 620 | 62% | 403 |
| 4 | /nearby | 694 | 837 | 108 | 90% | 1 |
| 5 | /events | 658 | 1,041 | 535 | 88% | 1 |
| 6 | /guides/[slug] | 532 | 658 | 420 | 32% | 27 |
| 7 | /bike-lessons | 441 | 497 | 441 | 97% | 1 |
| 8 | / (home) | 362 | 470 | 136 | 42% | 1 |
| 9 | /shift/employers/challenge | 182 | 260 | 182 | 79% | 1 |
| 10 | /shift/towns/[slug] | 177 | 227 | 81 | 41% | 38 |
| 11 | /shift-your-semester (hub) | 140 | 198 | 17 | 91% | 1 |
| 12 | /about | 116 | 136 | 51 | 55% | 1 |
| 13 | /shift/roams/[id] | 110 | 133 | 36 | 69% | 22 |
| 14 | /shift/towns | 90 | 133 | 37 | 50% | 1 |
| 15 | /challenges | 68 | 83 | 27 | 49% | 1 |
| 16 | /programs/what-moves-us/[page] | 68 | 79 | 26 | 34% | 6 |
| 17 | /trails/[slug] (launched 11-04) | 68 | 85 | 68 | 44% | 21 |
| 18 | /programs | 57 | 71 | 12 | 39% | 1 |
| 19 | /parking/[venue] (launched ~11-02) | 53 | 59 | 53 | 42% | 5 |
| 20 | /get-involved | 47 | 57 | 16 | 30% | 1 |
| 21 | /events/walk-ride-day/* | 46 | 53 | 7 | 72% | 7 |
| 22 | /guides (index) | 36 | 65 | 15 | 33% | 1 |
| 23 | /links (Instagram bio) | 32 | 43 | 32 | 91% | 1 |
| 24 | /events/shift-your-summer/* | 31 | 47 | 3 | 48% | 3 |
| 25 | /events/organizers/[slug] | 29 | 43 | 29 | 59% | 14 |
| 26 | /commute-advisor | 29 | 30 | 15 | 69% | 2 |
| 27 | /contact | 24 | 27 | 8 | 25% | 1 |
| 28 | /walkma | 21 | 23 | 21 | 62% | 1 |
| 29 | /[es, pt-BR, zh-Hans]/guides/[slug] | 20 | 35 | 20 | 75% | 15 |
| 30 | /together | 19 | 36 | 19 | 42% | 1 |
| 31 | /programs/walk-ride-days | 18 | 20 | 9 | 61% | 1 |
| 32 | /press | 18 | 18 | 13 | 67% | 1 |
| 33 | /help | 17 | 23 | 6 | 71% | 1 |
| 34 | /trails (index) | 17 | 25 | 17 | 24% | 1 |
| 35 | /shift/employers | 12 | 16 | 7 | 17% | 1 |
| 36 | Broken email links (`/shift/1/0100…=452`, `/preferences/1/…`) | 12 | 12 | 0 | 42% | 5 |
| 37 | /shift/rewards-partners | 11 | 11 | 3 | 73% | 1 |
| 38 | /shift/schools | 11 | 16 | 4 | 73% | 1 |
| 39 | /shift-your-semester/[school]/poster | 11 | 18 | 2 | 36% | 6 |
| 40 | /trip (launched 11-12) | 11 | 32 | 11 | 18% | 1 |

Further down: /donate **3 visitors in 90 days**, /newsletter 3, /shift/employers/login 5, /logan 5, /events/submit 4 real US visitors (the 60 raw are the spam bot), /shift/employers/portal/* 3 people with 130 pageviews. These had **0 pageviews in 90 days**: /visiting, /wayfinding/*, /rides/*, /streets/*, /links/[slug], /organizers/*, /ride-fund.

### Top URLs inside the biggest groups (90d visitors, with 30d in brackets)

- **/shift-your-semester/[school]:** northeastern 270 (98), mit 242 (73), boston-university 189 (5), harvard 184 (46), tufts 126 (23), umass-boston 120 (1), berklee 53, boston-college 52
- **/events/[id]:** moving-together-conference-2026-10-27 63 (53), open-streets-boston-allston-brighton-10-04 47, tour-de-streets-10-24 43 (36), open-streets-boston-roslindale-10-18 39, somerstreets-monster-mash-10-18 32, ride-for-your-life-10-25 31, moonlight-ride-on-the-refuge-10-23 30, annual-fall-colors-ride-10-25 21. The long tail is 403 URLs, most with fewer than 10 visitors.
- **/guides/[slug]:** how-to-pay-for-the-t **464** (369), which is 87% of the group. Then boston-traffic 13, boston-parking-costs 8, how-far-is-a-ten-minute-drive-on-foot 7, and none of the others above 5.
- **/shift/towns/[slug]:** boston-ma 47, somerville-ma 43, cambridge-ma 17, malden-ma 9, then 7 or fewer each.
- **/shift/roams/[id]:** community-path 19, emerald-necklace 17, battle-road-trail 13, wachusett-greenways 7, marblehead-rail-trail 7
- **/trails/[slug]:** somerville-community-path 11, charles-river-paths 9, bruce-freeman-rail-trail 7, the rest 5 or fewer
- **/parking/[venue]:** gillette-stadium 29, td-garden 12, fenway-park 8, white-stadium 3, logan-airport 1
- **/programs/what-moves-us/[page]:** everett-community-fair 58, then 4 or fewer

## 3. Entry (landing) pages, 90 days

Bounce is PostHog's `$is_bounce`. "1-page" is the share of sessions with a single pageview.

| Landing page | Sessions | Sessions 30d | Bounce | Pages / session | 1-page | Median session (s) |
|---|---:|---:|---:|---:|---:|---:|
| /shift-your-semester/[school] | 1,343 | 265 | 52% | 1.30 | 83% | 8 |
| /events/[id] | 1,212 | 705 | 52% | 1.29 | 86% | 6 |
| /shift | 1,096 | 868 | 41% | 1.15 | 91% | 18 |
| /nearby | 671 | 84 | 43% | 1.15 | 93% | 19 |
| /events | 666 | 553 | 53% | 1.82 | 75% | 1 |
| /guides/[slug] | 564 | 450 | 37% | 1.42 | 83% | 22 |
| /bike-lessons | 461 | 461 | 59% | 1.18 | 91% | 0 |
| / (home) | 312 | 112 | 38% | 2.23 | 59% | 16 |
| /shift/employers/challenge | 199 | 199 | 69% | 1.36 | 81% | 0 |
| /shift/towns/[slug] | 149 | 65 | 44% | 1.46 | 79% | 11 |
| /shift-your-semester | 112 | 8 | 46% | 1.23 | 84% | 2 |
| /shift/roams/[id] | 104 | 34 | 35% | 1.22 | 90% | 32 |
| /trails/[slug] | 61 | 61 | 28% | 1.33 | 84% | 25 |
| /parking/[venue] | 56 | 56 | 39% | 1.14 | 93% | 16 |

**Site-wide:** 84% of sessions view one page (paid 87%, unpaid 80%). Pages per session: 1.28 paid, 1.55 unpaid. 14% of paid sessions and 24% of unpaid sessions click anything at all.

Median engagement from `$pageleave` (90d): seconds on page are events 28, SYS school 16, /shift 29, guides 38, home 17, employer challenge 8. Median max scroll is 0–3% on /shift, /nearby, /events, the SYS school pages and the employer challenge page. Some of these pages scroll inside an inner container (so the scroll metric can't be trusted there), but on /shift and the SYS pages it means **most people never scroll past the first screen.**

## 4. Channel mix (sessions, 90 days, with 30d in brackets)

Channels come from the session's first UTM tag and referrer. Paid is split by `utm_source`. The UTM-less `utm_campaign=semester, utm_medium=cpc` traffic is the Reddit SEMESTER flight (09-17 → 10-01, with a tail to 11-01).

| Channel | Sessions 90d | Share | Sessions 30d | Share 30d |
|---|---:|---:|---:|---:|
| Paid: Meta (FB/IG) | 2,298 | 30% | 1,770 | 42% |
| Paid: Reddit | 1,259 | 17% | 258 | 6% |
| Direct / unknown | 1,209 | 16% | 505 | 12% |
| Organic search (Google, DuckDuckGo, Bing, Ecosia, Yahoo…) | 1,165 | 15% | 619 | 15% |
| Paid: Google Ad Grants | 595 | 8% | 488 | 12% |
| Email (nanopress newsletter, town digest, shift-updates, outreach) | 198 | 2.6% | 111 | 2.6% |
| Referral (cityofeverett.com 52, lynnschools.schoology 14, aocr.org 11, mit.edu, massmobilityhub…) | 194 | 2.6% | 97 | 2.3% |
| Print / QR / expo (tabling, posters, Connection expo, via shift.gogreenstreets.org) | 171 | 2.3% | 13 | 0.3% |
| Organic social: Facebook | 162 | 2.1% | 98 | 2.3% |
| Paid: LinkedIn (team-challenge-nov-2026) | 129 | 1.7% | 129 | 3.1% |
| AI assistants (ChatGPT) | 56 | 0.7% | 39 | 0.9% |
| Organic social: Instagram (incl. bio /links) | 51 | 0.7% | 39 | 0.9% |
| Organic social: Reddit | 51 | 0.7% | 18 | 0.4% |
| Shift app (referrer shift.gogreenstreets.org, `utm_source=shift_app`) | 35 | 0.5% | 0 | 0% |
| **Total** | **7,587** | | **4,196** | |

**Paid is 56% of sessions over 90 days and 63% over the last 30.** Meta campaigns (90d sessions): one_line_test 656 (/shift, /guides), calendar-test 473 (/events), lessons-nov 446 (/bike-lessons), newroutes 434 (/nearby, /shift), shift-downloads 179 (/shift). Reddit: semester 1,120 (SYS school pages) and newroutes 138.

### Channel mix of the top landing pages (90d sessions)

| Landing page | Main sources |
|---|---|
| /shift-your-semester/[school] (1,343) | Reddit paid 1,119 (83%), direct 178 (13%), organic 31, referral 11 |
| /events/[id] (1,212) | **Organic search 645 (53%)**, direct 439 (36%), email 131 (11%), ChatGPT 30, referral 28, FB 21 |
| /shift (1,096) | Meta paid 945 (86%), direct 40, Reddit paid 39, FB organic 24, Shift app 17, organic 15 |
| /nearby (671) | Meta paid 433 (65%), Reddit paid 100 (15%), direct 65, FB 29, Reddit organic 22 |
| /events (666) | Meta paid 471 (71%), print/QR 57, direct 55, FB 39, IG 18 |
| /guides/[slug] (564) | Google Ad Grants 485 (86%), organic 53 |
| /bike-lessons (461) | Meta paid 446 (97%) |
| / home (312) | Direct 141 (45%), organic 138 (44%), referral 19 |

## 5. Device split

Overall: **74% of visitors are on mobile**, 25% desktop and 1% tablet (90d, clean).

| Page | Mobile share of visitors |
|---|---:|
| /shift-your-semester/[school] | 81% |
| /shift | 93% |
| /events/[id] | 62% |
| /nearby | 90% |
| /events | 88% |
| /guides/[slug] | 32% (Ad Grants reaches desktop) |
| /bike-lessons | 97% |
| / home | 42% |
| /shift/employers/challenge | 79% |
| /shift/towns/[slug] | 41% |

The pages people arrive at from ads are phone pages. Home, guides and town pages are the only places where desktop is close to half.

## 6. Custom events the website sends to PostHog (90 days, clean US traffic)

| Event | Count | People | Fires on |
|---|---:|---:|---|
| snapshot_section_loaded | 1,093 | 136 | /nearby (instrumentation) |
| snapshot_viewed | 828 | 746 | /nearby |
| snapshot_newroutes_offer_shown | 621 | 582 | /nearby |
| events_card_clicked | 308 | 123 | /events, /events/group-rides, /events/walking-groups |
| shift_store_click | 216 | 206 | SYS hub, /shift, SYS schools, /, guides, events |
| home_cta_clicked | 173 | 159 | **mostly /shift-your-semester (78 people)**, then / (30), SYS schools, /challenges, guides |
| event_outbound_click | 155 | 120 | /events/[id] |
| nearby_sheet_snap | 86 | 24 | /nearby |
| events_filter_changed | 80 | 31 | /events |
| semester_join_cta_clicked | 76 | 72 | SYS school pages |
| cheat_sheet_download | 61 | 60 | /guides/how-to-pay-for-the-t |
| snapshot_detail_viewed, events_day_selected, events_show_more, snapshot_location_set, nearby_mode_filter, snapshot_marker_tapped, nearby_tab_changed, snapshot_location_denied, corridor_selected, reach_route_viewed, snapshot_station_expanded… | 10–60 each | | /nearby, /events |
| portal_page_viewed / portal_assistant_* / portal_challenge_builder_opened | 42 / 16 / 1 | 3 | employer portal (test accounts) |
| semester_school_page_viewed / semester_code_copied | 34 / 7 | 28 / 7 | SYS school pages |
| advisor_step_completed / advisor_results_shown / advisor_* | 32 / 17 / ~60 | 17 / 16 | /commute-advisor |
| event_directions_click / event_calendar_save / event_series_date_click / event_town_click | 19 / 3 / 2 / 1 | | /events/[id] |
| parking_reserve_click / venue_trip_planned | 12 / 3 | 8 / 3 | /parking/[venue] |
| email_signup | 12 | 12 | /events (since 2026-11-07) |
| trip_planned / trip_way_selected / trip_* | 10 / 11 / 3 | 6 | /trip |
| guide_plan_click | 9 | 9 | guides |
| snapshot_trip_planned / snapshot_app_cta_clicked | 8 / 7 | 7 / 7 | /nearby |
| together_signin_link_sent / together_signed_in / together_signup_saved | 3 / 3 / 2 | | /together |
| partner_signup_started | 1 | 1 | /move-in |

Generic autocapture is on (18k `$autocapture` events with clicks, changes and submits), `$pageleave` is on, `$rageclick` is low (about 25 people on clean pages), and session replay is off. A further ~150 event names are in the code but **never fired in 90 days**, e.g. ride_*, organizer_*, note_*, spot_*, visiting_*, creative_*, sponsor_report_*, host_follow, together_plan_*. Most of them sit on pages that had 0 visitors.

### Conversions and their rates (90d unless marked; rate = people who did it ÷ that page's visitors)

| Conversion | Event | People | Page visitors | Rate |
|---|---|---:|---:|---:|
| App-store click, /shift | shift_store_click | 72 (30d: 47) | 1,110 (30d: 846) | **6.5%** (30d 5.6%) |
| App-store click, SYS hub | shift_store_click | 78 | 140 | 56% |
| SYS school page "join" CTA | semester_join_cta_clicked | 72 | 1,283 | 5.6% |
| App-store click, SYS school pages | shift_store_click | 18 | 1,283 | 1.4% |
| App-store click, home | shift_store_click | 16 | 362 | 4.4% |
| App-store click, all pages | shift_store_click | 206 | 6,710 | 3.1% |
| Event page → organizer's registration/site | event_outbound_click | 120 (30d: 75) | 1,074 (30d: 620) | **11.2%** (30d 12.1%) |
| Event page directions | event_directions_click | 17 | 1,074 | 1.6% |
| Event page add-to-calendar | event_calendar_save | 3 | 1,074 | 0.3% |
| Calendar list → event card | events_card_clicked | ~123 | 658 | ~19% |
| T cheat-sheet download | cheat_sheet_download | 51 | 464 | **11.0%** |
| Commute Advisor completed (results shown) | advisor_results_shown | 15 | 29 | 52% |
| Parking "reserve" click | parking_reserve_click | 8 | 53 | 15% |
| Events email sign-up (since 11-07) | email_signup | 11 | ~535 (30d /events) | ~2% |
| /nearby → get the app | snapshot_app_cta_clicked | 6 | 694 | 0.9% |
| Free bike-lesson request | autocapture submit (PostHog event added 11-15, 0 fired so far) | 6 | 441 | **1.4%** |
| Employer team-challenge sign-up | autocapture submit (named event is GA4-only) | 1 | 182 | **0.5%** |
| Contact form | autocapture submit (GA4-only event) | 3 US (14 worldwide, mostly spam-like) | 24 | n/a |
| Get-involved interest form | autocapture submit | 1–2 | 47 | ~3% |
| Shift Together sign-up | together_signup_saved | 2 | 19 | 11% |
| Donate | **none** (Donorbox widget, GA4 page-view only) | ? | 3 | not measurable |
| Newsletter (footer / /newsletter form) | **GA4-only** `newsletter_signup` | ? (2 autocapture submits on /newsletter) | — | not in PostHog |

## 7. Paths

**From home (/)**, of 470 home pageviews the next step is: exit 262 (56%), /about 34, /events 19, /programs 16, /challenges 15, an SYS school page 13, /shift/towns 13, /shift 13, /get-involved 9, a town page 9, an event page 8.

**From an event page**, of 1,829 pageviews: exit 1,266 (69%), back to /events 235 (by 103 sessions), home 20, organizer page 20, /shift 15, a town page 8, /events/walking-groups 5, a trail 5. The page's actual "next step" is the organizer's link (`event_outbound_click`, 155 clicks), which shows up as an exit.

**From a town page**, of 227 pageviews: exit 156 (69%), an event page 13, /shift/towns 10, /events 7, /nearby 5, /shift 5, home 4.

**From /events**: exit 614 of 1,041, into an event 309 (160 sessions). **From /shift**: exit 1,118 of 1,279 (the store click leaves the site), /shift/towns 26, home 9, /commute-advisor 8.

**Single-page sessions: 84% site-wide** (80% unpaid, 87% paid).

## 8. Measurement gaps (code cross-check)

Tracking lives in `src/components/PostHogProvider.tsx` (manual SPA `$pageview`, autocapture, pageleave) plus about 330 `posthog.capture` / `track()` calls. GA4 (`G-6HQWGDZ6RH`, `src/app/layout.tsx`) and Meta/Reddit pixels (`src/lib/ad-pixels.ts`) run alongside it, and several conversions go **only** to GA4 (`src/lib/ga.ts`).

1. **Key conversions are GA4-only, so PostHog sees them only as anonymous autocapture submits.** These include `employer_inquiry` (`app/shift/employers/challenge/SignupForm.tsx`, the target of the LinkedIn and Meta team-challenge spend), `employer_team_created` (`challenge/confirm/ConfirmTeam.tsx`), `contact_inquiry` (`components/ContactForm.tsx`), `newsletter_signup` (`components/NewsletterSignupForm.tsx`), `shift_waitlist_signup`, `lesson_alert_signup`, `links_page_click` (`app/links/LinkButton.tsx`), `trail_gpx_download`, `walkma_step_click`, roam hub filters and video, `donate_page_view`, and `email_manage_*`.
2. **Donations aren't measured anywhere.** The Donorbox widget runs in an iframe with no completion callback. /donate itself had 3 US visitors in 90 days.
3. **Bot and internal traffic sit in the raw numbers**, at 43% of raw website pageviews. The "Internal / Test users" cohort used as the test-account filter has 0 members. Dev (localhost) and Vercel preview traffic go into the same project. A headless spam bot submits `/events/submit` from EU proxies, about 115 fake "persons". PostHog's built-in `$virt_is_bot` catches only 670 of the roughly 7,900 excluded pageviews. Any dashboard without the filters above overstates traffic by about 1.7×.
4. **No reverse proxy, and `respect_dnt: true`.** Events go straight to us.i.posthog.com, so ad blockers, Brave and Firefox strict mode, and DNT users are silently dropped. That likely undercounts the desktop and privacy-minded audience by an unknown share (often 10–30%). A store click is a click, not an install: website-to-install attribution depends on the app side.
5. **Misleading event names and blind spots:**
   - `home_cta_clicked` fires from a shared store-button component, so half of it (78 of 159 people) comes from /shift-your-semester, not home.
   - The bike-lesson request (`free_lesson_code_requested`) only reached PostHog on 2026-11-15. The Meta lessons-nov campaign (446 sessions since 11-04) has only autocapture to show for itself.
   - Scroll depth reads 0 on app-shell pages (/shift, /events, /nearby) because they scroll inside a container.
   - Malformed SES email links (`/shift/1/0100…=452`, `/preferences/1/…`) land 12 people on broken URLs.
   - `shiftatwork.org` mirrors the whole site and splits its analytics (213 visitors).
   - `/r/[code]/[channel]` ride short links log visits to Supabase, not PostHog.

## Latest Google Search Console snapshot

From `seo/reports/2026-11-15.md` and `seo/data/gsc/weekly-2026-11-13.json`, for the week **2026-11-07 → 11-13**:

- **100 clicks** and **10,675 impressions** (CTR 0.94%, avg position 7.4). In the US: 7,982 impressions and 93 clicks.
- Clicks fell for the third week running (146 → 117 → 100) while impressions rose 27% against the 4-week average.
- By page group (impressions / clicks):
  - translated guides 3,004 / 15
  - English guides 2,894 / 12, led by "ten-minute drive on foot" with 1,109 impressions and 2 clicks
  - parking venues 1,405 / 7
  - event pages 1,089 / **39**
  - roams 905 / 7
  - town pages 648 / 3
  - SYS school pages 373 / 0
  - home 56 / 8
- A quarter of impressions come from outside the US (Brazil alone has 1,092 impressions and 0 clicks).
- Open regression: 81 of 84 translated guides dropped out of the sitemap.
- October month (10-02 → 10-29): 463 clicks and 27,544 impressions, of which event pages earned 315 clicks on 14,701 impressions.
- Ad Grants Nov 1–11: 2,646 impressions, 212 clicks, CTR 8.0%.

**In short, event pages earn most organic clicks, while guides, translations and parking pages earn most impressions at under 0.5% CTR.**

---

## What this means for the review

**Where visitors actually are.** Three in four visitors are on a phone, and more than half of all sessions (63% in the last 30 days) start from a paid ad that lands on one page. The pages people see are not the home page. Their landing pages are:

- an SYS school page (Reddit)
- /shift, /events, /nearby or /bike-lessons (Meta)
- the "How to pay for the T" guide (Ad Grants)
- an event page (Google organic, the biggest unpaid source)

Home gets about 360 visitors in 90 days, under 6% of the audience. Its visitors are the only ones who browse (2.2 pages per session). The review should weight the **phone first screen of /shift, the event detail page, /events, the SYS school template, /nearby and the T guide** far above home, /about or /programs. Event pages are also the long-tail SEO asset: 403 URLs, 53% organic entries and most GSC clicks.

**Which pages convert.**
- Event pages hand people off well: 11–12% click through to the organizer.
- The T guide's cheat sheet converts at 11%.
- Commute Advisor completes 52% of the time, but it has almost no traffic.
- /shift's app-store click is 6.5%, and 5.6% in the last 30 days of heavy Meta spend. 91% of /shift sessions see one page with almost no scroll, so the first screen does all the work.
- SYS school pages convert at 5.6% to the join CTA.
- /bike-lessons (1.4% request) and /shift/employers/challenge (0.5% sign-up, 69% bounce, 8-second median time on page) take paid traffic and return almost nothing. Both are the clearest candidates for a redesign of the first screen.

**What is measured wrongly or not at all.**
- Raw PostHog numbers are inflated by about 1.7× by bots, datacenter link scanners, a spam bot and internal visits, until bot rules and an internal filter exist.
- The employer sign-up, contact, newsletter, donation and Instagram-bio link clicks never reach PostHog as named events. They are GA4-only or untracked, so a design change on those pages can't be judged in PostHog today.
- `home_cta_clicked` is mostly not home.
- Scroll depth is unusable on app-shell pages.
- Without a reverse proxy, a share of desktop and privacy-minded visitors is invisible.

Fixing items 1, 3 and 4 in section 8 before the redesign ships gives a baseline to compare against.
