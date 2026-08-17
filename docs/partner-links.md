# Partner co-branded links for /nearby

How to build the deep links outreach partners (brokers, property managers,
movers) put on QR codes, inserts, and welcome packets.

## Adding a partner (no deploy needed)

Use the admin dashboard: **admin.gogreenstreets.org → Community → Outreach
Partners** ("+ Add partner"). Enter the name, keep or adjust the suggested
slug, and drop in the logo — a transparent-background PNG (~≤400px wide) works
best. On the dark website header the logo sits in a small white chip, so dark
and light marks both work; the print page shows it on white paper directly.
The page shows the finished link with a copy button; `?partner=<slug>` works
the moment you save.

**Deactivate** (same page) instantly reverts every URL using that slug to the
default page — no deploy, and the partner can be reactivated later. (Under the
hood this is the `partners` table; the public read policy only exposes active
rows.)

## URL template

```
https://www.gogreenstreets.org/nearby?lat=<LAT>&lng=<LNG>&label=<URL-ENCODED NAME>&partner=<SLUG>&utm_source=insert&utm_campaign=newroutes
```

Worked example — Foundry Row Apartments in Union Square:

```
https://www.gogreenstreets.org/nearby?lat=42.381&lng=-71.092&label=Foundry%20Row%20Apartments&partner=bozzuto&utm_source=insert&utm_campaign=newroutes
```

Rules the page enforces (build links accordingly):

- **Coordinates**: 3 decimal places (~110 m) — the page rounds to that anyway,
  so share links never carry house-precision locations. Must be in the New
  England box (lat 40–44, lng −75 to −69) or the location gate shows instead.
- **`label`** is free text, up to 80 characters — a building name works
  ("Foundry Row Apartments"). URL-encode it: spaces become `%20`, commas
  `%2C`. The label renders in the header and on the print page.
- **`partner`** is the slug: lowercase letters, digits, hyphens. Anything else
  (or an unknown/inactive slug) silently renders the default page — coords
  still work, no error shown.
- **`utm_*` params** ride along untouched and survive the page's own URL
  rewrites, together with `partner`.
- `/new-routes?...` redirects to `/nearby` keeping all params, so campaign
  short-links keep working.
- The print version is at the same params on
  `https://www.gogreenstreets.org/nearby/print?...` — its QR code links back
  to the co-branded interactive page.

QR codes: any generator pointed at the full URL works (the site itself uses
the `qrcode` npm package for print pages).

## Cloudflare setup for commuteadvisor.org (one-time, dashboard)

Today the zone 301s **everything** — any path, any query — to
`https://www.gogreenstreets.org/commute-advisor`, dropping the path and query
string, so a co-branded `commuteadvisor.org/nearby?...` link would lose its
params. Replace the catch-all with two redirect rules (Rules → Redirect
Rules), in this order:

1. **Root goes to the advisor** (keeps today's behavior for the bare domain)
   - When: `(http.request.uri.path eq "/")`
   - Then: static redirect to `https://www.gogreenstreets.org/commute-advisor`,
     status 308, preserve query string ON.
2. **Everything else keeps its path and params**
   - When: `(http.request.uri.path ne "/")`
   - Then: dynamic redirect, expression
     `concat("https://www.gogreenstreets.org", http.request.uri.path)`,
     status 308, **preserve query string ON**.

After applying, verify:

```bash
curl -sI "https://commuteadvisor.org/nearby?lat=42.381&lng=-71.092&label=Test&partner=bozzuto" | grep -i location
```

should show
`location: https://www.gogreenstreets.org/nearby?lat=42.381&lng=-71.092&label=Test&partner=bozzuto`.
