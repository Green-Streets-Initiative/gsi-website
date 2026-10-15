import { cache } from 'react'
import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { EmployerGroup, EmployerBenefits, EmployerAdvisorLocation } from '@/lib/types/commute'
import EmployerCommuteAdvisor from '@/components/commute/EmployerCommuteAdvisor'
import { decodeAdvisorDraft } from '@/app/shift/employers/portal/advisor/advisor-draft'

type AdvisorGroupRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  tier: string | null
  status: string
  employer_benefits: EmployerBenefits | null
  commute_advisor_enabled: boolean
  /** Shift 01042: the team code, for the join link. Absent until that migration lands. */
  invite_code?: string | null
}

// One lookup per request, shared by generateMetadata and the page.
const loadGroup = cache(async (slug: string) => {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .rpc('get_advisor_group_by_slug', { p_slug: slug })
    .maybeSingle<AdvisorGroupRow>()
  return data ?? null
})

// Each employer's page carries its own title but stays out of search:
// it is for that company's staff, not the open web.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const group = slug === 'demo' ? null : await loadGroup(slug)
  return {
    title: group ? `Commute options to ${group.name}` : 'Commute Advisor',
    robots: { index: false, follow: false },
  }
}

/** "09:00:00" or "09:00" -> "09:00"; anything else -> null. */
function clockOrNull(v: unknown): string | null {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d/.test(v) ? v.slice(0, 5) : null
}

export default async function EmployerAdvisorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { slug } = await params
  const sp = await searchParams
  const locationParam = typeof sp.location === 'string' ? sp.location : null
  // Portal "Preview unsaved changes": the benefits and offices as the admin
  // has them now, rendered instead of the saved ones. Nothing is logged.
  const draft = decodeAdvisorDraft(typeof sp.draft === 'string' ? sp.draft : null)

  // Demo page is handled by /commute-advisor/demo/page.tsx. This route
  // shouldn't match 'demo' while that static sibling exists, but if it ever
  // does, send the visitor there instead of rendering an empty page.
  if (slug === 'demo') redirect('/commute-advisor/demo')

  const group = await loadGroup(slug)

  if (!group) redirect('/commute-advisor')

  const supabase = createServerSupabaseClient()

  // Offices/branches (item 7). Two or more and staff choose theirs. The
  // office's usual start time is read on its own: until its held migration
  // (Shift 01131) lands the column does not exist, and that must not fail
  // the page.
  const [{ data: locationRows }, startTimeRows] = await Promise.all([
    supabase
      .from('employer_locations')
      .select('id, name, address, lat, lng')
      .eq('group_id', group.id)
      .order('sort_order', { ascending: true })
      .limit(100),
    supabase
      .from('employer_locations')
      .select('id, typical_start_time')
      .eq('group_id', group.id)
      .limit(100)
      .then(({ data, error }) => (error ? null : (data as { id: string; typical_start_time: unknown }[] | null))),
  ])
  const startTimes: Record<string, string> = {}
  for (const row of startTimeRows ?? []) {
    const clock = clockOrNull(row.typical_start_time)
    if (clock) startTimes[row.id] = clock
  }

  const employerGroup: EmployerGroup = {
    locations: (locationRows ?? []) as EmployerAdvisorLocation[],
    id: group.id,
    name: group.name,
    slug: group.slug,
    logo_url: group.logo_url,
    tier: group.tier || 'basic',
    employer_benefits: (group.employer_benefits || {}) as EmployerBenefits,
    invite_code: group.invite_code ?? undefined,
  }

  return <EmployerCommuteAdvisor group={employerGroup} initialLocationId={locationParam} startTimes={startTimes} draft={draft} />
}
