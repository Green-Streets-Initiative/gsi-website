'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { Check, Clock, Copy, Download, ExternalLink, ImageIcon, Minus } from 'lucide-react'
import { getPromoStats } from '@/lib/organizers/api'
import { todayKey } from '@/lib/organizers/ride-words'
import type { PromoStats } from '@/lib/organizers/types'
import { PACE_LABEL, clock, dateLong, dateShort, dayShort, scheduleText } from '@/lib/rides/public'
import { PROMO_CHANNELS, PROMO_LABEL, promoLink, type PromoChannel } from '@/lib/rides/promo'
import { useRide } from './RideFrame'
import { Button, Card, Notice, SectionTitle, Spinner, Toggle, cx } from './ui'

type Post = Exclude<PromoChannel, 'qr' | 'cal'>
const POSTS = PROMO_CHANNELS.filter((c): c is { key: Post; label: string } => c.key !== 'qr' && c.key !== 'cal')

/** One line on how each place treats links, shown under its caption. */
const POST_TIP: Record<Post, string> = {
  ig: "Instagram captions can't hold a working link: put this one in your bio or on a story link sticker.",
  fb: 'Works for your page, your group and a Facebook event.',
  wa: 'For WhatsApp, Signal, GroupMe or Discord. Short, so it reads well on a phone.',
  strava: 'Post it in your Strava club, or paste it into a club event.',
  nd: 'Nextdoor likes a neighborly tone and a clear meeting spot.',
  reddit: 'For r/bikeboston and town subreddits. The first line is the post title.',
  email: 'For your own list or a newsletter that runs local events.',
}

const CALENDARS: { key: string; name: string; how: string; url: string }[] = [
  { key: 'massbike', name: 'MassBike events calendar', how: 'Free listing with a map pin. Their guide shows how to add an event.', url: 'https://www.massbike.org/massachusetts-bike-friendly-events-calendar' },
  { key: 'bostoncalendar', name: 'The Boston Calendar', how: 'Free with an account; a big Boston audience.', url: 'https://www.thebostoncalendar.com/events/new' },
  { key: 'bbe', name: 'Boston Bike Events', how: 'Run by one volunteer; send a tip by email or Instagram.', url: 'http://www.bostonbikeevents.net/' },
  { key: 'patch', name: 'Patch', how: 'Free on up to three town calendars.', url: 'https://patch.com/' },
]

function useCopy(): [string | null, (key: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null)
  const copy = (key: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 1800)
    })
  }
  return [copied, copy]
}

