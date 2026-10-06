import { permanentRedirect } from 'next/navigation'

// gogreenstreets.org/plan — the short address for the route planner. Nearby
// opens on its Destinations tab with the address box focused. Printed on
// guides, ads and the app's guide links, so it must stay stable. Permanent
// (308) so search engines treat /plan as a pointer, not a page of its own;
// /nearby's canonical is param-free, so ?plan=1 never competes with it.
export default function PlanPage() {
  permanentRedirect('/nearby?plan=1')
}
