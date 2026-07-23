import type { Group, Challenge, EmployerOnboarding } from './portal-types'
import type { EmployerBenefits } from '@/lib/types/commute'

export interface SetupStepDef {
  id: string
  label: string
  desc: string
  done: boolean
  route: string | null
}

// Single definition of "is setup complete" — shared by the Setup page, the
// dashboard banner, and the portal-wide progress bar so they can never
// disagree about what's left.
export function computeSetupSteps(args: {
  group: Group | null
  benefitsForm: EmployerBenefits
  memberCount: number
  challenges: Challenge[]
}): SetupStepDef[] {
  const { group, benefitsForm, memberCount, challenges } = args
  const onboarding = (group?.onboarding ?? {}) as EmployerOnboarding

  return [
    {
      id: 'success',
      label: 'Success plan defined',
      desc: 'What does "this worked" look like? Set your goal and launch date.',
      done: !!(onboarding.success_definition || onboarding.launch_date),
      route: null,
    },
    {
      id: 'profile',
      label: 'Company profile complete',
      desc: 'Name, admin contact, and a phone or website on file. (Your office address lives in Commute Advisor.)',
      done: !!(
        group?.name &&
        group?.admin_name &&
        (group?.admin_phone || group?.website_url)
      ),
      route: '/shift/employers/portal/settings',
    },
    {
      id: 'logo',
      label: 'Logo uploaded',
      desc: 'Shown to employees on your join page.',
      done: !!group?.logo_url,
      route: '/shift/employers/portal/settings',
    },
    {
      id: 'advisor',
      label: 'Commute Advisor configured',
      desc: 'Office address, benefits, and routes published for your team.',
      done: !!(
        benefitsForm.destination_address || benefitsForm.transit_subsidy_monthly
      ),
      route: '/shift/employers/portal/advisor',
    },
    {
      id: 'employees',
      label: 'Employees joined',
      desc: 'The Share Kit has your join code, QR poster, email templates, and printable flyer.',
      done: memberCount > 0,
      route: '/shift/employers/portal/share-kit',
    },
    {
      id: 'challenge',
      label: 'Active challenge running',
      desc: 'Kick off a friendly competition to drive sign-ups.',
      done: challenges.length > 0,
      route: '/shift/employers/portal/challenges',
    },
  ]
}
