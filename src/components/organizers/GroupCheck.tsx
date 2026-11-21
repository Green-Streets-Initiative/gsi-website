'use client'

import { useEffect, useRef, useState } from 'react'
import { AtSign, BadgeCheck, Check, Copy, ExternalLink, Globe, Link2 } from 'lucide-react'
import { errorText, getGroupCheck, runGroupCheck, settleClaimNow } from '@/lib/organizers/api'
import type { GroupCheck as State, GroupCheckPlace, GroupCheckResult } from '@/lib/organizers/types'
import { Button, Card, Field, Input, Notice, SectionTitle, Spinner, cx } from './ui'

/** "yourgroup.org" from a website address. */
function hostOf(url: string | null | undefined): string | null {
  try { return url ? new URL(url).hostname.replace(/^www\./, '') : null } catch { return null }
}
const SHARED = /(^|\.)(sites\.google\.com|google\.com|facebook\.com|instagram\.com|linktr\.ee|meetup\.com|strava\.com|github\.io|github\.com|notion\.site|wixsite\.com|squarespace\.com|wordpress\.com|blogspot\.com)$/i

const ICON = { website: Globe, instagram: AtSign, facebook: AtSign, linktree: Link2, other: AtSign } as const

const WHERE: Record<GroupCheckPlace['kind'], string> = {
  website: 'Anywhere on the home page, or on any page of the site.',
  instagram: 'In the bio.',
  facebook: 'In the page’s Intro or About text.',
  linktree: 'In the bio, or as the title of a link.',
  other: 'In the profile’s bio or description.',
}

/**
 * Show you run a group, for a claim the sign-in email couldn't verify
 * (a Gmail address, say): copy a code, put it on one of the group's pages,
 * press Check. The server reads the page and verifies the claim on the spot
 * (api/organizers/group-check). No one at Green Streets approves it.
 */
