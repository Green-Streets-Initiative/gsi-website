'use client'

// The setup assistant (Keith 2026-10-20): "Help me set up my first
// challenge", and it asks the key questions one at a time and does the work,
// with the admin's approval for anything staff can see, money, or email.
// Mounted once in the portal layout so it stays open across pages: docked
// beside the page on wide screens, full screen on a phone. Anything can open
// it with openAssistant().

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUp, Check, ExternalLink, Loader2, MessageSquarePlus, Sparkles, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'

const OPEN_EVENT = 'portal:open-assistant'
/** Fired after the assistant changes something, so pages can reload. */
export const ASSISTANT_CHANGED_EVENT = 'portal:assistant-changed'

export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { prompt } }))
}

const STARTERS = ['Help me set up my first challenge', 'What should I do next?', 'How do rewards work?']
const CHANGES = new Set(['Saving the draft', 'Launching', 'Adding funds', 'Saving the changes', 'Discarding the draft', 'Sending invitations', 'Updating email domains', 'Updating who can join', 'Updating the year plan'])

type Card = { title: string; lines: string[]; cta: string; tone: 'primary' | 'danger' }
type LinkT = { href: string; label: string; external?: boolean }
type Item =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool'; id: string; label: string; ok?: boolean; link?: LinkT; card?: { title: string; decision: 'approved' | 'declined' } }
  | { kind: 'choices'; options: string[] }
  | { kind: 'approval'; tool_use_id: string; card: Card }
  | { kind: 'error'; text: string }

export function AssistantDock() {
  const { group, isGsiAdmin } = usePortal()
  const [open, setOpen] = useState(false)
  const [seed, setSeed] = useState<string | null>(null)
  useEffect(() => {
    const h = (e: Event) => {
      setOpen(true)
      setSeed((e as CustomEvent<{ prompt?: string }>).detail?.prompt ?? null)
    }
    window.addEventListener(OPEN_EVENT, h)
    return () => window.removeEventListener(OPEN_EVENT, h)
  }, [])
  if (!open || !group || !(group.assistant_enabled || isGsiAdmin)) return null
  return <AssistantPanel groupId={group.id} seed={seed} onSeedUsed={() => setSeed(null)} onClose={() => setOpen(false)} />
}

