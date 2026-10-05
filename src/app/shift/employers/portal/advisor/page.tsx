'use client'

import { useState, useEffect } from 'react'
import {

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
import PortalSectionNav, { PortalSectionedPage, SECTION_SCROLL_MT } from '../_components/PortalSectionNav'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import { usePortal } from '../_lib/portal-context'
import { Card, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import Toggle from '@/components/employer/Toggle'
import { useToast } from '@/components/employer/Toast'
import { supabase } from '@/lib/supabase'
import LocationsCard from './LocationsCard'
import AdvisorUsageCard from './AdvisorUsageCard'
import LivePagePreview from '@/components/employer/LivePagePreview'
import { useEmployerLocations, locationTitle, type LocationDraft } from '../_lib/use-employer-locations'
import { employerAdvisorUrl, onThisSite } from '@/lib/employer/office-links'
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
  const { group, benefitsForm, setBenefitsForm, canEditAdvisor } = usePortal()
  const toast = useToast()
  // Admins, managers and GSI staff edit and publish; viewers read (S3).
  // The database refuses a viewer's write too; this keeps the form honest.
  const canEdit = canEditAdvisor

  const [form, setForm] = useState<EmployerBenefits>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  const { locations, loading: locationsLoading, save: saveLocationList } = useEmployerLocations(group?.id)

  // Keep unsaved benefit edits when a locations save refreshes benefitsForm
  useEffect(() => {
    if (!dirty) setForm({ ...benefitsForm })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benefitsForm])

  // Saving locations also moves the Advisor's main address (the database
  // keeps destination_* equal to location 1); mirror that here so the next
  // benefits save doesn't write the old address back.
  async function saveLocations(drafts: LocationDraft[]) {
    const err = await saveLocationList(drafts)
    if (err) return err
    const main = drafts[0]
    const dest: Partial<EmployerBenefits> = main
      ? { destination_address: main.address.trim(), destination_lat: main.lat, destination_lng: main.lng }
      : {}
    setForm((prev) => ({ ...prev, ...dest }))
    setBenefitsForm({ ...benefitsForm, ...dest })
    return null
  }

  const update = (patch: Partial<EmployerBenefits>) => {
    if (!canEdit) return
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

  // With more than one location, each gets its own link that opens the
  // Advisor with that site picked (Keith 2026-09-30: the hero linked one
  // site even when several were configured). Same links as the Share Kit.
  const siteLinks =
    group?.slug && locations.length > 1
      ? locations.map((l) => ({ id: l.id, title: locationTitle(l), url: employerAdvisorUrl(group.slug!, l.id) }))
      : []
  const [siteCopied, setSiteCopied] = useState<string | null>(null)
  function copySite(id: string, url: string) {
    navigator.clipboard.writeText(url)
    setSiteCopied(id)
    setTimeout(() => setSiteCopied(null), 2000)
  }

  async function handleSave() {
    if (!group || !canEdit) return
    setSaving(true)
    try {
      // A refused write (a viewer, a lapsed plan, a dropped connection) used
      // to read as saved. Now it says so, and the changes stay unsaved.
      const { error } = await supabase
        .from('groups')
        .update({ employer_benefits: form })
        .eq('id', group.id)
      if (error) {
        console.error('Commute Advisor save failed:', error.message)
        toast(
          /row-level security|permission denied|forbidden/i.test(error.message)
            ? "You don't have permission to change this page. An admin or manager on your team can."
            : "That didn't save. Check your connection and try again.",
          { type: 'error' },
        )
        return
      }
      setBenefitsForm(form)
      setDirty(false)
      toast('Saved. Your Commute Advisor page is updated.', { type: 'success' })
    } catch {
      toast("That didn't save. Check your connection and try again.", { type: 'error' })
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

  // The hand-built summary: what the frame falls back to when the page
  // can't load. Kept in step with the real page's header and benefit list.
  const previewSummary = (
    <Card className="w-full overflow-hidden">
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
              <div className="mb-1 text-[12px]">
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
                    {locations.length > 1 ? 'Choose your location' : 'Your workplace'}
                  </div>
                  <div className="text-[12.5px] text-ink-tertiary">
                    {locations.length > 1
                      ? locations.map((l) => locationTitle(l)).join(' · ')
                      : form.destination_address || 'Not set yet'}
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
                    <div className="mt-1 text-[12.5px] text-accent-ink">
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
                            <span className="text-ink-tertiary">
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
                <div className="border-t border-line-2 pt-3 text-[12.5px] text-ink-tertiary">
                  {form.other_benefits}
                </div>
              )}

              {(form.hr_contact_name || form.hr_contact_email) && (
                <div className="flex items-center gap-2 border-t border-line-2 pt-3 text-[12.5px] text-ink-tertiary">
                  <Mail size={14} strokeWidth={1.75} />
                  Questions? {form.hr_contact_name}
                  {form.hr_contact_email && ` · ${form.hr_contact_email}`}
                </div>
              )}
            </div>
    </Card>
  )

  return (
    <div className="grid gap-6">
      <PortalPageHead
        title="Commute Advisor"
        subtitle="A public page with your logo that shows anyone their walking, biking and transit options to your office, plus the benefits you offer. What you set here is what employees see."
      />

      {!canEdit && (
        <Card pad>
          <p className="text-[13.5px] leading-[1.55] text-ink">
            You can see this page but not change it. Ask an admin or manager on your team to make changes.
          </p>
        </Card>
      )}

      <PortalSectionedPage
        nav={
          <PortalSectionNav
            sections={[
              { id: 'adv-locations', label: 'Locations', done: locations.length > 0 },
              { id: 'adv-subsidy', label: 'Transit subsidy', done: !!form.transit_subsidy_monthly },
              { id: 'adv-perks', label: 'Facilities & perks', done: activeBenefits.length > 0 },
              { id: 'adv-contact', label: 'HR contact', done: !!form.hr_contact_email },
              { id: 'adv-preview', label: 'Employee preview' },
            ]}
          />
        }
      >
      <div className="grid gap-6">
      {/* The page this produces, and how much of it is filled in. */}
      <PortalHeroPanel
        title="Your Commute Advisor page"
        lede={
          <div className="grid gap-3">
            <p>Share it in your onboarding kit or HR portal. No app or login needed.</p>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-0 flex-1 truncate rounded-[10px] bg-white/10 px-3.5 py-2.5 text-[13.5px] text-white ring-1 ring-white/25">
                {advisorUrl}
              </div>
              <Button variant="secondary" size="sm" icon={Copy} onClick={copyLink}>
                {linkCopied ? 'Copied!' : 'Copy'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={() => window.open(onThisSite(advisorUrl), '_blank')}
              >
                Open
              </Button>
            </div>
            {siteLinks.length > 0 && (
              <div className="mt-1 grid gap-1.5">
                <p className="text-[13px] text-white/85">
                  That link opens on your main location. Each location also has its own link, which opens with that site already picked:
                </p>
                <ul className="grid gap-1.5">
                  {siteLinks.map((sl) => (
                    <li key={sl.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-semibold text-white">{sl.title}</span>
                        <span className="text-white/85"> · {sl.url.replace(/^https:\/\/(www\.)?/, '')}</span>
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-white ring-1 ring-white/35 hover:bg-white/10"
                        onClick={() => copySite(sl.id, sl.url)}
                      >
                        <Copy size={12} strokeWidth={2} />
                        {siteCopied === sl.id ? 'Copied!' : 'Copy'}
                      </button>
                      <a
                        href={onThisSite(sl.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold text-white ring-1 ring-white/35 hover:bg-white/10"
                      >
                        <ExternalLink size={12} strokeWidth={2} />
                        Open
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
        readouts={[
          { label: 'Locations', value: locations.length === 0 ? 'None yet' : locations.length },
          { label: 'Transit subsidy', value: form.transit_subsidy_monthly ? `$${form.transit_subsidy_monthly}/mo` : 'Not set' },
          { label: 'Perks on', value: `${activeBenefits.length} of ${BENEFITS_CONFIG.length}` },
          { label: 'HR contact', value: form.hr_contact_email ? 'Set' : 'Not set' },
        ]}
      />

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_340px]">
        {/* Form column. A viewer gets every field switched off at once. */}
        <fieldset disabled={!canEdit} className="grid min-w-0 gap-3.5">
          {/* Workplace & subsidy */}
          <div id="adv-locations" className={SECTION_SCROLL_MT}>
            <LocationsCard key={locationsLoading ? 'loading' : 'ready'} locations={locations} onSave={saveLocations} readOnly={!canEdit} />
          </div>

          <Card className={SECTION_SCROLL_MT} id="adv-subsidy">
            <CardHead
              title="Transit subsidy"
              sub="What employees see first"
            />
            <div className="grid gap-4 px-6 py-5">
              <div className="grid grid-cols-[160px_1fr] gap-4">
                <div>
                  <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                    Monthly transit subsidy
                  </label>
                  <div className="flex items-center rounded-[10px] border border-line bg-surface">
                    <span className="pl-3 text-[14px] text-ink-tertiary">$</span>
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
                <p className="mt-1 text-[12px] text-ink-tertiary">
                  Shown to employees in plain language.
                </p>
              </div>
            </div>
          </Card>

          {/* Facilities & perks */}
          <Card className={SECTION_SCROLL_MT} id="adv-perks">
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

              <div className="px-0.5 py-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold">
                      Shuttle routes
                    </div>
                    <div className="text-[12.5px] text-ink-tertiary">
                      {form.shuttle_routes?.length
                        ? `${form.shuttle_routes.length} route${form.shuttle_routes.length === 1 ? '' : 's'}`
                        : 'No routes added yet'}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Plus}
                    onClick={() =>
                      update({
                        shuttle_routes: [
                          ...(form.shuttle_routes ?? []),
                          { name: '', from_stop: '', schedule: '', details: '' },
                        ],
                      })
                    }
                  >
                    Add route
                  </Button>
                </div>

                {(form.shuttle_routes ?? []).map((route, i) => (
                  <div
                    key={i}
                    className="mt-3 grid gap-2.5 rounded-[10px] border border-line bg-surface-2 p-3.5"
                  >
                    <div className="grid grid-cols-2 gap-2.5">
                      <input
                        className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                        placeholder="Route name (e.g. North Station shuttle)"
                        value={route.name}
                        onChange={(e) =>
                          update({
                            shuttle_routes: form.shuttle_routes!.map((r, j) =>
                              j === i ? { ...r, name: e.target.value } : r,
                            ),
                          })
                        }
                      />
                      <input
                        className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                        placeholder="Departs from (e.g. North Station)"
                        value={route.from_stop}
                        onChange={(e) =>
                          update({
                            shuttle_routes: form.shuttle_routes!.map((r, j) =>
                              j === i ? { ...r, from_stop: e.target.value } : r,
                            ),
                          })
                        }
                      />
                    </div>
                    <input
                      className="rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                      placeholder="Schedule (e.g. Every 20 min, 7–10am and 4–7pm)"
                      value={route.schedule}
                      onChange={(e) =>
                        update({
                          shuttle_routes: form.shuttle_routes!.map((r, j) =>
                            j === i ? { ...r, schedule: e.target.value } : r,
                          ),
                        })
                      }
                    />
                    <div className="flex items-center gap-2.5">
                      <input
                        className="flex-1 rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                        placeholder="Details (optional — boarding notes, badge required, etc.)"
                        value={route.details}
                        onChange={(e) =>
                          update({
                            shuttle_routes: form.shuttle_routes!.map((r, j) =>
                              j === i ? { ...r, details: e.target.value } : r,
                            ),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          update({
                            shuttle_routes: form.shuttle_routes!.filter(
                              (_, j) => j !== i,
                            ),
                          })
                        }
                        className="shrink-0 text-[12.5px] font-semibold text-ep-danger hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* HR contact */}
          <Card className={SECTION_SCROLL_MT} id="adv-contact">
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
                    <span className="pl-3 text-ink-tertiary">
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
                  <span className="font-normal text-ink-tertiary">· optional</span>
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
        </fieldset>

        {/* Preview column: sits below the section nav, which is also sticky.
            The real page, scaled down; the hand-built summary is only the
            fallback when the page can't load in the frame. */}
        <div className={`sticky top-[60px] min-[1200px]:top-6 ${SECTION_SCROLL_MT}`} id="adv-preview">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-tertiary">
            <ExternalLink size={13} strokeWidth={1.75} />
            Employee preview
          </div>
          {group && (
            <LivePagePreview
              src={`/commute-advisor/${group.slug ?? group.invite_code}`}
              title="Your Commute Advisor page"
              pageWidth={1280}
              pageHeight={900}
              openHref={onThisSite(advisorUrl)}
              fallback={previewSummary}
            />
          )}
          <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-muted">
            Shows what&apos;s saved. Unsaved changes appear after you publish.
          </p>
          {group && (
            <div className="mt-4">
              <AdvisorUsageCard groupId={group.id} locations={locations} />
            </div>
          )}
        </div>
      </div>

      </div>
      </PortalSectionedPage>

      {/* Sticky save bar: only for people who can publish */}
      {canEdit && <div
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-end gap-2.5 border-t border-line px-6 py-3 min-[980px]:left-[256px]"
        style={{
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {dirty && (
          <span className="mr-auto text-[13px] text-ink-tertiary">
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
      </div>}
      <div className="h-2" />
    </div>
  )
}
