'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, User, Mail, Phone, Globe, Edit, Upload, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { TIER_LABEL, TIER_ANNUAL_PRICE } from '../_lib/portal-constants'
import { formatDateUTC } from '../_lib/portal-utils'
import PortalPageHead from '../_components/PortalPageHead'
import PortalSectionNav, { PortalSectionedPage, SECTION_SCROLL_MT } from '../_components/PortalSectionNav'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import Toggle from '@/components/employer/Toggle'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import EmailDomainsCard from './EmailDomainsCard'
import JoinPolicyCard from './JoinPolicyCard'
import PublicListingCard from './PublicListingCard'
import TeamCard from './TeamCard'

const SECTIONS = [
  { id: 'account', label: 'Account' },
  { id: 'branding', label: 'Branding' },
  { id: 'team', label: 'Team' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'public-listing', label: 'Public listing' },
  { id: 'email-domains', label: 'Email domains' },
  { id: 'who-can-join', label: 'Who can join' },
  { id: 'plan', label: 'Plan' },
]

type FormField = 'name' | 'admin_name' | 'admin_phone' | 'website_url'

const NOTIF_TITLES: Record<string, string> = {
  weekly_impact: 'Monday report',
  new_employee: 'New employees',
  challenge_milestones: 'Team size milestones',
}

const inputClass =
  'w-full rounded-[10px] border border-line bg-surface px-3.5 py-[10px] text-[14px] text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-soft'