function CopyButton({ id, text, copied, copy, label = 'Copy', primary }: {
  id: string; text: string; copied: string | null; copy: (k: string, t: string) => void; label?: string; primary?: boolean
}) {
  const done = copied === id
  return (
    <Button size="sm" variant={primary ? 'primary' : 'secondary'} onClick={() => copy(id, text)} aria-live="polite">
      {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {done ? 'Copied' : label}
    </Button>
  )
}

function saveFile(name: string, href: string) {
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function miles(n: number): string {
  const v = n < 10 ? Number(n.toFixed(1)) : Math.round(n)
  return `${v} ${v === 1 ? 'mile' : 'miles'}`
}

function fileSlug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'ride'
}

function StepTitle({ n, children }: { n?: number; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      {n && <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--ev-accent-fill) font-sans text-[14px] font-bold text-(--ev-on-accent-fill)">{n}</span>}
      {children}
    </span>
  )
}

/** Breaks text into lines that fit `width` on the canvas. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  if (lines.length > max) {
    lines.length = max
    lines[max - 1] = lines[max - 1].replace(/\s+\S*$/, '') + '…'
  }
  return lines
}

export default function PromoteView() {
  const { detail } = useRide()
  const r = detail.ride
  const code = r.invite_code
  const [copied, copy] = useCopy()
  const [post, setPost] = useState<Post>('ig')
  const [edits, setEdits] = useState<Partial<Record<Post, string>>>({})
  const [qr, setQr] = useState<string | null>(null)
  const [stats, setStats] = useState<PromoStats | null>(null)
  const [statsErr, setStatsErr] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [making, setMaking] = useState(false)

  const doneKey = `promote-calendars-${r.id}`
  useEffect(() => {
    try { setDone(JSON.parse(localStorage.getItem(doneKey) ?? '{}')) } catch { /* private mode */ }
  }, [doneKey])
  const tick = (k: string) => {
    setDone((d) => {
      const next = { ...d, [k]: !d[k] }
      try { localStorage.setItem(doneKey, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }

  useEffect(() => {
    let live = true
    getPromoStats(r.id)
      .then((s) => { if (live) setStats(s) })
      .catch(() => { if (live) setStatsErr("We couldn't load link counts. Try again in a minute.") })
    return () => { live = false }
  }, [r.id])

  const flyerLink = promoLink(code, 'qr')
  useEffect(() => {
    let live = true
    QRCode.toDataURL(flyerLink, { width: 1024, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => { if (live) setQr(url) })
      .catch(() => { /* the download button stays off */ })
    return () => { live = false }
  }, [flyerLink])

  // The facts every caption is built from.
  const facts = useMemo(() => {
    const today = todayKey()
    const next = detail.occurrences
      .filter((o) => o.status === 'scheduled' && o.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
    const repeats = (r.days ?? []).length > 0 || r.frequency === 'daily'
    const when = repeats ? scheduleText(r) : next ? `${dateLong(next.date)} · ${clock(next.start_time)}` : scheduleText(r)
    const nextLine = next ? `${dayShort(next.date)} ${dateShort(next.date)}, ${clock(next.start_time)}` : null
    const place = next?.meetup_name || r.meetup_name || next?.meetup_address || r.meetup_address || null
    const about = (r.description ?? '').trim().split(/(?<=[.!?])\s+/)[0]?.slice(0, 220) || ''
    const extras = [r.pace ? PACE_LABEL[r.pace] : null, r.route_miles ? `about ${miles(r.route_miles)}` : null].filter(Boolean).join(', ')
    const welcome = r.no_drop || r.tags.includes('beginner_friendly')
      ? 'New to group rides? This is a good first one: nobody gets left behind.'
      : 'New faces always welcome.'
    return { when, nextLine, place, about, extras, welcome, repeats, upcoming: !!next }
  }, [detail.occurrences, r])

  const captionFor = (c: Post): string => {
    const link = promoLink(code, c)
    const { nextLine, place, about, extras, welcome, repeats } = facts
    const when = facts.when.replace(' · ', ', ')
    const at = place ? ` at ${place}` : ''
    const lines = (...xs: (string | null | false)[]) => xs.filter((x): x is string => typeof x === 'string').join('\n').replace(/\n{3,}/g, '\n\n')
    switch (c) {
      case 'ig':
        return lines(r.name, `${facts.when}${place ? ` · ${place}` : ''}`, about, extras && `${extras[0].toUpperCase()}${extras.slice(1)}.`, welcome, '', 'RSVP at the link in our bio, no app needed.')
      case 'fb':
        return lines(`${r.name}: ${when}, meeting${at}.`, about, extras && `${extras[0].toUpperCase()}${extras.slice(1)}.`, welcome, '', `Say you're coming (no app needed): ${link}`)
      case 'wa':
        return `${r.name}${nextLine ? `, ${nextLine}` : ''}${at}. Coming? Tap to RSVP: ${link}`
      case 'strava':
        return lines(`${r.name}: ${when}${at}.`, extras && `${extras[0].toUpperCase()}${extras.slice(1)}.`, about, `RSVP: ${link}`)
      case 'nd':
        return lines(`Hi neighbors! Join us for ${r.name}, ${facts.when.replace(' · ', ' at ')}${at}.`, about, welcome, `Details and RSVP: ${link}`)
      case 'reddit':
        return lines(`[${repeats ? 'Group ride' : 'Ride'}] ${r.name}, ${nextLine ?? when}`, '', `${when}${at}.`, about, extras && `${extras[0].toUpperCase()}${extras.slice(1)}.`, welcome, '', `RSVP and updates if plans change: ${link}`)
      case 'email':
        return lines(r.name, `${when}${at}`, about, welcome, `RSVP: ${link}`)
    }
  }
  const caption = edits[post] ?? captionFor(post)

  const calendarText = [
    r.name,
    facts.when,
    r.meetup_name && r.meetup_address ? `${r.meetup_name}, ${r.meetup_address}` : (r.meetup_name || r.meetup_address || ''),
    (r.description ?? '').trim(),
    `RSVP: ${promoLink(code, 'cal')}`,
  ].filter(Boolean).join('\n\n')

  async function makePlainPost() {
    setMaking(true)
    try {
      await document.fonts.ready
      const W = 1080, H = 1350, P = 88
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#FBF7EF'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#1F2A24'
      ctx.textBaseline = 'top'
      ctx.font = "800 92px 'Bricolage Grotesque', sans-serif"
      let y = P
      for (const l of wrap(ctx, r.name, W - P * 2, 3)) { ctx.fillText(l, P, y); y += 100 }
      y += 28
      ctx.font = "500 46px 'DM Sans', sans-serif"
      for (const l of wrap(ctx, facts.when, W - P * 2, 2)) { ctx.fillText(l, P, y); y += 60 }
      if (facts.place) for (const l of wrap(ctx, facts.place, W - P * 2, 2)) { ctx.fillText(l, P, y); y += 60 }
      if (facts.extras) { ctx.fillText(facts.extras[0].toUpperCase() + facts.extras.slice(1), P, y); y += 60 }
      const q = 420
      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, flyerLink, { width: q, margin: 2, errorCorrectionLevel: 'M', color: { light: '#FBF7EF' } })
      ctx.drawImage(qrCanvas, P - 24, H - P - q - 70, q, q)
      ctx.font = "700 40px 'DM Sans', sans-serif"
      ctx.fillText('Scan to RSVP', P + q + 20, H - P - q / 2 - 90)
      ctx.font = "500 32px 'DM Sans', sans-serif"
      ctx.fillText('No app needed', P + q + 20, H - P - q / 2 - 36)
      ctx.font = "500 30px 'DM Sans', sans-serif"
      ctx.fillText(`gogreenstreets.org/r/${code}/qr`, P, H - P - 30)
      saveFile(`${fileSlug(r.name)}-post.png`, canvas.toDataURL('image/png'))
    } finally {
      setMaking(false)
    }
  }

  const rows = useMemo(() => {
    const by = new Map((stats?.channels ?? []).map((c) => [c.channel, c]))
    return PROMO_CHANNELS.map((c) => ({ ...c, v: by.get(c.key) })).filter((c) => c.v)
  }, [stats])


  const listed = r.visibility === 'public' && r.calendar_status === 'approved'
  const calsDone = CALENDARS.filter((c) => done[c.key]).length + (listed ? 1 : 0)
  const visits = (stats?.channels ?? []).reduce((a, c) => a + c.visits, 0)
  const people = (stats?.channels ?? []).reduce((a, c) => a + c.people, 0)
  const steps: { id: string; n?: number; label: string; value: string }[] = [
    { id: 'flyer', n: 1, label: 'Flyer', value: r.flyer_url ? 'Yours is up' : 'QR ready' },
    { id: 'posts', n: 2, label: 'Social posts', value: `${POSTS.length} captions` },
    { id: 'calendars', n: 3, label: 'Calendars', value: `${calsDone} of ${CALENDARS.length + 1}` },
    { id: 'results', label: 'Results', value: stats ? `${visits} visits, ${people} yes` : '–' },
  ]

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {!facts.upcoming && (
        <Notice tone="warn">
          No dates coming up, so these posts point to a ride that&apos;s over. <Link href={`/organizers/rides/${r.id}`} className="font-semibold underline">Add a date</Link> before you post.
        </Notice>
      )}

      <nav aria-label="Promote steps" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s) => (
          <a key={s.id} href={`#${s.id}`}
            className="flex min-h-[64px] flex-col justify-center rounded-xl border border-(--ev-line) bg-white px-4 py-2.5 hover:bg-(--ev-panel-faint)">
            <span className="text-[14px] font-semibold text-(--ev-ink-75)">{s.n ? `${s.n}. ` : ''}{s.label}</span>
            <span className="font-display text-[18px] font-extrabold leading-tight text-(--ev-ink)">{s.value}</span>
          </a>
        ))}
      </nav>

      <Card id="flyer">
        <SectionTitle hint="Put this QR on your own flyer or poster. It opens the ride page.">
          <StepTitle n={1}>Flyer</StepTitle>
        </SectionTitle>
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-[132px] w-[132px] shrink-0 overflow-hidden rounded-xl border border-(--ev-line) bg-white">
            {qr ? <img src={qr} alt={`QR code for ${r.name}`} className="h-full w-full" /> : null}
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button size="sm" variant="primary" disabled={!qr} onClick={() => qr && saveFile(`${fileSlug(r.name)}-qr.png`, qr)}>
              <Download className="h-4 w-4" aria-hidden />Download QR code
            </Button>
            <Button size="sm" busy={making} onClick={() => void makePlainPost()}>
              <ImageIcon className="h-4 w-4" aria-hidden />No flyer yet? Get a plain one
            </Button>
            <p className="text-[14px] text-(--ev-ink-75)">
              {r.flyer_url
                ? <>Your flyer shows on the ride page. <Link href={`/organizers/rides/${r.id}/edit`} className="font-semibold text-(--ev-ink) underline">Change it</Link></>
                : <>Made your own? <Link href={`/organizers/rides/${r.id}/edit`} className="font-semibold text-(--ev-ink) underline">Add it to the ride page</Link></>}
            </p>
          </div>
        </div>
      </Card>

      <Card id="posts">
        <SectionTitle hint="Each place gets its own link, so Results can show which posts bring people.">
          <StepTitle n={2}>Social posts</StepTitle>
        </SectionTitle>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Where you're posting">
          {POSTS.map((c) => (
            <Toggle key={c.key} on={post === c.key} onClick={() => setPost(c.key)} role="tab" aria-selected={post === c.key}>
              {c.label}
            </Toggle>
          ))}
        </div>
        <label htmlFor="promo-caption" className="mt-4 block text-[14px] font-semibold text-(--ev-ink-85)">Caption (edit it to sound like you)</label>
        <textarea
          id="promo-caption"
          value={caption}
          onChange={(e) => setEdits((x) => ({ ...x, [post]: e.target.value }))}
          rows={post === 'wa' ? 3 : 8}
          className="mt-1.5 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3.5 py-3 text-[15px] leading-relaxed text-(--ev-ink) focus-visible:outline-2 focus-visible:outline-(--ev-accent)"
        />
        <p className="mt-2 text-[14px] text-(--ev-ink-75)">{POST_TIP[post]}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton id={`cap-${post}`} text={caption} copied={copied} copy={copy} label="Copy caption" primary />
          <CopyButton id={`link-${post}`} text={promoLink(code, post)} copied={copied} copy={copy} label={post === 'ig' ? 'Copy bio link' : 'Copy link only'} />
          {edits[post] !== undefined && (
            <Button size="sm" variant="ghost" onClick={() => setEdits((x) => { const n = { ...x }; delete n[post]; return n })}>Start over</Button>
          )}
          <span className="ml-auto break-all text-[14px] text-(--ev-ink-75)">{promoLink(code, post).replace('https://www.', '')}</span>
        </div>
      </Card>

      <Card id="calendars">
        <SectionTitle
          hint="Copy the listing once, then paste it into each calendar."
          action={<CopyButton id="cal" text={calendarText} copied={copied} copy={copy} label="Copy listing" primary />}
        >
          <StepTitle n={3}>Event calendars</StepTitle>
        </SectionTitle>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-1 sm:grid-cols-2">
          <li className="flex items-start gap-3 rounded-xl bg-(--ev-panel-faint) px-3 py-3">
            <span className={cx('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
              listed ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'bg-white text-(--ev-ink-75)')}>
              {listed ? <Check className="h-4 w-4" aria-hidden />
                : r.visibility === 'public' && r.calendar_status === 'pending' ? <Clock className="h-4 w-4" aria-hidden />
                : <Minus className="h-4 w-4" aria-hidden />}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-(--ev-ink)">Green Streets events calendar</p>
              <p className="text-[14px] text-(--ev-ink-75)">
                {r.visibility !== 'public' ? 'Invite-only rides stay off the calendar.'
                  : listed ? 'Listed for you, and updated when the ride changes.'
                  : r.calendar_status === 'pending' ? 'Listed for you once we check it, usually within a day.'
                  : "Not listed. Write to keith@gogreenstreets.org if that's a mistake."}
              </p>
            </div>
          </li>
          {CALENDARS.map((c) => (
            <li key={c.key} className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-(--ev-panel-faint)">
              <button
                type="button"
                onClick={() => tick(c.key)}
                aria-pressed={!!done[c.key]}
                aria-label={`Mark ${c.name} ${done[c.key] ? 'not done' : 'done'}`}
                className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              >
                <span className={cx('flex h-7 w-7 items-center justify-center rounded-full',
                  done[c.key] ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : 'border-2 border-(--ev-line-strong) bg-white')}>
                  {done[c.key] && <Check className="h-4 w-4" aria-hidden />}
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[15px] font-semibold text-(--ev-ink) underline-offset-2 hover:underline">
                  {c.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
                <p className="text-[14px] text-(--ev-ink-75)">{c.how}</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card id="results">
        <SectionTitle hint="Visits to each link, and people who said yes through it.">Results</SectionTitle>
        {statsErr ? <Notice tone="off">{statsErr}</Notice>
          : !stats ? <Spinner label="Counting visits" />
          : rows.length === 0 ? (
            <p className="text-[15px] text-(--ev-ink-85)">
              No visits yet. <a href="#posts" className="font-semibold underline">Post your first link</a> and the counts start here.
            </p>
          ) : (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ key, v }) => (
                <li key={key} className="rounded-xl bg-(--ev-panel-faint) px-4 py-3">
                  <p className="text-[14px] font-semibold text-(--ev-ink-75)">{PROMO_LABEL[key]}</p>
                  <p className="mt-1 flex items-baseline gap-4">
                    <span><span className="font-display text-[26px] font-extrabold leading-none">{v!.visits}</span> <span className="text-[14px] text-(--ev-ink-75)">visits</span></span>
                    <span><span className="font-display text-[26px] font-extrabold leading-none">{v!.people}</span> <span className="text-[14px] text-(--ev-ink-75)">said yes</span></span>
                  </p>
                  {v!.visits_week > 0 && <p className="mt-1 text-[14px] text-(--ev-ink-75)">{v!.visits_week} visits this week</p>}
                </li>
              ))}
            </ul>
          )}
        {stats && stats.direct_people > 0 && (
          <p className="mt-3 text-[14px] text-(--ev-ink-75)">Plus {stats.direct_people} who said yes from the plain ride page link.</p>
        )}
      </Card>
    </div>
  )
}