export default function GroupCheck({ organizerId, name, url, onVerified }: {
  organizerId: string
  name: string
  url: string | null
  onVerified: (told?: string | null) => void
}) {
  const [state, setState] = useState<State | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [copied, setCopied] = useState<'code' | 'tag' | null>(null)
  const [otherPage, setOtherPage] = useState(false)
  const [page, setPage] = useState('')
  const [addLink, setAddLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<GroupCheckResult | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [someoneRunsIt, setSomeoneRunsIt] = useState(false)
  // The first-load check runs once per group, whatever the parent passes.
  const verifiedRef = useRef(onVerified)
  useEffect(() => { verifiedRef.current = onVerified })

  // A group nobody runs yet is verified on the spot (a claim from the app, or
  // one made before this existed); the code is only for the rest.
  useEffect(() => {
    let on = true
    settleClaimNow(organizerId).then((r) => {
      if (!on) return
      if (r.status === 'verified') { verifiedRef.current(r.told); return }
      setSomeoneRunsIt(r.why === 'someone_runs_it')
      return getGroupCheck(organizerId).then((s) => { if (on) setState(s) })
    }).catch((e) => { if (on) setLoadErr(errorText(e)) })
    return () => { on = false }
  }, [organizerId])

  async function copy(what: 'code' | 'tag') {
    if (!state?.code) return
    const text = what === 'tag' ? `<meta name="shift-verify" content="${state.code}">` : state.code
    try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(null), 2500) } catch { /* the text is selectable */ }
  }

  async function check() {
    if (addLink.trim() && !/^https?:\/\/\S+$/i.test(addLink.trim())) { setErr('Links start with https://'); return }
    if (page.trim() && !/^https?:\/\/\S+$/i.test(page.trim())) { setErr('Links start with https://'); return }
    setBusy(true)
    setErr(null)
    setResult(null)
    try {
      const r = await runGroupCheck(organizerId, { page: page.trim(), addLink: addLink.trim() })
      setResult(r)
      if (r.verified) { onVerified(); return }
      setState((s) => (s ? { ...s, places: r.places } : s))
      if (addLink.trim()) setAddLink('')
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loadErr) return <Card><Notice tone="off">{loadErr}</Notice></Card>
  if (!state) return <Card><Spinner label={`Loading ${name}`} /></Card>
  if (state.status === 'verified') return null

  const code = state.code ?? ''
  const site = state.places.find((p) => p.kind === 'website') ?? null
  const domain = hostOf(url)
  const emailDomain = domain && !SHARED.test(domain) && !/^[\d.]+$|:/.test(domain) ? domain : null
  const noPlaces = state.places.length === 0
  const missed = result && !result.verified ? result.results : []
  const unreadable = missed.filter((m) => m.problem === 'unreadable')

  return (
    <Card>
      <SectionTitle hint={someoneRunsIt
        ? `Someone already runs ${name} on Shift and can add you from their Host page. Or show it’s yours here; it takes a minute.`
        : 'It takes a minute. Shift checks the page itself, and you can edit your group’s page right after.'}>
        Show you run {name}
      </SectionTitle>

      <ol className="grid gap-5">
        <li className="grid gap-2">
          <p className="text-[15px] font-semibold text-(--ev-ink)"><Step n={1} />Copy your code</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 select-all rounded-[10px] border border-(--ev-line-strong) bg-(--ev-panel-faint) px-3 py-2 font-mono text-[15px] font-semibold sm:px-3.5 sm:text-[17px] sm:tracking-wide text-(--ev-ink)">{code}</code>
            <Button size="md" className="shrink-0" onClick={() => void copy('code')} aria-live="polite">
              {copied === 'code' ? <><Check className="h-4 w-4" aria-hidden />Copied</> : <><Copy className="h-4 w-4" aria-hidden />Copy</>}
            </Button>
          </div>
        </li>

        <li className="grid gap-2">
          <p className="text-[15px] font-semibold text-(--ev-ink)"><Step n={2} />Paste it on one of your group&rsquo;s pages</p>
          {noPlaces ? (
            state.can_add_link ? (
              <Field label="Your group’s website, Instagram, Facebook or Linktree" htmlFor={`gc-add-${organizerId}`}
                hint="Paste the code there first. It becomes the group’s link on Shift too.">
                <Input id={`gc-add-${organizerId}`} value={addLink} onChange={(e) => setAddLink(e.target.value)} placeholder="https://www.instagram.com/yourgroup" inputMode="url" />
              </Field>
            ) : (
              <Notice tone="warn">
                {name} has no website or profile on Shift to check. Ask someone who already runs it on Shift to add you from their Host page.
              </Notice>
            )
          ) : (
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-start">
              <ul className="grid gap-2" aria-label="Where the code can go">
                {state.places.map((p) => {
                  const Icon = ICON[p.kind]
                  const miss = missed.find((m) => m.url === p.url)
                  return (
                    <li key={p.url} className="flex items-start gap-3 rounded-xl border border-(--ev-line-mid) bg-white px-3.5 py-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
                      <div className="min-w-0">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] font-semibold text-(--ev-ink) hover:underline">
                          {p.label}<ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                        <p className="text-[14px] leading-snug text-(--ev-ink-75)">{WHERE[p.kind]}{p.kind !== 'website' ? ' You can take it out once you’re verified.' : ''}</p>
                        {miss && (
                          <p className={cx('mt-1 text-[14px] font-semibold', miss.problem === 'unreadable' ? 'text-[#6B4200]' : 'text-(--ev-danger)')}>
                            {miss.problem === 'unreadable' ? `${p.label} wouldn’t let us read it.` : 'Not there yet.'}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              <BioExample name={name} code={code} />
            </div>
          )}
          {site && !otherPage && (
            <div>
              <button type="button" onClick={() => setOtherPage(true)} className="min-h-[44px] text-[15px] font-semibold text-(--ev-accent) hover:underline">
                Put it on another page of {hostOf(site.url)}, or as a hidden tag
              </button>
            </div>
          )}
          {site && otherPage && (
            <div className="grid gap-3 rounded-xl border border-(--ev-line-mid) bg-(--ev-panel-faint) p-4">
              <Field label={`Which page of ${hostOf(site.url)}?`} htmlFor={`gc-page-${organizerId}`} optional
                hint="Leave it blank when the code is on the home page.">
                <Input id={`gc-page-${organizerId}`} value={page} onChange={(e) => setPage(e.target.value)} placeholder={`${site.url.replace(/\/+$/, '')}/about`} inputMode="url" />
              </Field>
              <div className="grid gap-1.5">
                <p className="text-[14px] text-(--ev-ink-80)">To keep it out of sight, paste this into the page&rsquo;s &lt;head&gt; instead:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="select-all break-all rounded-lg border border-(--ev-line-mid) bg-white px-2.5 py-1.5 font-mono text-[14px] text-(--ev-ink)">{`<meta name="shift-verify" content="${code}">`}</code>
                  <Button size="sm" onClick={() => void copy('tag')}>
                    {copied === 'tag' ? <><Check className="h-4 w-4" aria-hidden />Copied</> : <><Copy className="h-4 w-4" aria-hidden />Copy tag</>}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </li>

        <li className="grid gap-2">
          <p className="text-[15px] font-semibold text-(--ev-ink)"><Step n={3} />Check it</p>
          <div>
            <Button variant="primary" busy={busy} disabled={noPlaces && !addLink.trim()} onClick={() => void check()}>
              <BadgeCheck className="h-4 w-4" aria-hidden />{busy ? 'Checking…' : 'Check now'}
            </Button>
          </div>
          {result && !result.verified && (
            <Notice tone="warn">
              We didn&rsquo;t find {code} yet. Some sites take a minute to show a change, so check again shortly.
              {unreadable.length > 0 && unreadable.length === missed.length && ' If it still won’t read, use your website or Linktree.'}
            </Notice>
          )}
          {err && <Notice tone="off">{err}</Notice>}
        </li>
      </ol>

      {emailDomain && (
        <p className="mt-5 border-t border-(--ev-line) pt-4 text-[14px] text-(--ev-ink-75)">
          Have an email at {emailDomain}? Sign in with it instead and you&rsquo;re verified right away.
        </p>
      )}
    </Card>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span aria-hidden className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-(--ev-accent-fill) text-[13px] font-bold text-white align-[1px]">{n}</span>
  )
}

/** What a bio with the code looks like, so the step is obvious at a glance. */
function BioExample({ name, code }: { name: string; code: string }) {
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 22) || 'yourgroup'
  return (
    <figure className="hidden rounded-xl border sm:block border-(--ev-line-mid) bg-(--ev-panel-faint) p-3.5" aria-label="Example of a bio with the code">
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-accent-fill) font-display text-[15px] font-extrabold text-white">
          {name.trim().charAt(0).toUpperCase() || 'G'}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-semibold text-(--ev-ink)">{handle}</span>
          <span className="block truncate text-[13px] text-(--ev-ink-75)">{name}</span>
        </span>
      </div>
      <p className="mt-2.5 text-[14px] leading-snug text-(--ev-ink-80)">
        Easy social rides every Sunday. Everyone welcome.<br />
        <mark className="rounded bg-[#FFF4D6] px-1 font-mono text-[13px] font-semibold text-[#6B4200]">{code}</mark>
      </p>
      <figcaption className="mt-2 text-[13px] text-(--ev-ink-75)">Like this, in a bio</figcaption>
    </figure>
  )
}
