'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Building2,
  Shield,
  Mail,
  Phone,
  Globe,
  Edit,
  LogOut,
  Pause,
  Upload,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'
import { TIER_LABEL } from '../_lib/portal-constants'
import PortalPageHead from '../_components/PortalPageHead'
import { Card, CardHead } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import Toggle from '@/components/employer/Toggle'

export default function SettingsPage() {
  const { group, setGroup, signOut, loading } = usePortal()

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    admin_name: '',
    admin_phone: '',
    website_url: '',
  })

  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [notifPrefs, setNotifPrefs] = useState({ weekly_impact: true, new_employee: true, challenge_milestones: false })

  useEffect(() => {
    if (!group) return
    try {
      const raw = localStorage.getItem(`ep_notif_prefs_${group.id}`)
      if (raw) setNotifPrefs(JSON.parse(raw))
    } catch {}
  }, [group])

  const updateNotifPref = useCallback((key: string, value: boolean) => {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: value }
      if (group) {
        try { localStorage.setItem(`ep_notif_prefs_${group.id}`, JSON.stringify(next)) } catch {}
      }
      return next
    })
  }, [group])

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-faint">Loading...</span>
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
    setEditing(true)
  }

  async function saveAccount() {
    if (!group) return
    setSaving(true)
    await supabase
      .from('groups')
      .update({
        name: form.name.trim(),
        admin_name: form.admin_name.trim() || null,
        admin_phone: form.admin_phone.trim() || null,
        website_url: form.website_url.trim() || null,
      })
      .eq('id', group.id)

    setGroup({
      ...group,
      name: form.name.trim(),
      admin_name: form.admin_name.trim() || null,
      admin_phone: form.admin_phone.trim() || null,
      website_url: form.website_url.trim() || null,
    })
    setEditing(false)
    setSaving(false)
  }

  async function handleLogoFile(file: File) {
    if (!group) return
    setLogoError('')
    const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setLogoError('Logo must be PNG, JPG, SVG, or WebP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Logo must be under 5 MB')
      return
    }
    setUploadingLogo(true)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const mimeMap: Record<string, string> = {
      svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
      jpeg: 'image/jpeg', webp: 'image/webp',
    }
    const contentType = mimeMap[ext] || file.type
    const path = `logos/${Date.now()}-${group.id.slice(0, 8)}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('employer-logos')
      .upload(path, file, { contentType })
    if (uploadErr) {
      setLogoError(uploadErr.message)
      setUploadingLogo(false)
      return
    }
    const publicUrl = supabase.storage.from('employer-logos').getPublicUrl(path).data.publicUrl
    const { error: updateErr } = await supabase
      .from('groups')
      .update({ logo_url: publicUrl })
      .eq('id', group.id)
    if (updateErr) {
      setLogoError(updateErr.message)
      setUploadingLogo(false)
      return
    }
    setGroup({ ...group, logo_url: publicUrl })
    setUploadingLogo(false)
  }

  const rows = [
    { label: 'Company', value: group.name, icon: Building2, field: 'name' as const },
    { label: 'Admin', value: group.admin_name || '—', icon: Shield, field: 'admin_name' as const },
    { label: 'Email', value: group.admin_email, icon: Mail, field: null },
    { label: 'Phone', value: group.admin_phone || '—', icon: Phone, field: 'admin_phone' as const },
    { label: 'Website', value: group.website_url || '—', icon: Globe, field: 'website_url' as const },
  ]

  return (
    <>
      <PortalPageHead title="Settings" subtitle="Manage your account, branding, and notifications" />

      <div className="grid items-start gap-6" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Account details */}
          <Card>
            <CardHead
              title="Account details"
              action={
                editing ? (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button variant="primary" size="sm" onClick={saveAccount} disabled={saving}>
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" icon={Edit} onClick={startEditing}>Edit</Button>
                )
              }
            />
            <div className="px-6">
              {rows.map((row, i) => {
                const Icon = row.icon
                return (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between py-3.5 ${i < rows.length - 1 ? 'border-b border-line-2' : ''}`}
                  >
                    <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-ink-muted">
                      <Icon size={16} strokeWidth={1.75} className="text-ink-faint" />
                      {row.label}
                    </span>
                    {editing && row.field ? (
                      <input
                        type="text"
                        value={form[row.field]}
                        onChange={(e) => setForm({ ...form, [row.field!]: e.target.value })}
                        className="w-[260px] rounded-[10px] border border-line bg-surface px-3 py-[10px] text-[14px] text-ink outline-none transition-shadow focus:border-accent focus:ring-2 focus:ring-accent-soft"
                      />
                    ) : (
                      <span className="text-[14px] font-semibold text-ink">{row.value}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Branding / Logo upload */}
          <Card>
            <CardHead title="Branding" sub="Your logo, shown to employees" />
            <div className="p-6">
              <div
                className={`relative flex flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed p-8 transition-colors ${
                  dragOver ? 'border-accent bg-accent-softer' : 'border-line bg-surface-2'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleLogoFile(file)
                }}
              >
                {group.logo_url ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center rounded-lg bg-white px-4 py-2"
                      style={{ boxShadow: '0 0 0 1px rgba(25,26,46,0.06)' }}>
                      <img src={group.logo_url} alt="Logo" className="h-[40px] w-auto object-contain" />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" icon={Upload} onClick={() => fileRef.current?.click()}>
                        Replace
                      </Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await supabase.from('groups').update({ logo_url: null }).eq('id', group.id)
                        setGroup({ ...group, logo_url: null })
                      }}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={24} className="text-ink-faint" />
                    <div className="text-center">
                      <button
                        type="button"
                        className="text-[14px] font-medium text-accent hover:underline"
                        onClick={() => fileRef.current?.click()}
                      >
                        Upload a logo
                      </button>
                      <span className="text-[14px] text-ink-faint"> or drag and drop</span>
                    </div>
                    <p className="text-[12px] text-ink-faint">PNG, JPG, SVG, or WebP up to 5 MB</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleLogoFile(file)
                  }}
                />
              </div>
              {logoError && <p className="mt-2 text-[13px] text-ep-danger">{logoError}</p>}
              {uploadingLogo && <p className="mt-2 text-[13px] text-ink-faint">Uploading...</p>}
            </div>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHead title="Notifications" sub="What we email you about" />
            <div className="space-y-3 px-6 py-5">
              <Toggle on={notifPrefs.weekly_impact} onChange={(v) => updateNotifPref('weekly_impact', v)} title="Weekly impact summary" desc="A digest of trips, miles, and CO₂ every Monday" />
              <Toggle on={notifPrefs.new_employee} onChange={(v) => updateNotifPref('new_employee', v)} title="New employee joins" desc="When someone joins with your code" />
              <Toggle on={notifPrefs.challenge_milestones} onChange={(v) => updateNotifPref('challenge_milestones', v)} title="Challenge milestones" desc="Alerts when your team hits goals" />
            </div>
          </Card>

          {/* Plan & access */}
          <Card>
            <CardHead title="Plan & access" />
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-[14px] font-semibold text-ink">
                  {TIER_LABEL[group.tier] ?? group.tier} tier
                </div>
                <div className="text-[13px] text-ink-faint">
                  Manage billing, seats, and rewards pool
                </div>
              </div>
              <Badge tone="success">{TIER_LABEL[group.tier] ?? group.tier}</Badge>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <Card pad>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-ep-danger">
              Danger zone
            </div>
            <div className="flex flex-wrap gap-2.5">
              <Button variant="danger" size="sm" icon={LogOut} onClick={signOut}>
                Sign out
              </Button>
              <Button variant="danger" size="sm" icon={Pause} onClick={() => {}}>
                Pause account
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
