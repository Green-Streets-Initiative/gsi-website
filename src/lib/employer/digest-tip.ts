import { employerNearbyUrl } from './office-links'
import { federalHolidayOn, longDay, type Observance } from './observances'

/**
 * "One thing to try this week" for the weekly employer report.
 *
 * Keith, 2026-09-28: only when it's a realistic, smart suggestion. So:
 * - A quiet week sends NO tip. Most weeks should be quiet.
 * - Tips are tied to a real moment (a Walk/Ride Day coming up) or to
 *   something the employer already has but hasn't been shown yet.
 * - Never a nudge to start a challenge. Customers plan those on their own
 *   timeline (Loomis: first challenge in November), and GSI raises them
 *   person to person, not from a robot email.
 * - Each tip has its own cooldown, the same tip never runs two weeks in a
 *   row, and there are at least two weeks between tips (a Walk/Ride Day
 *   reminder excepted). What was sent lives in groups.onboarding.digest_tips.
 * - No scolding ("you haven't..."). Say what's there and why it's useful.
 */

const DAY = 86_400_000

export type DigestTipMemory = {
  last_key?: string
  last_sent_at?: string
  shown?: Record<string, string>
}

export type DigestTip = { key: string; html: string }

export type TipInputs = {
  now: Date
  portalUrl: string
  group: {
    slug: string | null
    commute_advisor_enabled: boolean | null
    employer_benefits: {
      destination_address?: string | null
      destination_lat?: number | null
      destination_lng?: number | null
    } | null
  }
  memberCount: number
  headcount: number | null
  joinsLast28Days: number
  /** The next Walk/Ride Day that has prizes and a drawing set, if any. */
  nextWalkRideDay: { id: string; starts_at: string } | null
  /** A year-plan challenge drafted and waiting for an admin (Shift 01025). */
  readyDraft?: { id: string; title: string; starts_on: string } | null
  /**
   * An observance 14-21 days out that none of the employer's challenges
   * covers (observanceForTip, Shift 01029). Once per occurrence.
   */
  observance?: Observance | null
  /** How many locations the employer has saved (Shift 01021). */
  locationCount?: number
  memory: DigestTipMemory | null
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function daysSince(iso: string | undefined, now: Date): number {
  return iso ? (now.getTime() - new Date(iso).getTime()) / DAY : Infinity
}

function link(href: string, text: string): string {
  return `<a href="${href}" style="color:#2D6A4F;font-weight:600;">${text}</a>`
}

export function pickDigestTip(i: TipInputs): DigestTip | null {
  const shown = i.memory?.shown ?? {}
  const shareKit = `${i.portalUrl}/share-kit`
  const candidates: (() => DigestTip | null)[] = [
    // 0. A drafted year-plan challenge: once per draft.
    () => {
      const d = i.readyDraft
      if (!d) return null
      const key = `draft:${d.id}`
      if (shown[key]) return null
      const day = new Date(d.starts_on + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
      return {
        key,
        html: `Your ${escapeHtml(d.title)} challenge is drafted and ready to start ${escapeHtml(day)}. ${link(`${i.portalUrl}/challenges`, 'Review and launch it')}, or skip it this time.`,
      }
    },
    // 1. Walk/Ride Day in the next 4 to 17 days: once per Walk/Ride Day.
    () => {
      const w = i.nextWalkRideDay
      if (!w) return null
      const daysOut = (new Date(w.starts_at).getTime() - i.now.getTime()) / DAY
      if (daysOut < 4 || daysOut > 17) return null
      const key = `wrd:${w.id}`
      if (shown[key]) return null
      // starts_at is midnight Eastern; format in Eastern so it never slips a day
      const day = new Date(w.starts_at).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
      })
      return {
        key,
        html: `Walk/Ride Day is ${escapeHtml(day)}. The walks, bike rides and transit trips your team logs that day are entries in GSI's prize drawing. A good week to pass your join link to anyone who hasn't joined yet: ${link(shareKit, 'open your Share Kit')}.`,
      }
    },
    // 1b. An observance two to three weeks out: once per occurrence. Points
    //     to the Share Kit note, never to starting a challenge.
    () => {
      const o = i.observance
      if (!o) return null
      const key = `obs:${o.slug}:${o.on_date}`
      if (shown[key]) return null
      const holiday = federalHolidayOn(o.on_date)
      const when = holiday ? `${longDay(o.on_date)}, which is ${holiday} this year, so the days before it work well` : longDay(o.on_date)
      return {
        key,
        html: `${escapeHtml(o.name)} is ${escapeHtml(when)}. If you'd like to mark it, there's a ready-to-send note for your team in ${link(shareKit, 'your Share Kit')}, with a link to the day's own site.`,
      }
    },
    // 2. The branded Nearby page, once, when the office address is saved.
    () => {
      if (shown.nearby || !i.group.slug) return null
      if (!employerNearbyUrl(i.group.slug, i.group.employer_benefits)) return null
      return {
        key: 'nearby',
        html: (i.locationCount ?? 0) > 1
          ? `Each of your ${i.locationCount} locations now has its own Nearby page: a live map of T stops, bus arrivals, Bluebikes docks and bike paths around it, with your logo. Useful for new hires and welcome emails. There's a ready-to-send note for each in ${link(shareKit, 'your Share Kit')}.`
          : `Your office now has its own Nearby page: a live map of T stops, bus arrivals, Bluebikes docks and bike paths around it, with your logo. Useful for new hires and welcome emails. There's a ready-to-send note in ${link(shareKit, 'your Share Kit')}.`,
      }
    },
    // 3. The branded Commute Advisor, once.
    () => {
      if (shown.advisor || !i.group.slug || i.group.commute_advisor_enabled === false) return null
      return {
        key: 'advisor',
        html: `Your Commute Advisor page shows anyone their walking, biking and transit options to your office, no app needed. There's a ready-to-send note for staff in ${link(shareKit, 'your Share Kit')}.`,
      }
    },
    // 4. Share Kit, at most every six weeks, and only when the team is
    //    small next to the headcount the employer gave us and joins have
    //    been quiet for four weeks.
    () => {
      if (daysSince(shown.share_kit, i.now) < 42) return null
      if (!i.headcount || i.memberCount >= i.headcount * 0.25) return null
      if (i.joinsLast28Days > 0) return null
      return {
        key: 'share_kit',
        html: `New faces around the office this season? ${link(shareKit, 'Your Share Kit')} has a ready-made invite email, a QR poster and a printable flyer.`,
      }
    },
  ]

  for (const make of candidates) {
    const tip = make()
    if (!tip) continue
    const sinceLast = daysSince(i.memory?.last_sent_at, i.now)
    // Never the same tip two weeks running
    if (tip.key === i.memory?.last_key && sinceLast < 8) continue
    // Keep most weeks quiet: at least two weeks between tips, except a
    // Walk/Ride Day, which only makes sense in the days before it
    if (!tip.key.startsWith('wrd:') && !tip.key.startsWith('draft:') && sinceLast < 14) continue
    return tip
  }
  return null
}

export function rememberTip(memory: DigestTipMemory | null, tip: DigestTip, now: Date): DigestTipMemory {
  const at = now.toISOString()
  return { last_key: tip.key, last_sent_at: at, shown: { ...(memory?.shown ?? {}), [tip.key]: at } }
}

export function buildTipSection(tip: DigestTip | null): string {
  if (!tip) return ''
  return `<tr><td style="padding:0 32px 24px;">
        <div style="border:1px solid #D8E6DC;border-radius:10px;padding:16px 20px;">
          <div style="font-size:12px;font-weight:700;color:#2D6A4F;margin-bottom:6px;">One thing to try this week</div>
          <div style="font-size:14px;line-height:1.55;color:#191A2E;">${tip.html}</div>
        </div>
      </td></tr>`
}
