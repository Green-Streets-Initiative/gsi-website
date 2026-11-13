'use client'

import { Fragment, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { ArrowSquareOut, ArrowUp } from '@phosphor-icons/react'
import StoreBadges from '@/components/StoreBadges'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { askTripStrings } from '@/lib/site-strings/ask-trip'
import AskTripCard, { type AskCard } from '@/components/commute/AskTripCard'

/*
 * "Ask about this trip" (Keith 2026-11-08): a visitor with no Shift account
 * asks about the plan on the Commute Advisor in their own words, and the
 * Shift assistant answers with its look-ups only (/api/shift/ask-trip).
 * The plan comes first; this sits under it and supports it. When the answer
 * calls for it, the box invites them to keep the trip in Shift (the store
 * badges): that's the conversion the trial measures.
 *
 * Off unless the switch is on for this browser (app_feature_flags
 * visitor_trip_assistant: its rollout_percent picks a share of browsers, the
 * rest are the holdout), or ?ask=1 previews it. Built to be reused by
 * /nearby: it needs only a trip.
 *
 * Analytics (PostHog, website): ask_trip_exposure (once per page, both arms,
 * while the switch is on), ask_trip_asked, ask_trip_answered,
 * ask_trip_invite_shown, ask_trip_store_clicked, ask_trip_link_clicked,
 * ask_trip_card_shown and ask_trip_card_directions (the route or comparison
 * card under an answer), ask_trip_limit (daily or monthly). Never the
 * question's words.
 */

export type AskTrip = {
  from: { lat: number; lng: number }
  to: { lat: number; lng: number; name: string }
  arrive_by: string | null
  route_date: string | null
  miles: number | null
  recommended: string | null
  no_car: boolean
  ways: { way: string; minutes: number | null; cost_per_day: number | null; leave_by: string | null }[]
  /** The transit trip's lines, as the plan names them. */
  transit: string | null
}

type AskLink = { kind: 'parking' | 'roam'; href: string; name: string }
type Turn = { q: string; a: string; step: string | null; links: AskLink[]; cards: AskCard[]; invite: boolean; error: string | null; done: boolean }
type Gate = { on: boolean; token?: string; left?: number; preview?: boolean; rollout?: number }

const VID_KEY = 'ask-trip-vid'
const DAILY_MAX = 5
const PLAY_URL = 'https://play.google.com/store/apps/details?id=org.greenstreets.shift&referrer=utm_source%3Dgogreenstreets%26utm_medium%3Dwebsite%26utm_campaign%3Dask_trip'

function visitorId(): string {
  try {
    const kept = localStorage.getItem(VID_KEY)
    if (kept && /^[A-Za-z0-9_-]{16,64}$/.test(kept)) return kept
    const fresh = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'[b % 64]).join('')
    localStorage.setItem(VID_KEY, fresh)
    return fresh
  } catch {
    return `s${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 24)
  }
}

/** 0-99, steady for a browser: which side of the trial it is on. */
function bucketOf(vid: string): number {
  let h = 2166136261
  for (let i = 0; i < vid.length; i++) h = Math.imul(h ^ vid.charCodeAt(i), 16777619) >>> 0
  return h % 100
}

const previewParam = () => {
  try { return new URLSearchParams(window.location.search).get('ask') === '1' } catch { return false }
}

type AskKey = keyof (typeof askTripStrings)['en'] & string
/** The step line for a tool the server named, or the plain one. */
const stepKey = (step: string | null): AskKey => {
  const k = `ask.step_${step}`
  return step && k in askTripStrings.en ? (k as AskKey) : 'ask.working'
}

const capture = (event: string, props: Record<string, unknown>) => {
  try { posthog.capture(event, props) } catch { /* analytics never blocks */ }
}

/** Plain text with "- " lines as a list, the way the assistant writes. */
function Answer({ text }: { text: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flush = (key: number) => {
    if (!list.length) return
    blocks.push(<ul key={`l${key}`} className="my-1 list-disc space-y-1 pl-5">{list.map((li, i) => <li key={i}>{li}</li>)}</ul>)
    list = []
  }
  text.split('\n').forEach((line, i) => {
    const m = line.match(/^\s*[-•]\s+(.*)$/)
    if (m) { list.push(m[1]); return }
    flush(i)
    if (line.trim()) blocks.push(<p key={i} className="mb-1.5 last:mb-0">{line}</p>)
  })
  flush(-1)
  return <>{blocks}</>
}

export default function AskAboutTrip({ trip, locale = 'en', source = 'commute_advisor' }: { trip: AskTrip; locale?: SiteLocale; source?: string }) {
  const t = translator(askTripStrings, locale)
  const [gate, setGate] = useState<Gate | null>(null)
  const [shown, setShown] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [left, setLeft] = useState<number | null>(null)
  const [stopped, setStopped] = useState<'daily' | 'monthly' | null>(null)
  const [busy, setBusy] = useState(false)
  const vidRef = useRef('')
  const honeyRef = useRef<HTMLInputElement>(null)
  const inviteSent = useRef(false)
  const max = gate?.preview ? 20 : DAILY_MAX

  // Is it on for this browser? One look per plan; off on any error.
  useEffect(() => {
    const vid = visitorId()
    vidRef.current = vid
    const preview = previewParam()
    const ctrl = new AbortController()
    fetch(`/api/shift/ask-trip?vid=${encodeURIComponent(vid)}${preview ? '&preview=1' : ''}`, { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => r.json() as Promise<Gate>)
      .then((g) => {
        if (!g.on) return
        const inTrial = !!g.preview || bucketOf(vid) < (g.rollout ?? 0)
        if (!g.preview) capture('ask_trip_exposure', { in_trial: inTrial, rollout: g.rollout, source, locale })
        setGate(g)
        setLeft(typeof g.left === 'number' ? g.left : null)
        setShown(inTrial)
        if (g.left === 0) setStopped('daily')
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [source, locale])

  const ways = new Set(trip.ways.map((w) => w.way))
  const suggestions = (['s_rain', ways.has('bike') ? 's_calm' : null, ways.has('transit') ? 's_bike_t' : null, 's_kid'] as const)
    .filter((s): s is 's_rain' | 's_calm' | 's_bike_t' | 's_kid' => !!s)
    .slice(0, 3)

  const patch = (i: number, p: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
    setTurns((all) => all.map((x, k) => (k === i ? { ...x, ...(typeof p === 'function' ? p(x) : p) } : x)))

  const ask = useCallback(async (question: string, from: 'typed' | 'suggestion', suggestion?: string) => {
    const q = question.trim().slice(0, 600)
    if (!q || busy || !gate?.token || stopped) return
    setBusy(true)
    setDraft('')
    const history = turns.filter((x) => x.done && !x.error && x.a).slice(-4).map((x) => ({ q: x.q, a: x.a }))
    const i = turns.length
    setTurns((all) => [...all, { q, a: '', step: null, links: [], cards: [], invite: false, error: null, done: false }])
    capture('ask_trip_asked', { n: i + 1, from, suggestion: suggestion ?? null, source, locale, preview: !!gate.preview })
    const started = Date.now()
    let answer = ''
    let invite = false
    try {
      const res = await fetch('/api/shift/ask-trip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history, trip, locale, vid: vidRef.current, token: gate.token, website: honeyRef.current?.value ?? '', preview: !!gate.preview }),
      })
      if (!res.ok || !res.body) {
        const code = ((await res.json().catch(() => ({}))) as { code?: string }).code ?? 'failed'
        if (code === 'daily' || code === 'monthly') {
          setStopped(code)
          setLeft(0)
          setTurns((all) => all.slice(0, i))
          capture('ask_trip_limit', { kind: code, source, locale })
          return
        }
        patch(i, { error: code === 'model_busy' ? 'err_busy' : 'err_failed', done: true })
        return
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        let nl: number
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim()
          buf = buf.slice(nl + 1)
          if (!line) continue
          let e: { type: string; delta?: string; key?: string; links?: AskLink[]; cards?: AskCard[]; code?: string; left?: number | null }
          try { e = JSON.parse(line) } catch { continue }
          if (e.type === 'text' && e.delta) { answer += e.delta; const a = answer; patch(i, { a, step: null }) }
          else if (e.type === 'step' && e.key) patch(i, { step: e.key })
          else if (e.type === 'links' && e.links) patch(i, { links: e.links })
          else if (e.type === 'cards' && Array.isArray(e.cards)) {
            const cards = e.cards.slice(0, 2)
            patch(i, { cards })
            for (const c of cards) capture('ask_trip_card_shown', { kind: c.compare ? 'compare' : 'route', lead: c.compare ? null : c.lead ?? 'bike', source, locale, preview: !!gate.preview })
          }
          else if (e.type === 'invite') { invite = true; patch(i, { invite: true }) }
          else if (e.type === 'error') patch(i, { error: e.code === 'refused' ? 'err_refused' : e.code === 'model_busy' ? 'err_busy' : 'err_failed' })
          else if (e.type === 'done' && typeof e.left === 'number') setLeft(e.left)
        }
      }
      patch(i, (x) => ({ done: true, step: null, error: x.error ?? (answer.trim() ? null : 'err_failed') }))
      capture('ask_trip_answered', { n: i + 1, invite, seconds: Math.round((Date.now() - started) / 1000), source, locale, preview: !!gate.preview })
      if (invite && !inviteSent.current) {
        inviteSent.current = true
        capture('ask_trip_invite_shown', { n: i + 1, source, locale, preview: !!gate.preview })
      }
    } catch {
      patch(i, { error: 'err_failed', done: true, step: null })
    } finally {
      setBusy(false)
    }
  }, [busy, gate, stopped, turns, trip, locale, source])

  if (!gate?.on || !shown) return null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void ask(draft, 'typed')
  }
  // The invitation shows once, under the first answer that asks for it (or at the day's limit).
  const inviteAt = turns.findIndex((x) => x.invite && x.done)
  const saveCard = (
    <div className="mt-3 rounded-[10px] border border-[#2D6A4F]/25 bg-[#F4F8EE] px-3.5 py-3">
      <p className="text-[1rem] font-bold text-[#191A2E]">{t('ask.save_title')}</p>
      <p className="mt-0.5 text-[0.9375rem] leading-snug text-[#191A2E]">{t('ask.save_body')}</p>
      <div
        className="mt-2.5"
        onClickCapture={(ev) => {
          const a = (ev.target as HTMLElement).closest('a')
          if (a) capture('ask_trip_store_clicked', { store: a.href.includes('apple.com') ? 'ios' : 'android', source, locale, questions: turns.length, preview: !!gate?.preview })
        }}
      >
        <StoreBadges height={40} androidUrl={PLAY_URL} />
      </div>
    </div>
  )

  return (
    <section aria-labelledby="ask-trip-title" className="mt-3.5 rounded-[12px] border border-[rgba(25,26,46,0.12)] bg-white px-3.5 py-3.5">
      <h3 id="ask-trip-title" className="text-[1.0625rem] font-bold text-[#191A2E]">{t('ask.title')}</h3>

      {turns.map((x, i) => (
        <Fragment key={i}>
          <p className="mt-3 text-[0.9375rem] font-semibold leading-snug text-[#191A2E]">{x.q}</p>
          <div className="mt-1 text-[0.9375rem] leading-relaxed text-[#191A2E]" aria-live="polite">
            {x.a ? <Answer text={x.a} /> : null}
            {!x.done && !x.a && (
              <p className="flex items-center gap-2 text-[#4A4D68]">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[rgba(25,26,46,0.15)] border-t-[#2D6A4F]" aria-hidden />
                {t(stepKey(x.step))}
              </p>
            )}
            {x.error && <p className="text-[#8A2F1E]">{t(`ask.${x.error}` as AskKey)}</p>}
          </div>
          {x.done && !x.error && x.cards.map((c, k) => (
            <AskTripCard
              key={k}
              card={c}
              locale={locale}
              onDirections={(way) => capture('ask_trip_card_directions', { kind: c.compare ? 'compare' : 'route', way, source, locale, preview: !!gate?.preview })}
            />
          ))}
          {x.done && x.links.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {x.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href.startsWith('/') ? withLang(l.href, locale) : l.href}
                  target="_blank"
                  rel="noopener"
                  onClick={() => capture('ask_trip_link_clicked', { kind: l.kind, source, locale })}
                  className="inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-[#2D6A4F] hover:underline"
                >
                  {t(l.kind === 'parking' ? 'ask.link_parking' : 'ask.link_roam', { name: l.name })}
                  <ArrowSquareOut size={15} weight="bold" aria-hidden />
                </Link>
              ))}
            </div>
          )}
          {i === inviteAt && !stopped && saveCard}
        </Fragment>
      ))}

      {stopped ? (
        <>
          <p className="mt-3 text-[0.9375rem] leading-snug text-[#191A2E]">{t(stopped === 'daily' ? 'ask.err_daily' : 'ask.err_monthly')}</p>
          {stopped === 'daily' && saveCard}
        </>
      ) : (
        <>
          {turns.length === 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => void ask(t(`ask.${s}`), 'suggestion', s)}
                  className="min-h-[40px] rounded-full border border-[rgba(25,26,46,0.18)] bg-white px-3.5 text-left text-[0.9375rem] font-semibold text-[#191A2E] transition-colors hover:border-[#2D6A4F] hover:bg-[#F4F8EE] disabled:opacity-60"
                >
                  {t(`ask.${s}`)}
                </button>
              ))}
            </div>
          )}
          <form onSubmit={submit} className="mt-3 flex items-center gap-2">
            <label htmlFor="ask-trip-q" className="sr-only">{t('ask.input_label')}</label>
            <input
              id="ask-trip-q"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={600}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={t('ask.placeholder')}
              className="min-h-[44px] min-w-0 flex-1 rounded-full border border-[rgba(25,26,46,0.18)] bg-white px-4 text-[1rem] text-[#191A2E] outline-none placeholder:text-[#5B6075] focus:border-[#2D6A4F]"
            />
            {/* Only bots fill this in: people never see it. */}
            <input ref={honeyRef} type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-px w-px opacity-0" />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label={t('ask.send')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2D6A4F] text-white transition-colors hover:bg-[#1F4D3A] disabled:opacity-40"
            >
              <ArrowUp size={20} weight="bold" aria-hidden />
            </button>
          </form>
          <p className="mt-2 text-[0.875rem] leading-snug text-[#4A4D68]">
            {t('ask.note')}{left != null && left < max ? ` ${left > 0 ? t('ask.left', { n: left, max }) : t('ask.left_none')}` : ''}
          </p>
        </>
      )}
    </section>
  )
}
