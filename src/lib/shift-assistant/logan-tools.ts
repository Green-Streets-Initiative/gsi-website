import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { bostonInstant, clockText, dayText, normalizeFlight, type FlightInfo, type LoganTrip } from '@/lib/logan'

// Going to or from Logan with someone, in the Shift assistant (parity
// gap-logan, 2026-11-13). The app's assistant offers "I have a flight out of
// Logan" and the app has no Logan screen; gogreenstreets.org/logan does the
// sign-up. These tools do what that page does, as the person, with the same
// RPCs (Shift 01518, 01733, 01734) and the same flight look-up (edge function
// logan-flights, action lookup), so a match, the meeting spot and the
// flight watching on the day all work the same:
//
//   get_my_logan_trips    their sign-ups each way and their matches
//   look_up_flight        a flight number and date -> the time at Logan,
//                         the terminal, whether it's international
//   join_logan_trip       (approval card) sign up or change one direction
//   answer_logan_match    (approval card) yes or no to someone Shift suggested
//
// Running late, a phone number for the day, and stopping a trip stay on the
// page (the button under the reply opens it).

type Ctx = { user: SupabaseClient; userId: string; token: string }
type Link = { href: string; label: string; external?: boolean }
type Result = { content: Record<string, unknown>; isError?: boolean; link?: Link }
export type LoganCard = { title: string; lines: string[]; cta: string; tone: 'primary' }

const FUNCTIONS = `${(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')}/functions/v1`
const PAGE: Link = { href: 'https://www.gogreenstreets.org/logan?utm_source=assistant', label: 'Open your Logan trips', external: true }
const fail = (error: string): Result => ({ content: { error }, isError: true })
const nullable = (t: string, description?: string) => ({ type: [t, 'null'], ...(description ? { description } : {}) })

/** The agreement people accept, the same words as the Shift Together cards (tools.ts TOGETHER_TERMS). */
const TERMS = "I'm 18 or older. Green Streets introduces people but doesn't check or supervise them. If we meet, it's because we both agree to, in a public place, with bikes, cars and gear we get on our own. Getting around always carries some risk, and I'm responsible for my own safety."

const KIND_WORDS = { airport_out: 'Going to Logan', airport_back: 'Coming home from Logan' } as const
/** The page's own words for each way (site-strings/logan logan.way_*). */
const WAY_WORDS = { transit: 'The T or Logan Express', split: 'Share a taxi or ride app', either: 'The T, Logan Express, or a shared taxi or ride app' } as const
type Kind = keyof typeof KIND_WORDS
type Way = keyof typeof WAY_WORDS

/** The server's reasons, as /logan says them (lib/logan.ts REASON). */
const REASON: Record<string, string> = {
  bad_time: 'The flight has to be at least three hours from now and within six months.',
  bad_place: 'The place has to be in Massachusetts. Look it up with find_place.',
  has_match: 'They and their match both said yes, so this trip is set. If plans changed, they use "Can’t make it?" on the Logan page.',
  needs_terms: 'The agreement wasn’t saved. Try again.',
  under_18: 'Going to Logan with someone is for people 18 and older, and the birth date on their account says they are under 18. Tell them kindly; if the date is wrong, they can email info@gogreenstreets.org.',
  bad_flight: 'That doesn’t look like a flight number. It starts with the airline’s two-letter code, like B6 1234 or DL 456.',
}

export const LOGAN_ACTIVITY: Record<string, string> = {
  get_my_logan_trips: 'Checking your Logan trips',
  look_up_flight: 'Looking up the flight',
  join_logan_trip: 'Signing you up',
  answer_logan_match: 'Sending your answer',
}

export const LOGAN_NEEDS_APPROVAL = new Set(['join_logan_trip', 'answer_logan_match'])

