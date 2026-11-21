'use client'

import { useState, type ReactNode } from 'react'
import ShiftWordmark from '@/components/brand/ShiftWordmark'
import { toneClass } from '@/components/events/EventsTone'
import type { UndoInfo } from '@/lib/organizers/group-claim'
import { CheckCircle2 } from 'lucide-react'
import { Button, Card, Notice, cx } from '@/components/organizers/ui'
import '@/components/events/events-tone.css'

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className={cx('min-h-dvh bg-(--ev-bg) text-(--ev-ink)', toneClass('light'))}>
      <header className="border-b border-(--ev-line) bg-(--ev-bar)">
        <div className="mx-auto flex h-[60px] max-w-[640px] items-center px-4 sm:px-6"><ShiftWordmark tone="dark" height={22} /></div>
      </header>
      <main className="mx-auto w-full max-w-[640px] px-4 pb-20 pt-8 sm:px-6">{children}</main>
    </div>
  )
}

export default function NotUs({ id, token, info }: { id: string; token: string; info: UndoInfo }) {
  return <Frame>{info.ok ? <Ask id={id} token={token} group={info.group} who={info.who} wasUndone={info.undone} /> : (
    <p className="text-[16px] leading-relaxed text-(--ev-ink-80)">{info.error}</p>
  )}</Frame>
}

function Ask({ id, token, group, who, wasUndone }: { id: string; token: string; group: string; who: string; wasUndone: boolean }) {
  const [undone, setUndone] = useState(wasUndone)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function undo() {
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch('/api/organizers/not-us', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, t: token }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Something went wrong. Try again.')
      setUndone(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (undone) {
    return (
      <Card>
        <CheckCircle2 className="h-8 w-8 text-(--ev-accent)" aria-hidden />
        <h1 className="mt-3 font-display text-[28px] font-extrabold leading-tight">Your page for {group} is back the way it was</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-80)">
          {who} can&rsquo;t edit it anymore. Anyone who runs {group} can still set it up on Shift by putting a short code on your website.
        </p>
        <a href="/organizers" className="mt-5 inline-flex min-h-[44px] items-center rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">Run {group} on Shift</a>
      </Card>
    )
  }
  return (
    <Card>
      <h1 className="font-display text-[28px] font-extrabold leading-tight [overflow-wrap:anywhere]">Is {who} part of {group}?</h1>
      <p className="mt-2 text-[16px] leading-relaxed text-(--ev-ink-80)">
        They said they run {group}, so they can set up its rides and edit its page on the Green Streets events calendar. If you don&rsquo;t know them, we&rsquo;ll put the page back the way it was and they won&rsquo;t be able to edit it.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button variant="primary" busy={busy} onClick={() => void undo()}>They&rsquo;re not one of us</Button>
        <a href="https://www.gogreenstreets.org/events" className="inline-flex min-h-[44px] items-center rounded-[10px] px-4 text-[15px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel)">They are, all good</a>
      </div>
      {err && <div className="mt-4"><Notice tone="off">{err}</Notice></div>}
    </Card>
  )
}
