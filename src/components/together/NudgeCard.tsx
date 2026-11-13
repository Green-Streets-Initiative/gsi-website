'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Car } from 'lucide-react'
import { WAY_ICON } from '@/components/together/bits'
import { Card } from '@/components/organizers/ui'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { togetherMoreStrings, type TogetherMoreKey } from '@/lib/site-strings/together-more'
import { track } from '@/lib/together'
import { markNudge, nextNudge, type Nudge } from '@/lib/together-more'

/**
 * The app's Home nudge for Shift Together on the web (PartnerNudgeCard;
 * Shift 01370, 01457): one sentence, one action, "Not now". Counts only:
 * who asked or offered stays private until both people say yes.
 *
 *   guide            people near you would like company the first time they try a way
 *   newcomer         people near you who already go that way offered to go with you
 *   recruit_guide    you go that way a lot: would you go with a neighbor once?
 *   recruit_carpool  you drive to work: share the drive with someone near you
 *
 * The server decides when one shows and how often ("Not now" waits 30
 * days; two of them stop it). The button opens the sign-up on that choice.
 */
const pl = (base: string, n: number) => `${base}_${n === 1 ? 'one' : 'other'}` as TogetherMoreKey
const k = (key: string) => key as TogetherMoreKey

export default function NudgeCard({ locale, skip = false }: { locale: SiteLocale; skip?: boolean }) {
  const t = translator(togetherMoreStrings, locale)
  const [nudge, setNudge] = useState<Nudge | null>(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (skip) return
    let live = true
    void nextNudge().then((n) => {
      if (!live || !n) return
      setNudge(n)
      track('together_nudge_shown', { side: n.side, way: n.way, count: n.count })
    })
    return () => { live = false }
  }, [skip])

  if (!nudge || gone || skip) return null
  const { side, count, way } = nudge
  const guideWay = way === 'bike' || way === 'transit' || way === 'micro' ? way : null

  let eyebrow: string, title: string, ask: string | null = null, cta: string, href: string
  if (side === 'guide') {
    eyebrow = t('nudge.guide_eyebrow')
    title = t(pl('nudge.guide_title', count), { count, way: t(k(`nudge.try_${way}`)) })
    cta = t('nudge.guide_cta')
    href = '/together?kind=guide'
  } else if (side === 'newcomer') {
    eyebrow = t('nudge.newcomer_eyebrow')
    title = t(pl('nudge.newcomer_title', count), { count, verb: t(pl(`nudge.verb_${way}`, count)) })
    cta = t('nudge.newcomer_cta')
    href = '/together?kind=newcomer'
  } else if (side === 'recruit_carpool') {
    const similar = nudge.similar ?? 0
    eyebrow = t('nudge.carpool_eyebrow')
    title = similar ? t(pl('nudge.carpool_similar', similar), { count: similar }) : t(pl('nudge.carpool_count', nudge.trips ?? count), { count: nudge.trips ?? count })
    ask = t(similar ? 'nudge.carpool_similar_ask' : 'nudge.carpool_ask')
    cta = t('nudge.carpool_cta')
    href = '/together?kind=carpool'
  } else {
    // An invitation says the strongest true thing: "more than almost anyone in <town>" only for a town's top 10%.
    const n = nudge.trips ?? count
    const statWay = way === 'bike' || way === 'transit' || way === 'walk' ? way : null
    eyebrow = guideWay ? t(k(`nudge.recruit_eyebrow_${guideWay}`)) : t('nudge.recruit_eyebrow')
    title = statWay
      ? nudge.top && nudge.town ? t(k(`nudge.top_${statWay}`), { town: nudge.town }) : t(pl(`nudge.count_${statWay}`, n), { count: n })
      : ''
    ask = guideWay ? t(k(`nudge.recruit_ask_${guideWay}`)) : t('nudge.recruit_ask')
    cta = guideWay ? t(k(`nudge.recruit_cta_${guideWay}`)) : t('nudge.recruit_cta')
    href = '/together?kind=guide'
  }
  const Icon = side === 'recruit_carpool' ? Car : WAY_ICON[way] ?? ArrowRight

  return (
    <Card className="grid grid-cols-1 gap-3 border-l-4 border-l-(--ev-accent)">
      <p className="flex items-center gap-2 text-[15px] font-bold text-(--ev-accent)">
        <Icon className="h-[18px] w-[18px]" aria-hidden /> {eyebrow}
      </p>
      {title ? <p className="text-[19px] font-bold leading-snug">{title}</p> : null}
      {ask ? <p className="text-[16px] text-(--ev-ink-85)">{ask}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={withLang(href, locale)}
          onClick={() => { void markNudge(side, 'tapped'); track('together_nudge_tapped', { side, way }) }}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill)"
        >
          {cta} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={() => { setGone(true); void markNudge(side, 'dismissed'); track('together_nudge_dismissed', { side, way }) }}
          className="min-h-[44px] px-2 text-[15px] font-semibold text-(--ev-ink-80) underline"
        >
          {t('nudge.not_now')}
        </button>
      </div>
    </Card>
  )
}