export default function SettingsPage() {
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const { group, setGroup, canManageAccount, admins, setAdmins, sessionEmail, loading } = usePortal()
  // Account details, branding, listing, domains, who can join and the plan:
  // admins and GSI staff. Managers see these read-only, like viewers.
  const canManage = canManageAccount

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<FormField, string>>({
    name: '',
    admin_name: '',
    admin_phone: '',
    website_url: '',
  })
  const [nameError, setNameError] = useState('')

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [removingLogo, setRemovingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const defaultPrefs = { weekly_impact: true, new_employee: true, challenge_milestones: false }
  const [notifPrefs, setNotifPrefs] = useState(defaultPrefs)
  const [notifError, setNotifError] = useState('')

  // Prefs belong to whoever is logged in, not to the group's main contact.
  // Any invited teammate must be able to save their own.
  const currentAdmin = admins.find((a) => a.email.toLowerCase() === (sessionEmail ?? ''))

  useEffect(() => {
    if (!currentAdmin) return
    if (currentAdmin.notification_prefs) {
      setNotifPrefs({ ...defaultPrefs, ...currentAdmin.notification_prefs })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin?.id])

  const updateNotifPref = useCallback(
    async (key: string, value: boolean) => {
      if (!currentAdmin) {
        setNotifError("We couldn't find your account on this team, so this can't be saved.")
        return
      }
      const prev = notifPrefs
      const next = { ...prev, [key]: value }
      setNotifPrefs(next)
      setNotifError('')
      const { error } = await supabase
        .from('group_admins')
        .update({ notification_prefs: next })
        .eq('id', currentAdmin.id)
      if (error) {
        setNotifPrefs(prev)
        const msg = `We couldn't save that. Please try again.`
        setNotifError(msg)
        toast(msg, { type: 'error' })
        return
      }
      // Keep the shared admins list in sync so the notification bell
      // (which reads prefs from context) reflects the change immediately.
      setAdmins(admins.map((a) => (a.id === currentAdmin.id ? { ...a, notification_prefs: next } : a)))
      toast(`${NOTIF_TITLES[key] ?? 'Notification'} ${value ? 'on' : 'off'}`, { type: 'success' })
    },
    [currentAdmin, notifPrefs, admins, setAdmins, toast],
  )

  // Arriving with a hash (#team from the old Team page and the account
  // menu): jump to that section once there is content to jump to.
  // ScrollReset puts every new route at the top first; this runs after it.
  const hashJumped = useRef(false)
  useEffect(() => {
    if (loading || !group || hashJumped.current) return
    hashJumped.current = true
    const id = window.location.hash.slice(1)
    if (!id) return
    document.getElementById(id)?.scrollIntoView({ block: 'start' })
  }, [loading, group])

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-tertiary">Loading...</span>
      </div>
    )
  }

  function startEditing() {
    setForm({
      name: group!.name || '',
      admin_name: group!.admin_name || '',
      admin_phone: group!.admin_phone || '',
      website_url: group!.website_url || '',
    })
    setNameError('')
    setEditing(true)
  }

  async function saveAccount() {
    if (!group || saving) return
    const name = form.name.trim()
    if (!name) {
      setNameError('Enter your company name.')
      return
    }
    setSaving(true)
    const patch = {
      name,
      admin_name: form.admin_name.trim() || null,
      admin_phone: form.admin_phone.trim() || null,
      website_url: form.website_url.trim() || null,
    }
    const { error } = await supabase.from('groups').update(patch).eq('id', group.id)
    setSaving(false)
    if (error) {
      toast("We couldn't save your account details. Please try again.", { type: 'error' })
      return
    }
    setGroup({ ...group, ...patch })
    setEditing(false)
    toast('Saved', { type: 'success' })
  }

  // The mobile app renders logo_url with React Native <Image>, which can't
  // display SVG. An SVG here looks fine on the web but shows employees a
  // blank box in the app. Convert SVGs to a 512px PNG before upload.
  async function rasterizeSvg(file: File): Promise<Blob> {
    const svgBlob = new Blob([await file.text()], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Could not read SVG'))
        img.src = url
      })
      const TARGET = 512
      const w = img.naturalWidth || TARGET
      const h = img.naturalHeight || TARGET
      const scale = TARGET / Math.max(w, h)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(w * scale))
      canvas.height = Math.max(1, Math.round(h * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Could not convert SVG')
      return blob
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function failLogo(msg: string) {
    setLogoError(msg)
    toast(msg, { type: 'error' })
    setUploadingLogo(false)
  }

  async function handleLogoFile(file: File) {
    if (!group) return
    setLogoError('')
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      failLogo('Your logo must be a PNG, JPG, SVG or WebP file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      failLogo('Your logo must be under 5 MB.')
      return
    }
    setUploadingLogo(true)

    let uploadBody: Blob = file
    let ext = (file.name.split('.').pop() || 'png').toLowerCase()
    if (file.type === 'image/svg+xml') {
      try {
        uploadBody = await rasterizeSvg(file)
        ext = 'png'
      } catch {
        failLogo("This SVG couldn't be converted. Please upload a PNG or JPG instead.")
        return
      }
    }

    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
    }
    const contentType = mimeMap[ext] || file.type
    const path = `logos/${Date.now()}-${group.id.slice(0, 8)}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('employer-logos')
      .upload(path, uploadBody, { contentType })
    if (uploadErr) {
      failLogo("We couldn't upload that file. Please try again.")
      return
    }
    const publicUrl = supabase.storage.from('employer-logos').getPublicUrl(path).data.publicUrl
    const { error: updateErr } = await supabase.from('groups').update({ logo_url: publicUrl }).eq('id', group.id)
    if (updateErr) {
      failLogo("The file uploaded but we couldn't save it to your account. Please try again.")
      return
    }
    setGroup({ ...group, logo_url: publicUrl })
    setUploadingLogo(false)
    toast('Logo uploaded', { type: 'success' })
  }

  async function removeLogo() {
    if (!group || removingLogo) return
    const ok = await confirm({
      title: 'Remove your logo?',
      body: 'Employees will see your company name without a logo in the app and on your join page.',
      confirmLabel: 'Remove logo',
      tone: 'danger',
    })
    if (!ok) return
    setRemovingLogo(true)
    const { error } = await supabase.from('groups').update({ logo_url: null }).eq('id', group.id)
    setRemovingLogo(false)
    if (error) {
      const msg = "We couldn't remove the logo. Please try again."
      setLogoError(msg)
      toast(msg, { type: 'error' })
      return
    }
    setGroup({ ...group, logo_url: null })
    toast('Logo removed', { type: 'success' })
  }

  const rows: {
    label: string
    value: string
    icon: React.ElementType
    field: FormField | null
    note?: string
  }[] = [
    { label: 'Company', value: group.name, icon: Building2, field: 'name' },
    {
      label: 'Main contact',
      value: group.admin_name || '—',
      icon: User,
      field: 'admin_name',
      note: 'The person Green Streets gets in touch with about this account.',
    },
    { label: 'Email', value: group.admin_email, icon: Mail, field: null },
    { label: 'Phone', value: group.admin_phone || '—', icon: Phone, field: 'admin_phone' },
    { label: 'Website', value: group.website_url || '—', icon: Globe, field: 'website_url' },
  ]

  const statusLabel =
    group.status === 'active'
      ? 'Active'
      : group.status === 'cancelled'
        ? 'Cancelled'
        : group.status === 'paused'
          ? 'Paused'
          : 'Inactive'
  const pauseMailto = `mailto:info@gogreenstreets.org?subject=${encodeURIComponent(`Pause — ${group.name}`)}`

  return (
    <>
      <PortalPageHead title="Settings" subtitle="Your account, branding, team, notifications and plan" />

      <PortalSectionedPage nav={<PortalSectionNav sections={SECTIONS} />}>
        <div className="space-y-6">
          {/* Account */}
          <Card id="account" className={SECTION_SCROLL_MT}>
            <CardHead
              title="Account"
              sub="Your company's details on Shift"
              action={
                canManage ? (
                  editing ? (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                        Cancel
                      </Button>
                      <Button variant="primary" size="sm" onClick={saveAccount} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="sm" icon={Edit} onClick={startEditing}>
                      Edit
                    </Button>
                  )
                ) : undefined
              }
            />
            <CardBody>
              {editing ? (
                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveAccount()
                  }}
                >
                  <label className="block md:col-span-2">
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Company name</span>
                    <input
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => {
                        setForm({ ...form, name: e.target.value })
                        if (e.target.value.trim()) setNameError('')
                      }}
                      aria-invalid={!!nameError}
                      className={`${inputClass} ${nameError ? 'border-ep-danger' : ''}`}
                    />
                    {nameError && <span className="mt-1.5 block text-[12.5px] text-ep-danger">{nameError}</span>}
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Main contact</span>
                    <input
                      type="text"
                      value={form.admin_name}
                      onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                      className={inputClass}
                    />
                    <span className="mt-1.5 block text-[12px] text-ink-tertiary">
                      The person Green Streets gets in touch with about this account.
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Email</span>
                    <input type="email" value={group.admin_email} disabled className={`${inputClass} opacity-60`} />
                    <span className="mt-1.5 block text-[12px] text-ink-tertiary">
                      To change this, email info@gogreenstreets.org.
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Phone</span>
                    <input
                      type="tel"
                      value={form.admin_phone}
                      onChange={(e) => setForm({ ...form, admin_phone: e.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Website</span>
                    <input
                      type="url"
                      value={form.website_url}
                      onChange={(e) => setForm({ ...form, website_url: e.target.value })}
                      placeholder="https://"
                      className={inputClass}
                    />
                  </label>
                  {/* Enter submits; the buttons live in the card head. */}
                  <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
                </form>
              ) : (
                <div>
                  {rows.map((row, i) => {
                    const Icon = row.icon
                    return (
                      <div
                        key={row.label}
                        className={`flex flex-col gap-1 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${
                          i < rows.length - 1 ? 'border-b border-line-2' : ''
                        } ${i === 0 ? 'pt-0' : ''}`}
                      >
                        <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-ink-muted">
                          <Icon size={16} strokeWidth={1.75} className="text-ink-icon" />
                          {row.label}
                        </span>
                        <span className="min-w-0 sm:text-right">
                          <span className="block break-words text-[14px] font-semibold text-ink">{row.value}</span>
                          {row.note && <span className="block text-[12px] text-ink-tertiary">{row.note}</span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="mt-4 border-t border-line-2 pt-3 text-[12.5px] text-ink-tertiary">
                Looking for your office address? It lives in{' '}
                <Link href="/shift/employers/portal/advisor" className="font-semibold text-accent hover:underline">
                  Commute Advisor
                </Link>
                , because employees&apos; commute plans are built around it.
              </p>
            </CardBody>
          </Card>

          {/* Branding */}
          <Card id="branding" className={SECTION_SCROLL_MT}>
            <CardHead title="Branding" sub="Your logo, shown to employees in the app and on your join page" />
            <CardBody>
              {canManage ? (
                <>
                  <div
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed p-6 transition-colors sm:p-8 ${
                      dragOver ? 'border-accent bg-accent-softer' : 'border-line bg-surface-2'
                    }`}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOver(false)
                      const file = e.dataTransfer.files[0]
                      if (file) void handleLogoFile(file)
                    }}
                  >
                    {group.logo_url ? (
                      <div className="flex flex-col items-center gap-3">
                        <div
                          className="flex items-center rounded-lg bg-white px-4 py-2"
                          style={{ boxShadow: '0 0 0 1px rgba(25,26,46,0.06)' }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={group.logo_url} alt={`${group.name} logo`} className="h-[40px] w-auto object-contain" />
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Upload}
                            onClick={() => fileRef.current?.click()}
                            disabled={uploadingLogo || removingLogo}
                          >
                            Replace
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void removeLogo()} disabled={uploadingLogo || removingLogo}>
                            {removingLogo ? 'Removing...' : 'Remove'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} className="text-ink-icon" />
                        <div className="text-center">
                          <button
                            type="button"
                            className="text-[14px] font-medium text-accent hover:underline"
                            onClick={() => fileRef.current?.click()}
                            disabled={uploadingLogo}
                          >
                            Upload a logo
                          </button>
                          <span className="text-[14px] text-ink-tertiary"> or drag and drop</span>
                        </div>
                        <p className="text-center text-[12px] text-ink-tertiary">
                          PNG, JPG, SVG or WebP up to 5 MB. SVGs are converted to PNG automatically.
                        </p>
                      </>
                    )}
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".png,.jpg,.jpeg,.svg,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void handleLogoFile(file)
                        e.target.value = ''
                      }}
                    />
                  </div>
                  {logoError && <p className="mt-2 text-[13px] text-ep-danger">{logoError}</p>}
                  {uploadingLogo && <p className="mt-2 text-[13px] text-ink-tertiary">Uploading...</p>}
                </>
              ) : (
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  {group.logo_url ? (
                    <div
                      className="flex items-center rounded-lg bg-white px-4 py-2"
                      style={{ boxShadow: '0 0 0 1px rgba(25,26,46,0.06)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={group.logo_url} alt={`${group.name} logo`} className="h-[40px] w-auto object-contain" />
                    </div>
                  ) : (
                    <p className="text-[13.5px] text-ink-muted">No logo yet.</p>
                  )}
                  <p className="text-[13px] text-ink-tertiary">Ask an admin to change the logo.</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Team: who can open this portal */}
          <div id="team" className={`space-y-6 ${SECTION_SCROLL_MT}`}>
            <TeamCard />
          </div>

          {/* Notifications */}
          <Card id="notifications" className={SECTION_SCROLL_MT}>
            <CardHead title="Notifications" sub="Your Monday email and the bell at the top of the portal" />
            <CardBody className="space-y-4">
              <Toggle
                on={notifPrefs.weekly_impact}
                onChange={(v) => void updateNotifPref('weekly_impact', v)}
                title="Monday report"
                desc="An email every Monday with your team's trips, miles and CO₂"
              />
              <Toggle
                on={notifPrefs.new_employee}
                onChange={(v) => void updateNotifPref('new_employee', v)}
                title="New employees"
                desc="How many people joined, in the Monday report and the bell"
              />
              <Toggle
                on={notifPrefs.challenge_milestones}
                onChange={(v) => void updateNotifPref('challenge_milestones', v)}
                title="Team size milestones"
                desc="When 10, 25, 50 or more people have joined, in the Monday report and the bell"
              />
              {notifError && <p className="text-[13px] text-ep-danger">{notifError}</p>}
            </CardBody>
          </Card>

          {/* Public listing */}
          <div id="public-listing" className={SECTION_SCROLL_MT}>
            <PublicListingCard group={group} canManage={canManage} onChanged={setGroup} />
          </div>

          {/* Email domains */}
          <div id="email-domains" className={SECTION_SCROLL_MT}>
            <EmailDomainsCard groupId={group.id} canManage={canManage} />
          </div>

          {/* Who can join: open, work email, or admin approval */}
          <div id="who-can-join" className={SECTION_SCROLL_MT}>
            <JoinPolicyCard group={group} canManage={canManage} onChanged={setGroup} />
          </div>

          {/* Plan */}
          <Card id="plan" className={SECTION_SCROLL_MT}>
            <CardHead
              title="Plan"
              sub="What your company is on and when it renews"
              action={
                canManage ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    iconRight={ArrowRight}
                    onClick={() => router.push('/shift/employers/portal/billing')}
                  >
                    Manage billing
                  </Button>
                ) : undefined
              }
            />
            <CardBody>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-[20px] font-bold tracking-[-0.01em] text-ink">
                  {TIER_LABEL[group.tier] ?? group.tier}
                </span>
                <Badge tone={group.status === 'active' ? 'success' : group.status === 'cancelled' || group.status === 'paused' ? 'warn' : 'neutral'}>
                  {statusLabel}
                </Badge>
              </div>
              <div className="grid gap-2 text-[13.5px]">
                {TIER_ANNUAL_PRICE[group.tier] != null && (
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-muted">Annual fee</span>
                    <span className="font-semibold text-ink">${TIER_ANNUAL_PRICE[group.tier].toLocaleString()} / year</span>
                  </div>
                )}
                {group.access_starts_at && (
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-muted">Started</span>
                    <span className="font-semibold text-ink">{formatDateUTC(group.access_starts_at)}</span>
                  </div>
                )}
                {group.access_ends_at && (
                  <div className="flex justify-between gap-4">
                    <span className="text-ink-muted">{group.status === 'cancelled' ? 'Access through' : 'Renews'}</span>
                    <span className="font-semibold text-ink">{formatDateUTC(group.access_ends_at)}</span>
                  </div>
                )}
              </div>
              {group.status === 'paused' && (
                <p className="mt-4 text-[13px] leading-[1.5] text-ink-muted">
                  Your plan is paused. Write to info@gogreenstreets.org to pick it up again.
                </p>
              )}
              {canManage && (
                <div className="mt-4 grid gap-2 border-t border-line-2 pt-3">
                  <Link
                    href="/shift/employers/portal/billing#manage-in-stripe"
                    className="inline-flex items-center gap-1.5 justify-self-start text-[13px] font-semibold text-accent hover:underline"
                  >
                    Change or cancel your plan in Billing &amp; rewards
                    <ArrowRight size={13} strokeWidth={1.75} />
                  </Link>
                  <p className="text-[12.5px] leading-[1.5] text-ink-muted">
                    To pause, email{' '}
                    <a href={pauseMailto} className="font-semibold text-accent hover:underline">
                      info@gogreenstreets.org
                    </a>
                    .
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </PortalSectionedPage>
    </>
  )
}