export const LOGAN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_my_logan_trips',
    description: "Their sign-ups for going to or coming home from Logan Airport with someone (gogreenstreets.org/logan): each direction with the flight, the time, how they'd go, and the people Shift suggested or they agreed to go with (first name, town, where and when to meet, who has said yes, and whether a late flight moved the meeting). Call it before join_logan_trip or answer_logan_match, and for \"did anyone match my Logan trip?\".",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'look_up_flight',
    description: 'A flight at Logan by its number and date: when it leaves or lands at Logan as scheduled, the terminal, the other city, and whether it is international. The same look-up the Logan page makes. Use it to confirm a flight before signing someone up, or for "what terminal is my flight".',
    input_schema: {
      type: 'object',
      properties: {
        flight: { type: 'string', description: 'The flight number with the airline code: "B6 1234", "DL 456".' },
        date: { type: 'string', description: 'YYYY-MM-DD, the day it leaves (going) or lands (coming home), Boston time.' },
        kind: { type: 'string', enum: ['airport_out', 'airport_back'], description: 'airport_out: they fly out of Logan. airport_back: they land at Logan.' },
      },
      required: ['flight', 'date', 'kind'],
    },
  },
  {
    name: 'join_logan_trip',
    description: "Sign the person up to go to Logan, or home from it, with someone who lives near them and is at the airport when they are, as gogreenstreets.org/logan does. Shift works out where and when they meet (a T station near both going out, Logan coming home), suggests someone, and both say yes before either sees the other's email; on the day it watches the flight and moves the meeting if it's late. One sign-up per direction; signing up again changes it. Ask only for the date and the flight number (it fills in the time, terminal and whether it's international); only when they have no number or it can't be found, the time instead (and for coming home, the terminal). Leave the place empty for their Home. The way defaults to either, the group to 1 and the big bags to 1; ask only when they said something that changes them. The card shows the agreement they accept, and they approve it there.",
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['airport_out', 'airport_back'] },
        date: { type: 'string', description: 'YYYY-MM-DD, the day the flight leaves (going) or lands (coming home), Boston time.' },
        flight: nullable('string', 'The flight number, "B6 1234". Empty when they have none yet.'),
        time: nullable('string', 'HH:MM, 24-hour, Boston time, when it leaves or lands. Only when there is no flight number or it was not found.'),
        terminal: nullable('string', 'A, B, C or E: only for coming home without a flight number.'),
        international: { type: ['boolean', 'null'], description: 'Only without a flight number: true for an international flight.' },
        way: nullable('string', 'transit (the T or Logan Express, each pays their own fare), split (one taxi or ride-app car, splitting the fare), or either. Empty means either, which matches the most people.'),
        party: { type: ['number', 'null'], description: 'People in their group, 1 to 6. Empty means 1.' },
        bags: { type: ['number', 'null'], description: 'Big bags, 0 to 8, for a shared car. Empty means 1.' },
        place: { type: ['object', 'null'], properties: { name: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' } }, description: 'Where they leave from or go home to, from find_place, when it is not their Home. Their match sees only the town.' },
      },
      required: ['kind', 'date'],
    },
  },
  {
    name: 'answer_logan_match',
    description: 'Say yes or no to someone Shift suggested for a Logan trip (a match from get_my_logan_trips with status proposed, where their own answer is still empty). Once both say yes, each sees the other\'s email. The person approves on a card first.',
    input_schema: {
      type: 'object',
      properties: { match_id: { type: 'string' }, yes: { type: 'boolean' } },
      required: ['match_id', 'yes'],
    },
  },
]

async function myTrips(ctx: Ctx): Promise<{ terms: boolean; trips: LoganTrip[] } | null> {
  const { data, error } = await ctx.user.rpc('get_my_airport_trips')
  if (error) return null
  const d = (data ?? {}) as { terms?: boolean; trips?: LoganTrip[] }
  return { terms: !!d.terms, trips: d.trips ?? [] }
}

