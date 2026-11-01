'use client'

import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { claimOrg, createOrg, errorText, searchOrgs, type OrgMatch } from '@/lib/organizers/api'
import type { OrgClaim } from '@/lib/organizers/types'
import { useConsole } from './ConsoleContext'
import { Button, Field, Input, Notice, Select } from './ui'

/** "yourgroup.org" from an organization's website, for the verification line. */
function domainOf(url: string | null | undefined): string | null {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : null } catch { return null }
}

/**
 * Who a ride is from: the organizer alone, or an organization they run. The
 * same steps as the app's ride form: pick one of yours, find one already on
 * the calendar, or add it. Finding or adding one claims it, and the server
 * verifies the claim on the spot when the sign-in email is at the
 * organization's website domain (Shift 01563). Until it's verified the ride
 * shows as the organizer's own; the organization's name, logo and links
 * appear once it is.
 */
export default function OrgPicker({ value, onPick }: {
  value: string
  onPick: (org: { id: string; name: string; url: string | null } | null) => void
}) {
  const { me, refreshMe } = useConsole()
  const orgs: OrgClaim[] = me?.orgs ?? []
  const picked = orgs.find((o) => o.id === value) ?? null
  const [finding, setFinding] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<OrgMatch[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [justClaimed, setJustClaimed] = useState<{ name: string; status: 'verified' | 'pending' } | null>(null)

  useEffect(() => {
    if (!finding || q.trim().length < 2) { setHits(null); return }
    let live = true
    const t = setTimeout(() => {
      searchOrgs(q).then((r) => { if (live) setHits(r) }).catch(() => { if (live) setHits([]) })
    }, 300)
    return () => { live = false; clearTimeout(t) }
  }, [q, finding])

  async function choose(org: OrgMatch) {
    setBusy(true)
    setErr(null)
    try {
      const status = orgs.some((o) => o.id === org.id) ? (orgs.find((o) => o.id === org.id)!.claim) : await claimOrg(org.id)
      await refreshMe()
      onPick(org)
      setJustClaimed({ name: org.name, status })
      setFinding(false)
      setQ('')
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function add() {
    if (!name.trim()) { setErr('Give the organization a name'); return }
    if (url.trim() && !/^https?:\/\/\S+$/i.test(url.trim())) { setErr('Links start with https://'); return }
    setBusy(true)
    setErr(null)
    try {
      const r = await createOrg(name, url)
      await refreshMe()
      onPick({ id: r.id, name: name.trim(), url: url.trim() || null })
      setJustClaimed({ name: name.trim(), status: r.status })
      setAdding(false)
      setFinding(false)
      setName('')
      setUrl('')
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const pendingDomain = picked?.claim === 'pending' ? domainOf(picked.url) : null

  return (
    <Field label="Organization" htmlFor="org" hint="A verified organization's name, logo and links show on the ride page and calendar.">
      <div className="grid gap-3">
        <Select id="org" value={value} className="max-w-[420px]"
          onChange={(e) => { setJustClaimed(null); const o = orgs.find((x) => x.id === e.target.value); onPick(o ? { id: o.id, name: o.name, url: o.url } : null) }}>
          <option value="">Just me</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}{o.claim === 'pending' ? ' (not verified yet)' : ''}</option>)}
        </Select>

        {justClaimed?.status === 'verified' && <Notice tone="good">You&rsquo;re verified for {justClaimed.name}. The ride shows its name, logo and links.</Notice>}
        {picked?.claim === 'pending' && (
          <Notice tone="info">
            Until {picked.name} is verified, the ride shows as yours. It&rsquo;s verified automatically when your sign-in email is at
            {pendingDomain ? <> {pendingDomain}</> : <> its website&rsquo;s domain</>}.
          </Notice>
        )}

        {!finding ? (
          <div>
            <Button size="sm" variant="ghost" onClick={() => { setFinding(true); setErr(null) }}>
              <Search className="h-4 w-4" aria-hidden />{orgs.length ? 'Find another organization' : 'Find your organization'}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 rounded-xl border border-(--ev-line-mid) bg-(--ev-panel-faint) p-4">
            <label htmlFor="org-search" className="text-[15px] font-semibold text-(--ev-ink-85)">Find your organization</label>
            <Input id="org-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Somerville Bike Kitchen" autoComplete="off" />
            {hits && hits.length > 0 && (
              <ul className="grid gap-1.5" aria-label="Matching organizations">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button type="button" disabled={busy} onClick={() => void choose(h)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[10px] border border-(--ev-line-strong) bg-white px-3 text-left hover:bg-(--ev-panel) disabled:opacity-60">
                      <span className="text-[15px] font-semibold text-(--ev-ink)">{h.name}</span>
                      {domainOf(h.url) && <span className="truncate text-[14px] text-(--ev-ink-75)">{domainOf(h.url)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {hits && hits.length === 0 && <p className="text-[14px] text-(--ev-ink-75)">Nothing by that name yet.</p>}

            {!adding ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { setAdding(true); setName(q.trim()) }}><Plus className="h-4 w-4" aria-hidden />Not listed? Add it</Button>
                <Button size="sm" variant="ghost" onClick={() => { setFinding(false); setQ(''); setErr(null) }}>Done</Button>
              </div>
            ) : (
              <div className="grid gap-3 border-t border-(--ev-line) pt-3 sm:grid-cols-2">
                <Field label="Name" htmlFor="new-org-name">
                  <Input id="new-org-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Somerville Slow Rollers" />
                </Field>
                <Field label="Website" htmlFor="new-org-url" optional hint="Verifies you when your email is at this domain.">
                  <Input id="new-org-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" />
                </Field>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button size="sm" variant="primary" busy={busy} onClick={() => void add()}>Add the organization</Button>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Back</Button>
                </div>
              </div>
            )}
            {err && <Notice tone="off">{err}</Notice>}
          </div>
        )}
      </div>
    </Field>
  )
}