/** Short paragraphs, "- " lists and **bold**: all the assistant writes. */
function Rich({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    )
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return (
            <ul key={i} className="my-1.5 list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ''))}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i} className="my-1.5 first:mt-0 last:mb-0">
            {lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

function LinkButton({ link, onNavigate }: { link: LinkT; onNavigate: () => void }) {
  const cls =
    'mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold text-accent hover:border-accent'
  if (link.external) {
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>
        {link.label} <ExternalLink size={13} />
      </a>
    )
  }
  return (
    <Link href={link.href} className={cls} onClick={onNavigate}>
      {link.label}
    </Link>
  )
}

function AssistantPanel({ groupId, seed, onSeedUsed, onClose }: { groupId: string; seed: string | null; onSeedUsed: () => void; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [fresh, setFresh] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  const authHeader = async (): Promise<Record<string, string> | null> => {
    const { data } = await supabase.auth.getSession()
    const t = data.session?.access_token
    return t ? { Authorization: `Bearer ${t}` } : null
  }

  const load = useCallback(async (id?: string | null) => {
    const h = await authHeader()
    if (!h) return
    const qs = new URLSearchParams({ group_id: groupId, ...(id ? { thread_id: id } : {}) })
    const res = await fetch(`/api/employer/assistant?${qs}`, { headers: h })
    const json = (await res.json().catch(() => ({}))) as { thread_id?: string | null; items?: Item[]; error?: string }
    if (!res.ok) {
      setItems([{ kind: 'error', text: json.error ?? 'The assistant could not load.' }])
    } else {
      setThreadId(json.thread_id ?? null)
      setItems(json.items ?? [])
    }
    setLoaded(true)
  }, [groupId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [items, busy])

  const send = useCallback(
    async (payload: { message?: string; decision?: { tool_use_id: string; approve: boolean } }) => {
      if (busy) return
      const h = await authHeader()
      if (!h) {
        setItems((p) => [...p, { kind: 'error', text: 'Sign in again to continue.' }])
        return
      }
      setBusy(true)
      setItems((p) => {
        // Answered cards and choices leave the list; the reload restores the record.
        const kept = p.filter((i) => i.kind !== 'choices' && (i.kind !== 'approval' || (payload.decision && i.tool_use_id !== payload.decision.tool_use_id)))
        return payload.message ? [...kept, { kind: 'user', text: payload.message }] : kept
      })
      let changed = false
      let currentThread = threadId
      try {
        const res = await fetch('/api/employer/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...h },
          body: JSON.stringify({ group_id: groupId, thread_id: fresh ? null : threadId, new_thread: fresh, ...payload }),
        })
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          setItems((p) => [...p, { kind: 'error', text: j.error ?? 'The assistant could not answer. Try again.' }])
          return
        }
        setFresh(false)
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let nl: number
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl)
            buf = buf.slice(nl + 1)
            if (!line.trim()) continue
            const e = JSON.parse(line) as Record<string, unknown>
            if (e.type === 'thread') {
              currentThread = String(e.id)
              setThreadId(currentThread)
            } else if (e.type === 'text') {
              setItems((p) => {
                const last = p[p.length - 1]
                if (last?.kind === 'assistant') return [...p.slice(0, -1), { kind: 'assistant', text: last.text + String(e.delta) }]
                return [...p, { kind: 'assistant', text: String(e.delta) }]
              })
            } else if (e.type === 'tool') {
              if (CHANGES.has(String(e.label))) changed = true
              setItems((p) => [...p, { kind: 'tool', id: String(e.id), label: String(e.label) }])
            } else if (e.type === 'tool_done') {
              setItems((p) => p.map((i) => (i.kind === 'tool' && i.id === e.id ? { ...i, ok: !!e.ok, link: (e.link as LinkT) ?? undefined } : i)))
            } else if (e.type === 'choices') {
              setItems((p) => [...p, { kind: 'choices', options: e.options as string[] }])
            } else if (e.type === 'approval') {
              setItems((p) => [...p, { kind: 'approval', tool_use_id: String(e.tool_use_id), card: e.card as Card }])
            } else if (e.type === 'error') {
              setItems((p) => [...p, { kind: 'error', text: String(e.message) }])
            }
          }
        }
      } catch {
        setItems((p) => [...p, { kind: 'error', text: 'The connection dropped. Your conversation is saved; try again.' }])
      } finally {
        setBusy(false)
        if (changed || payload.decision) window.dispatchEvent(new CustomEvent(ASSISTANT_CHANGED_EVENT))
        await load(currentThread)
        input.current?.focus()
      }
    },
    [busy, groupId, threadId, fresh, load],
  )

  // Opened with a request ("Set it up with the assistant"): ask it, unless a
  // conversation is already under way.
  useEffect(() => {
    if (!loaded || !seed) return
    onSeedUsed()
    if (items.length === 0) void send({ message: seed })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, seed])

  const submit = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    void send({ message: t })
  }

  const empty = loaded && items.length === 0

  return (
    <aside
      aria-label="Setup assistant"
      className="fixed inset-0 z-50 flex flex-col bg-surface lg:static lg:inset-auto lg:z-auto lg:h-full lg:w-[400px] lg:shrink-0 lg:border-l lg:border-line"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-soft text-accent">
            <Sparkles size={16} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="text-[14.5px] font-bold text-ink">Setup assistant</h2>
            <p className="text-[12px] text-ink-muted">Asks first before anything your team sees</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Start a new conversation"
            aria-label="Start a new conversation"
            disabled={busy}
            onClick={() => {
              setFresh(true)
              setItems([])
            }}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 disabled:opacity-50"
          >
            <MessageSquarePlus size={17} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Close the assistant" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-2">
            <X size={18} />
          </button>
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {!loaded && <Loader2 size={18} className="mx-auto mt-8 animate-spin text-ink-muted" aria-label="Loading" />}
        {empty && (
          <div className="mt-2">
            <p className="text-[14px] leading-[1.55] text-ink">
              I can set up your Shift program with you: your first challenge, rewards, inviting your team, and what to do next. I&apos;ll ask a few
              questions and do the setting up. Nothing your team can see happens until you approve it.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send({ message: s })}
                  className="rounded-full border border-line px-3.5 py-1.5 text-left text-[13.5px] font-semibold text-accent hover:border-accent hover:bg-accent-softer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {items.map((it, i) => {
            if (it.kind === 'user')
              return (
                <div key={i} className="ml-8 self-end rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-[14px] leading-[1.5] text-white">
                  {it.text}
                </div>
              )
            if (it.kind === 'assistant')
              return (
                <div key={i} className="mr-4 text-[14px] leading-[1.55] text-ink">
                  <Rich text={it.text} />
                </div>
              )
            if (it.kind === 'tool')
              return (
                <div key={i} className="text-[12.5px] text-ink-muted">
                  {it.label && (
                    <span className="flex items-center gap-1.5">
                      {it.card?.decision === 'declined' ? (
                        <X size={13} aria-hidden />
                      ) : it.ok === undefined ? (
                        <Loader2 size={13} className="animate-spin" aria-hidden />
                      ) : it.ok ? (
                        <Check size={13} className="text-accent" aria-hidden />
                      ) : (
                        <X size={13} className="text-ep-danger" aria-hidden />
                      )}
                      {it.card ? `${it.card.decision === 'approved' ? 'Approved' : 'Not approved'}: ${it.card.title.replace(/\?$/, '')}` : it.label}
                    </span>
                  )}
                  {it.link && <LinkButton link={it.link} onNavigate={() => window.innerWidth < 1024 && onClose()} />}
                </div>
              )
            if (it.kind === 'choices')
              return (
                <div key={i} className="flex flex-wrap gap-2">
                  {it.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      disabled={busy}
                      onClick={() => void send({ message: o })}
                      className="rounded-full border border-accent/40 bg-accent-softer px-3.5 py-1.5 text-left text-[13.5px] font-semibold text-accent-ink hover:border-accent disabled:opacity-60"
                    >
                      {o}
                    </button>
                  ))}
                </div>
              )
            if (it.kind === 'approval')
              return (
                <div key={i} className="rounded-xl border border-accent/40 bg-surface p-4 shadow-sm" role="group" aria-label={it.card.title}>
                  <div className="text-[14.5px] font-bold text-ink">{it.card.title}</div>
                  <ul className="mt-2 space-y-1.5 text-[13.5px] leading-[1.5] text-ink">
                    {it.card.lines.map((l) => (
                      <li key={l} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" aria-hidden />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void send({ decision: { tool_use_id: it.tool_use_id, approve: true } })}
                      className={`rounded-[10px] px-4 py-2 text-[14px] font-semibold text-white shadow-sm disabled:opacity-60 ${
                        it.card.tone === 'danger' ? 'bg-ep-danger hover:opacity-90' : 'bg-accent hover:bg-accent-dark'
                      }`}
                    >
                      {it.card.cta}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void send({ decision: { tool_use_id: it.tool_use_id, approve: false } })}
                      className="rounded-[10px] px-3 py-2 text-[14px] font-semibold text-ink-muted hover:bg-surface-2 disabled:opacity-60"
                    >
                      Not now
                    </button>
                  </div>
                </div>
              )
            return (
              <div key={i} role="alert" className="rounded-lg bg-ep-danger/5 px-3 py-2 text-[13px] font-semibold text-ep-danger">
                {it.text}
              </div>
            )
          })}
          {busy && items[items.length - 1]?.kind !== 'assistant' && (
            <Loader2 size={16} className="animate-spin text-ink-muted" aria-label="The assistant is working" />
          )}
        </div>
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-accent">
          <textarea
            ref={input}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submit()
              }
            }}
            placeholder="Ask or answer here"
            aria-label="Message the assistant"
            className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-tertiary"
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            aria-label="Send"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-white disabled:opacity-40"
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </form>
    </aside>
  )
}
