'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Briefcase, CalendarDays, Car, Clock, GraduationCap, House, Languages, Mail, MapPin, Medal, MessageSquare, Route, Sprout } from 'lucide-react'
import { Avatar, Chip, ChipRow, FitMeter, WAY_ICON } from '@/components/together/bits'
import { Button, Card, Input, Textarea, cx } from '@/components/organizers/ui'
import { siteDate, withLang, type SiteLocale, type T } from '@/lib/site-i18n'
import { LANGUAGE_KEY, SLOT_KEY, TIME_KEY, WAY_KEY, type TogetherKey } from '@/lib/site-strings/together'
import {
  TIMES, arriveGap, clock, experienceFit, isSlot, overallFit, phoneLabel, routeFit, setMatchPhone, timingDaysKnown, timingFit, track,
  type Match, type PartnerWay, type Rating, type ReportReason,
} from '@/lib/together'

/**
 * One Shift Together match as the person sees it (the app's partner-matches
 * card): a fit rating, the person's face, and timing, route and experience
 * meters before the yes; their email once both say yes. Used on
 * /together/matches and, with made-up sample data marked "Example", in
 * "How it works" and the empty matches page (ExampleMatch).
 */

const RATINGS: { id: Rating; label: TogetherKey }[] = [{ id: 'great', label: 'matches.rate_great' }, { id: 'ok', label: 'matches.rate_ok' }, { id: 'not_good', label: 'matches.rate_not_good' }]
const REASONS: { id: ReportReason; label: TogetherKey }[] = [
  { id: 'no_show', label: 'matches.report_no_show' },
  { id: 'uncomfortable', label: 'matches.report_uncomfortable' },
  { id: 'unsafe', label: 'matches.report_unsafe' },
  { id: 'other', label: 'matches.report_other' },
]
// Plain words, as in the match notice (01462; Keith 2026-10-27: "too euphemistic").
const DO: Record<string, TogetherKey> = { bike: 'do.bike', walk: 'do.walk', transit: 'do.transit', micro: 'do.micro' }
function shortLine(m: Match, t: T<TogetherKey>): string {
  if (m.kind === 'practice') return m.my_kind === 'guide' ? t('matches.short_practice_guide') : t('matches.short_practice_learner')
  if (m.my_kind === 'carpool') return t('matches.short_carpool')
  const key = DO[m.other.shared_modes?.[0] ?? (m.my_kind === 'guide' ? m.other.modes[0] : '') ?? '']
  const way = key ? t(key) : null
  if (m.my_kind === 'newcomer') return way ? t('matches.short_newcomer', { way }) : t('matches.short_newcomer_any')
  return way ? t('matches.short_guide', { way }) : t('matches.short_guide_any')
}
const MOSTLY: Record<string, TogetherKey> = {
  walk: 'matches.mostly_walk', bike: 'matches.mostly_bike', transit: 'matches.mostly_transit', micro: 'matches.mostly_micro', drive: 'matches.mostly_drive',
}
const ROLE: Record<string, TogetherKey> = { driver: 'matches.role_driver', rider: 'matches.role_rider', either: 'matches.role_either' }

