'use client'

// The ride assistant (Keith 2026-10-22), built on the employer portal's
// setup assistant (shift/employers/portal/_components/AssistantPanel.tsx):
// plan a ride or run one by conversation, with the organizer's Approve on
// anything people would see. Mounted once in the console shell: docked
// beside the page on wide screens, a drawer on tablets, full screen on a
// phone. openAssistant() opens it from anywhere.

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Check, ExternalLink, History, Loader2, MapPin, MessageSquarePlus, Paperclip, Route as RouteIcon, ThumbsDown, ThumbsUp, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { startersFor } from '@/lib/organizer-assistant/starters'
import { elevationOf, parseGpx, simplify, toWaypoints } from '@/lib/organizers/route-geo'
import { cx } from './ui'
import { track } from '@/lib/organizers/track'

const OPEN_EVENT = 'organizers:open-assistant'
/** Fired after the assistant changes something, so screens can reload. */
export const ASSISTANT_CHANGED_EVENT = 'organizers:assistant-changed'

/** Open the assistant; with a prompt, it starts on that task in a new conversation. */
export function openAssistant(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { prompt } }))
}

const CHANGE_LABELS = new Set(['Creating the ride', 'Saving the changes', 'Posting the update', 'Cancelling the date', 'Changing the date', 'Updating the ride', 'Starting it again', 'Sending the invite', 'Settling the request'])

type Card = { title: string; lines: string[]; cta: string; tone: 'primary' | 'danger'; mapUrl?: string; confirmText?: string; staffNote?: string }
type LinkT = { href: string; label: string; external?: boolean }
type ThreadSummary = { id: string; title: string; updated_at: string; waiting: boolean }
type Item =
  | { kind: 'user'; text: string }
  | { kind: 'user_image'; url: string }
  | { kind: 'user_file'; name: string }
  | { kind: 'carried' }
  | { kind: 'assistant'; text: string; msgId?: number; rated?: 'up' | 'down' }
  | { kind: 'tool'; id: string; label: string; ok?: boolean; link?: LinkT; card?: { title: string; decision: 'approved' | 'declined' } }
  | { kind: 'choices'; options: string[] }
  | { kind: 'approval'; tool_use_id: string; card: Card }
  | { kind: 'error'; text: string }

/** An image small enough for the model: GIFs and small files pass as they are;
 *  anything over 1.5 MB or 2000 px on a side becomes a JPEG at that size. */
async function shrinkImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.size <= 1.5 * 1024 * 1024) {
    const bmp = await createImageBitmap(file)
    const fits = Math.max(bmp.width, bmp.height) <= 2000
    bmp.close()
    if (fits) return file
  }
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
  if (!blob) throw new Error('shrink failed')
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
}

/** Where an attached GPX route waits for the editor (?import=<id>): this browser only. */
export const ROUTE_IMPORT_KEY = (id: string) => `shift-route-import:${id}`

