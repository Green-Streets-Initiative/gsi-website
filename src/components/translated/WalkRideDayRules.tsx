import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import HtmlLang from '@/components/HtmlLang'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resultsPath } from '@/app/events/walk-ride-day/_lib/results'
import { HTML_LANG, dateET, dollars, longDate, type DraftLocale } from '@/lib/translated-pages'
import { LegalDraftBanner } from './TranslationNotes'
import RulesEs from './rules-es'
import RulesPtBR from './rules-pt-BR'

/*
 * The Walk/Ride Day official rules (/events/walk-ride-day/rules) in Spanish
 * or Portuguese. The data load is the English page's, line for line, so the
 * month, prizes, entry cap, referral window and drawing date match it; each
 * language's text is a whole translation in rules-<lang>.tsx, kept section
 * for section with the English so a reviewer can read them side by side.
 * The English rules stay the official text (the banner says so).
 */

/** Server render: one read of the clock per request. */
const nowMs = () => Date.now()

const TITLE = { es: 'Reglas oficiales', 'pt-BR': 'Regulamento oficial' } as const
const EYEBROW = { es: 'Legal', 'pt-BR': 'Jurídico' } as const

export function rulesMetadata(locale: DraftLocale): Metadata {
  return locale === 'es'
    ? { title: 'Walk/Ride Day · Reglas oficiales | Green Streets Initiative', description: 'Reglas oficiales del sorteo de tarjetas de regalo del Walk/Ride Day de Green Streets Initiative.' }
    : { title: 'Walk/Ride Day · Regulamento oficial | Green Streets Initiative', description: 'Regulamento oficial do sorteio de cartões-presente do Walk/Ride Day da Green Streets Initiative.' }
}

export type RulesPrize = { id: string; text: string; value: string | null; quantity: number }

/** Everything the rules text needs, computed once for either language. */
export type RulesVars = {
  locale: DraftLocale
  /** "Walk/Ride Day de noviembre de 2026", or null with no month set up. */
  name: string | null
  dayLabel: string | null
  drawLabel: string | null
  referralOpensLabel: string | null
  referralMax: number
  referralPerFriend: number
  maxEntries: number
  prizes: RulesPrize[]
  totalArv: string | null
  resultsHref: string
}

type PrizeRow = { id: string; description: string; value_amount: number | null; quantity: number }

/** The month's name, from its date rather than the English row name. */
function competitionName(locale: DraftLocale, startsAt: string): string {
  const month = dateET(locale, startsAt, { month: 'long', year: 'numeric' })
  return `Walk/Ride Day de ${month}`
}

/**
 * Prize rows are written in English in the database. The one wording in use
 * ("$10 digital gift card — winner's choice of local shop or brand gift card")
 * is translated here; anything else shows as written, marked as English.
 */
function prizeText(locale: DraftLocale, p: PrizeRow): string {
  const m = /^\$(\d+(?:\.\d+)?) digital gift card — winner's choice of local shop or brand gift card$/.exec(p.description.trim())
  if (m) {
    const v = dollars(locale, Number(m[1]))
    return locale === 'es'
      ? `Tarjeta de regalo digital de ${v}: la persona ganadora elige una tienda local o una tarjeta de regalo de una marca`
      : `Cartão-presente digital de ${v}: quem ganhar escolhe uma loja local ou um cartão-presente de uma marca`
  }
  return `${p.description} ${locale === 'es' ? '(en inglés)' : '(em inglês)'}`
}

