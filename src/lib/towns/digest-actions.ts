import type { TownCivicEvent } from '@/lib/towns/queries'

/**
 * What the town email's top card tells a resident to do (Keith 2026-11-15).
 *
 * Somerville's Nov 15 email led with a street pop-up and said three things
 * that weren't true of it: the chip called it a "public meeting", a bullet
 * said "Join the public meeting online, registration takes a minute" (the
 * link was a news post about an open house two weeks earlier), and a big
 * button said "Attend the pop-up event" for something you just walk up to.
 * The card was built from whichever fields a record had; nothing asked what
 * each one was.
 *
 * The rules here:
 *  - the event is called what its own title calls it;
 *  - a line says "online" only when the link is a place to join or sign up;
 *  - a link that names another day is left out;
 *  - the button appears only when tapping it does the thing (register, take
 *    the survey, sign, apply). An event you just show up to gets none: the
 *    calendar links under the card are its action;
 *  - a survey open for the same project is offered to people who can't come.
 *
 * No imports at run time, so `node --test` can load it.
 */

/** Form services, where a page saying "closed" is about the form itself. Keep
 *  in step with FORM_HOST in Shift supabase/functions/_shared/civic-staging.ts. */
export const FORM_HOST =
  /(^|\.)(jotform\.com|surveymonkey\.com|forms\.gle|forms\.office\.com|forms\.cloud\.microsoft|typeform\.com|alchemer\.com|surveygizmo\.com|qualtrics\.com|formstack\.com|cognitoforms\.com|wufoo\.com|smartsheet\.com|survey123\.arcgis\.com|polco\.us|zoho\.com)$/i

export function isFormPage(url: string): boolean {
  try {
    const u = new URL(url)
    return FORM_HOST.test(u.hostname) || (u.hostname === 'docs.google.com' && u.pathname.startsWith('/forms'))
  } catch {
    return false
  }
}

/** Where people join or sign up for a meeting. */
const JOIN_HOST =
  /(^|\.)(zoom\.us|zoomgov\.com|teams\.microsoft\.com|teams\.live\.com|webex\.com|gotomeeting\.com|gotowebinar\.com|goto\.com|meet\.google\.com|eventbrite\.com|bluejeans\.com)$/i

/** What a link is: a place to join or sign up, a form to fill in, a file, or just a page to read. */
export type LinkKind = 'join' | 'form' | 'file' | 'page'

export function linkKind(url: string): LinkKind {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return 'page'
  }
  const path = u.pathname.toLowerCase()
  if (JOIN_HOST.test(u.hostname) || /\/(register|registration|rsvp|webinar|join)(\/|$|[-_.])/.test(path)) return 'join'
  if (isFormPage(url) || /\/(surveys?|forms?|questionnaire)(\/|$|[-_.])/.test(path)) return 'form'
  if (/\.(pdf|docx?|xlsx?|pptx?)$/.test(path)) return 'file'
  return 'page'
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/**
 * The day a link's own address names ("…-open-house-november-4",
 * "/events/2026/11/04/…"), as "MM-DD", or null when it names none.
 */
export function dayInUrl(url: string): string | null {
  let path: string
  try {
    path = decodeURIComponent(new URL(url).pathname).toLowerCase()
  } catch {
    return null
  }
  const pad = (n: string | number) => String(n).padStart(2, '0')
  const numeric = path.match(/(?:^|\D)20\d\d[/-](\d{1,2})[/-](\d{1,2})(?!\d)/)
  if (numeric && +numeric[1] >= 1 && +numeric[1] <= 12 && +numeric[2] >= 1 && +numeric[2] <= 31) {
    return `${pad(numeric[1])}-${pad(numeric[2])}`
  }
  const named = path.match(
    /(?:^|[^a-z])(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)[-_ .]?(\d{1,2})(?:st|nd|rd|th)?(?![\da-z])/,
  )
  if (named && +named[2] >= 1 && +named[2] <= 31) {
    const m = MONTHS.findIndex((name) => name.startsWith(named[1].slice(0, 3)))
    if (m >= 0) return `${pad(m + 1)}-${pad(named[2])}`
  }
  return null
}

