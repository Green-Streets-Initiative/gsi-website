'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Sparkles, HelpCircle, Mail } from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { supabase } from '@/lib/supabase'
import type { EmployerOnboarding } from '../_lib/portal-types'
import { computeSetupSteps } from '../_lib/setup-steps'
import { Card } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import ProgressBar from '@/components/employer/ProgressBar'
import Button from '@/components/employer/Button'

export default function SetupPage() {
  const { group, challenges, memberCount, benefitsForm } = usePortal()
  const router = useRouter()

  const steps = computeSetupSteps({ group, benefitsForm, memberCount, challenges })

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

                {isOpen && s.id === 'success' && (
                  <div className="border-t border-line-2 px-6 pb-5 pt-4">
                    <SuccessPlanForm />
                  </div>
                )}
                {isOpen && s.route && (
                  <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-line-2 px-6 pb-5 pt-4">
                    <p className="max-w-[48ch] text-[14px] text-ink-muted">
                      {s.desc}
                    </p>
                    <Button
                      variant={s.done ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => router.push(s.route!)}
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

const fieldClass =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent'
const fieldLabelClass = 'mb-1.5 block text-[12.5px] font-semibold text-ink-muted'

// Inline intake for the customer's own definition of success — the answers
// live in groups.onboarding and drive the goal-vs-actual card on Impact.
function SuccessPlanForm() {
  const { group, setGroup, isAdmin, isGsiAdmin } = usePortal()
  const canEdit = isAdmin || isGsiAdmin

  const [form, setForm] = useState<EmployerOnboarding>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setForm({ ...(group?.onboarding ?? {}) })
  }, [group?.id])

  if (!group) return null

  if (!canEdit) {
    return (
      <p className="text-[13.5px] text-ink-muted">
        {form.success_definition
          ? form.success_definition
          : 'An admin can fill this in — ask them to define your team’s success goal here.'}
      </p>
    )
  }

  async function save() {
    if (!group) return
    setSaving(true)
    setError(null)
    setSaved(false)
    const cleaned: EmployerOnboarding = {
      ...form,
      key_dates: (form.key_dates ?? []).filter((k) => k.label.trim() || k.date),
      champions: (form.champions ?? []).filter((c) => c.trim()),
    }
    const { error: err } = await supabase
      .from('groups')
      .update({ onboarding: cleaned })
      .eq('id', group.id)
    setSaving(false)
    if (err) {
      setError("Couldn't save — try again or contact info@gogreenstreets.org.")
      return
    }
    setGroup({ ...group, onboarding: cleaned })
    setSaved(true)
  }

  return (
    <div className="grid gap-4">
      <div>
        <label className={fieldLabelClass}>
          How will you know this worked? What will you measure or report internally?
        </label>
        <textarea
          rows={3}
          className={fieldClass}
          placeholder="e.g. 30% of employees tracking commutes by fall; a mode-shift number we can cite in our ESG report; less pressure on the parking garage"
          value={form.success_definition ?? ''}
          onChange={(e) => setForm({ ...form, success_definition: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={fieldLabelClass}>About how many employees?</label>
          <input
            type="number"
            min={1}
            className={fieldClass}
            placeholder="350"
            value={form.headcount ?? ''}
            onChange={(e) =>
              setForm({ ...form, headcount: e.target.value ? Number(e.target.value) : null })
            }
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Sign-up goal (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            className={fieldClass}
            placeholder="35"
            value={form.target_signup_pct ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                target_signup_pct: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </div>
        <div>
          <label className={fieldLabelClass}>Launch date</label>
          <input
            type="date"
            className={fieldClass}
            value={form.launch_date ?? ''}
            onChange={(e) => setForm({ ...form, launch_date: e.target.value || null })}
          />
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[12.5px] font-semibold text-ink-muted">
            Key dates (ESG reporting, wellness week, Bike Week…)
          </label>
          <button
            type="button"
            className="text-[12.5px] font-semibold text-accent hover:underline"
            onClick={() =>
              setForm({
                ...form,
                key_dates: [...(form.key_dates ?? []), { label: '', date: '' }],
              })
            }
          >
            + Add date
          </button>
        </div>
        {(form.key_dates ?? []).map((k, i) => (
          <div key={i} className="mb-2 flex items-center gap-2.5">
            <input
              className={`${fieldClass} flex-1`}
              placeholder="e.g. Annual sustainability report due"
              value={k.label}
              onChange={(e) =>
                setForm({
                  ...form,
                  key_dates: form.key_dates!.map((kd, j) =>
                    j === i ? { ...kd, label: e.target.value } : kd,
                  ),
                })
              }
            />
            <input
              type="date"
              className={`${fieldClass} w-[170px]`}
              value={k.date}
              onChange={(e) =>
                setForm({
                  ...form,
                  key_dates: form.key_dates!.map((kd, j) =>
                    j === i ? { ...kd, date: e.target.value } : kd,
                  ),
                })
              }
            />
            <button
              type="button"
              className="shrink-0 text-[12.5px] font-semibold text-ep-danger hover:underline"
              onClick={() =>
                setForm({
                  ...form,
                  key_dates: form.key_dates!.filter((_, j) => j !== i),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div>
        <label className={fieldLabelClass}>
          Champions — colleagues who&apos;ll help spread the word (one per line, aim for ~1 per 50 employees)
        </label>
        <textarea
          rows={3}
          className={fieldClass}
          placeholder={'Jordan Kim <jkim@company.com>\nSam Rivera <srivera@company.com>'}
          value={(form.champions ?? []).join('\n')}
          onChange={(e) =>
            setForm({ ...form, champions: e.target.value.split('\n') })
          }
        />
      </div>

      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save success plan'}
        </Button>
        {saved && <span className="text-[13px] font-medium text-accent">Saved</span>}
        {error && <span className="text-[13px] text-ep-danger">{error}</span>}
      </div>
    </div>
  )
}
