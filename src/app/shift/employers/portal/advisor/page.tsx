'use client'

import { useState, useEffect } from 'react'
import {
  Link2,
  Copy,
  ExternalLink,
  MapPin,
  Wallet,
  Check,
  Mail,
  Bike,
  ShieldCheck,
  Leaf,
  Car,
  Plus,
} from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { Card, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import Toggle from '@/components/employer/Toggle'
import AddressAutocomplete from '@/components/AddressAutocomplete'
import { supabase } from '@/lib/supabase'
import type { EmployerBenefits } from '@/lib/types/commute'

const BENEFITS_CONFIG = [
  {
    key: 'bluebikes_subsidized' as const,
    noteKey: 'bluebikes_subsidy_label' as const,
    title: 'Bluebikes membership subsidized',
    placeholder:
      'e.g. Annual Bluebikes membership covered for all employees',
    icon: Bike,
  },
  {
    key: 'bike_parking' as const,
    noteKey: 'bike_parking_details' as const,
    title: 'Bike parking available',
    placeholder:
      'e.g. Secure bike cage in garage level B1, keycard access',
    icon: ShieldCheck,
  },
  {
    key: 'showers' as const,
    noteKey: 'shower_details' as const,
    title: 'Showers available',
    placeholder: 'e.g. Locker rooms with showers on floors 3 and 7',
    icon: Leaf,
  },
  {
    key: 'free_parking' as const,
    noteKey: null,
    title: 'Free parking offered',
    placeholder: 'e.g. Free garage parking for all staff',
    icon: Car,
  },
]

const SUBSIDY_TYPES = [
  { value: 'pre_tax', label: 'Pre-tax benefit' },
  { value: 'direct', label: 'Employer-paid' },
]

export default function AdvisorPage() {
  const { group, benefitsForm, setBenefitsForm } = usePortal()

  const [form, setForm] = useState<EmployerBenefits>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  useEffect(() => {
    setForm({ ...benefitsForm })
  }, [benefitsForm])

  const update = (patch: Partial<EmployerBenefits>) => {
    setForm((prev) => ({ ...prev, ...patch }))
    setDirty(true)
  }

  const advisorUrl = group?.slug
    ? `gogreenstreets.org/commute-advisor/${group.slug}`
    : group
      ? `gogreenstreets.org/commute-advisor/${group.invite_code}`
      : ''

  function copyLink() {
    navigator.clipboard.writeText(`https://${advisorUrl}`)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  async function handleSave() {
    if (!group) return
    setSaving(true)
    try {
      await supabase
        .from('groups')
        .update({ employer_benefits: form })
        .eq('id', group.id)
      setBenefitsForm(form)
      setDirty(false)
    } finally {
      setSaving(false)
    }
  }

  function handleDiscard() {
    setForm({ ...benefitsForm })
    setDirty(false)
  }

  const activeBenefits = BENEFITS_CONFIG.filter(
    (b) => form[b.key as keyof EmployerBenefits],
  )

  return (
    <div className="grid gap-6">
      <PortalPageHead
        title="Commute Advisor"
        subtitle="Configure the benefits and resources you offer employees"
      />

      <div
        className="grid items-start gap-5"
        style={{ gridTemplateColumns: 'minmax(0,1fr) 380px' }}
      >
        {/* Form column */}
        <div className="grid gap-3.5">
          {/* Public link */}
          <Card pad>
            <div className="mb-1.5 flex items-center gap-2.5">
              <Link2 size={17} strokeWidth={1.75} className="text-ink-faint" />
              <strong className="whitespace-nowrap text-[14px]">
                Your public Commute Advisor link
              </strong>
            </div>
            <p className="mb-3 text-[13px] text-ink-faint">
              Share this in your onboarding kit or HR portal — no app or login
              required.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 font-mono text-[13px] text-ink-muted">
                {advisorUrl}
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={Copy}
                onClick={copyLink}
              >
                {linkCopied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={() =>
                  window.open(`https://${advisorUrl}`, '_blank')
                }
              >
                Open
              </Button>
            </div>
          </Card>

          {/* Workplace & subsidy */}
          <Card>
            <CardHead
              title="Workplace & subsidy"
              sub="What employees see first"
            />
            <div className="grid gap-4 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                  Workplace address
                </label>
                <AddressAutocomplete
                  value={form.destination_address || ''}
                  onChange={(v) => update({ destination_address: v })}
                  onPlaceSelected={(place) =>
                    update({
                      destination_lat: place.lat,
                      destination_lng: place.lng,
                    })
                  }
                  variant="light"
                  placeholder="Start typing an address..."
                />
              </div>

              <div className="grid grid-cols-[160px_1fr] gap-4">
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                    Monthly transit subsidy
                  </label>
                  <div className="flex items-center rounded-[10px] border border-line bg-surface">
                    <span className="pl-3 text-[14px] text-ink-faint">$</span>
                    <input
                      type="number"
                      className="w-full border-0 bg-transparent px-2 py-2.5 text-[14px] text-ink outline-none"
                      value={form.transit_subsidy_monthly ?? ''}
                      onChange={(e) =>
                        update({
                          transit_subsidy_monthly: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                    Subsidy type
                  </label>
                  <select
                    className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                    value={form.transit_subsidy_type ?? 'pre_tax'}
                    onChange={(e) =>
                      update({
                        transit_subsidy_type: e.target.value as
                          | 'pre_tax'
                          | 'direct',
                      })
                    }
                  >
                    {SUBSIDY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                  Subsidy display label
                </label>
                <input
                  className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                  placeholder="Shown to employees in plain language"
                  value={form.transit_subsidy_label ?? ''}
                  onChange={(e) =>
                    update({ transit_subsidy_label: e.target.value })
                  }
                />
                <p className="mt-1 text-[12px] text-ink-faint">
                  Shown to employees in plain language.
                </p>
              </div>
            </div>
          </Card>

          {/* Facilities & perks */}
          <Card>
            <CardHead
              title="Facilities & perks"
              sub="Toggle what's available, then add a detail"
            />
            <div className="grid gap-3 px-6 py-5">
              {BENEFITS_CONFIG.map((b) => (
                <div key={b.key} className="grid gap-2.5">
                  <Toggle
                    on={!!form[b.key as keyof EmployerBenefits]}
                    onChange={(v) =>
                      update({ [b.key]: v } as Partial<EmployerBenefits>)
                    }
                    title={b.title}
                  />
                  {form[b.key as keyof EmployerBenefits] && b.noteKey && (
                    <input
                      className="ml-[52px] w-[calc(100%-52px)] rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                      placeholder={b.placeholder}
                      value={
                        (form[b.noteKey as keyof EmployerBenefits] as string) ??
                        ''
                      }
                      onChange={(e) =>
                        update({
                          [b.noteKey!]: e.target.value,
                        } as Partial<EmployerBenefits>)
                      }
                    />
                  )}
                </div>
              ))}

              <div className="flex items-center justify-between px-0.5 py-1.5">
                <div>
                  <div className="text-[14px] font-semibold">
                    Shuttle routes
                  </div>
                  <div className="text-[12.5px] text-ink-faint">
                    {form.shuttle_routes?.length
                      ? `${form.shuttle_routes.length} routes`
                      : 'No routes added yet'}
                  </div>
                </div>
                <Button variant="ghost" size="sm" icon={Plus}>
                  Add route
                </Button>
              </div>
            </div>
          </Card>

          {/* HR contact */}
          <Card>
            <CardHead title="HR contact & notes" />
            <div className="grid gap-4 px-6 py-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                    HR contact name
                  </label>
                  <input
                    className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                    value={form.hr_contact_name ?? ''}
                    onChange={(e) =>
                      update({ hr_contact_name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                    HR contact email
                  </label>
                  <div className="flex items-center rounded-[10px] border border-line bg-surface">
                    <span className="pl-3 text-ink-faint">
                      <Mail size={16} strokeWidth={1.75} />
                    </span>
                    <input
                      className="w-full border-0 bg-transparent px-2 py-2.5 text-[14px] text-ink outline-none"
                      value={form.hr_contact_email ?? ''}
                      onChange={(e) =>
                        update({ hr_contact_email: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                  Other benefits{' '}
                  <span className="font-normal text-ink-faint">· optional</span>
                </label>
                <textarea
                  className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                  rows={3}
                  value={form.other_benefits ?? ''}
                  onChange={(e) =>
                    update({ other_benefits: e.target.value })
                  }
                />
              </div>
            </div>
          </Card>
        </div>

        {/* Preview column */}
        <div className="sticky top-0">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-faint">
            <ExternalLink size={13} strokeWidth={1.75} />
            Employee preview
          </div>
          <Card className="overflow-hidden">
            <div
              className="px-[22px] py-5 text-white"
              style={{ background: 'var(--color-accent-dark)' }}
            >
              {group?.logo_url && (
                <div className="mb-3 flex items-center gap-2.5">
                  <div className="flex h-7 items-center rounded bg-white px-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={group.logo_url}
                      alt=""
                      className="h-5 w-auto"
                    />
                  </div>
                </div>
              )}
              <div className="mb-1 text-[12px] opacity-80">
                with{' '}
                <span className="font-bold" style={{ color: '#8FD3AE' }}>
                  Green Streets
                </span>{' '}
                Initiative
              </div>
              <div className="text-[18px] font-bold tracking-[-0.01em]">
                How {group?.name || 'your company'} supports your commute
              </div>
            </div>
            <div className="grid gap-3.5 px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-accent-soft text-accent">
                  <MapPin size={17} strokeWidth={1.75} />
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold">
                    Your workplace
                  </div>
                  <div className="text-[12.5px] text-ink-faint">
                    {form.destination_address || 'Not set yet'}
                  </div>
                </div>
              </div>

              {(form.transit_subsidy_monthly ?? 0) > 0 && (
                <div className="rounded-xl bg-accent-soft p-3.5">
                  <div className="flex items-center gap-2">
                    <Wallet
                      size={16}
                      strokeWidth={1.75}
                      className="text-accent"
                    />
                    <strong className="whitespace-nowrap text-[14px] text-accent-ink">
                      ${form.transit_subsidy_monthly}/mo transit benefit
                    </strong>
                  </div>
                  {form.transit_subsidy_label && (
                    <div className="mt-1 text-[12.5px] text-accent-ink opacity-85">
                      {form.transit_subsidy_label}
                    </div>
                  )}
                </div>
              )}

              {activeBenefits.length > 0 && (
                <div className="grid gap-2.5">
                  {activeBenefits.map((b) => (
                    <div
                      key={b.key}
                      className="flex items-start gap-2.5"
                    >
                      <Check
                        size={16}
                        strokeWidth={2.4}
                        className="mt-0.5 shrink-0 text-accent"
                      />
                      <div className="text-[13px]">
                        <span className="font-semibold">
                          {b.title
                            .replace(' available', '')
                            .replace(' offered', '')
                            .replace(' subsidized', '')}
                        </span>
                        {b.noteKey &&
                          form[b.noteKey as keyof EmployerBenefits] && (
                            <span className="text-ink-faint">
                              {' '}
                              —{' '}
                              {
                                form[
                                  b.noteKey as keyof EmployerBenefits
                                ] as string
                              }
                            </span>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {form.other_benefits && (
                <div className="border-t border-line-2 pt-3 text-[12.5px] text-ink-faint">
                  {form.other_benefits}
                </div>
              )}

              {(form.hr_contact_name || form.hr_contact_email) && (
                <div className="flex items-center gap-2 border-t border-line-2 pt-3 text-[12.5px] text-ink-faint">
                  <Mail size={14} strokeWidth={1.75} />
                  Questions? {form.hr_contact_name}
                  {form.hr_contact_email && ` · ${form.hr_contact_email}`}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed bottom-0 right-0 z-30 flex items-center justify-end gap-2.5 border-t border-line px-6 py-3"
        style={{
          left: '256px',
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {dirty && (
          <span className="mr-auto text-[13px] text-ink-faint">
            Unsaved changes
          </span>
        )}
        <Button variant="ghost" onClick={handleDiscard}>
          Discard
        </Button>
        <Button
          variant="primary"
          icon={Check}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save & publish'}
        </Button>
      </div>
      <div className="h-2" />
    </div>
  )
}
