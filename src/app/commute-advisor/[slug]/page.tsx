import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { EmployerGroup, EmployerBenefits } from '@/lib/types/commute'
import EmployerCommuteAdvisor from '@/components/commute/EmployerCommuteAdvisor'

type AdvisorGroupRow = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  tier: string | null
  status: string
  employer_benefits: EmployerBenefits | null
  commute_advisor_enabled: boolean
}

export default async function EmployerAdvisorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Demo page is handled by /commute-advisor/demo/page.tsx
  if (slug === 'demo') return null

  const supabase = createServerSupabaseClient()

  const { data: group } = await supabase
    .rpc('get_advisor_group_by_slug', { p_slug: slug })
    .maybeSingle<AdvisorGroupRow>()

  if (!group) redirect('/commute-advisor')

  const employerGroup: EmployerGroup = {
    id: group.id,
    name: group.name,
    slug: group.slug,
    logo_url: group.logo_url,
    tier: group.tier || 'basic',
    employer_benefits: (group.employer_benefits || {}) as EmployerBenefits,
  }

  return <EmployerCommuteAdvisor group={employerGroup} />
}