/** The flight look-up /logan makes (logan-flights, as the person). */
async function lookup(ctx: Ctx, flight: string, date: string, kind: Kind): Promise<FlightInfo> {
  try {
    const res = await fetch(`${FUNCTIONS}/logan-flights`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ctx.token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lookup', flight, date, kind }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    const data = await res.json().catch(() => null)
    return data && typeof data === 'object' && 'found' in data ? (data as FlightInfo) : { found: false, reason: 'unavailable' }
  } catch {
    return { found: false, reason: 'unavailable' }
  }
}

const when = (iso: string) => `${dayText(iso)} at ${clockText(iso)}`
const flightName = (f: Extract<FlightInfo, { found: true }>, kind: Kind) => {
  const num = f.number.split(' ')[1] ?? f.number
  const name = f.airline ? `${f.airline} ${num}` : f.number
  return f.city ? `${name} ${kind === 'airport_out' ? 'to' : 'from'} ${f.city}` : name
}

function matchFacts(m: LoganTrip['matches'][number]) {
  const meet = m.meet_place ?? m.meet_station
  return {
    match_id: m.id,
    status: m.status === 'proposed' ? 'suggested' : m.status === 'connected' ? 'both said yes' : 'went together',
    with: [m.other.first_name, m.other.last_initial ? `${m.other.last_initial}.` : null].filter(Boolean).join(' ') || 'someone',
    their_town: m.other.town,
    their_flight_at_logan: when(m.other.trip_at),
    meet: meet ? `${meet}, ${clockText(m.meet_at)}` : null,
    how: m.way === 'transit' ? 'the T or Logan Express together' : 'one taxi or ride-app car, splitting the fare',
    your_answer: m.my_answer,
    their_answer: m.their_answer,
    ...(m.status !== 'proposed' && m.other.email ? { their_email: m.other.email } : {}),
    ...(m.delay_state === 'moved' ? { late_flight: `A late flight moved the meeting from ${m.orig_meet_at ? clockText(m.orig_meet_at) : 'the first time'}.` } : {}),
    ...(m.delay_state === 'go_ahead' ? { late_flight: 'A flight is late enough that the other person was told to go ahead.' } : {}),
  }
}

export async function runLoganTool(ctx: Ctx, name: string, input: Record<string, unknown>): Promise<Result | null> {
  switch (name) {
    case 'get_my_logan_trips': {
      const r = await myTrips(ctx)
      if (!r) return fail('Their Logan trips are not answering right now.')
      const live = r.trips.filter((t) => t.status !== 'closed')
      if (!live.length) return { content: { trips: [], note: 'They have no Logan sign-up. Offer to sign them up (join_logan_trip): ask the date and the flight number.' } }
      return {
        content: {
          trips: live.map((t) => ({
            direction: KIND_WORDS[t.kind],
            flight: t.flight_label ?? t.flight,
            at_logan: when(t.trip_at),
            ...(t.terminal ? { terminal: t.terminal } : {}),
            how: WAY_WORDS[t.way],
            group: t.party_size,
            big_bags: t.big_bags,
            from_or_to: t.place_label,
            status: t.status === 'paused' ? 'paused' : t.matches.length ? 'has a match' : 'looking for someone',
            ...(t.flight_status ? { flight_today: `${t.flight_status}${t.flight_expected_at ? `, expected ${clockText(t.flight_expected_at)}` : ''}` } : {}),
            matches: t.matches.map(matchFacts),
          })),
          note: 'Say what stands in a sentence or two. A suggested match with no answer from them: offer answer_logan_match. Running late, a phone number for the day, or stopping a trip happen on the Logan page (the button).',
        },
        link: PAGE,
      }
    }
    case 'look_up_flight': {
      const kind = input.kind === 'airport_back' ? 'airport_back' : 'airport_out'
      const flight = normalizeFlight(String(input.flight ?? ''))
      const date = String(input.date ?? '')
      if (!flight) return fail(REASON.bad_flight)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Give the date as YYYY-MM-DD.')
      const f = await lookup(ctx, flight, date, kind)
      if (!f.found) {
        return { content: { found: false, why: f.reason === 'not_logan' ? `That flight doesn't ${kind === 'airport_out' ? 'leave from' : 'land at'} Logan that day.` : f.reason === 'not_found' ? 'No flight with that number that day.' : 'Flight times are not answering right now.', note: 'Ask them to check the number and date; to sign up anyway, the time it leaves or lands works too.' } }
      }
      return {
        content: {
          found: true, flight: flightName(f, kind),
          [kind === 'airport_out' ? 'leaves_logan' : 'lands_at_logan']: when(f.sched),
          ...(f.expected && f.expected !== f.sched ? { expected: when(f.expected) } : {}),
          terminal: f.terminal, international: f.international,
          credit: 'Flight data from AeroDataBox.',
        },
      }
    }
    default:
      return null
  }
}

type Card = { card: LoganCard; input: Record<string, unknown> } | { result: Result }

export async function loganCard(ctx: Ctx, name: string, input: Record<string, unknown>): Promise<Card> {
  if (name === 'answer_logan_match') {
    const id = String(input.match_id ?? '')
    const yes = input.yes !== false
    const r = await myTrips(ctx)
    const m = r?.trips.flatMap((t) => t.matches.map((x) => ({ t, x }))).find(({ x }) => x.id === id)
    if (!m) return { result: fail('No match with that id. Use a match_id from get_my_logan_trips.') }
    if (m.x.status !== 'proposed') return { result: fail('They already both said yes to this match.') }
    if (m.x.my_answer) return { result: fail(`They already said ${m.x.my_answer} to this match.`) }
    const f = matchFacts(m.x)
    return {
      card: {
        title: yes ? `Go with ${f.with}?` : `Say no to ${f.with}`,
        lines: [
          `${KIND_WORDS[m.t.kind]}, ${when(m.t.trip_at)}`,
          ...(f.meet ? [`Meet at ${f.meet}`] : []),
          `By ${f.how}`,
          yes ? "Once you both say yes, you each see the other's email" : 'Shift keeps looking for someone else',
        ],
        cta: yes ? 'Yes, go together' : 'No thanks', tone: 'primary',
      },
      input: { match_id: id, yes },
    }
  }

  // join_logan_trip
  const kind: Kind | null = input.kind === 'airport_out' || input.kind === 'airport_back' ? input.kind : null
  if (!kind) return { result: fail('kind is airport_out (flying out of Logan) or airport_back (landing at Logan).') }
  const date = String(input.date ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { result: fail('Give the date as YYYY-MM-DD.') }
  const rawFlight = typeof input.flight === 'string' ? input.flight.trim() : ''
  const flight = rawFlight ? normalizeFlight(rawFlight) : null
  if (rawFlight && !flight) return { result: fail(REASON.bad_flight) }
  const time = typeof input.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ? input.time : null

  const [found, current, placesQ, ackQ, versionQ] = await Promise.all([
    flight ? lookup(ctx, flight, date, kind) : Promise.resolve(null),
    myTrips(ctx),
    ctx.user.from('saved_locations').select('label, address_text, lat, lng').eq('user_id', ctx.userId).ilike('label', 'home').limit(1),
    ctx.user.from('commute_partner_acks').select('version').eq('user_id', ctx.userId),
    ctx.user.rpc('partner_terms_version'),
  ])

  let at: string | null
  let international: boolean
  let terminal: string | null
  let label: string | null = null
  if (found?.found) {
    at = found.sched
    international = found.international
    terminal = kind === 'airport_back' ? found.terminal ?? null : null
    label = flightName(found, kind)
  } else {
    if (!time) {
      const why = found && !found.found && found.reason === 'not_logan' ? `That flight doesn't ${kind === 'airport_out' ? 'leave from' : 'land at'} Logan on that day.` : flight ? "That flight couldn't be found for that day." : 'There is no flight number.'
      return { result: fail(`${why} Ask them to check the number and date, or the time it ${kind === 'airport_out' ? 'leaves' : 'lands'}${kind === 'airport_back' ? ' and the terminal' : ''}, then call again with time.`) }
    }
    at = bostonInstant(date, time)
    international = input.international === true
    terminal = kind === 'airport_back' && typeof input.terminal === 'string' && ['A', 'B', 'C', 'E'].includes(input.terminal.toUpperCase()) ? input.terminal.toUpperCase() : null
  }
  if (!at) return { result: fail('Give the time as HH:MM.') }
  const ms = new Date(at).getTime()
  if (ms < Date.now() + 3 * 3600_000 || ms > Date.now() + 180 * 86400_000) return { result: fail(REASON.bad_time) }

  const given = input.place as { name?: unknown; lat?: unknown; lng?: unknown } | null | undefined
  const home = ((placesQ.data ?? [])[0] as { address_text: string | null; lat: number | null; lng: number | null } | undefined)
  const place = given && typeof given.lat === 'number' && typeof given.lng === 'number'
    ? { name: typeof given.name === 'string' && given.name.trim() ? given.name.trim().slice(0, 160) : 'This place', lat: given.lat, lng: given.lng }
    : home?.lat != null && home?.lng != null ? { name: home.address_text ?? 'Home', lat: home.lat, lng: home.lng } : null
  if (!place) return { result: fail(`They have no Home saved. Ask where they ${kind === 'airport_out' ? 'leave from' : 'are going home to'} (a street or a town is enough), look it up with find_place, then call again with place.`) }

  const way: Way = input.way === 'transit' || input.way === 'split' ? input.way : 'either'
  const party = Math.min(6, Math.max(1, Math.round(Number(input.party) || 1)))
  const bags = way === 'transit' ? 0 : Math.min(8, Math.max(0, input.bags == null ? 1 : Math.round(Number(input.bags) || 0)))
  const version = typeof versionQ.data === 'string' ? versionQ.data : null
  const accepted = !!current?.terms || (!!version && ((ackQ.data ?? []) as { version: string }[]).some((a) => a.version === version))
  const existing = current?.trips.find((t) => t.kind === kind && t.status !== 'closed')
  if (existing?.matches.some((m) => m.status === 'connected')) return { result: fail(REASON.has_match) }

  return {
    card: {
      title: existing ? `Update: ${KIND_WORDS[kind].toLowerCase()}` : `${KIND_WORDS[kind]} with someone`,
      lines: [
        label ? `${label}, ${kind === 'airport_out' ? 'leaves' : 'lands'} ${when(at)}` : `${kind === 'airport_out' ? 'Flight leaves' : 'Flight lands'} ${when(at)}${flight ? ` (${flight})` : ''}`,
        ...(terminal ? [`Terminal ${terminal}`] : []),
        `${kind === 'airport_out' ? 'From' : 'To'} ${place.name} (your match sees only the town)`,
        WAY_WORDS[way],
        `${party === 1 ? '1 person' : `${party} people`}${way === 'transit' ? '' : `, ${bags === 1 ? '1 big bag' : `${bags} big bags`}`}`,
        "Shift finds someone near you at Logan when you are and works out where and when to meet. You both say yes before either of you sees the other's email",
        ...(flight ? ['On the day, Shift watches the flight and moves the meeting if it runs late'] : []),
        ...(accepted ? [] : [`By signing up you agree: ${TERMS}`]),
      ],
      cta: existing ? 'Save' : 'Sign me up', tone: 'primary',
    },
    input: {
      kind, trip_at: at, international, terminal, way, party, bags,
      lat: place.lat, lng: place.lng, label: place.name,
      flight, flight_label: flight ? label : null,
      accept_version: accepted ? null : version,
    },
  }
}

export async function runApprovedLogan(ctx: Ctx, name: string, input: Record<string, unknown>): Promise<Result> {
  if (name === 'answer_logan_match') {
    const { data, error } = await ctx.user.rpc('respond_partner_match', { p_match_id: String(input.match_id), p_yes: input.yes === true })
    if (error || !(data as { ok?: boolean } | null)?.ok) return fail("That answer didn't go through. Try again in a moment, or use the Logan page.")
    return {
      content: {
        saved: true,
        note: input.yes === true
          ? "Sent. Say in a sentence that once the other person says yes too, they each get the other's email, and Shift emails them both."
          : 'Sent. Say in a sentence that Shift keeps looking for someone else.',
      },
      link: PAGE,
    }
  }
  const sorry = "That didn't save. Try again in a moment, or use the Logan page."
  if (input.accept_version) {
    const { data, error } = await ctx.user.rpc('accept_partner_terms', { p_version: String(input.accept_version) })
    if (error || !(data as { ok?: boolean } | null)?.ok) return fail(sorry)
  }
  const { data, error } = await ctx.user.rpc('set_airport_trip', {
    p_kind: input.kind,
    p_trip_at: input.trip_at,
    p_international: input.international === true,
    p_terminal: input.kind === 'airport_back' ? input.terminal ?? null : null,
    p_way: input.way,
    p_party: input.party,
    p_bags: input.bags,
    p_lat: input.lat,
    p_lng: input.lng,
    p_label: input.label,
    p_flight: input.flight ?? null,
    p_flight_label: input.flight ? input.flight_label ?? null : null,
  })
  const r = (data ?? null) as { ok?: boolean; reason?: string; matches?: number } | null
  if (error || !r) return fail(sorry)
  if (!r.ok) return fail(REASON[r.reason ?? ''] ?? sorry)
  const found = (r.matches ?? 0) > 0
  return {
    content: {
      saved: true, matches_now: r.matches ?? 0,
      note: found
        ? "Signed up, and Shift already found someone. Say so in a sentence; get_my_logan_trips has who, and answer_logan_match says yes for them once they decide. Shift emails them too."
        : 'Signed up. Say in a sentence that Shift emails them when it finds someone near them at Logan then; nobody yet. Offer the same for the other direction if it fits.',
    },
    link: PAGE,
  }
}
