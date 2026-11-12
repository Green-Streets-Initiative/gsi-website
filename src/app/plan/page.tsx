import { redirect } from 'next/navigation'

// gogreenstreets.org/plan — the short address for the trip planner, printed
// on guides, ads and the app's guide links, so it must stay stable. It used
// to 308 to /nearby?plan=1; browsers that cached that land on /nearby, which
// sends ?plan=1 on to /trip. Temporary (307) from now on, so the target can
// move again without a cached hop. ?lang= rides along.
export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = (await searchParams).lang
  const lang = Array.isArray(raw) ? raw[0] : raw
  redirect(lang ? `/trip?lang=${encodeURIComponent(lang)}` : '/trip')
}
