'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SignHero, SignTop, StreetHeading, StreetSection, StepSign, H3 } from './street'
import {
  ApiError, categoryLabel, fetchChallenge, joinNewsletter, lastDay, longDay, post, prizeFor, readPerson, shortDay,
  withPreview, writePerson, type ChallengeResponse, type EntryView, type Person,
} from '../_lib/api'
import { EntryCard, PlayerDialog } from './Video'
import EmailGate, { PRIMARY } from './EmailGate'
import ShareButton from './ShareButton'
import { track } from '../_lib/track'

const PHASE_TOP: Record<string, string> = {
  soon: 'Coming soon',
  open: 'Entries open',
  judging: 'Judges are scoring',
  voting: 'Vote now',
  counting: 'Votes are in',
  results: 'The winners',
}

export default function ChallengePage({ initial, preview }: { initial: ChallengeResponse; preview: string }) {
  const [data, setData] = useState<ChallengeResponse>(initial)
  const [person, setPerson] = useState<Person | null>(null)
  const [playing, setPlaying] = useState<EntryView | null>(null)
  const [voteFor, setVoteFor] = useState<EntryView | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)
  const [voteBusy, setVoteBusy] = useState(false)
  const [newsletter, setNewsletter] = useState(false)

  const c = data.challenge
  const reload = useCallback(async (p: Person | null) => {
    const fresh = await fetchChallenge(c.slug, preview, p?.token).catch(() => null)
    if (fresh) setData(fresh)
    // A token the server no longer knows (expired): forget it.
    if (p && fresh && !fresh.me) { writePerson(null); setPerson(null) }
  }, [c.slug, preview])

  useEffect(() => {
    const p = readPerson()
    if (p) { setPerson(p); reload(p) }
  }, [reload])

  const finalists = useMemo(
    () => data.entries.filter((e) => e.finalist_rank).sort((a, b) => (a.finalist_rank ?? 0) - (b.finalist_rank ?? 0)),
    [data.entries],
  )
  const winners = useMemo(() => {
    const order = c.prizes.map((p) => p.key)
    return data.entries.filter((e) => e.award).sort((a, b) => order.indexOf(a.award!) - order.indexOf(b.award!))
  }, [data.entries, c.prizes])
  const voted = data.me?.voted_entry_id ?? null
  const votedEntry = data.entries.find((e) => e.id === voted) ?? null
  const grand = c.prizes.find((p) => p.key === 'grand')

  async function castVote(entry: EntryView, p: Person) {
    setVoteBusy(true)
    setVoteError(null)
    try {
      await post({ action: 'vote', slug: c.slug, preview, entry_id: entry.id }, p.token)
      if (newsletter) joinNewsletter(p.email, p.first_name)
      track('creative_vote_cast', { slug: c.slug, entry_id: entry.id, from: 'challenge_page', newsletter })
      setVoteFor(null)
      await reload(p)
    } catch (err) {
      setVoteError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
    } finally {
      setVoteBusy(false)
    }
  }

  function startVote(entry: EntryView) {
    setPlaying(null)
    setVoteError(null)
    if (person) castVote(entry, person)
    else setVoteFor(entry)
  }

  const enterHref = withPreview(`/challenges/${c.slug}/enter`, preview)
  const rulesHref = withPreview(`/challenges/${c.slug}/rules`, preview)

  const cta = c.phase === 'open'
    ? <Link href={enterHref} className={PRIMARY}>Enter your ad</Link>
    : c.phase === 'voting' && c.finalists_ready
    ? <a href="#finalists" className={PRIMARY}>Vote for People&rsquo;s Choice</a>
    : c.phase === 'results' && c.results_ready
    ? <a href="#winners" className={PRIMARY}>See the winners</a>
    : null

  const when = c.phase === 'soon'
    ? `Entries open ${longDay(c.opens_at)}`
    : c.phase === 'open'
    ? `Enter by ${lastDay(c.entries_close_at)}`
    : c.phase === 'judging'
    ? `Finalists named ${shortDay(c.judging_close_at)}`
    : c.phase === 'voting'
    ? `Vote by ${lastDay(c.voting_close_at)}`
    : c.phase === 'counting'
    ? `Winners announced ${longDay(c.results_at)}`
    : null

  return (
    <>
      <SignHero
        top={<SignTop strong={PHASE_TOP[c.phase]}>A Green Streets creative challenge</SignTop>}
        title={c.title}
        lede={<p>{c.tagline}</p>}
        after={
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
            {cta}
            <ul className="flex flex-wrap gap-2 text-[15px] font-semibold text-navy">
              <li className="rounded-full bg-white px-3.5 py-1.5">{c.total_prizes} in prizes</li>
              {grand && <li className="rounded-full bg-white px-3.5 py-1.5">{grand.amount} for the {grand.label.toLowerCase()}</li>}
              {when && <li className="rounded-full bg-white px-3.5 py-1.5">{when}</li>}
            </ul>
          </div>
        }
      />

      {data.me && data.me.entries.length > 0 && (
        <StreetSection tone="white">
          <StreetHeading as="h2" title="Your entries" lede={c.phase === 'open' ? `You can enter up to ${c.max_entries_per_person}. Share your ad's page so people see it.` : undefined} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.me.entries.map((e) => (
              <li key={e.id} className="rounded-[16px] border-2 border-navy/[0.12] bg-cream p-4">
                <p className="font-headline text-[1.125rem] font-extrabold text-navy">{e.title}</p>
                <p className="mt-1 text-[15px] text-ink-soft">
                  {e.status === 'pending' ? 'Being checked. It shows in the gallery in a few minutes.' : `In the gallery · ${categoryLabel(c, e.category)}`}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4">
                  <Link href={withPreview(`/challenges/${c.slug}/e/${e.id}`, preview)} className="inline-flex min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline">
                    Its page
                  </Link>
                  <ShareButton url={e.share_url} title={e.title} compact />
                </div>
              </li>
            ))}
          </ul>
          {data.me.can_enter && (
            <Link href={enterHref} className="mt-5 inline-flex min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline">
              Enter another ad &rarr;
            </Link>
          )}
        </StreetSection>
      )}

      {c.results_ready && winners.length > 0 && (
        <StreetSection id="winners">
          <StreetHeading title="The winners" lede={`Picked by the judges, plus People's Choice from ${finalists.length} finalists.`} />
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {winners.map((e) => (
              <EntryCard key={e.id} c={c} entry={e} onOpen={setPlaying}
                footer={<p className="mt-2 text-[15px] font-bold text-forest">{prizeFor(c, e.award)?.label} · {prizeFor(c, e.award)?.amount}</p>} />
            ))}
          </ul>
        </StreetSection>
      )}

      {c.finalists_ready && finalists.length > 0 && (
        <StreetSection id="finalists" tone={c.results_ready ? 'white' : 'cream'}>
          <StreetHeading
            title={c.phase === 'voting' ? 'Pick your favorite' : 'The finalists'}
            lede={c.phase === 'voting'
              ? `One vote each, with your email. You can change it until ${lastDay(c.voting_close_at)}.`
              : `The judges' top ${finalists.length}.`}
          />
          {votedEntry && c.phase === 'voting' && (
            <p className="mb-6 rounded-[14px] bg-accent-soft px-4 py-3 text-[16px] text-navy">
              You voted for <span className="font-bold">{votedEntry.title}</span>. Thanks!
            </p>
          )}
          {voteError && <p role="alert" className="mb-4 text-[15px] font-semibold text-ep-danger">{voteError}</p>}
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {finalists.map((e) => (
              <EntryCard key={e.id} c={c} entry={e} onOpen={setPlaying}
                footer={c.phase === 'voting' ? (
                  <button type="button" disabled={voteBusy || voted === e.id} onClick={() => startVote(e)}
                    className={`mt-3 inline-flex min-h-[46px] items-center justify-center rounded-full px-6 text-[16px] font-bold ${voted === e.id ? 'bg-accent-soft text-forest' : 'bg-navy text-white hover:opacity-90'} disabled:cursor-default`}>
                    {voted === e.id ? 'Your vote' : voted ? 'Vote for this one instead' : 'Vote'}
                  </button>
                ) : c.results_ready && e.vote_count != null ? (
                  <p className="mt-2 text-[15px] text-ink-soft">{e.vote_count} {e.vote_count === 1 ? 'vote' : 'votes'}</p>
                ) : null} />
            ))}
          </ul>
        </StreetSection>
      )}

      {(c.phase === 'soon' || c.phase === 'open') && (
        <StreetSection tone="white">
          <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
            <div>
              <StreetHeading title="What to make" />
              <ul className="space-y-3">
                {c.brief.map((line, i) => (
                  <li key={i} className="flex gap-3 text-[1.0625rem] leading-relaxed text-navy">
                    <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-forest" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
                Upload the file, or paste a YouTube, Vimeo or TikTok link. Up to {c.max_entries_per_person} ads each. Massachusetts residents 18 and older.
              </p>
            </div>
            <div>
              <h3 className={H3}>Prizes</h3>
              <ul className="mt-4 divide-y-2 divide-navy/[0.08] border-y-2 border-navy/[0.14]">
                {c.prizes.map((p) => (
                  <li key={p.key} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="text-[16px] text-navy">{p.label}</span>
                    <span className="font-headline text-[1.5rem] font-extrabold text-forest">{p.amount}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[15px] text-ink-soft">Gift cards, by email. One prize per ad.</p>
            </div>
          </div>
        </StreetSection>
      )}

      <StreetSection>
        <StreetHeading title="How it works" />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Make your ad', d: `${c.min_seconds ?? 30} to ${c.max_seconds ?? 60} seconds. Enter by ${lastDay(c.entries_close_at)}.` },
            { t: 'Judges score it', d: `They pick ${c.finalist_count} finalists by ${shortDay(c.judging_close_at)}.` },
            { t: 'Everyone votes', d: `People's Choice, ${shortDay(c.judging_close_at)} to ${lastDay(c.voting_close_at)}.` },
            { t: 'Winners named', d: `${longDay(c.results_at)}${c.slug.endsWith('commercial-break') ? ', the week of the big game' : ''}.` },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-4">
              <StepSign n={i + 1} />
              <div>
                <p className="font-headline text-[1.125rem] font-extrabold text-navy">{s.t}</p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink-soft">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
        {data.judges.length > 0 && (
          <p className="mt-8 text-[16px] text-navy">
            <span className="font-bold">Judges: </span>
            {data.judges.map((j) => j.affiliation ? `${j.name}, ${j.affiliation}` : j.name).join(' · ')}
          </p>
        )}
      </StreetSection>

      <StreetSection tone="white" id="entries">
        <StreetHeading
          title={c.phase === 'open' || c.phase === 'soon' ? 'Entries so far' : 'Every entry'}
          lede={data.count === 0
            ? (c.phase === 'open' ? 'Be the first. Your ad shows here a few minutes after you enter it.' : 'No entries yet.')
            : undefined}
          aside={data.count > 0 ? <span className="text-[16px] font-bold text-navy">{data.count} {data.count === 1 ? 'ad' : 'ads'}</span> : undefined}
        />
        {data.count > 0 && (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {data.entries.map((e) => <EntryCard key={e.id} c={c} entry={e} onOpen={setPlaying} />)}
          </ul>
        )}
      </StreetSection>

      <StreetSection closing>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[16px]">
          {c.phase === 'open' && <Link href={enterHref} className={PRIMARY}>Enter your ad</Link>}
          <ShareButton url={c.share_url} title={c.title} />
          <Link href={rulesHref} className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">Official rules</Link>
          <a href="mailto:info@gogreenstreets.org" className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">Questions? info@gogreenstreets.org</a>
        </div>
        <p className="mt-6 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">
          Judged on how well it gets the point across, how fresh the idea is, how much it makes you want to go and how well it&rsquo;s made. Not affiliated with the NFL or any league.
        </p>
      </StreetSection>

      <PlayerDialog c={c} entry={playing} onClose={() => setPlaying(null)}>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {playing && c.phase === 'voting' && playing.finalist_rank && voted !== playing.id && (
            <button type="button" onClick={() => startVote(playing)} className={PRIMARY}>Vote for this one</button>
          )}
          {playing && (
            <Link href={withPreview(`/challenges/${c.slug}/e/${playing.id}`, preview)} className="inline-flex min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline">
              Its page
            </Link>
          )}
          {playing && <ShareButton url={playing.share_url} title={playing.title} compact />}
        </div>
      </PlayerDialog>

      {voteFor && (
        <VoteDialog title={voteFor.title} onClose={() => setVoteFor(null)}>
          <EmailGate
            slug={c.slug}
            preview={preview}
            intro={`Confirm your email to vote for "${voteFor.title}". One vote each.`}
            onVerified={(p) => { setPerson(p); castVote(voteFor, p) }}
            onCancel={() => setVoteFor(null)}
          />
          <label className="mt-5 flex items-start gap-3 text-[15px] text-navy">
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-1 h-5 w-5 accent-forest" />
            <span>Also send me the Green Streets newsletter, once a month.</span>
          </label>
          {voteError && <p role="alert" className="mt-3 text-[15px] font-semibold text-ep-danger">{voteError}</p>}
        </VoteDialog>
      )}
    </>
  )
}

function VoteDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={`Vote for ${title}`} className="fixed inset-0 z-50 flex items-end justify-center bg-navy/70 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[460px] rounded-[20px] bg-cream p-6">
        <p className="mb-4 font-headline text-[1.375rem] font-extrabold text-navy">Vote for People&rsquo;s Choice</p>
        {children}
      </div>
    </div>
  )
}
