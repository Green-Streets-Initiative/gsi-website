'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Sparkles, HelpCircle, Mail } from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { Card } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import ProgressBar from '@/components/employer/ProgressBar'
import Button from '@/components/employer/Button'

interface SetupStep {
  id: string
  label: string
  desc: string
  done: boolean
  route: string
}

export default function SetupPage() {
  const { group, challenge, memberCount, benefitsForm } = usePortal()
  const router = useRouter()

  const steps: SetupStep[] = [
    {
      id: 'profile',
      label: 'Company profile complete',
      desc: 'Name, address, and admin contact on file.',
      done: !!(group?.name && group?.admin_name),
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
      desc: 'Benefits and routes published for your team.',
      done: !!(
        benefitsForm.destination_address || benefitsForm.transit_subsidy_monthly
      ),
      route: '/shift/employers/portal/advisor',
    },
    {
      id: 'employees',
      label: 'Employees joined',
      desc: 'Invite your team with your join code or link.',
      done: memberCount > 0,
      route: '/shift/employers/portal/employees',
    },
    {
      id: 'challenge',
      label: 'Active challenge running',
      desc: "Kick off a friendly competition to drive sign-ups.",
      done: !!challenge,
      route: '/shift/employers/portal/challenges',
    },
  ]

  const firstIncomplete = steps.find((s) => !s.done)
  const [openId, setOpenId] = useState<string | null>(
    firstIncomplete?.id ?? steps[0].id,
  )

  const doneCount = steps.filter((s) => s.done).length
  const pct = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="grid gap-6">
      <PortalPageHead
        title="Setup"
        subtitle="Complete these steps to get the most out of Shift for Employers"
      />

      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}
      >
        {/* Steps */}
        <div className="grid gap-3.5">
          <Card
            pad
            className="flex flex-wrap items-center gap-[18px]"
          >
            <div className="min-w-[200px] flex-1">
              <div className="mb-2 flex items-center justify-between">
                <strong className="whitespace-nowrap text-[15px]">
                  Setup progress
                </strong>
                <span className="text-[13px] font-semibold text-ink-faint">
                  {doneCount} of {steps.length} complete
                </span>
              </div>
              <ProgressBar pct={pct} />
            </div>
            {doneCount === steps.length ? (
              <Badge tone="success">All set — you&apos;re live</Badge>
            ) : (
              <span className="text-[13px] text-ink-faint">
                {steps.length - doneCount} steps left
              </span>
            )}
          </Card>

          {steps.map((s) => {
            const isOpen = openId === s.id
            return (
              <Card
                key={s.id}
                className="overflow-hidden"
                style={
                  isOpen
                    ? { borderColor: 'var(--color-accent)' }
                    : undefined
                }
              >
                <div
                  className="flex cursor-pointer items-center gap-3.5 px-6 py-[18px]"
                  onClick={() => setOpenId(isOpen ? null : s.id)}
                >
                  <button
                    type="button"
                    className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-2 transition-colors ${
                      s.done
                        ? 'border-accent bg-accent text-white'
                        : 'border-line bg-transparent'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.done && <Check size={14} strokeWidth={2.5} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[15px] font-semibold ${
                        s.done
                          ? 'text-ink-muted line-through decoration-line'
                          : 'text-ink'
                      }`}
                    >
                      {s.label}
                    </div>
                    {!isOpen && (
                      <div className="mt-0.5 text-[13px] text-ink-faint">
                        {s.desc}
                      </div>
                    )}
                  </div>
                  {s.done ? (
                    <Badge tone="success" dot={false}>
                      Done
                    </Badge>
                  ) : (
                    <Badge tone="warn" dot={false}>
                      To do
                    </Badge>
                  )}
                  <ChevronDown
                    size={18}
                    strokeWidth={1.75}
                    className={`text-ink-faint transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>

                {isOpen && (
                  <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-line-2 px-6 pb-5 pt-4">
                    <p className="max-w-[48ch] text-[14px] text-ink-muted">
                      {s.desc}
                    </p>
                    <Button
                      variant={s.done ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => router.push(s.route)}
                    >
                      {s.id === 'profile' && 'Edit company profile'}
                      {s.id === 'logo' && 'Manage logo'}
                      {s.id === 'advisor' && 'Open Commute Advisor'}
                      {s.id === 'employees' && 'Invite employees'}
                      {s.id === 'challenge' && 'Create a challenge'}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>

        {/* Side help */}
        <div className="grid gap-5">
          <Card pad>
            <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-accent-soft text-accent">
              <Sparkles size={22} strokeWidth={1.75} />
            </div>
            <div className="mb-1.5 text-[16px] font-bold">
              Why finish setup?
            </div>
            <p className="text-[13.5px] leading-[1.5] text-ink-muted">
              Teams that complete all five steps before inviting employees see
              roughly twice the join rate in the first two weeks. The last two —
              getting employees in and starting a challenge — drive the most
              momentum.
            </p>
          </Card>

          <Card pad>
            <div className="mb-2.5 flex items-center gap-2.5">
              <HelpCircle
                size={18}
                strokeWidth={1.75}
                className="text-ink-faint"
              />
              <strong className="whitespace-nowrap text-[14px]">
                Need a hand?
              </strong>
            </div>
            <p className="mb-3 text-[13.5px] leading-[1.5] text-ink-muted">
              Your GSI partnerships team can help you launch and run your first
              challenge.
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={Mail}
              onClick={() =>
                window.open('mailto:info@gogreenstreets.org', '_blank')
              }
            >
              Contact your partner
            </Button>
          </Card>
        </div>
      </div>
    </div>
  )
}
