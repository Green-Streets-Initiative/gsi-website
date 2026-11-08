'use client'

import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { Check, Link2, MapPinned, Smartphone, type LucideIcon } from 'lucide-react'
import { Badge, Card } from '@/components/organizers/ui'
import { translator, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { togetherStrings, waysWords, type TogetherKey } from '@/lib/site-strings/together'
import { lessonOffer, track, type LessonOffer, type PartnerKind, type PartnerWay } from '@/lib/together'

/**
 * What to do while Shift looks for a match, so "we'll email you" is never the
 * end of the page (the app's PartnerFallback, for the web): the free road
 * lesson for people trying a bike near the school, plan the route, invite
 * someone, and the app.
 */

const PLAN_SUB: Record<PartnerWay, TogetherKey> = {
  bike: 'next.plan_bike',
  walk: 'next.plan_walk',
  transit: 'next.plan_transit',
  micro: 'next.plan_micro',
}

export default function NextSteps({ kind, ways, source, locale = 'en' }: { kind: PartnerKind; ways: PartnerWay[]; source: 'saved' | 'matches'; locale?: SiteLocale }) {
  const t = translator(togetherStrings, locale)
  const way: PartnerWay = ways[0] ?? 'bike'
  const [copied, setCopied] = useState(false)
  const invite = async () => {
    const url = 'https://www.gogreenstreets.org/together'
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt(t('next.copy_prompt'), url)
    }
    track('together_invite_copied', { kind, source })
  }
  return (
    <section aria-labelledby="together-meanwhile" className="grid grid-cols-1 gap-3">
      <h2 id="together-meanwhile" className="font-display text-[22px] font-extrabold">{t('next.title')}</h2>
      {kind === 'newcomer' && ways.includes('bike') ? <LessonCard locale={locale} /> : null}
      <div className={kind === 'carpool' ? 'grid grid-cols-1 gap-3 sm:max-w-[320px]' : 'grid grid-cols-1 gap-3 sm:grid-cols-3'}>
        {kind !== 'carpool' ? (
          <Tile Icon={MapPinned} title={t('next.plan')} sub={t(PLAN_SUB[way])} href={withLang('/nearby?plan=1', locale)} onClick={() => track('together_plan_opened', { source })} />
        ) : null}
        {/* Why invite: a friend who already makes the trip can be your match, or someone who'd like to try can be the guide's.
            Not for a carpool: anyone who already drives your way, you'd simply ask (Keith 2026-10-27). */}
        {kind !== 'carpool' ? (
          <Tile
            Icon={copied ? Check : Link2}
            title={kind === 'guide' ? t('next.invite_guide', { ways: waysWords(locale, ways, 'ing', t) }) : t('next.invite_newcomer', { ways: waysWords(locale, ways, 'does', t) })}
            sub={copied
              ? t('next.copied')
              : kind === 'guide'
                ? t('next.invite_guide_sub')
                : t('next.invite_newcomer_sub')}
            onClick={() => void invite()}
          />
        ) : null}
        <Tile
          Icon={Smartphone}
          title={t('next.app')}
          sub={kind === 'carpool' ? t('next.app_carpool') : t('next.app_sub')}
          href="https://shift.gogreenstreets.org/get"
          onClick={() => track('together_get_app', { source })}
        />
      </div>
    </section>
  )
}

function Tile({ Icon, title, sub, href, onClick }: { Icon: LucideIcon; title: string; sub: string; href?: string; onClick?: () => void }) {
  const body: ReactNode = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--ev-panel) text-(--ev-accent)" aria-hidden>
        <Icon className="h-5 w-5" />
      </span>
      <span className="grid gap-1">
        <span className="text-[17px] font-bold leading-snug">{title}</span>
        <span className="text-[15px] leading-snug text-(--ev-ink-80)">{sub}</span>
      </span>
    </>
  )
  const cls = 'flex min-h-[44px] items-start gap-3 rounded-2xl border border-(--ev-line-strong) bg-white p-4 text-left transition hover:bg-(--ev-panel) sm:flex-col sm:gap-2'
  if (href) {
    return href.startsWith('/')
      ? <Link href={href} onClick={onClick} className={cls}>{body}</Link>
      : <a href={href} onClick={onClick} className={cls}>{body}</a>
  }
  return <button type="button" onClick={onClick} className={cls}>{body}</button>
}

/**
 * The free 1:1 road lesson, for newcomers by bike near the school (Shift 01454).
 * They ask on /bike-lessons, which sends when they're free to the instructors
 * (Keith 2026-10-28): the instructors' addresses are never shown (Shift 01475).
 */
const LESSON_FORM = '/bike-lessons#street-lesson'
const LESSON_LINK = 'inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill) hover:opacity-90'

export function LessonCard({ locale = 'en' }: { locale?: SiteLocale } = {}) {
  const t: T<TogetherKey> = translator(togetherStrings, locale)
  const [offer, setOffer] = useState<LessonOffer | null>(null)
  useEffect(() => { void lessonOffer().then(setOffer) }, [])
  if (!offer || (offer.state !== 'offer' && offer.state !== 'has_code')) return null

  if (offer.state === 'has_code') {
    return (
      <Card>
        <h3 className="font-display text-[22px] font-extrabold">{offer.requested ? t('lesson.requested') : t('lesson.code')}</h3>
        <p className="mt-3 inline-block rounded-xl border-2 border-(--ev-accent) px-4 py-2 font-display text-[26px] font-extrabold tracking-[0.12em]">{offer.code}</p>
        {offer.requested ? (
          <p className="mt-3 text-[16px] leading-relaxed text-(--ev-ink-85)">
            {t('lesson.requested_body', { school: offer.school })}
          </p>
        ) : (
          <>
            <p className="mt-3 text-[16px] leading-relaxed text-(--ev-ink-85)">
              {t('lesson.code_body', { school: offer.school })}
            </p>
            <Link href={LESSON_FORM} onClick={() => track('together_lesson_request_link', { state: 'has_code' })} className={`${LESSON_LINK} mt-3`}>
              {t('lesson.send')}
            </Link>
          </>
        )}
      </Card>
    )
  }
  return (
    <Card className="flex flex-wrap items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-[22px] font-extrabold">{t('lesson.book')}</h3>
          {offer.left != null && <Badge tone="good">{t('lesson.left', { n: offer.left })}</Badge>}
        </div>
        <p className="mt-1 text-[16px] text-(--ev-ink-85)">{t('lesson.offer_body', { school: offer.school })}</p>
      </div>
      <Link href={LESSON_FORM} onClick={() => track('together_lesson_request_link', { state: 'offer' })} className={LESSON_LINK}>
        {t('lesson.ask')}
      </Link>
    </Card>
  )
}
