'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { errorText, saveHostPage } from '@/lib/organizers/api'
import { TAG_OPTIONS } from '@/lib/organizers/ride-words'
import type { OrgClaim } from '@/lib/organizers/types'
import { useConsole } from './ConsoleContext'
import { Button, Card, Empty, Field, Input, Notice, SectionTitle, Select, Textarea, Toggle } from './ui'

const LINKS: { key: string; label: string; placeholder: string }[] = [
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/yourgroup' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/yourgroup' },
  { key: 'strava', label: 'Strava club', placeholder: 'https://www.strava.com/clubs/…' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/…' },
  { key: 'whatsapp', label: 'WhatsApp community', placeholder: 'https://chat.whatsapp.com/…' },
  { key: 'meetup', label: 'Meetup', placeholder: 'https://www.meetup.com/…' },
]

const isLink = (v: string) => !v.trim() || /^https?:\/\/\S+$/i.test(v.trim())

function Editor({ org, onSaved }: { org: OrgClaim; onSaved: () => void }) {
  const [description, setDescription] = useState(org.description ?? '')
  const [url, setUrl] = useState(org.url ?? '')
  const [links, setLinks] = useState<Record<string, string>>(org.social_links ?? {})
  const [tags, setTags] = useState<string[]>(org.ride_tags ?? [])
  const [noDrop, setNoDrop] = useState(org.rides_no_drop)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'good' | 'off'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const bad = !isLink(url) || LINKS.some((l) => !isLink(links[l.key] ?? ''))

  async function save() {
    if (bad) { setMsg({ tone: 'off', text: 'Links start with https://' }); return }
    setBusy(true)
    setMsg(null)
    try {
      await saveHostPage(org.id, {
        description, url,
        social_links: Object.fromEntries(LINKS.map((l) => [l.key, (links[l.key] ?? '').trim()])),
        ride_tags: tags, rides_no_drop: noDrop,
      })
      setDirty(false)
      setMsg({ tone: 'good', text: 'Saved. Your group shows this way on Shift and the events calendar.' })
      onSaved()
    } catch (e) {
      setMsg({ tone: 'off', text: errorText(e) })
    } finally {
      setBusy(false)
    }
  }

  const touch = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setDirty(true) }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-6">
      <Card>
        <SectionTitle hint="Who you are and what your rides are like. People read this before their first ride with you.">About {org.name}</SectionTitle>
        <div className="grid gap-4">
          <Field label="Description" htmlFor="org-desc" hint={`${1500 - description.length} characters left`}>
            <Textarea id="org-desc" rows={6} maxLength={1500} value={description} onChange={(e) => touch(setDescription)(e.target.value)}
              placeholder="We're a volunteer crew in Somerville running easy social rides every weekend, with a coffee stop and nobody left behind." />
          </Field>
          <Field label="Website" htmlFor="org-url" optional error={!isLink(url) ? 'Links start with https://' : null}>
            <Input id="org-url" value={url} onChange={(e) => touch(setUrl)(e.target.value)} placeholder="https://…" inputMode="url" />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Where people can follow along between rides.">Links</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {LINKS.map((l) => (
            <Field key={l.key} label={l.label} htmlFor={`link-${l.key}`} optional error={!isLink(links[l.key] ?? '') ? 'Links start with https://' : null}>
              <Input id={`link-${l.key}`} value={links[l.key] ?? ''} inputMode="url" placeholder={l.placeholder}
                onChange={(e) => { setLinks((p) => ({ ...p, [l.key]: e.target.value })); setDirty(true) }} />
            </Field>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle hint="Your group's rides on the events calendar carry these, and new rides you set up here start with them.">Ride style</SectionTitle>
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={noDrop} onChange={(e) => touch(setNoDrop)(e.target.checked)} className="mt-1 h-5 w-5 accent-(--ev-accent-fill)" />
          <span>
            <span className="block text-[15px] font-semibold text-(--ev-ink)">Nobody gets dropped, on every ride</span>
            <span className="block text-[14px] text-(--ev-ink-75)">The group waits or regroups so slower people stay with it.</span>
          </span>
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {TAG_OPTIONS.map((t) => (
            <Toggle key={t.key} on={tags.includes(t.key)} onClick={() => touch(setTags)(tags.includes(t.key) ? tags.filter((x) => x !== t.key) : [...tags, t.key])}>{t.label}</Toggle>
          ))}
        </div>
      </Card>

      {msg && <Notice tone={msg.tone} onClose={() => setMsg(null)}>{msg.text}</Notice>}
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => void save()} busy={busy} disabled={!dirty}>Save host page</Button>
      </div>
    </div>
  )
}

export default function HostPage() {
  const { me, refreshMe } = useConsole()
  const verified = useMemo(() => (me?.orgs ?? []).filter((o) => o.claim === 'verified'), [me])
  const pending = (me?.orgs ?? []).filter((o) => o.claim === 'pending')
  const [picked, setOrgId] = useState('')
  const orgId = picked || verified[0]?.id || ''
  const org = verified.find((o) => o.id === orgId) ?? null

  // The public page exists once a group runs often enough (lib/hosts.ts);
  // link to it only when it's there.
  const publicPath = org ? `/events/organizers/${encodeURIComponent(org.id)}` : null
  const [live, setLive] = useState(false)
  useEffect(() => {
    let on = true
    setLive(false)
    if (publicPath) fetch(publicPath, { method: 'HEAD' }).then((r) => { if (on) setLive(r.ok) }).catch(() => {})
    return () => { on = false }
  }, [publicPath])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="font-display text-[clamp(28px,3.6vw,38px)] font-extrabold leading-tight">Host page</h1>
        {live && publicPath && (
          <a href={publicPath} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
            See it live<ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
      <p className="mt-1 max-w-2xl text-[15px] leading-snug text-(--ev-ink-80)">
        How your group appears with its rides on Shift and the Green Streets events calendar.
      </p>
      {verified.length > 1 && (
        <div className="mt-5 max-w-sm">
          <Field label="Organization" htmlFor="host-org">
            <Select id="host-org" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {verified.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </Select>
          </Field>
        </div>
      )}
      <div className="mt-6">
        {org ? <Editor key={org.id} org={org} onSaved={() => void refreshMe()} /> : (
          <Empty title="No verified organization yet">
            {pending.length > 0
              ? `GSI is checking that you run ${pending.map((p) => p.name).join(' and ')}. Once that's done, you can edit its host page here.`
              : 'When you set up a ride under your organization, GSI checks that you run it. After that, its host page is yours to edit here.'}
          </Empty>
        )}
      </div>
    </div>
  )
}
