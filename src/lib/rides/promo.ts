/**
 * The Promote tab's channels: one short link per place an organizer posts,
 * so the console can say which posts brought people in.
 *
 * gogreenstreets.org/r/<code>/<channel> logs a visit (Shift 01415,
 * log_ride_link_visit) and lands on /rides/<code>?via=<channel>; an RSVP
 * from there is stamped with the channel by ride-guest-rsvp. Keep the slugs
 * in step with ride_link_visits.channel and PROMO_CHANNELS in the Shift repo.
 */
export type PromoChannel = 'ig' | 'fb' | 'wa' | 'strava' | 'nd' | 'reddit' | 'qr' | 'cal' | 'email'

export const PROMO_CHANNELS: { key: PromoChannel; label: string }[] = [
  { key: 'ig', label: 'Instagram' },
  { key: 'fb', label: 'Facebook' },
  { key: 'wa', label: 'Group chats' },
  { key: 'strava', label: 'Strava club' },
  { key: 'nd', label: 'Nextdoor' },
  { key: 'reddit', label: 'Reddit' },
  { key: 'email', label: 'Email and newsletters' },
  { key: 'cal', label: 'Event calendars' },
  { key: 'qr', label: 'Printed flyer (QR)' },
]

export const PROMO_LABEL = Object.fromEntries(PROMO_CHANNELS.map((c) => [c.key, c.label])) as Record<PromoChannel, string>

export function isPromoChannel(s: string | null | undefined): s is PromoChannel {
  return !!s && s in PROMO_LABEL
}

export const PROMO_BASE = 'https://www.gogreenstreets.org/r'

export function promoLink(code: string, channel: PromoChannel): string {
  return `${PROMO_BASE}/${code}/${channel}`
}