/** Listens for openAssistant() and ⌘J; renders the panel while open. */
export function AssistantDock({ available, onOpenChange }: { available: boolean; onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = useState(false)
  // How it was opened (a button, a task from a page, the keyboard), for the opened event.
  const how = useRef<'button' | 'task' | 'shortcut'>('button')
  useEffect(() => {
    if (open) track('organizer_assistant_opened', { how: how.current })
  }, [open])
  const [seed, setSeed] = useState<{ prompt: string } | null>(null)
  useEffect(() => {
    const h = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt
      how.current = prompt ? 'task' : 'button'
      setOpen(true)
      setSeed(prompt ? { prompt } : null)
    }
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault()
        how.current = 'shortcut'
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
  useEffect(() => { onOpenChange(open && available) }, [open, available, onOpenChange])
  if (!open || !available) return null
  return <AssistantPanel seed={seed} onSeedUsed={() => setSeed(null)} onClose={() => setOpen(false)} />
}

/** Short paragraphs, "- " lists and **bold**: all the assistant writes. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>)
  return (
    <>
      {text.trim().split(/\n{2,}/).map((b, i) => {
        const lines = b.split('\n')
        if (lines.every((l) => /^\s*[-•]\s+/.test(l))) {
          return <ul key={i} className="my-1.5 list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-•]\s+/, ''))}</li>)}</ul>
        }
        return <p key={i} className="my-1.5 first:mt-0 last:mb-0">{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l)}</span>)}</p>
      })}
    </>
  )
}

function LinkButton({ link, onNavigate }: { link: LinkT; onNavigate: () => void }) {
  const cls = 'mt-1.5 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-(--ev-line-strong) bg-white px-3 text-[14px] font-semibold text-(--ev-accent) hover:border-(--ev-accent)'
  if (link.external) return <a href={link.href} target="_blank" rel="noopener noreferrer" className={cls}>{link.label} <ExternalLink size={14} /></a>
  return <Link href={link.href} className={cls} onClick={onNavigate}>{link.label}</Link>
}

function RateReply({ rated, onRate }: { rated?: 'up' | 'down'; onRate: (up: boolean, note?: string) => Promise<boolean> }) {
  const [asking, setAsking] = useState(false)
  const [note, setNote] = useState('')
  const [done, setDone] = useState<'up' | 'down' | undefined>(rated)
  const rate = async (up: boolean, withNote?: string) => { if (await onRate(up, withNote)) setDone(up ? 'up' : 'down') }
  if (asking) {
    return (
      <form className="mt-2 flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); setAsking(false); void rate(false, note) }}>
        <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What went wrong? (optional)" aria-label="What went wrong?"
          className="min-w-0 flex-1 rounded-lg border border-(--ev-line-strong) bg-white px-3 py-1.5 text-[14px] text-(--ev-ink) outline-none placeholder:text-(--ev-ink-60) focus:border-(--ev-accent)" />
        <button type="submit" className="rounded-lg border border-(--ev-line-strong) px-2.5 py-1.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">Send</button>
      </form>
    )
  }
  return (
    <div className="mt-1.5 flex items-center gap-1 text-(--ev-ink-75)">
      <button type="button" aria-label="Good answer" aria-pressed={done === 'up'} onClick={() => void rate(true)}
        className={cx('grid h-8 w-8 place-items-center rounded-md hover:bg-(--ev-panel)', done === 'up' && 'text-(--ev-accent)')}>
        <ThumbsUp size={15} strokeWidth={1.75} />
      </button>
      <button type="button" aria-label="Not a good answer" aria-pressed={done === 'down'} onClick={() => setAsking(true)}
        className={cx('grid h-8 w-8 place-items-center rounded-md hover:bg-(--ev-panel)', done === 'down' && 'text-(--ev-danger)')}>
        <ThumbsDown size={15} strokeWidth={1.75} />
      </button>
      {done && <span className="ml-1 text-[13px]">Thanks, that helps us improve it.</span>}
    </div>
  )
}

const API = '/api/organizers/assistant'

function AssistantPanel({ seed, onSeedUsed, onClose }: { seed: { prompt: string } | null; onSeedUsed: () => void; onClose: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const [threadId, setThreadId] = useState<string | null>(null)
  const [long, setLong] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const [fresh, setFresh] = useState(false)
  const [view, setView] = useState<'chat' | 'history'>('chat')
  const [threads, setThreads] = useState<ThreadSummary[] | null>(null)
  const [typed, setTyped] = useState<Record<string, string>>({})
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

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
    const res = await fetch(`${API}?${new URLSearchParams(id ? { thread_id: id } : {})}`, { headers: h })
    const json = (await res.json().catch(() => ({}))) as { thread_id?: string | null; items?: Item[]; error?: string; long?: boolean }
    setLong(!!json.long)
    if (!res.ok) setItems([{ kind: 'error', text: json.error ?? 'The assistant could not load.' }])
    else {
      setThreadId(json.thread_id ?? null)
      setItems(json.items ?? [])
    }
    setLoaded(true)
  }, [])

  const openedWithTask = useRef(!!seed)
  useEffect(() => {
    if (openedWithTask.current) {
      setFresh(true)
      setLoaded(true)
      return
    }
    void load()
  }, [load])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [items, busy])

  const send = useCallback(async (payload: {
    message?: string
    attachments?: { url: string; name: string }[]
    route_file?: { import_id: string; name: string; waypoints: { lat: number; lng: number }[]; elevation: { ascent_ft: number } | null }
    decision?: { tool_use_id: string; approve: boolean; confirm_text?: string }
    carry_from?: string
    new_thread?: boolean
    thread_id?: null
  }) => {
    if (busy) return
    const h = await authHeader()
    if (!h) {
      setItems((p) => [...p, { kind: 'error', text: 'Sign in again to continue.' }])
      return
    }
    setBusy(true)
    // What kind of turn, and what came with it; never the words.
    track('organizer_assistant_sent', { kind: payload.decision ? (payload.decision.approve ? 'approved' : 'declined') : 'message', images: payload.attachments?.length ?? 0, file: !!payload.route_file })
    setItems((p) => {
      const kept = p.filter((i) => i.kind !== 'choices' && (i.kind !== 'approval' || (payload.decision && i.tool_use_id !== payload.decision.tool_use_id)))
      const shown: Item[] = [
        ...(payload.attachments ?? []).map((a) => ({ kind: 'user_image' as const, url: a.url })),
        ...(payload.route_file ? [{ kind: 'user_file' as const, name: payload.route_file.name }] : []),
        ...(payload.message ? [{ kind: 'user' as const, text: payload.message }] : []),
      ]
      return [...kept, ...shown]
    })
    let changed = false
    let current = threadId
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...h },
        body: JSON.stringify({ thread_id: fresh ? null : threadId, new_thread: fresh, page: window.location.pathname + window.location.search, ...payload }),
      })
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; long?: boolean }
        if (j.long) setLong(true)
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
            current = String(e.id)
            setThreadId(current)
          } else if (e.type === 'text') {
            setItems((p) => {
              const last = p[p.length - 1]
              if (last?.kind === 'assistant') return [...p.slice(0, -1), { kind: 'assistant', text: last.text + String(e.delta) }]
              return [...p, { kind: 'assistant', text: String(e.delta) }]
            })
          } else if (e.type === 'tool') {
            if (CHANGE_LABELS.has(String(e.label))) changed = true
            setItems((p) => [...p, { kind: 'tool', id: String(e.id), label: String(e.label) }])
          } else if (e.type === 'tool_done') {
            setItems((p) => p.map((i) => (i.kind === 'tool' && i.id === e.id ? { ...i, ok: !!e.ok, link: (e.link as LinkT) ?? undefined } : i)))
          } else if (e.type === 'choices') {
            setItems((p) => [...p, { kind: 'choices', options: e.options as string[] }])
          } else if (e.type === 'approval') {
            setItems((p) => [...p, { kind: 'approval', tool_use_id: String(e.tool_use_id), card: e.card as Card }])
          } else if (e.type === 'error') {
            setItems((p) => [...p, { kind: 'error', text: String(e.message) }])
          } else if (e.type === 'long') {
            setLong(true)
          }
        }
      }
    } catch {
      setItems((p) => [...p, { kind: 'error', text: 'The connection dropped. Your conversation is saved; try again.' }])
    } finally {
      setBusy(false)
      if (changed || payload.decision) window.dispatchEvent(new CustomEvent(ASSISTANT_CHANGED_EVENT))
      await load(current)
      input.current?.focus()
    }
  }, [busy, threadId, fresh, load])

  useEffect(() => {
    if (!loaded || !seed || busy) return
    onSeedUsed()
    setView('chat')
    setThreadId(null)
    setItems([])
    setFresh(true)
    void send({ message: seed.prompt, thread_id: null, new_thread: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, seed, busy])

  const rateReply = async (messageId: number, up: boolean, note?: string): Promise<boolean> => {
    const h = await authHeader()
    if (!h) return false
    const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body: JSON.stringify({ rating: { message_id: messageId, up, note } }) })
    return res.ok
  }

  const openHistory = async () => {
    setView('history')
    setThreads(null)
    const h = await authHeader()
    if (!h) return
    const res = await fetch(`${API}?list=1`, { headers: h })
    const j = (await res.json().catch(() => ({}))) as { threads?: ThreadSummary[] }
    setThreads(j.threads ?? [])
  }

  const deleteThread = async (t: ThreadSummary) => {
    if (!window.confirm(`Delete "${t.title}"? Anything it set up stays on its ride.`)) return
    const h = await authHeader()
    if (!h) return
    await fetch(`${API}?${new URLSearchParams({ thread_id: t.id })}`, { method: 'DELETE', headers: h })
    setThreads((p) => (p ?? []).filter((x) => x.id !== t.id))
    if (t.id === threadId) { setThreadId(null); setItems([]); setFresh(true) }
  }

  const submit = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    void send({ message: t })
  }

  // Attachments, like the employer assistant's: an image (a flyer, a
  // screenshot of an event or a route) goes to the ride-flyers bucket and the
  // assistant sees it; a GPX route is read here, kept in this browser for the
  // editor, and the assistant gets a summary of how it rides.
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const attach = async (input: File) => {
    let file: File = input
    const note = draft.trim() || undefined
    const fail = (text: string) => setItems((p) => [...p, { kind: 'error', text }])
    if (/\.gpx$/i.test(file.name) || file.type === 'application/gpx+xml') {
      if (file.size > 15 * 1024 * 1024) return fail('That file is over 15 MB. Export the route without extra data and try again.')
      try {
        const { name, points } = parseGpx(await file.text())
        const route = { name: name ?? file.name.replace(/\.gpx$/i, ''), waypoints: toWaypoints(simplify(points, 1500)), elevation: elevationOf(points) }
        const id = Math.random().toString(36).slice(2, 12)
        try { localStorage.setItem(ROUTE_IMPORT_KEY(id), JSON.stringify(route)) } catch { /* private mode: the summary still works */ }
        setDraft('')
        void send({ route_file: { import_id: id, ...route, elevation: route.elevation ? { ascent_ft: route.elevation.ascent_ft } : null }, message: note })
      } catch (e) {
        fail(e instanceof Error ? e.message : "That file isn't a GPX route we can read.")
      }
      return
    }
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return fail('Attach an image (JPG, PNG, WebP or GIF) or a GPX route file.')
    // The image is re-sent to the model with every later turn, and the model
    // refuses images over about 5 MB: a big phone photo would break the whole
    // conversation. So shrink it here: at most 2000 px on a side, as JPEG.
    const img = await shrinkImage(file).catch(() => null)
    if (!img) return fail("That image couldn't be read. Try a JPG or PNG.")
    if (img.size > 4 * 1024 * 1024) return fail('That image is too big even after shrinking. Try a smaller one.')
    file = img
    const ext = ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[file.type] ?? 'jpg'
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user.id
    if (!uid) return fail('Sign in again to continue.')
    setUploading(true)
    const path = `${uid}/assistant/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('ride-flyers').upload(path, file, { contentType: file.type })
    setUploading(false)
    if (error) return fail("That image didn't upload. Try again.")
    const url = supabase.storage.from('ride-flyers').getPublicUrl(path).data.publicUrl
    setDraft('')
    void send({ attachments: [{ url, name: file.name }], message: note })
  }

  const empty = loaded && items.length === 0
  const narrow = () => typeof window !== 'undefined' && window.innerWidth < 1280

  return (
    <aside
      aria-label="Ride assistant"
      className="ph-no-capture fixed inset-0 z-[70] flex flex-col bg-(--ev-card) sm:left-auto sm:w-[440px] sm:border-l sm:border-(--ev-line-mid) sm:shadow-(--ev-shadow) xl:top-[60px] xl:z-30 xl:shadow-none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-(--ev-line) px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold text-(--ev-ink)">Assistant</h2>
          <p className="text-[14px] text-(--ev-ink-75)">Plans and runs rides with you. Asks before anything people see.</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button type="button" aria-label="Your past conversations" title="Your past conversations" disabled={busy}
            onClick={() => (view === 'history' ? setView('chat') : void openHistory())}
            className={cx('grid h-10 w-10 place-items-center rounded-lg hover:bg-(--ev-panel) disabled:opacity-50', view === 'history' ? 'bg-(--ev-panel) text-(--ev-ink)' : 'text-(--ev-ink-75)')}>
            <History size={18} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Start a new conversation" title="Start a new conversation" disabled={busy}
            onClick={() => { setFresh(true); setItems([]); setView('chat') }}
            className="grid h-10 w-10 place-items-center rounded-lg text-(--ev-ink-75) hover:bg-(--ev-panel) disabled:opacity-50">
            <MessageSquarePlus size={18} strokeWidth={1.75} />
          </button>
          <button type="button" aria-label="Close the assistant" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-(--ev-ink-75) hover:bg-(--ev-panel)">
            <X size={19} />
          </button>
        </div>
      </div>

      {view === 'history' && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <button type="button" onClick={() => setView('chat')} className="mb-3 flex items-center gap-1.5 text-[14px] font-semibold text-(--ev-accent) hover:underline">
            <ArrowLeft size={15} /> Back to the conversation
          </button>
          <h3 className="text-[15px] font-bold text-(--ev-ink)">Your conversations</h3>
          <p className="mb-3 text-[14px] text-(--ev-ink-75)">Only you can see these. What they set up is on its ride for everyone running it.</p>
          {threads === null ? <Loader2 size={16} className="animate-spin text-(--ev-ink-75)" aria-label="Loading" />
            : threads.length === 0 ? <p className="text-[14px] text-(--ev-ink-75)">No conversations yet.</p>
              : (
                <ul className="divide-y divide-(--ev-line) rounded-xl border border-(--ev-line-mid)">
                  {threads.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                      <button type="button" onClick={() => { setFresh(false); setView('chat'); setLoaded(false); void load(t.id) }} className="min-w-0 flex-1 text-left">
                        <span className={cx('block truncate text-[14px] font-semibold', t.id === threadId ? 'text-(--ev-accent)' : 'text-(--ev-ink)')}>{t.title}</span>
                        <span className="block text-[13px] text-(--ev-ink-75)">
                          {new Date(t.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          {t.waiting ? ' · waiting for your OK' : ''}
                        </span>
                      </button>
                      <button type="button" aria-label={`Delete "${t.title}"`} onClick={() => void deleteThread(t)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-(--ev-ink-75) hover:bg-(--ev-panel) hover:text-(--ev-danger)">
                        <Trash2 size={16} strokeWidth={1.75} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
        </div>
      )}

      <div ref={scroller} className={cx('min-h-0 flex-1 overflow-y-auto px-4 py-4', view === 'history' && 'hidden')} aria-live="polite">
        {!loaded && <Loader2 size={18} className="mx-auto mt-8 animate-spin text-(--ev-ink-75)" aria-label="Loading" />}
        {empty && (
          <div className="mt-1">
            <p className="text-[15px] leading-[1.55] text-(--ev-ink)">
              Tell me about the ride you want to run, or what you need for the next one. I&rsquo;ll ask a few questions and do the setting up.
              Nothing people can see changes until you approve it.
            </p>
            <div className="mt-4 flex flex-col items-start gap-2">
              {startersFor(typeof window === 'undefined' ? '' : window.location.pathname).map((s) => (
                <button key={s} type="button" onClick={() => void send({ message: s })}
                  className="min-h-[38px] rounded-full border border-(--ev-accent-line-40) bg-(--ev-accent-tint-8) px-3.5 text-left text-[14px] font-semibold text-(--ev-accent-90) hover:border-(--ev-accent)">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {items.map((it, i) => {
            if (it.kind === 'user') return <div key={i} className="ml-8 self-end whitespace-pre-wrap rounded-2xl rounded-br-md bg-(--ev-accent-fill) px-3.5 py-2 text-[15px] leading-[1.5] text-(--ev-on-accent-fill)">{it.text}</div>
            if (it.kind === 'user_image') return (
              <a key={i} href={it.url} target="_blank" rel="noopener noreferrer" className="ml-8 self-end">
                <img src={it.url} alt="Attached image" className="max-h-48 max-w-[220px] rounded-xl border border-(--ev-line) object-cover" />
              </a>
            )
            if (it.kind === 'user_file') return (
              <div key={i} className="ml-8 inline-flex items-center gap-1.5 self-end rounded-xl border border-(--ev-line-strong) bg-white px-3 py-2 text-[14px] font-semibold text-(--ev-ink)">
                <RouteIcon size={15} aria-hidden />{it.name}
              </div>
            )
            if (it.kind === 'carried') return <p key={i} className="text-center text-[14px] text-(--ev-ink-75)">Picked up from an earlier conversation, with a summary of it.</p>
            if (it.kind === 'assistant') {
              const next = items.slice(i + 1).find((x) => x.kind !== 'tool')
              const endOfTurn = !next || next.kind !== 'assistant'
              return (
                <div key={i} className="mr-4 text-[15px] leading-[1.55] text-(--ev-ink)">
                  <Rich text={it.text} />
                  {it.msgId != null && endOfTurn && !busy && <RateReply key={it.msgId} rated={it.rated} onRate={(up, note) => rateReply(it.msgId!, up, note)} />}
                </div>
              )
            }
            if (it.kind === 'tool') {
              return (
                <div key={i} className="text-[14px] text-(--ev-ink-75)">
                  {it.label && (
                    <span className="flex items-center gap-1.5">
                      {it.card?.decision === 'declined' ? <X size={14} aria-hidden />
                        : it.ok === undefined ? <Loader2 size={14} className="animate-spin" aria-hidden />
                          : it.ok ? <Check size={14} className="text-(--ev-accent)" aria-hidden />
                            : <X size={14} className="text-(--ev-danger)" aria-hidden />}
                      {it.card ? `${it.card.decision === 'approved' ? 'Approved' : 'Not approved'}: ${it.card.title.replace(/\?$/, '')}` : it.label}
                    </span>
                  )}
                  {it.link && <LinkButton link={it.link} onNavigate={() => narrow() && onClose()} />}
                </div>
              )
            }
            if (it.kind === 'choices') {
              return (
                <div key={i} className="flex flex-wrap gap-2">
                  {it.options.map((o) => (
                    <button key={o} type="button" disabled={busy} onClick={() => void send({ message: o })}
                      className="min-h-[38px] rounded-full border border-(--ev-accent-line-40) bg-(--ev-accent-tint-8) px-3.5 text-left text-[14px] font-semibold text-(--ev-accent-90) hover:border-(--ev-accent) disabled:opacity-60">
                      {o}
                    </button>
                  ))}
                </div>
              )
            }
            if (it.kind === 'approval') {
              const needs = it.card.confirmText
              const typedOk = !needs || (typed[it.tool_use_id] ?? '').trim().toLowerCase() === needs.trim().toLowerCase()
              return (
                <div key={i} role="group" aria-label={it.card.title} className="rounded-xl border border-(--ev-accent-line-40) bg-white p-4 shadow-sm">
                  <div className="text-[15px] font-bold text-(--ev-ink)">{it.card.title}</div>
                  <ul className="mt-2 space-y-1.5 text-[14px] leading-[1.5] text-(--ev-ink-85)">
                    {it.card.lines.map((l) => (
                      <li key={l} className="flex gap-2"><span className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-(--ev-ink-60)" aria-hidden /><span>{l}</span></li>
                    ))}
                  </ul>
                  {it.card.mapUrl && (
                    <a href={it.card.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold text-(--ev-accent) hover:underline">
                      <MapPin size={15} /> Check it on the map
                    </a>
                  )}
                  {it.card.staffNote && <p className="mt-3 rounded-lg bg-[#FFF4D6] px-3 py-2 text-[14px] font-medium text-[#6B4200]">{it.card.staffNote}</p>}
                  {needs && (
                    <label className="mt-3 block text-[14px] text-(--ev-ink)">
                      To confirm, type <strong>{needs}</strong>.
                      <input value={typed[it.tool_use_id] ?? ''} onChange={(e) => setTyped((t) => ({ ...t, [it.tool_use_id]: e.target.value }))}
                        aria-label={`Type ${needs} to confirm`} autoComplete="off"
                        className="mt-1.5 w-full rounded-[10px] border border-(--ev-line-strong) bg-white px-3 py-2 text-[15px] text-(--ev-ink) outline-none focus:border-(--ev-danger)" />
                    </label>
                  )}
                  <div className="mt-3.5 flex flex-wrap gap-2">
                    <button type="button" disabled={busy || !typedOk}
                      onClick={() => void send({ decision: { tool_use_id: it.tool_use_id, approve: true, confirm_text: typed[it.tool_use_id] } })}
                      className={cx('min-h-[44px] rounded-[10px] px-4 text-[15px] font-semibold text-white disabled:opacity-60',
                        it.card.tone === 'danger' ? 'bg-(--ev-danger) hover:opacity-90' : 'bg-(--ev-accent-fill) hover:opacity-90')}>
                      {it.card.cta}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void send({ decision: { tool_use_id: it.tool_use_id, approve: false } })}
                      className="min-h-[44px] rounded-[10px] px-3 text-[15px] font-semibold text-(--ev-ink-80) hover:bg-(--ev-panel) disabled:opacity-60">
                      Not now
                    </button>
                  </div>
                </div>
              )
            }
            return <div key={i} role="alert" className="rounded-lg bg-[#FBE4DF] px-3 py-2 text-[14px] font-semibold text-(--ev-danger)">{it.text}</div>
          })}
          {busy && items[items.length - 1]?.kind !== 'assistant' && <Loader2 size={16} className="animate-spin text-(--ev-ink-75)" aria-label="The assistant is working" />}
        </div>
      </div>

      {long && !fresh && threadId && view === 'chat' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-(--ev-line) bg-(--ev-panel) px-4 py-2.5 text-[14px] text-(--ev-ink)">
          <span className="min-w-0 flex-1">This conversation is getting long, so answers get slower. A fresh one picks up from a summary.</span>
          <button type="button" disabled={busy}
            onClick={() => {
              const from = threadId
              setView('chat'); setThreadId(null); setItems([]); setFresh(true); setLong(false)
              void send({ message: "Let's pick up where we left off.", new_thread: true, thread_id: null, carry_from: from })
            }}
            className="shrink-0 rounded-lg border border-(--ev-line-strong) bg-white px-3 py-1.5 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
            Start fresh
          </button>
        </div>
      )}

      <form className={cx('border-t border-(--ev-line) p-3', view === 'history' && 'hidden')} onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="flex items-end gap-2 rounded-xl border border-(--ev-line-strong) bg-white px-3 py-2 focus-within:border-(--ev-accent)">
          <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-hidden
            accept="image/png,image/jpeg,image/webp,image/gif,.gpx,application/gpx+xml"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void attach(f) }} />
          <button type="button" disabled={busy || uploading} onClick={() => fileInput.current?.click()}
            aria-label="Attach an image or a GPX route" title="Attach an image or a GPX route"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-(--ev-ink-75) hover:bg-(--ev-panel) hover:text-(--ev-ink) disabled:opacity-40">
            {uploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
          </button>
          <textarea ref={input} rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
            onPaste={(e) => {
              const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/'))
              if (f) { e.preventDefault(); void attach(f) }
            }}
            placeholder="Ask, or attach a screenshot or GPX route" aria-label="Message the assistant"
            className="min-h-[48px] flex-1 resize-none bg-transparent text-[15px] leading-[1.45] text-(--ev-ink) outline-none placeholder:text-(--ev-ink-60)" />
          <button type="submit" disabled={busy || !draft.trim()} aria-label="Send"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-(--ev-accent-fill) text-(--ev-on-accent-fill) disabled:opacity-40">
            <ArrowUp size={17} />
          </button>
        </div>
        <p className="mt-2 text-center text-[13px] leading-[1.45] text-(--ev-ink-75)">
          Seen only by you and GSI. AI can make mistakes, so check what matters.{' '}
          <a href="/organizers/assistant-data" target="_blank" rel="noopener" className="underline underline-offset-2 hover:text-(--ev-ink)">Your data</a>
        </p>
      </form>
    </aside>
  )
}
