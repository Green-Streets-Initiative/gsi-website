'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiError, categoryLabel, fetchEntry, joinNewsletter, lastDay, post, prizeFor, readPerson, withPreview,
  type EntryResponse, type Person,
} from '../../_lib/api'
import { Player } from '../../_components/Video'
import EmailGate, { PRIMARY } from '../../_components/EmailGate'
import ShareButton from '../../_components/ShareButton'
import { track } from '../../_lib/track'

/**
 * One entry's page: the link an entrant sends around. The video first; then
 * the one thing that page is for right now (vote while voting is open, make
 * your own while entries are open).
 */
export default function EntryShare({ initial, preview }: { initial: EntryResponse; preview: string }) {
  const [data, setData] = useState(initial)
  const [person, setPerson] = useState<Person | null>(null)
  const [gate, setGate] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { challenge: c, entry: e } = data

  useEffect(() => {
    const p = readPerson()
    if (!p) return
    setPerson(p)
    fetchEntry(e.id, preview, p.token).then((d) => d && setData(d)).catch(() => {})
  }, [e.id, preview])

  const voted = data.me?.voted_entry_id ?? null
  const canVote = c.phase === 'voting' && !!e.finalist_rank
  const prize = prizeFor(c, e.award)
  const back = withPreview(`/challenges/${c.slug}`, preview)

  async function vote(p: Person) {
    setBusy(true)
    setError(null)
    try {
      await post({ action: 'vote', slug: c.slug, preview, entry_id: e.id }, p.token)
      if (newsletter) joinNewsletter(p.email, p.first_name)
      track('creative_vote_cast', { slug: c.slug, entry_id: e.id, from: 'entry_page', newsletter })
      setGate(false)
      setData({ ...data, me: { voted_entry_id: e.id } })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 pb-20 pt-[76px]">
      <Link href={back} className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
        &larr; {c.title}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {prize && <span className="rounded-full bg-gold px-3 py-1 text-[14px] font-bold text-navy">{prize.label}</span>}
        {!prize && e.finalist_rank && <span className="rounded-full bg-lime px-3 py-1 text-[14px] font-bold text-navy">Finalist</span>}
        <span className="rounded-full bg-white px-3 py-1 text-[14px] font-bold text-navy">{categoryLabel(c, e.category)}</span>
      </div>
      <h1 className="mt-3 font-headline text-[clamp(2rem,4.6vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.01em] text-navy">{e.title}</h1>
      <p className="mt-2 text-[16px] text-ink-soft">By {e.credit_name}</p>

      <div className="mt-6"><Player entry={e} /></div>
      <p className="mt-5 text-[1.125rem] leading-relaxed text-navy">&ldquo;{e.says}&rdquo;</p>

      {e.mine && e.status === 'pending' && (
        <p className="mt-5 rounded-[14px] bg-white px-4 py-3 text-[15px] text-navy">Only you can see this page until our quick check finishes, usually within minutes.</p>
      )}

      <div className="mt-8 rounded-[20px] bg-white p-5 sm:p-6">
        {canVote ? (
          voted === e.id ? (
            <p className="text-[16px] font-bold text-forest">You voted for this one. Thanks! Send it to a friend.</p>
          ) : gate ? (
            <>
              <EmailGate slug={c.slug} preview={preview} intro="Confirm your email to vote. One vote each."
                onVerified={(p) => { setPerson(p); vote(p) }} onCancel={() => setGate(false)} />
              <label className="mt-5 flex items-start gap-3 text-[15px] text-navy">
                <input type="checkbox" checked={newsletter} onChange={(ev) => setNewsletter(ev.target.checked)} className="mt-1 h-5 w-5 accent-forest" />
                <span>Also send me the Green Streets newsletter, once a month.</span>
              </label>
            </>
          ) : (
            <>
              <p className="font-headline text-[1.375rem] font-extrabold text-navy">Vote for People&rsquo;s Choice</p>
              <p className="mt-1 text-[16px] text-ink-soft">
                One of {c.finalist_count} finalists. Voting closes {lastDay(c.voting_close_at)}.{voted ? ' Voting here moves your vote.' : ''}
              </p>
              <button type="button" disabled={busy} onClick={() => (person ? vote(person) : setGate(true))} className={`${PRIMARY} mt-4`}>
                {busy ? 'Voting…' : 'Vote for this ad'}
              </button>
            </>
          )
        ) : c.phase === 'open' ? (
          <>
            <p className="font-headline text-[1.375rem] font-extrabold text-navy">Make your own</p>
            <p className="mt-1 text-[16px] text-ink-soft">{c.total_prizes} in prizes. Enter by {lastDay(c.entries_close_at)}.</p>
            <Link href={withPreview(`/challenges/${c.slug}/enter`, preview)} className={`${PRIMARY} mt-4`}>Enter your ad</Link>
          </>
        ) : (
          <>
            <p className="font-headline text-[1.375rem] font-extrabold text-navy">{c.title}</p>
            <p className="mt-1 text-[16px] text-ink-soft">{c.tagline}</p>
            <Link href={back} className={`${PRIMARY} mt-4`}>{c.results_ready ? 'See the winners' : 'See every entry'}</Link>
          </>
        )}
        {error && <p role="alert" className="mt-3 text-[15px] font-semibold text-ep-danger">{error}</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <ShareButton url={e.share_url} title={e.title} />
        {e.link_url && (
          <a href={e.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">
            Watch on {e.platform === 'youtube' ? 'YouTube' : e.platform === 'vimeo' ? 'Vimeo' : 'TikTok'}
          </a>
        )}
      </div>
    </div>
  )
}