export default async function TranslatedRulesPage({ locale }: { locale: DraftLocale }) {
  const supabase = createServerSupabaseClient()

  const { data: competitionsRaw } = await supabase
    .from('competitions')
    .select('id, name, starts_at, ends_at, drawing_at')
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Walk/Ride Day%')
    .order('starts_at', { ascending: true })

  const competitions = (competitionsRaw ?? []) as {
    id: string; name: string; starts_at: string; ends_at: string; drawing_at: string | null
  }[]

  // Same pick as the English page: active, then next upcoming, then most recent past.
  const now = nowMs()
  const competition =
    competitions.find(c => new Date(c.starts_at).getTime() <= now && new Date(c.ends_at).getTime() >= now) ??
    competitions.find(c => new Date(c.starts_at).getTime() > now) ??
    [...competitions].reverse().find(c => new Date(c.ends_at).getTime() < now) ??
    null

  let prizes: PrizeRow[] = []
  let maxEntries = 3
  let referralOpensAt: string | null = null
  let referralMax = 0
  let referralPerFriend = 1
  if (competition) {
    const { data } = await supabase
      .from('competition_prizes')
      .select('id, description, value_amount, quantity, eligibility_criteria, referral_entry_cap')
      .eq('competition_id', competition.id)
      .eq('prize_type', 'individual')
      .order('display_order', { ascending: true })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prizes = (data ?? []).map((row: any) => ({
      id: row.id,
      description: row.description,
      value_amount: row.value_amount != null ? Number(row.value_amount) : null,
      quantity: row.quantity ?? 1,
    }))

    const cap = (data ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.eligibility_criteria?.max_daily_entries)
      .find((v: unknown) => typeof v === 'number')
    if (typeof cap === 'number') maxEntries = cap

    type ReferralRow = {
      referral_entry_cap: number | null
      eligibility_criteria: {
        referral_opens_at?: unknown
        referral_mode?: unknown
        referral_stage_entries?: { first_trip?: unknown }
      } | null
    }
    const referralRow = ((data ?? []) as ReferralRow[]).find(r => {
      const opens = r.eligibility_criteria?.referral_opens_at
      return (
        (r.referral_entry_cap ?? 0) > 0 &&
        r.eligibility_criteria?.referral_mode === 'first_trip_only' &&
        typeof opens === 'string' &&
        !Number.isNaN(Date.parse(opens))
      )
    })
    if (referralRow) {
      referralOpensAt = referralRow.eligibility_criteria?.referral_opens_at as string
      const perFriend = referralRow.eligibility_criteria?.referral_stage_entries?.first_trip
      if (typeof perFriend === 'number' && perFriend > 0) referralPerFriend = perFriend
      referralMax = (referralRow.referral_entry_cap ?? 0) * referralPerFriend
    }
  }

  const dayLabel = competition ? longDate(locale, competition.starts_at) : null
  const referralOpensLabel = referralOpensAt && dayLabel ? longDate(locale, referralOpensAt) : null
  const drawLabel = competition
    ? longDate(locale, competition.drawing_at ?? new Date(new Date(competition.ends_at).getTime() + 6 * 60 * 60 * 1000).toISOString())
    : null
  const total = prizes.reduce((sum, p) => (p.value_amount == null ? sum : sum + p.value_amount * Math.max(p.quantity, 1)), 0)

  const vars: RulesVars = {
    locale,
    name: competition ? competitionName(locale, competition.starts_at) : null,
    dayLabel,
    drawLabel,
    referralOpensLabel,
    referralMax,
    referralPerFriend,
    maxEntries,
    prizes: prizes.map(p => ({
      id: p.id,
      text: prizeText(locale, p),
      value: p.value_amount != null ? dollars(locale, p.value_amount) : null,
      quantity: p.quantity,
    })),
    totalArv: total > 0 ? dollars(locale, total) : null,
    resultsHref: competition ? resultsPath(competition.starts_at) : '/events/walk-ride-day/results',
  }

  return (
    <>
      <Nav variant="light" locale={locale} />
      <HtmlLang locale={locale} />
      <main lang={HTML_LANG[locale]} className="bg-cream pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-8 lg:py-10">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{EYEBROW[locale]}</p>
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
            {TITLE[locale]}
          </h1>
          <p className="mt-4 text-[15px] text-ink-soft">
            {vars.name ?? 'Walk/Ride Day'}{' '}&middot; Green Streets Initiative
          </p>
          <LegalDraftBanner locale={locale} page="walk-ride-day-rules" />
          {locale === 'es' ? <RulesEs v={vars} /> : <RulesPtBR v={vars} />}
        </article>
      </main>
      <Footer variant="light" />
    </>
  )
}
