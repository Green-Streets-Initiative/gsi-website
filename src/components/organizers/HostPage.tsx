'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, ImagePlus, Trash2 } from 'lucide-react'
import { errorText, saveHostPage, uploadLogo } from '@/lib/organizers/api'
import { TAG_OPTIONS } from '@/lib/organizers/ride-words'
import type { OrgClaim } from '@/lib/organizers/types'
import { useConsole } from './ConsoleContext'
import GroupTeam from './GroupTeam'
import { rememberSteppedDown } from './HandoffsForMe'
import { Button, Card, Empty, Field, Input, Notice, SectionTitle, Select, Textarea, Toggle, cx } from './ui'

// The channels a ride page shows as "Follow" buttons (OrganizerChannels),
// the ones that bring the next ride to someone's phone first. The rest
// open under "More links".
const LINKS: { key: string; label: string; placeholder: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp community', placeholder: 'https://chat.whatsapp.com/…' },
  { key: 'partiful', label: 'Partiful', placeholder: 'https://partiful.com/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/yourgroup' },
  { key: 'strava', label: 'Strava club', placeholder: 'https://www.strava.com/clubs/…' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://www.facebook.com/yourgroup' },
  { key: 'discord', label: 'Discord', placeholder: 'https://discord.gg/…' },
]
const MORE_LINKS: { key: string; label: string; placeholder: string }[] = [
  { key: 'meetup', label: 'Meetup', placeholder: 'https://www.meetup.com/…' },
  { key: 'bluesky', label: 'Bluesky', placeholder: 'https://bsky.app/profile/…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://www.tiktok.com/@…' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://www.youtube.com/@…' },
  { key: 'linktree', label: 'Linktree', placeholder: 'https://linktr.ee/…' },
]
const ALL_LINKS = [...LINKS, ...MORE_LINKS]

/** "yourgroup.org" from a website address. */
function domainOf(url: string | null | undefined): string | null {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : null } catch { return null }
}

const isLink = (v: string) => !v.trim() || /^https?:\/\/\S+$/i.test(v.trim())

function Editor({ org, onSaved }: { org: OrgClaim; onSaved: () => void }) {
  const [description, setDescription] = useState(org.description ?? '')
  const [url, setUrl] = useState(org.url ?? '')
  const [links, setLinks] = useState<Record<string, string>>(org.social_links ?? {})
  const [tags, setTags] = useState<string[]>(org.ride_tags ?? [])
  const [noDrop, setNoDrop] = useState(org.rides_no_drop)
  const [logo, setLogo] = useState<string | null>(org.logo_url)
  const [logoBusy, setLogoBusy] = useState(false)
  const [more, setMore] = useState(() => MORE_LINKS.some((l) => (org.social_links ?? {})[l.key]))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'good' | 'off'; text: string } | null>(null)
  const [dirty, setDirty] = useState(false)
  const bad = !isLink(url) || ALL_LINKS.some((l) => !isLink(links[l.key] ?? ''))

  async function onLogo(file: File) {
    setLogoBusy(true)
    setMsg(null)
    try { setLogo(await uploadLogo(file)); setDirty(true) } catch (e) { setMsg({ tone: 'off', text: errorText(e) }) } finally { setLogoBusy(false) }
  }

  async function save() {
    if (bad) { setMsg({ tone: 'off', text: 'Links start with https://' }); return }
    setBusy(true)
    setMsg(null)
    try {
      await saveHostPage(org.id, {
        description, url,
        social_links: Object.fromEntries(ALL_LINKS.map((l) => [l.key, (links[l.key] ?? '').trim()])),
        ride_tags: tags, rides_no_drop: noDrop, logo_url: logo ?? '',
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

  const chips = [noDrop ? 'No-drop' : null, ...tags.filter((k) => k !== 'no_drop').map((k) => TAG_OPTIONS.find((o) => o.key === k)?.label ?? null)].filter(Boolean) as string[]
  const site = domainOf(url)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 pb-6">
      {/* The thing being made, first (design system: tool screens show it on their first screen). Mirrors /events/organizers/<id>. */}
      <section aria-label="How people see your group" className="overflow-hidden rounded-2xl border border-(--ev-line) bg-[#FAF6EE]">
        <p className="border-b border-(--ev-line) bg-white px-5 py-2.5 text-[14px] font-semibold text-(--ev-ink-75)">How people see your group</p>
        <div className="flex flex-wrap items-start gap-5 p-5 sm:p-6">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-20 w-auto max-w-[200px] shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#2D6A4F] font-display text-[28px] font-extrabold text-white" aria-hidden>
              {org.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1 basis-[280px]">
            <p className="font-display text-[clamp(24px,3vw,30px)] font-extrabold leading-tight text-(--ev-ink)">{org.name}</p>
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {chips.map((c) => <span key={c} className="rounded-full bg-(--ev-accent-tint-15) px-3 py-1 text-[14px] font-semibold text-(--ev-accent)">{c}</span>)}
              </div>
            )}
            <p className={cx('mt-2 line-clamp-4 max-w-[640px] text-[15px] leading-relaxed', description ? 'text-(--ev-ink-80)' : 'text-(--ev-ink-75)')}>
              {description || 'Your description shows here: who you are and what your rides are like.'}
            </p>
            {site && <p className="mt-2 text-[14px] font-semibold text-(--ev-accent)">{site}</p>}
          </div>
        </div>
      </section>
      <Card>
        <SectionTitle hint="Who you are and what your rides are like. People read this before their first ride with you.">About {org.name}</SectionTitle>
        <div className="grid gap-4">
          <Field label="Logo" optional hint="Your ride pages, flyers and share cards use it and its colors. A PNG with a clear background looks best.">
            {logo ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex h-24 w-48 items-center justify-center rounded-lg border border-(--ev-line-mid) bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt={`${org.name} logo`} className="max-h-full max-w-full object-contain" />
                </span>
                <label htmlFor="org-logo" className={cx('inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)', logoBusy && 'pointer-events-none opacity-60')}>
                  <ImagePlus className="h-4 w-4" aria-hidden />{logoBusy ? 'Uploading…' : 'Replace'}
                </label>
                <Button size="sm" variant="ghost" onClick={() => { setLogo(null); setDirty(true) }}><Trash2 className="h-4 w-4" aria-hidden />Remove</Button>
              </div>
            ) : (
              <label htmlFor="org-logo" className={cx('inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)', logoBusy && 'pointer-events-none opacity-60')}>
                <ImagePlus className="h-4 w-4" aria-hidden />{logoBusy ? 'Uploading…' : 'Add your logo'}
              </label>
            )}
            <input id="org-logo" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) void onLogo(file); e.target.value = '' }} />
          </Field>
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
        <SectionTitle hint="Your ride pages show these as Follow buttons, so people hear about the next ride from you.">Links</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          {(more ? ALL_LINKS : LINKS).map((l) => (
            <Field key={l.key} label={l.label} htmlFor={`link-${l.key}`} optional error={!isLink(links[l.key] ?? '') ? 'Links start with https://' : null}>
              <Input id={`link-${l.key}`} value={links[l.key] ?? ''} inputMode="url" placeholder={l.placeholder}
                onChange={(e) => { setLinks((p) => ({ ...p, [l.key]: e.target.value })); setDirty(true) }} />
            </Field>
          ))}
        </div>
        {!more && (
          <button type="button" onClick={() => setMore(true)} className="mt-3 min-h-[44px] text-[15px] font-semibold text-(--ev-accent) hover:underline">
            More links: Meetup, Bluesky, TikTok, YouTube, Linktree
          </button>
        )}
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
  const router = useRouter()
  const verified = useMemo(() => (me?.orgs ?? []).filter((o) => o.claim === 'verified'), [me])
  const pending = (me?.orgs ?? []).filter((o) => o.claim === 'pending')
  const [picked, setOrgId] = useState('')
  const orgId = picked || verified[0]?.id || ''
  const org = verified.find((o) => o.id === orgId) ?? null

  // The public page exists once a group runs often enough (lib/hosts.ts);
  // link to it only when it's there.
  const publicPath = org ? `/events/organizers/${encodeURIComponent(org.id)}` : null
  // Which page answered: a different organization starts out not live.
  const [livePath, setLivePath] = useState<string | null>(null)
  const live = !!publicPath && livePath === publicPath
  useEffect(() => {
    let on = true
    if (publicPath) fetch(publicPath, { method: 'HEAD' }).then((r) => { if (on && r.ok) setLivePath(publicPath) }).catch(() => {})
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
        {org ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <Editor key={org.id} org={org} onSaved={() => void refreshMe()} />
            <GroupTeam key={`team-${org.id}`} org={org} onSteppedDown={() => {
              const others = verified.length > 1
              setOrgId('')
              void refreshMe()
              if (!others) { rememberSteppedDown(org.name); router.push('/organizers') }
            }} />
          </div>
        ) : (
          <Empty
            title="No verified organization yet"
            picture={<HostCardSketch name={pending[0]?.name} />}
            action={pending.length === 0 ? <a href="/organizers/rides/new" className="inline-flex min-h-11 items-center rounded-xl bg-(--ev-ink) px-5 text-[15px] font-semibold text-white hover:opacity-90">Set up a ride</a> : undefined}
          >
            {pending.length > 0
              ? `${pending.map((p) => p.name).join(' and ')} ${pending.length > 1 ? 'are' : 'is'} verified automatically when your sign-in email is at ${pending.length > 1 ? 'their websites\u2019 domains' : (domainOf(pending[0].url) ?? 'its website\u2019s domain')}. Then its host page is yours to edit here.`
              : 'Set up a ride under your organization. It\u2019s verified automatically when your sign-in email is at its website\u2019s domain, and then its host page is yours to edit here.'}
          </Empty>
        )}
      </div>
    </div>
  )
}

/** The host card drawn small: the group's initials tile and its name, the way its page shows it once verified. */
function HostCardSketch({ name }: { name?: string }) {
  const initials = (name ?? 'Your group').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <div className="flex w-[240px] items-center gap-3 rounded-xl border border-(--ev-line) bg-[#FAF6EE] p-3 text-left" aria-hidden>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#2D6A4F] font-display text-[18px] font-extrabold text-white">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] font-extrabold text-(--ev-ink)">{name ?? 'Your group'}</p>
        <div className="mt-1.5 flex gap-1.5">
          <span className="h-2.5 w-12 rounded-full bg-(--ev-accent-tint-15)" />
          <span className="h-2.5 w-9 rounded-full bg-(--ev-accent-tint-15)" />
        </div>
      </div>
    </div>
  )
}