/**
 * The link residents tap, or null when the record's link is about another
 * day than the meeting it's attached to (the Nov 18 pop-up carried a news
 * post titled "…open house November 4"). Items with no meeting date keep
 * their link: a survey's page can name the day it opened.
 */
export function usableLink(item: Pick<TownCivicEvent, 'virtual_link' | 'hearing_date'>): string | null {
  const url = item.virtual_link
  if (!url) return null
  const day = dayInUrl(url)
  if (day && item.hearing_date && day !== item.hearing_date.slice(5)) return null
  return url
}

const NOUNS: Array<[RegExp, string]> = [
  [/\bhearing\b/, 'public hearing'],
  [/\bpop[- ]?up\b/, 'pop-up'],
  [/open house/, 'open house'],
  [/office hours?\b/, 'office hour'],
  [/listening session/, 'listening session'],
  [/\bworkshop\b/, 'workshop'],
  [/information session/, 'information session'],
  [/\bwebinar\b/, 'webinar'],
  [/\bvolunteer\b/, 'volunteer opportunity'],
]

/**
 * The organizer's own word for the event. The title decides; the summary is
 * read only when the title names no kind of event (a pop-up's summary can
 * mention the open house that came before it). Keith 07-14: "we refer to the
 * meeting as a 'hearing,' but the hosts themselves do not."
 */
export function eventNoun(item: Pick<TownCivicEvent, 'title' | 'description'>): string {
  const title = item.title.toLowerCase()
  for (const [re, noun] of NOUNS) if (re.test(title)) return noun
  if (/\bmeeting\b/.test(title)) return 'public meeting'
  const text = (item.description ?? '').toLowerCase()
  for (const [re, noun] of NOUNS) if (re.test(text)) return noun
  return 'public meeting'
}

/** Events people walk up to: nothing to register for. */
const DROP_IN = new Set(['pop-up', 'open house', 'office hour'])

const GENERIC = new Set([
  'project', 'projects', 'open', 'house', 'meeting', 'public', 'hearing', 'virtual', 'community',
  'design', 'designs', 'updated', 'update', 'reconstruction', 'redesign', 'improvement', 'improvements',
  'street', 'square', 'avenue', 'road', 'safety', 'plan', 'session', 'workshop', 'online', 'person',
  'city', 'town', 'with', 'from', 'about', 'into', 'your', 'survey', 'feedback', 'streets',
])

/** The words that say which project a record is about ("broadway", "magoun"). */
export function nameWords(item: Pick<TownCivicEvent, 'title' | 'digest_headline' | 'community_name'>, townNames: string[]): Set<string> {
  const towns = new Set(townNames.map((t) => t.toLowerCase()))
  const text = `${item.community_name ?? ''} ${item.digest_headline ?? ''} ${item.title}`.toLowerCase()
  return new Set(text.split(/[^a-z]+/).filter((w) => w.length >= 4 && !GENERIC.has(w) && !towns.has(w)))
}

/** Two records about one project: their names share two distinctive words. */
export function sameProject(a: TownCivicEvent, b: TownCivicEvent, townNames: string[]): boolean {
  const wa = nameWords(a, townNames)
  let shared = 0
  for (const w of nameWords(b, townNames)) if (wa.has(w)) shared++
  return shared >= 2
}

