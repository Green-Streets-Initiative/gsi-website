'use client'

import { useCallback, useEffect, useState } from 'react'
import posthog from 'posthog-js'
import { Check, MessageCircle } from 'lucide-react'
import { toneClass } from '@/components/events/EventsTone'
import '@/components/events/events-tone.css'
import { FUNCTIONS_BASE } from '@/lib/rides/public'

/**
 * A person's own link to a ride's group chat (Shift 01686, Keith 2026-11-07).
 * Organizers keep WhatsApp's "approve new members" on to keep spammers out,
 * so this page is the one tap between the rider and the chat: tapping it
 * tells the organizer who is about to ask to join (ride-chat-open), then
 * goes on to the chat. The chat's own link never sits on a public page.
 */

type Peek =
  | { ok: true; ride: string; host: string; name: string; app: string | null; came: number; last_came: string | null; code: string | null }
  | { ok: false; reason: 'not_in' | 'unknown'; ride?: string | null; host?: string | null; code?: string | null }

function dayLabel(d: string | null): string | null {
  if (!d) return null
  const dt = new Date(`${d}T12:00:00Z`)
  return Number.isNaN(dt.getTime()) ? null : dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function ChatDoor({ chatKey }: { chatKey: string }) {
  const [peek, setPeek] = useState<Peek | null>(null)
  const [failed, setFailed] = useState(false)
  const [going, setGoing] = useState(false)

  const call = useCallback(async (action: 'peek' | 'open') => {
    const res = await fetch(`${FUNCTIONS_BASE}/ride-chat-open`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: chatKey, action }),
    })
    if (res.status >= 500 || res.status === 429) throw new Error(String(res.status))
    return res.json()
  }, [chatKey])

  useEffect(() => {
    call('peek').then(setPeek).catch(() => setFailed(true))
  }, [call])

  const open = async () => {
    setGoing(true)
    try {
      const r = await call('open')
      if (r?.ok && r.url) {
        posthog.capture('ride_chat_opened', { surface: 'shift_link', app: r.app ?? null })
        window.location.href = r.url
        return
      }
      setPeek(r)
    } catch {
      setFailed(true)
    }
    setGoing(false)
  }

  const shell = (children: React.ReactNode) => (
    <div className={`min-h-[70vh] bg-(--ev-bg) px-4 py-10 sm:px-8 ${toneClass('light')}`}>
      <div className="mx-auto max-w-[520px]">{children}</div>
    </div>
  )

  if (failed) {
    return shell(
      <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
        <h1 className="font-display text-[26px] font-extrabold text-(--ev-ink)">That didn&rsquo;t load</h1>
        <p className="mt-2 text-[16px] text-(--ev-ink-85)">Check your connection and try again.</p>
        <button onClick={() => { setFailed(false); call('peek').then(setPeek).catch(() => setFailed(true)) }}
          className="mt-4 min-h-[44px] rounded-[10px] bg-(--ev-accent-fill) px-5 text-[15px] font-bold text-(--ev-on-accent-fill)">
          Try again
        </button>
      </div>,
    )
  }

  if (!peek) {
    return shell(<p className="text-[16px] text-(--ev-ink-75)" role="status">Loading&hellip;</p>)
  }

  if (!peek.ok) {
    const rideHref = peek.code ? `/rides/${peek.code}` : '/rides'
    return shell(
      <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
        <h1 className="font-display text-[26px] font-extrabold leading-tight text-(--ev-ink)">
          {peek.reason === 'not_in' ? 'The chat invite isn’t shared with you yet' : 'This chat link doesn’t work anymore'}
        </h1>
        <p className="mt-2 text-[16px] text-(--ev-ink-85)">
          {peek.reason === 'not_in'
            ? `${peek.host ?? 'The organizer'} shares the chat invite with people on the ride. Once they share it with you, this link works.`
            : 'Open the ride for its latest details.'}
        </p>
        {peek.code && (
          <a href={rideHref} className="mt-4 inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) px-5 text-[15px] font-bold text-(--ev-ink) hover:bg-(--ev-panel)">
            See the ride
          </a>
        )}
      </div>,
    )
  }

  const app = peek.app ?? 'group chat'
  const last = dayLabel(peek.last_came)
  const trust = peek.came > 0
    ? (peek.came === 1 ? `Came to 1 ride${last ? `, ${last}` : ''}` : `Came to ${peek.came} rides${last ? `, last ${last}` : ''}`)
    : 'Invited by the organizer'

  return shell(
    <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-6">
      <p className="text-[15px] font-semibold text-(--ev-ink-75)">{peek.ride}</p>
      <h1 className="mt-1 font-display text-[clamp(26px,4vw,32px)] font-extrabold leading-tight text-(--ev-ink)">
        Join the {peek.app ? `${peek.app} group` : 'group chat'}
      </h1>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-(--ev-panel) px-4 py-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-(--ev-ink) text-[16px] font-bold text-white" aria-hidden>
          {peek.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block text-[16px] font-bold text-(--ev-ink)">{peek.name}</span>
          <span className="flex items-center gap-1 text-[14px] font-semibold text-(--ev-ink-75)">
            <Check size={14} strokeWidth={3} aria-hidden /> {trust}
          </span>
        </span>
      </div>

      <p className="mt-4 text-[16px] text-(--ev-ink-85)">
        {peek.host} approves each request in {app}. Tap below and we&rsquo;ll tell them it&rsquo;s you, so they can approve you quickly.
      </p>

      <button onClick={open} disabled={going}
        className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[16px] font-bold text-(--ev-on-accent-fill) hover:opacity-90 disabled:opacity-60">
        <MessageCircle size={18} aria-hidden /> {going ? 'Opening…' : `Open the ${peek.app ? `${peek.app} group` : 'group chat'}`}
      </button>
    </div>,
  )
}
