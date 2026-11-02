'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { MessageSquareHeart } from 'lucide-react'
import { errorText, getFeedbackDue, sendFeedback, type FeedbackDue } from '@/lib/organizers/api'
import { dateLabel } from '@/lib/organizers/ride-words'
import { useConsole } from './ConsoleContext'
import { track } from '@/lib/organizers/track'
import { Button, Card, Dialog, Field, Input, Notice, Textarea, Toggle } from './ui'

/**
 * Feedback from organizers (01595, Keith 2026-11-02). Once a ride's first
 * date has gone by, the console asks how it went, once per ride; "Not now"
 * puts it off a week. "Send feedback" asks the same at any time, with no
 * ride. An answer they let us share shows on the organizer kit page.
 */

const HOW = [
  { key: 'great', label: 'Great' },
  { key: 'okay', label: 'Okay' },
  { key: 'rough', label: 'Rough' },
] as const
type How = (typeof HOW)[number]['key']

const LATER_DAYS = 7
const laterKey = (seriesId: string) => `organizer-feedback-later:${seriesId}`

function putOff(seriesId: string): boolean {
  try {
    const at = Number(localStorage.getItem(laterKey(seriesId)) ?? 0)
    return Date.now() - at < LATER_DAYS * 86_400_000
  } catch { return false }
}

function FeedbackForm({ due, onSent }: { due: FeedbackDue; onSent: () => void }) {
  const { me } = useConsole()
  const group = me?.orgs?.[0]?.name
  const [how, setHow] = useState<How | null>(null)
  const [fix, setFix] = useState('')
  const [quote, setQuote] = useState('')
  const [share, setShare] = useState(true)
  const [name, setName] = useState([me?.first_name, group].filter(Boolean).join(', '))
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const willShare = share && quote.trim().length > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!how && !fix.trim() && !quote.trim()) { setErr('Tell us something first.'); return }
    if (willShare && !name.trim()) { setErr('Add the name to show with your words, or untick sharing.'); return }
    setBusy(true)
    setErr(null)
    try {
      await sendFeedback({ seriesId: due?.series_id ?? null, rideDate: due?.ride_date ?? null, how, fix, quote, mayQuote: willShare, shownName: name })
      track('organizer_feedback_sent', { how, has_fix: !!fix.trim(), has_quote: !!quote.trim(), shared: willShare, after_ride: !!due })
      onSent()
    } catch (e2) {
      setErr(errorText(e2, "We couldn't send it. Try again in a minute."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {due && (
        <Field label="How did it go?">
          <div className="flex flex-wrap gap-2">
            {HOW.map((h) => <Toggle key={h.key} on={how === h.key} onClick={() => setHow(how === h.key ? null : h.key)}>{h.label}</Toggle>)}
          </div>
        </Field>
      )}
      <Field label="What should we fix or add?" htmlFor="fb-fix" optional>
        <Textarea id="fb-fix" value={fix} onChange={(e) => setFix(e.target.value)} maxLength={1500}
          placeholder="Anything that got in your way, or a tool you wished you had" />
      </Field>
      <Field label="What would you tell another organizer about Shift?" htmlFor="fb-quote" optional>
        <Textarea id="fb-quote" value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={400} className="min-h-[72px]" />
      </Field>
      {quote.trim() && (
        <div className="rounded-[12px] bg-(--ev-panel) p-4">
          <label className="flex items-start gap-3 text-[15px] font-semibold text-(--ev-ink-85)">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-1 h-4 w-4 accent-(--ev-accent-fill)" />
            <span>Share it on our page for organizers</span>
          </label>
          {share && (
            <div className="mt-3 pl-7">
              <Field label="Show it as" htmlFor="fb-name" hint="Your first name and your group, or however you like.">
                <Input id="fb-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Maria, Somerville Social Rides" />
              </Field>
            </div>
          )}
        </div>
      )}
      {err && <p role="alert" className="text-[14px] font-semibold text-(--ev-danger)">{err}</p>}
      <Button type="submit" variant="primary" busy={busy}>Send to Green Streets</Button>
    </form>
  )
}

/** The "how did it go?" card, on the rides page once a ride's first date has gone by. */
export function FeedbackDueCard() {
  const [due, setDue] = useState<FeedbackDue>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    let live = true
    getFeedbackDue()
      .then((d) => {
        if (!live || !d || putOff(d.series_id)) return
        setDue(d)
        track('organizer_feedback_asked', { series_id: d.series_id })
      })
      .catch(() => { /* the card is extra; the page works without it */ })
    return () => { live = false }
  }, [])

  if (sent) {
    return <div className="mb-5"><Notice tone="good" onClose={() => setSent(false)}>Thanks. We read every one, and it shapes what we build next.</Notice></div>
  }
  if (!due) return null
  return (
    <Card className="mb-6 border-(--ev-accent) shadow-(--ev-shadow)">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-[22px] font-extrabold leading-tight">How did {due.ride_name} go?</h2>
          <p className="mt-1 text-[15px] text-(--ev-ink-80)">Your first date was {dateLabel(due.ride_date)}. Two minutes helps us make the next one easier.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => {
          try { localStorage.setItem(laterKey(due.series_id), String(Date.now())) } catch { /* fine */ }
          track('organizer_feedback_later', { series_id: due.series_id })
          setDue(null)
        }}>Not now</Button>
      </div>
      <div className="mt-5"><FeedbackForm due={due} onSent={() => { setDue(null); setSent(true) }} /></div>
    </Card>
  )
}

/** "Send feedback", at the foot of the rides page, any time. */
export function FeedbackLink() {
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  return (
    <div className="mt-12 border-t border-(--ev-line) pt-6">
      {sent ? (
        <Notice tone="good" onClose={() => setSent(false)}>Thanks. We read every one, and it shapes what we build next.</Notice>
      ) : (
        <button type="button" onClick={() => { setOpen(true); track('organizer_feedback_opened') }}
          className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-(--ev-accent) hover:underline">
          <MessageSquareHeart className="h-5 w-5" aria-hidden /> Something to tell us? Send feedback
        </button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Tell Green Streets">
        <FeedbackForm due={null} onSent={() => { setOpen(false); setSent(true) }} />
      </Dialog>
    </div>
  )
}
