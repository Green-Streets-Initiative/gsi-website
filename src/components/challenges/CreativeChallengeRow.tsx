import { ArrowRight, FilmSlate } from '@phosphor-icons/react/dist/ssr'
import TrackedLink from '@/components/TrackedLink'
import { longDateET } from '@/lib/campaigns/format'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { hubStrings } from '@/lib/site-strings/challenges'

/*
 * A creative challenge (Commercial Break first) on /challenges while it takes
 * entries or People's Choice votes. Read from the creative-challenges
 * function's GET ?live=1, the same call as the app's Community card
 * (Shift lib/creative-challenge.ts): it answers null while the
 * creative_challenges switch is off, so the row shows only once the
 * challenge is public. Drawn like ChallengeRow, so it sits in Happening now.
 */

export interface LiveCreativeChallenge {
  slug: string
  title: string
  tagline: string | null
  phase: 'open' | 'voting'
  total_prizes: string | null
  entries_close_at: string
  voting_close_at: string
}

export async function fetchLiveCreativeChallenge(): Promise<LiveCreativeChallenge | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/creative-challenges?live=1`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      next: { revalidate: 600 },
    })
    if (!res.ok) return null
    const c = ((await res.json()) as { challenge?: LiveCreativeChallenge | null }).challenge
    return c && (c.phase === 'open' || c.phase === 'voting') && c.slug ? c : null
  } catch {
    return null
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[13px] text-ink-soft">{label}</dt>
      <dd className="order-3 shrink-0 text-[13px] font-semibold text-navy">{value}</dd>
      <span className="order-2 min-w-6 flex-1 translate-y-[-3px] border-b border-dotted border-navy/30" />
    </div>
  )
}

export default function CreativeChallengeRow({ c, locale = 'en' }: { c: LiveCreativeChallenge; locale?: SiteLocale }) {
  const t = translator(hubStrings, locale)
  const voting = c.phase === 'voting'
  const facts = [
    {
      label: t(voting ? 'creative.voting_closes' : 'creative.entries_close'),
      value: longDateET(voting ? c.voting_close_at : c.entries_close_at, locale),
    },
    ...(c.total_prizes ? [{ label: t('creative.prizes'), value: c.total_prizes }] : []),
  ]
  return (
    <li className="border-b border-navy/15">
      <TrackedLink
        href={withLang(`/challenges/${c.slug}`, locale)}
        placement="challenges_hub"
        destination={`creative:${c.slug}:${c.phase}`}
        className="group grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 py-7 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:grid-cols-[220px_1fr_auto]"
      >
        <span className="flex items-start gap-3">
          <FilmSlate size={26} weight="regular" className="mt-1 shrink-0 text-forest" aria-hidden />
          <span className="font-serif text-[1.5rem] leading-tight text-navy">{c.title}</span>
        </span>
        <span className="block">
          {c.tagline && <span className="block text-[15px] leading-relaxed text-ink-soft">{c.tagline}</span>}
          <dl className="mt-3 flex flex-col gap-1.5">
            {facts.map((f) => (
              <Fact key={f.label} {...f} />
            ))}
          </dl>
          <span className="mt-3 block text-[15px] font-semibold text-forest">
            {t(voting ? 'creative.cta_vote' : 'creative.cta_enter')}
          </span>
        </span>
        <ArrowRight
          size={20}
          className="col-start-2 row-start-1 mt-1 text-forest transition-transform group-hover:translate-x-1 md:col-start-3"
        />
      </TrackedLink>
    </li>
  )
}
