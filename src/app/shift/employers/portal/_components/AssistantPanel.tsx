'use client'

// The setup assistant (Keith 2026-10-20): "Help me set up my first
// challenge", and it asks the key questions one at a time and does the work,
// with the admin's approval for anything staff can see, money, or email.
// Mounted once in the portal layout so it stays open across pages: docked
// beside the page on wide screens, full screen on a phone. Anything can open
// it with openAssistant().

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUp, Check, ExternalLink, History, Loader2, Maximize2, MapPin, MessageSquarePlus, Minimize2, Paperclip, Trash2, X } from 'lucide-react'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { usePortal } from '../_lib/portal-context'

const OPEN_EVENT = 'portal:open-assistant'
/** Fired after the assistant changes something, so pages can reload. */
export const ASSISTANT_CHANGED_EVENT = 'portal:assistant-changed'

export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { prompt } }))
}

const STARTERS = ['Help me set up my first challenge', 'What should I do next?', 'How do rewards work?']
const CHANGES = new Set(['Saving the draft', 'Launching', 'Saving the changes', 'Removing the draft', 'Sending invitations', 'Updating email domains', 'Updating who can join', 'Updating the year plan'])

type Card = { title: string; lines: string[]; cta: string; tone: 'primary' | 'danger'; image?: string; mapUrl?: string; confirmText?: string }
type ThreadSummary = { id: string; title: string; updated_at: string; waiting: boolean }
type LinkT = { href: string; label: string; external?: boolean }
type Item =
  | { kind: 'user'; text: string }
  | { kind: 'user_image'; url: string }
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
    // ⌘J / Ctrl+J opens and closes it from anywhere in the portal.
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener(OPEN_EVENT, h)
    window.addEventListener('keydown', k)
    return () => {
      window.removeEventListener(OPEN_EVENT, h)
      window.removeEventListener('keydown', k)
    }
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
        if (/^\s*-{3,}\s*$/.test(b)) return <hr key={i} className="my-3 border-line" />
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
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null)
  const [uploading, setUploading] = useState(false)
  /** What was typed into each irreversible card's confirm box. */
  const [typed, setTyped] = useState<Record<string, string>>({})
  const fileInput = useRef<HTMLInputElement>(null)
  const confirm = useConfirm()
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  // Width: drag the left edge (the page beside it keeps at least 560px), or
  // expand to fill the page area as a focused view. Kept per browser as a
  // convenience (it renders fine without storage).
  const WIDTH_KEY = 'portal.assistant.width'
  const SIDEBAR = 256
  const maxWidth = () => Math.max(360, Math.min(900, window.innerWidth - SIDEBAR - 560))
  const [width, setWidth] = useState(440)
  const [wide, setWide] = useState(false)
  useEffect(() => {
    try {
      const w = Number(localStorage.getItem(WIDTH_KEY))
      if (w >= 360) setWidth(Math.min(w, maxWidth()))
    } catch {}
  }, [])
  const effectiveWidth = width
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = effectiveWidth
    setWide(false)
    let last = startW
    const move = (ev: PointerEvent) => {
      last = Math.max(360, Math.min(maxWidth(), startW + (startX - ev.clientX)))
      setWidth(last)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.userSelect = ''
      try {
        localStorage.setItem(WIDTH_KEY, String(last))
      } catch {}
    }
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // The message box grows with what is typed, up to about 40% of the screen.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.4))}px`
  }, [draft])

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
    async (payload: { message?: string; decision?: { tool_use_id: string; approve: boolean; confirm_text?: string }; attachments?: { url: string; name: string }[] }) => {
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
        const shown: Item[] = [...(payload.attachments ?? []).map((a) => ({ kind: 'user_image' as const, url: a.url }))]
        if (payload.message) shown.push({ kind: 'user', text: payload.message })
        return [...kept, ...shown]
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

  const openHistory = async () => {
    setView('history')
    setThreads(null)
    const h = await authHeader()
    if (!h) return
    const res = await fetch(`/api/employer/assistant?${new URLSearchParams({ group_id: groupId, list: '1' })}`, { headers: h })
    const j = (await res.json().catch(() => ({}))) as { threads?: ThreadSummary[] }
    setThreads(j.threads ?? [])
  }

  const openThread = async (id: string) => {
    setFresh(false)
    setView('chat')
    setLoaded(false)
    await load(id)
  }

  const deleteThread = async (t: ThreadSummary) => {
    const ok = await confirm({
      title: 'Delete this conversation?',
      body: `"${t.title}" goes for good. Anything it set up (drafts, challenges, invitations) stays.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (!ok) return
    const h = await authHeader()
    if (!h) return
    await fetch(`/api/employer/assistant?${new URLSearchParams({ group_id: groupId, thread_id: t.id })}`, { method: 'DELETE', headers: h })
    setThreads((p) => (p ?? []).filter((x) => x.id !== t.id))
    if (t.id === threadId) {
      setThreadId(null)
      setItems([])
      setFresh(true)
    }
  }

  // An image for the assistant (a logo): uploaded to the logo bucket, then
  // sent with whatever is in the box. Nothing changes until the admin
  // approves it on a card.
  const attach = async (file: File) => {
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as Record<string, string>)[file.type]
    if (!ext) {
      setItems((p) => [...p, { kind: 'error', text: 'Attach a PNG, JPG or WebP image.' }])
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setItems((p) => [...p, { kind: 'error', text: 'That image is over 2 MB. Try a smaller version.' }])
      return
    }
    setUploading(true)
    const path = `logos/assistant-${Date.now()}-${groupId.slice(0, 8)}.${ext}`
    const { error } = await supabase.storage.from('employer-logos').upload(path, file, { contentType: file.type })
    setUploading(false)
    if (error) {
      setItems((p) => [...p, { kind: 'error', text: "That image didn't upload. Try again." }])
      return
    }
    const url = supabase.storage.from('employer-logos').getPublicUrl(path).data.publicUrl
    const message = draft.trim()
    setDraft('')
    void send({ attachments: [{ url, name: file.name }], message: message || undefined })
  }

  const submit = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    void send({ message: t })
  }

  const empty = loaded && items.length === 0

  return (
    <aside
      aria-label="Assistant"
      style={{ ['--assistant-w' as string]: `${effectiveWidth}px` }}
      className={`fixed inset-0 z-50 flex flex-col bg-surface ${
        wide
          ? 'min-[980px]:left-[256px]'
          : 'lg:relative lg:inset-auto lg:z-auto lg:h-full lg:w-[var(--assistant-w)] lg:shrink-0 lg:border-l lg:border-line'
      }`}
    >
      {/* Drag to resize (wide screens) */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the assistant"
        onPointerDown={startDrag}
        onDoubleClick={() => setWide((w) => !w)}
        className={`absolute inset-y-0 -left-1 z-10 hidden w-2 cursor-col-resize hover:bg-accent/20 ${wide ? '' : 'lg:block'}`}
      />
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink">Assistant</h2>
          <p className="text-[12.5px] text-ink-muted">Sets things up with you. Asks before anything your team sees.</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Your past conversations"
            aria-label="Your past conversations"
            disabled={busy}
            onClick={() => (view === 'history' ? setView('chat') : void openHistory())}
            className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-50 ${view === 'history' ? 'bg-surface-2 text-ink' : 'text-ink-muted'}`}
          >
            <History size={17} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            title={wide ? 'Back to the side' : 'Expand'}
            aria-label={wide ? 'Put the assistant back at the side' : 'Expand the assistant'}
            onClick={() => setWide((w) => !w)}
            className="hidden h-9 w-9 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 lg:grid"
          >
            {wide ? <Minimize2 size={16} strokeWidth={1.75} /> : <Maximize2 size={16} strokeWidth={1.75} />}
          </button>
          <button
            type="button"
            title="Start a new conversation"
            aria-label="Start a new conversation"
            disabled={busy}
            onClick={() => {
              setFresh(true)
              setItems([])
              setView('chat')
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

      {view === 'history' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [&>*]:mx-auto [&>*]:max-w-[720px]">
          <div>
            <button type="button" onClick={() => setView('chat')} className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline">
              <ArrowLeft size={14} /> Back to the conversation
            </button>
            <h3 className="text-[14px] font-bold text-ink">Your conversations</h3>
            <p className="mb-3 text-[12.5px] text-ink-muted">Only you can see these. Anything they set up is on its page for your whole team.</p>
            {threads === null ? (
              <Loader2 size={16} className="animate-spin text-ink-muted" aria-label="Loading" />
            ) : threads.length === 0 ? (
              <p className="text-[13.5px] text-ink-muted">No conversations yet.</p>
            ) : (
              <ul className="divide-y divide-line-2 rounded-xl border border-line">
                {threads.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                    <button type="button" onClick={() => void openThread(t.id)} className="min-w-0 flex-1 text-left">
                      <span className={`block truncate text-[13.5px] font-semibold ${t.id === threadId ? 'text-accent' : 'text-ink'}`}>{t.title}</span>
                      <span className="block text-[12px] text-ink-muted">
                        {new Date(t.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {t.waiting ? ' · waiting for your OK' : ''}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete "${t.title}"`}
                      onClick={() => void deleteThread(t)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ep-danger"
                    >
                      <Trash2 size={15} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div ref={scroller} className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 [&>*]:mx-auto [&>*]:max-w-[720px] ${view === 'history' ? 'hidden' : ''}`} aria-live="polite">
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
            if (it.kind === 'user_image')
              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={it.url} alt="Attached image" className="ml-8 max-h-32 self-end rounded-xl border border-line bg-white object-contain p-1.5" />
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
                  {it.card.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.card.image} alt="The image to use" className="mt-2.5 max-h-28 rounded-lg border border-line bg-white object-contain p-2" />
                  )}
                  <ul className="mt-2 space-y-1.5 text-[13.5px] leading-[1.5] text-ink">
                    {it.card.lines.map((l) => (
                      <li key={l} className="flex gap-2">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink-muted" aria-hidden />
                        <span>{l}</span>
                      </li>
                    ))}
                  </ul>
                  {it.card.mapUrl && (
                    <a href={it.card.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline">
                      <MapPin size={14} /> Check it on the map
                    </a>
                  )}
                  {it.card.confirmText && (
                    <label className="mt-3 block text-[13px] text-ink">
                      This can&apos;t be undone. Type <strong>{it.card.confirmText}</strong> to confirm.
                      <input
                        value={typed[it.tool_use_id] ?? ''}
                        onChange={(e) => setTyped((t) => ({ ...t, [it.tool_use_id]: e.target.value }))}
                        aria-label={`Type ${it.card.confirmText} to confirm`}
                        autoComplete="off"
                        className="mt-1.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-ep-danger"
                      />
                    </label>
                  )}
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        busy ||
                        (!!it.card.confirmText &&
                          (typed[it.tool_use_id] ?? '').trim().toLowerCase() !== it.card.confirmText.trim().toLowerCase())
                      }
                      onClick={() =>
                        void send({ decision: { tool_use_id: it.tool_use_id, approve: true, confirm_text: typed[it.tool_use_id] } })
                      }
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
        className={`border-t border-line p-3 [&>*]:mx-auto [&>*]:max-w-[720px] ${view === 'history' ? 'hidden' : ''}`}
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-surface px-3 py-2 focus-within:border-accent">
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void attach(f)
            }}
          />
          <button
            type="button"
            aria-label="Attach an image, like your logo"
            title="Attach an image, like your logo"
            disabled={busy || uploading}
            onClick={() => fileInput.current?.click()}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 disabled:opacity-40"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} strokeWidth={1.75} />}
          </button>
          <textarea
            ref={input}
            rows={3}
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
            className="min-h-[66px] flex-1 resize-none bg-transparent text-[14px] leading-[1.45] text-ink outline-none placeholder:text-ink-tertiary"
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
        <p className="mt-1.5 text-center text-[11.5px] text-ink-muted">Private to you. GSI may review conversations to improve the assistant.</p>
      </form>
    </aside>
  )
}