/** "Fri, Dec 4" from "2026-12-04". */
function shortDate(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function weekday(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
}

function clock(hhmm: string | null): { text: string; pm: boolean } | null {
  const m = hhmm?.match(/^(\d{2}):(\d{2})/)
  if (!m) return null
  const h = Number(m[1])
  return { text: `${h % 12 === 0 ? 12 : h % 12}:${m[2]}`, pm: h >= 12 }
}

/** "4:30 PM", or "4:30–6:00 PM" when the record has an end time. */
export function timeRange(start: string | null, end: string | null): string | null {
  const s = clock(start)
  if (!s) return null
  const e = clock(end)
  const half = (c: { pm: boolean }) => (c.pm ? 'PM' : 'AM')
  if (!e || (e.text === s.text && e.pm === s.pm)) return `${s.text} ${half(s)}`
  return s.pm === e.pm ? `${s.text}–${e.text} ${half(e)}` : `${s.text} ${half(s)}–${e.text} ${half(e)}`
}

function host(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/** One "How to weigh in" line: plain text around at most one link. The email escapes it. */
export interface ActionLine {
  before?: string
  link?: { href: string; text: string; tag: string; mailto?: boolean }
  after?: string
}

export interface FeaturedPlan {
  noun: string
  lines: ActionLine[]
  /** The big button, or null when there is nothing to tap through to. */
  button: { href: string; label: string } | null
  /** A survey or comment form open for the same project, offered on the card. */
  alsoOnline: TownCivicEvent | null
  /** What was changed or left out, for the send log. */
  notes: string[]
}

export function featuredPlan(opts: {
  item: TownCivicEvent
  /** Every published item for the town, sent or not: where a matching survey is found. */
  related?: TownCivicEvent[]
  todayIso: string
  townNames: string[]
  volunteer: boolean
  recruit: boolean
  petition: boolean
}): FeaturedPlan {
  const { item, related = [], todayIso, townNames, volunteer, recruit, petition } = opts
  const noun = eventNoun(item)
  const notes: string[] = []
  const link = usableLink(item)
  if (item.virtual_link && !link) notes.push(`left out a link about another day: ${item.virtual_link}`)
  const kind = link ? linkKind(link) : null
  const meeting = !!item.hearing_date
  const online = item.hearing_type === 'virtual' || item.hearing_type === 'hybrid'
  const survey = /\bsurvey\b/i.test(`${item.title} ${link ?? ''}`)
  const lines: ActionLine[] = []
  let button: FeaturedPlan['button'] = null

  if (link) {
    if (volunteer) {
      lines.push({ link: { href: link, text: item.action_label ?? 'Sign up online', tag: 'featured_register' }, after: ' — the application takes a few minutes' })
      button = { href: link, label: item.action_label ?? 'Sign up online' }
    } else if (recruit) {
      lines.push({ link: { href: link, text: 'Apply online', tag: 'featured_register' }, after: ' — the application takes a few minutes' })
      button = { href: link, label: item.action_label ?? 'Apply online' }
    } else if (petition) {
      lines.push({ link: { href: link, text: item.action_label ?? 'Sign the petition', tag: 'featured_register' }, after: ' — it takes a minute' })
      button = { href: link, label: item.action_label ?? 'Sign the petition' }
    } else if (!meeting) {
      // A comment window: the link is the survey or form itself.
      const text = survey ? 'Take the online survey' : kind === 'form' ? 'Fill out the feedback form' : 'Share your feedback online'
      lines.push({ link: { href: link, text, tag: 'featured_register' }, after: item.comment_deadline ? `, open through ${shortDate(item.comment_deadline)}` : '' })
      button = { href: link, label: item.action_label ?? (survey ? 'Take the survey' : 'Submit a comment') }
    } else if (kind === 'join') {
      const signUp = /regist|rsvp|eventbrite/i.test(link)
      lines.push({
        link: { href: link, text: `Join the ${item.hearing_type === 'virtual' ? 'virtual ' : ''}${noun} online`, tag: 'featured_register' },
        after: signUp ? ' — registration takes a minute' : '',
      })
      button = { href: link, label: item.action_label ?? (signUp ? `Register for the ${noun}` : `Join the ${noun}`) }
    } else if (online) {
      // Held online, but the link is a page or a file, not the meeting itself.
      // A file's host is a storage address, not a name anyone knows.
      const h = kind === 'page' ? host(link) : null
      lines.push({ link: { href: link, text: `Find the link to join online${h ? ` on ${h}` : ''}`, tag: 'featured_register' } })
      button = { href: link, label: 'See how to join' }
    }
    // In person with a link that is only a page: nothing to say about "online".
  } else if (meeting && online && item.source_url && !volunteer) {
    // Held online with no link stored (MassDOT's virtual hearings): the
    // notice is where the link to join is.
    const h = host(item.source_url)
    lines.push({ link: { href: item.source_url, text: `Find the link to join online${h ? ` on ${h}` : ''}`, tag: 'featured_notice' } })
    button = { href: item.source_url, label: 'See how to join' }
  }

  // In person, but the organizer asks people to sign up first.
  const signUpFirst = meeting && !button && /regist|rsvp|sign[- ]?up/i.test(item.action_label ?? '')
  if (signUpFirst && (link ?? item.source_url)) {
    button = { href: (link ?? item.source_url)!, label: item.action_label! }
  }

  if (meeting && item.hearing_type !== 'virtual' && !volunteer) {
    const time = timeRange(item.hearing_time, item.hearing_end_time)
    const place = item.hearing_location_name?.trim()
    const when = time ? `${weekday(item.hearing_date!)}${item.hearing_end_time ? ', ' : ' at '}${time}` : weekday(item.hearing_date!)
    const walkUp = DROP_IN.has(noun) && kind !== 'join' && !signUpFirst
    lines.push({ before: `In person${place ? `: ${place}` : ''}, ${when}.${walkUp ? ' Just show up.' : ''}` })
  }

  if (item.access_notes) lines.push({ before: item.access_notes })

  if (item.comment_deadline) {
    const by = shortDate(item.comment_deadline)
    if (volunteer && item.comment_email) {
      lines.push({ before: 'Email ', link: { href: item.comment_email, text: item.comment_email, tag: '', mailto: true }, after: ' to sign up' })
    } else if (item.comment_email) {
      lines.push({ before: `${meeting ? 'Can’t make it? ' : ''}Email comments to `, link: { href: item.comment_email, text: item.comment_email, tag: '', mailto: true }, after: ` by ${by}` })
    } else if (meeting || !link) {
      // A comment window with a link already said "open through …" on its own line.
      lines.push({ before: `Written comments are accepted through ${by}` })
    }
  }

  // A survey or comment form open for the same project, for people who can't come.
  let alsoOnline: TownCivicEvent | null = null
  if (meeting && !volunteer) {
    alsoOnline = related
      .filter((r) =>
        r.id !== item.id && !r.hearing_date && !!r.virtual_link &&
        !!r.comment_deadline && r.comment_deadline >= todayIso &&
        sameProject(item, r, townNames))
      .sort((a, b) => a.comment_deadline!.localeCompare(b.comment_deadline!))[0] ?? null
    if (alsoOnline) {
      const isSurvey = /\bsurvey\b/i.test(`${alsoOnline.title} ${alsoOnline.virtual_link}`)
      lines.push({
        before: 'Can’t make it? ',
        link: { href: alsoOnline.virtual_link!, text: isSurvey ? 'Take the online survey' : 'Send your comments online', tag: 'featured_survey' },
        after: `, open through ${shortDate(alsoOnline.comment_deadline!)}`,
      })
    }
  }

  const used = (url: string) => lines.some((l) => l.link?.href === url)
  const notice = item.source_url ?? link
  if (notice && !used(notice)) {
    const h = host(notice)
    lines.push({ link: { href: notice, text: `${petition ? 'Read the organizers’ case' : 'Read the full notice'}${h ? ` on ${h}` : ''}`, tag: 'featured_notice' } })
  }

  // No link of its own: a comment window still gets a button to the notice,
  // where the instructions are. A meeting you walk into gets none.
  if (!button && !meeting && item.source_url) {
    button = { href: item.source_url, label: item.action_label ?? (item.comment_deadline ? 'Submit a comment' : 'See the details') }
  }

  return { noun, lines, button, alsoOnline, notes }
}

/**
 * Why this item shouldn't lead or ride in an email as it stands, or null.
 * A record problem a page load can't see: an online-only meeting with no way
 * to join it.
 */
export function recordProblem(item: TownCivicEvent): string | null {
  if (item.hearing_date && item.hearing_type === 'virtual' && !usableLink(item) && !item.access_notes && !item.source_url) {
    return 'an online meeting with no link to join it'
  }
  return null
}
