'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SignHero, SignTop, StreetHeading, StreetSection, StepSign, H3 } from './street'
import {
  categoryLabel, errorText, fetchChallenge, joinNewsletter, lastDay as lastDayEn, longDay as longDayEn, post, prizeFor,
  readPerson, shortDay as shortDayEn, withPreview, writePerson, type ChallengeResponse, type EntryView, type Person,
} from '../_lib/api'
import { EntryCard, PlayerDialog } from './Video'
import EmailGate, { PRIMARY } from './EmailGate'
import ShareButton from './ShareButton'
import { track } from '../_lib/track'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { creativeStrings, rich } from '@/lib/site-strings/challenges'

const PHASE_TOP = {
  soon: 'phase.soon',
  open: 'phase.open',
  judging: 'phase.judging',
  voting: 'phase.voting',
  counting: 'phase.counting',
  results: 'phase.results',
} as const

export default function ChallengePage({ initial, preview, locale = 'en' }: { initial: ChallengeResponse; preview: string; locale?: SiteLocale }) {
  const t = translator(creativeStrings, locale)
  const shortDay = (iso: string) => shortDayEn(iso, locale)
  const longDay = (iso: string) => longDayEn(iso, locale)
  const lastDay = (iso: string) => lastDayEn(iso, locale)
  const link = (path: string) => withLang(withPreview(path, preview), locale)
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
      setVoteError(errorText(err, locale, t('err.try_again'), { action: 'vote' }))
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

  const enterHref = link(`/challenges/${c.slug}/enter`)
  const rulesHref = link(`/challenges/${c.slug}/rules`)

  const cta = c.phase === 'open'
    ? <Link href={enterHref} className={PRIMARY}>{t('cta.enter')}</Link>
    : c.phase === 'voting' && c.finalists_ready
    ? <a href="#finalists" className={PRIMARY}>{t('vote.peoples')}</a>
    : c.phase === 'results' && c.results_ready
    ? <a href="#winners" className={PRIMARY}>{t('cta.winners')}</a>
    : null

  const when = c.phase === 'soon'
    ? t('when.soon', { date: longDay(c.opens_at) })
    : c.phase === 'open'
    ? t('when.open', { date: lastDay(c.entries_close_at) })
    : c.phase === 'judging'
    ? t('when.judging', { date: shortDay(c.judging_close_at) })
    : c.phase === 'voting'
    ? t('when.voting', { date: lastDay(c.voting_close_at) })
    : c.phase === 'counting'
    ? t('when.counting', { date: longDay(c.results_at) })
    : null

  return (
    <>
      <SignHero
        top={<SignTop strong={t(PHASE_TOP[c.phase])}>{t('hero.kicker')}</SignTop>}
        title={c.title}
        lede={<p>{c.tagline}</p>}
        after={
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">
            {cta}
            <ul className="flex flex-wrap gap-2 text-[15px] font-semibold text-navy">
              <li className="rounded-full bg-white px-3.5 py-1.5">{t('chip.total', { amount: c.total_prizes })}</li>
              {grand && (
                <li className="rounded-full bg-white px-3.5 py-1.5">
                  {/* The prize's name is the database's, in English; only English lowercases it mid-sentence. */}
                  {t('chip.grand', { amount: grand.amount, label: locale === 'en' ? grand.label.toLowerCase() : grand.label })}
                </li>
              )}
              {when && <li className="rounded-full bg-white px-3.5 py-1.5">{when}</li>}
            </ul>
          </div>
        }
      />

      {data.me && data.me.entries.length > 0 && (
        <StreetSection tone="white">
          <StreetHeading as="h2" title={t('mine.title')} lede={c.phase === 'open' ? t('mine.lede', { n: c.max_entries_per_person }) : undefined} />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.me.entries.map((e) => (
              <li key={e.id} className="rounded-[16px] border-2 border-navy/[0.12] bg-cream p-4">
                <p className="font-headline text-[1.125rem] font-extrabold text-navy">{e.title}</p>
                <p className="mt-1 text-[15px] text-ink-soft">
                  {e.status === 'pending' ? t('mine.pending') : t('mine.in_gallery', { category: categoryLabel(c, e.category, locale) })}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4">
                  <Link href={link(`/challenges/${c.slug}/e/${e.id}`)} className="inline-flex min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline">
                    {t('mine.its_page')}
                  </Link>
                  <ShareButton url={e.share_url} title={e.title} compact locale={locale} />
                </div>
              </li>
            ))}
          </ul>
          {data.me.can_enter && (
            <Link href={enterHref} className="mt-5 inline-flex min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline">
              {t('mine.another')} &rarr;
            </Link>
          )}
        </StreetSection>
      )}

      {c.results_ready && winners.length > 0 && (
        <StreetSection id="winners">
          <StreetHeading title={t('winners.title')} lede={t('winners.lede', { n: finalists.length })} />
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {winners.map((e) => (
              <EntryCard key={e.id} c={c} entry={e} onOpen={setPlaying} locale={locale}
                footer={<p className="mt-2 text-[15px] font-bold text-forest">{prizeFor(c, e.award)?.label} · {prizeFor(c, e.award)?.amount}</p>} />
            ))}
          </ul>
        </StreetSection>
      )}

      {c.finalists_ready && finalists.length > 0 && (
        <StreetSection id="finalists" tone={c.results_ready ? 'white' : 'cream'}>
          <StreetHeading
            title={c.phase === 'voting' ? t('finalists.pick') : t('finalists.title')}
            lede={c.phase === 'voting'
              ? t('finalists.lede_voting', { date: lastDay(c.voting_close_at) })
              : t('finalists.lede', { n: finalists.length })}
          />
          {votedEntry && c.phase === 'voting' && (
            <p className="mb-6 rounded-[14px] bg-accent-soft px-4 py-3 text-[16px] text-navy">
              {rich(t('voted.banner'), { title: <span className="font-bold">{votedEntry.title}</span> })}
            </p>
          )}
          {voteError && <p role="alert" className="mb-4 text-[15px] font-semibold text-ep-danger">{voteError}</p>}
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {finalists.map((e) => (
              <EntryCard key={e.id} c={c} entry={e} onOpen={setPlaying} locale={locale}
                footer={c.phase === 'voting' ? (
                  <button type="button" disabled={voteBusy || voted === e.id} onClick={() => startVote(e)}
                    className={`mt-3 inline-flex min-h-[46px] items-center justify-center rounded-full px-6 text-[16px] font-bold ${voted === e.id ? 'bg-accent-soft text-forest' : 'bg-navy text-white hover:opacity-90'} disabled:cursor-default`}>
                    {voted === e.id ? t('vote.yours') : voted ? t('vote.instead') : t('vote.vote')}
                  </button>
                ) : c.results_ready && e.vote_count != null ? (
                  <p className="mt-2 text-[15px] text-ink-soft">{t(e.vote_count === 1 ? 'votes.one' : 'votes.other', { n: e.vote_count })}</p>
                ) : null} />
            ))}
          </ul>
        </StreetSection>
      )}

      {(c.phase === 'soon' || c.phase === 'open') && (
        <StreetSection tone="white">
          <div className="grid gap-10 lg:grid-cols-[3fr_2fr]">
            <div>
              <StreetHeading title={t('make.title')} />
              <ul className="space-y-3">
                {c.brief.map((line, i) => (
                  <li key={i} className="flex gap-3 text-[1.0625rem] leading-relaxed text-navy">
                    <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-forest" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
                {t('make.how', { n: c.max_entries_per_person })}
              </p>
            </div>
            <div>
              <h3 className={H3}>{t('prizes.title')}</h3>
              <ul className="mt-4 divide-y-2 divide-navy/[0.08] border-y-2 border-navy/[0.14]">
                {c.prizes.map((p) => (
                  <li key={p.key} className="flex items-baseline justify-between gap-4 py-3">
                    <span className="text-[16px] text-navy">{p.label}</span>
                    <span className="font-headline text-[1.5rem] font-extrabold text-forest">{p.amount}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[15px] text-ink-soft">{t('prizes.note')}</p>
            </div>
          </div>
        </StreetSection>
      )}

      <StreetSection>
        <StreetHeading title={t('how.title')} />
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: t('how.make'), d: t('how.make_d', { min: c.min_seconds ?? 30, max: c.max_seconds ?? 60, date: lastDay(c.entries_close_at) }) },
            { t: t('how.judges'), d: t('how.judges_d', { n: c.finalist_count, date: shortDay(c.judging_close_at) }) },
            { t: t('how.votes'), d: t('how.votes_d', { start: shortDay(c.judging_close_at), end: lastDay(c.voting_close_at) }) },
            { t: t('how.winners'), d: t(c.slug.endsWith('commercial-break') ? 'how.winners_d_game' : 'how.winners_d', { date: longDay(c.results_at) }) },
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
            <span className="font-bold">{t('judges.label')}</span>
            {data.judges.map((j) => j.affiliation ? `${j.name}, ${j.affiliation}` : j.name).join(' · ')}
          </p>
        )}
      </StreetSection>

      <StreetSection tone="white" id="entries">
        <StreetHeading
          title={c.phase === 'open' || c.phase === 'soon' ? t('gallery.so_far') : t('gallery.every')}
          lede={data.count === 0
            ? (c.phase === 'open' ? t('gallery.first') : t('gallery.none'))
            : undefined}
          aside={data.count > 0 ? <span className="text-[16px] font-bold text-navy">{t(data.count === 1 ? 'gallery.ads_one' : 'gallery.ads_other', { n: data.count })}</span> : undefined}
        />
        {data.count > 0 && (
          <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {data.entries.map((e) => <EntryCard key={e.id} c={c} entry={e} onOpen={setPlaying} locale={locale} />)}
          </ul>
        )}
      </StreetSection>

      <StreetSection closing>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[16px]">
          {c.phase === 'open' && <Link href={enterHref} className={PRIMARY}>{t('cta.enter')}</Link>}
          <ShareButton url={c.share_url} title={c.title} locale={locale} />
          <Link href={rulesHref} className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">{t('closing.rules')}</Link>
          <a href="mailto:info@gogreenstreets.org" className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">{t('closing.questions')}</a>
        </div>
        <p className="mt-6 max-w-[640px] text-[15px] leading-relaxed text-ink-soft">{t('closing.fine')}</p>
      </StreetSection>

      <PlayerDialog c={c} entry={playing} onClose={() => setPlaying(null)} locale={locale}>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          {playing && c.phase === 'voting' && playing.finalist_rank && voted !== playing.id && (
            <button type="button" onClick={() => startVote(playing)} className={PRIMARY}>{t('player.vote')}</button>
          )}
          {playing && (
            <Link href={link(`/challenges/${c.slug}/e/${playing.id}`)} className="inline-flex min-h-[44px] items-center font-bold text-forest underline-offset-4 hover:underline">
              {t('mine.its_page')}
            </Link>
          )}
          {playing && <ShareButton url={playing.share_url} title={playing.title} compact locale={locale} />}
        </div>
      </PlayerDialog>

      {voteFor && (
        <VoteDialog title={voteFor.title} onClose={() => setVoteFor(null)} label={t('votedialog.aria', { title: voteFor.title })} heading={t('vote.peoples')}>
          <EmailGate
            slug={c.slug}
            preview={preview}
            intro={t('votegate.intro', { title: voteFor.title })}
            onVerified={(p) => { setPerson(p); castVote(voteFor, p) }}
            onCancel={() => setVoteFor(null)}
            locale={locale}
          />
          <label className="mt-5 flex items-start gap-3 text-[15px] text-navy">
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-1 h-5 w-5 accent-forest" />
            <span>{t('newsletter.also')}</span>
          </label>
          {voteError && <p role="alert" className="mt-3 text-[15px] font-semibold text-ep-danger">{voteError}</p>}
        </VoteDialog>
      )}
    </>
  )
}

function VoteDialog({ onClose, children, label, heading }: { title: string; onClose: () => void; children: React.ReactNode; label: string; heading: string }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-50 flex items-end justify-center bg-navy/70 p-4 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[460px] rounded-[20px] bg-cream p-6">
        <p className="mb-4 font-headline text-[1.375rem] font-extrabold text-navy">{heading}</p>
        {children}
      </div>
    </div>
  )
}
