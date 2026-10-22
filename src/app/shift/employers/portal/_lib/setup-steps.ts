import type { Group, Challenge, EmployerOnboarding } from './portal-types'
import { participation } from './participation'
import type { EmployerBenefits } from '@/lib/types/commute'

export interface SetupStepDef {
  id: string
  /** The task, as an instruction: "Upload your logo". Used for "Next: …". */
  label: string
  /** The finished state: "Logo uploaded". Used on ticked rows. */
  doneLabel: string
  desc: string
  done: boolean
  /** Where the task is done; null when it is done on the Setup page itself. */
  route: string | null
}

/**
 * The single definition of "is setup done", shared by the Setup page, the
 * progress banner, the sidebar dot and Home (Keith 2026-09-30: the sidebar
 * used to keep its own rule and disagree with the banner).
 */
export function computeSetupSteps(args: {
  group: Group | null
  benefitsForm: EmployerBenefits
  memberCount: number
  challenges: Challenge[]
}): SetupStepDef[] {
  const { group, benefitsForm, memberCount, challenges } = args
  const onboarding = (group?.onboarding ?? {}) as EmployerOnboarding
  const now = Date.now()

  return [
    {
      id: 'success',
      label: 'Say what success looks like',
      doneLabel: 'Success plan set',
      desc: 'What matters most to you, your target, and the date you plan to launch.',
      // goal_type is the structured answer (2026-09-30); older plans had only
      // the free-text definition or a launch date, and still count.
      done: !!(onboarding.goal_type || onboarding.success_definition || onboarding.launch_date),
      route: null,
    },
    {
      id: 'profile',
      label: 'Complete your company profile',
      doneLabel: 'Company profile complete',
      desc: 'A contact name, and a phone number or website.',
      done: !!(
        group?.name &&
        group?.admin_name &&
        (group?.admin_phone || group?.website_url)
      ),
      route: '/shift/employers/portal/settings#account',
    },
    {
      id: 'logo',
      label: 'Upload your logo',
      doneLabel: 'Logo uploaded',
      desc: 'It shows on the join page, the Commute Advisor and the app.',
      done: !!group?.logo_url,
      route: '/shift/employers/portal/settings#branding',
    },
    {
      id: 'advisor',
      label: 'Set up your Commute Advisor',
      doneLabel: 'Commute Advisor set up',
      desc: 'Your office and one benefit, so employees can plan a new way in.',
      done: !!(
        benefitsForm.destination_address &&
        (benefitsForm.transit_subsidy_monthly ||
          benefitsForm.bikeshare_subsidized ||
          benefitsForm.bike_parking ||
          benefitsForm.showers ||
          benefitsForm.free_parking ||
          benefitsForm.parking_cost_monthly ||
          (benefitsForm.shuttle_routes?.length ?? 0) > 0 ||
          benefitsForm.other_benefits)
      ),
      route: '/shift/employers/portal/advisor',
    },
    {
      // Not done at the first person (Keith 2026-10-22: "1 of 350" read as
      // done): done once enough have joined to run a challenge.
      id: 'employees',
      label: 'Get your team in',
      doneLabel: 'Your team is ready for a challenge',
      desc: 'Invite people until enough have joined to run a challenge.',
      done: !!group && ['ready', 'strong', 'goal_met'].includes(participation(group, memberCount).stage.key),
      route: '/shift/employers/portal/employees?invite=1',
    },
    {
      id: 'challenge',
      label: 'Schedule your first challenge',
      doneLabel: 'A challenge is scheduled or running',
      desc: 'A ready-made season or one of your own.',
      // Only this employer's own challenges, and only ones still to come or
      // under way: an ended challenge is history, not setup.
      done: challenges.some((c) => !c.is_flagship && new Date(c.ends_at).getTime() >= now),
      route: '/shift/employers/portal/challenges',
    },
  ]
}

/** The first unfinished step, or null when setup is complete. */
export function nextSetupStep(steps: SetupStepDef[]): SetupStepDef | null {
  return steps.find((s) => !s.done) ?? null
}
