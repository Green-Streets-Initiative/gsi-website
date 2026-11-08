import { permanentRedirect } from 'next/navigation'

// gogreenstreets.org/plan — the short address for the route planner. Nearby
// opens on its Destinations tab with the address box focused. Printed on
// guides, ads and the app's guide links, so it must stay stable. Permanent
// (308) so search engines treat /plan as a pointer, not a page of its own;
// /nearby's canonical is param-free, so ?plan=1 never competes with it.
// The app's links carry ?lang= (Shift lib/site-link.ts); it goes along, so
// Nearby opens in the reader's language.
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = (await searchParams).lang
  const lang = Array.isArray(raw) ? raw[0] : raw
  permanentRedirect(lang ? `/nearby?plan=1&lang=${encodeURIComponent(lang)}` : '/nearby?plan=1')
}