/** Your number for this one match, so they can text you on the day (01502). Optional. */
function MyPhone({ m, name, t }: { m: Match; name: string; t: T<TogetherKey> }) {
  const [mine, setMine] = useState<string | null>(m.my_phone ?? null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  async function save(value: string) {
    setSaving(true)
    setProblem(null)
    const r = await setMatchPhone(m.id, value)
    setSaving(false)
    if (!r.ok) return setProblem(r.reason === 'bad_phone' ? t('phone.bad') : t('phone.failed'))
    setMine(r.phone ?? null)
    setOpen(false)
    track(r.phone ? 'together_phone_added' : 'together_phone_removed', { kind: m.kind })
  }

  if (!open) {
    return mine ? (
      <p className="text-[15px] text-(--ev-ink-80)">
        {t('phone.yours', { name, phone: phoneLabel(mine) })}{' '}
        <button type="button" className="font-semibold underline" onClick={() => { setDraft(phoneLabel(mine)); setOpen(true) }}>{t('change')}</button>
      </p>
    ) : (
      <button type="button" className="w-fit text-left text-[15px] font-semibold underline" onClick={() => setOpen(true)}>
        {t('phone.add', { name })}
      </button>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-2">
      <Input type="tel" autoComplete="tel" inputMode="tel" maxLength={20} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        placeholder="(617) 555-0123" aria-label={t('phone.aria', { name })} />
      <p className="text-[15px] text-(--ev-ink-80)">{t('phone.hint', { name })}</p>
      {problem ? <p role="alert" className="text-[15px] font-semibold text-(--ev-danger)">{problem}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" busy={saving} disabled={!draft.trim()} onClick={() => save(draft)}>{t('phone.save')}</Button>
        {mine
          ? <Button disabled={saving} onClick={() => save('')}>{t('phone.remove')}</Button>
          : <Button disabled={saving} onClick={() => setOpen(false)}>{t('cancel')}</Button>}
      </div>
    </div>
  )
}

export function MatchCard({ m, locale, t, busy, myArrive, onAnswer, onWent, onRate, onEnd, onReport }: {
  m: Match
  locale: SiteLocale
  t: T<TogetherKey>
  busy: boolean
  myArrive: string | null
  onAnswer: (yes: boolean) => void
  onWent: () => void
  onRate: (rating: Rating, comment: string) => void
  onEnd: () => void
  onReport: (reason: ReportReason, details: string) => void
}) {
  const [rating, setRating] = useState<Rating | null>(null)
  const [comment, setComment] = useState('')
  const [wrongOpen, setWrongOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [confirmEnd, setConfirmEnd] = useState(false)
  // Read once when the card mounts: "Did you go together?" waits a day after connecting.
  const [now] = useState(() => Date.now())

  const name = m.other.first_name || t('matches.someone')
  const connected = m.status === 'connected' || m.status === 'went_together'
  const fullName = connected && m.other.last_initial ? `${name} ${m.other.last_initial}.` : name
  const askWent = m.status === 'connected' && !!m.connected_at && now - new Date(m.connected_at).getTime() > 24 * 3600_000
  const carpool = m.my_kind === 'carpool'
  const practice = m.kind === 'practice' ? m.practice ?? null : null
  const eyebrow = m.status === 'went_together' ? t('matches.went') : connected ? t('matches.both_yes') : shortLine(m, t)
  const overall = m.status === 'proposed' ? overallFit(m, myArrive) : null
  const since = m.other.member_since ? siteDate(locale, m.other.member_since, { month: 'short', year: 'numeric' }) : null
  const timing = timingFit(m, myArrive)
  const gap = carpool ? arriveGap(myArrive, m.other.arrive_by) : null
  const detour = carpool && m.detour_minutes != null ? Math.max(1, Math.round(m.detour_minutes)) : null
  const far = m.home_miles != null && m.dest_miles != null ? Math.max(m.home_miles, m.dest_miles) : null
  const farText = far == null ? null : t('matches.within', { miles: Math.max(0.1, Math.round(far * 10) / 10) })
  const coworkers = m.other.shared_groups.some((g) => g.type === 'workplace')
  const groups = connected && m.other.group_name && !m.other.shared_groups.some((g) => g.name === m.other.group_name)
    ? [{ name: m.other.group_name, type: 'workplace' as const }, ...m.other.shared_groups]
    : m.other.shared_groups
  const Primary = m.other.primary_mode ? WAY_ICON[m.other.primary_mode] : null
  // What they speak, the ones you share first (01476): context, not a rule.
  // Left off when you both speak only English, where it says nothing new.
  const shared = m.other.shared_languages ?? []
  const theirs = m.other.languages ?? []
  const onlyEnglish = theirs.length === 1 && theirs[0] === 'en' && shared.includes('en')
  const speaks = onlyEnglish ? '' : [...shared, ...theirs.filter((l) => !shared.includes(l))]
    .map((l) => (l in LANGUAGE_KEY ? t(LANGUAGE_KEY[l as keyof typeof LANGUAGE_KEY]) : l)).join(t('list.sep'))
  const timingValue = gap != null
    ? (gap === 0 ? t('matches.same_time') : t('matches.apart', { n: gap }))
    : timing != null && timing > 1 && !timingDaysKnown(m) && m.other.shared_times.length
      ? TIMES.filter((x) => m.other.shared_times.includes(x.id)).map((x) => t(TIME_KEY[x.id])).join(t('list.sep'))
      : timing === 3 ? t('matches.same_days') : timing === 2 ? t('matches.some_days') : t('matches.different')

  return (
    <Card as="li" className={cx('grid grid-cols-1 gap-5', connected && 'outline-2 outline-(--ev-accent)')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[15px] font-bold text-(--ev-accent)">{eyebrow}</span>
        {overall ? (
          <span className={cx(
            'rounded-full px-3 py-1 text-[14px] font-bold',
            overall === 3 ? 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)' : overall === 2 ? 'bg-(--ev-accent-tint-15) text-(--ev-ink)' : 'bg-(--ev-panel) text-(--ev-ink-80)',
          )}>
            {overall === 3 ? t('matches.fit_great') : overall === 2 ? t('matches.fit_good') : t('matches.fit_possible')}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <Avatar name={name} url={m.other.avatar_url} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[22px] font-bold leading-tight">{fullName}</h2>
            {m.other.status_name ? <span className="rounded-full bg-(--ev-panel) px-2.5 py-0.5 text-[13px] font-bold">{m.other.status_name}</span> : null}
          </div>
          {Primary && m.other.primary_mode ? (
            <p className="mt-1 flex items-center gap-1.5 text-[15px] text-(--ev-ink-85)">
              <Primary className="h-4 w-4" aria-hidden /> {t(MOSTLY[m.other.primary_mode])}
            </p>
          ) : null}
          {since ? <p className="text-[15px] text-(--ev-ink-80)">{t('matches.member_since', { date: since })}</p> : null}
          {speaks ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[15px] text-(--ev-ink-85)">
              <Languages className="h-4 w-4" aria-hidden /> {t('matches.speaks', { list: speaks })}
            </p>
          ) : null}
        </div>
      </div>

      {groups.length ? (
        <div className="flex flex-wrap gap-2">
          {groups.slice(0, 3).map((g) => {
            const GI = g.type === 'workplace' ? Briefcase : g.type === 'school' ? GraduationCap : House
            return (
              <span key={`${g.type}:${g.name}`} className="inline-flex items-center gap-1.5 rounded-full bg-(--ev-panel) px-3 py-1 text-[14px] font-semibold">
                <GI className="h-4 w-4 text-(--ev-accent)" aria-hidden /> {g.name}
              </span>
            )
          })}
        </div>
      ) : null}

      {practice ? (
        <div className="grid grid-cols-1 gap-2 rounded-xl bg-(--ev-panel) px-4 py-3 text-[16px]">
          <p className="flex items-center gap-2">
            <MapPin className="h-[18px] w-[18px] shrink-0 text-(--ev-accent)" aria-hidden />
            {practice.near_home || !practice.trail
              ? (m.my_kind === 'guide' ? t('matches.near_their_home') : t('matches.near_your_home'))
              : t('matches.practice_at', { trail: practice.trail, point: practice.point })}
            {m.my_kind === 'guide' && m.home_miles != null ? t('matches.from_you', { miles: Math.max(0.1, Math.round(m.home_miles * 10) / 10) }) : ''}
          </p>
          {practice.slots.length ? (
            <p className="flex items-center gap-2">
              <CalendarDays className="h-[18px] w-[18px] shrink-0 text-(--ev-accent)" aria-hidden />
              {practice.slots.map((x) => (isSlot(x) ? t(SLOT_KEY[x]) : x)).join(t('list.sep'))}
            </p>
          ) : null}
        </div>
      ) : null}

      {!practice && (m.status === 'proposed' || (carpool && connected)) ? (
        <div className="grid grid-cols-1 gap-1 rounded-xl bg-(--ev-panel) px-4 py-3">
          {m.status === 'proposed' && timing != null ? (
            <FitMeter icon={<Clock className="h-[18px] w-[18px]" />} label={t('matches.timing')} level={timing} value={timingValue} />
          ) : null}
          {m.status === 'proposed' && (detour != null || farText) ? (
            <FitMeter
              icon={<Route className="h-[18px] w-[18px]" />}
              label={detour != null ? t('matches.detour') : t('matches.route')}
              level={routeFit(m)}
              value={detour != null ? t(m.i_drive ? 'matches.detour_you' : 'matches.detour_them', { n: detour }) : farText!}
            />
          ) : null}
          {m.my_kind === 'newcomer' && m.other.trips_60d != null ? (
            <FitMeter
              icon={<Medal className="h-[18px] w-[18px]" />}
              label={t('matches.experience')}
              level={experienceFit(m)}
              value={t(m.other.trips_60d === 1 ? 'matches.trip' : 'matches.trips', { n: m.other.trips_60d })}
            />
          ) : null}
          {m.my_kind === 'guide' && m.other.modes.length ? (
            <ChipRow icon={<Sprout className="h-[18px] w-[18px]" />} label={t('matches.wants')}>
              {m.other.modes.map((w) => {
                const WI = WAY_ICON[w]
                return (
                  <span key={w} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-semibold">
                    <WI className="h-4 w-4" aria-hidden /> {w in WAY_KEY ? t(WAY_KEY[w as PartnerWay]) : w}
                  </span>
                )
              })}
            </ChipRow>
          ) : null}
          {carpool ? (
            <ChipRow icon={<Car className="h-[18px] w-[18px]" />} label={t('matches.role')}>
              {m.other.carpool_role ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-semibold">
                  <Car className="h-4 w-4" aria-hidden /> {t(ROLE[m.other.carpool_role])}
                </span>
              ) : null}
              {m.other.arrive_by ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[14px] font-semibold">
                  <Clock className="h-4 w-4" aria-hidden /> {t('matches.arrives', { time: clock(m.other.arrive_by, locale) })}
                </span>
              ) : null}
            </ChipRow>
          ) : null}
        </div>
      ) : null}

      {m.status === 'proposed' && !m.my_answer ? (
        <div className="grid grid-cols-1 gap-2">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" busy={busy} onClick={() => onAnswer(true)}>{t('matches.yes')}</Button>
            <Button disabled={busy} onClick={() => onAnswer(false)}>{t('matches.no')}</Button>
          </div>
          <p className="text-[15px] text-(--ev-ink-80)">{t('matches.yes_hint', { name })}</p>
        </div>
      ) : null}
      {m.status === 'proposed' && m.my_answer === 'yes' ? (
        <p className="text-[16px] font-semibold">{t('matches.waiting', { name })}</p>
      ) : null}

      {connected && m.other.email ? (
        <div className="grid grid-cols-1 gap-3">
          <p className="text-[16px] font-semibold">
            {m.status === 'went_together'
              ? (carpool ? t('matches.next_went_carpool') : practice ? t('matches.next_went_practice') : t('matches.next_went'))
              : (carpool ? t('matches.next_carpool', { name }) : practice ? t('matches.next_practice', { name }) : t('matches.next', { name }))}
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href={`mailto:${m.other.email}?subject=${encodeURIComponent(carpool ? t('matches.subject_carpool') : practice ? t('matches.subject_practice') : t('matches.subject'))}`}
              onClick={() => track('together_email_tapped', { kind: m.kind })}
              className={cx(
                'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold',
                m.status === 'went_together' ? 'border border-(--ev-line-strong) bg-white' : 'bg-(--ev-accent-fill) text-(--ev-on-accent-fill)',
              )}
            >
              <Mail className="h-4 w-4" aria-hidden /> {t('matches.email', { name })}
            </a>
            {!carpool && m.status === 'connected' ? (
              <Link
                href={withLang('/trip', locale)}
                onClick={() => track('together_plan_opened', { source: 'match' })}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold"
              >
                <Route className="h-4 w-4" aria-hidden /> {t('matches.plan')}
              </Link>
            ) : null}
          </div>
          <p className="select-all break-all text-[15px] text-(--ev-ink-85)">{m.other.email}</p>
          {/* Trip-day texts: only if they added a number (01502). */}
          {m.other.phone ? (
            <a
              href={`sms:${m.other.phone}`}
              onClick={() => track('together_text_tapped', { kind: m.kind })}
              className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-[10px] border border-(--ev-line-strong) bg-white px-4 text-[15px] font-semibold"
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> {t('matches.text', { name, phone: phoneLabel(m.other.phone) })}
            </a>
          ) : null}
          <MyPhone m={m} name={name} t={t} />
          {m.status === 'connected' ? (
            <p className="text-[15px] text-(--ev-ink-80)">
              {carpool
                ? (coworkers ? t('matches.safety_coworkers') : t('matches.safety_carpool'))
                : t('matches.safety')}
            </p>
          ) : null}
          {/* Insurance and gas, as the app's match card says (partners.matches.carpool_costs). */}
          {carpool && connected ? <p className="text-[15px] text-(--ev-ink-80)">{t('matches.carpool_costs')}</p> : null}

          {askWent ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
              <p className="text-[16px] font-bold">{t('matches.went_q')}</p>
              <div><Button busy={busy} onClick={onWent}>{t('matches.went_yes')}</Button></div>
            </div>
          ) : null}

          {m.status === 'went_together' && !m.my_rating ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
              <p className="text-[16px] font-bold">{t('matches.rate_q', { name })}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('matches.rate_q', { name })}>
                {RATINGS.map((r) => <Chip key={r.id} role="radio" aria-checked={rating === r.id} on={rating === r.id} onClick={() => setRating(r.id)}>{t(r.label)}</Chip>)}
              </div>
              <Textarea rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('matches.rate_placeholder')} aria-label={t('matches.rate_aria')} />
              <p className="text-[15px] text-(--ev-ink-80)">{t('matches.rate_private', { name })}</p>
              <div><Button variant="primary" busy={busy} disabled={!rating} onClick={() => rating && onRate(rating, comment)}>{t('matches.send')}</Button></div>
            </div>
          ) : m.status === 'went_together' ? (
            <p className="text-[15px] font-semibold">{t('matches.went_done')}</p>
          ) : null}

          {!wrongOpen ? (
            <button type="button" onClick={() => setWrongOpen(true)} className="min-h-[44px] justify-self-start text-[15px] font-semibold text-(--ev-ink-80) underline">
              {t('matches.wrong')}
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-(--ev-line) p-4">
              <p className="text-[16px] font-bold">{t('matches.wrong')}</p>
              {m.status === 'connected' ? (
                confirmEnd ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[15px]">{t('matches.end_confirm', { name })}</span>
                    <Button size="sm" busy={busy} onClick={onEnd}>{t('matches.end_yes')}</Button>
                  </div>
                ) : (
                  <div><Button size="sm" onClick={() => setConfirmEnd(true)}>{t('matches.end')}</Button></div>
                )
              ) : null}
              <p className="text-[15px] font-bold">{t('matches.report_q')}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('matches.report_aria')}>
                {REASONS.map((r) => <Chip key={r.id} role="radio" aria-checked={reason === r.id} on={reason === r.id} onClick={() => setReason(r.id)}>{t(r.label)}</Chip>)}
              </div>
              <Textarea rows={2} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder={t('matches.report_placeholder')} aria-label={t('matches.report_aria')} />
              <p className="text-[15px] text-(--ev-ink-80)">{t('matches.report_hint', { name })}</p>
              <div className="flex flex-wrap gap-3">
                <Button busy={busy} disabled={!reason} onClick={() => reason && onReport(reason, details)}>{t('matches.report_send')}</Button>
                <Button variant="ghost" onClick={() => setWrongOpen(false)}>{t('cancel')}</Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </Card>
  )
}
