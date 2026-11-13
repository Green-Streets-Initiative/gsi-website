import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchRepairPlaces, nearbyRepair, REPAIR_RADIUS_MILES } from '@/lib/nearby/repair'
import { repairStatus } from '@/lib/nearby/repair-status'
import { repairStatusLine } from '@/lib/nearby/repair-format'
import { t as nearbyT } from '@/lib/nearby/i18n'
import { departuresNear } from '@/lib/shift-assistant/more-data'

// Three look-ups the app shows and the assistant couldn't (parity
// gap-assistant-missing-tools, 2026-11-13), each borrowing the code the
// app or website already runs:
//
//   find_repair           community repair co-ops near a place, open now or
//                         when they open next: the rows Around You and /nearby
//                         read (town_resources bike_repair), with the same
//                         "Open until 6 PM" line (lib/nearby/repair-format)
//   find_guides           Shift's how-to guides (content_items micro_guide),
//   get_guide             the guide library the app and /guides show; the
//                         button opens the guide in the app's reader, or on
//                         the website for builds without the guide screen
//   get_my_pinned_lines   the lines, buses and docks they pinned in Around
//                         You (around_you_pins), with the next departures of
//                         each pinned line from where they are or from Home

type Ctx = {
  user: SupabaseClient
  userId: string
  here?: { lat: number; lng: number } | null
  screens?: Set<string>
}
type Point = { lat: number; lng: number }
type Link = { screen: 'guide'; params: Record<string, string>; label: string } | { href: string; label: string; external?: boolean }
type Result = { content: Record<string, unknown>; isError?: boolean; link?: Link }

const SITE = 'https://www.gogreenstreets.org'
const fail = (error: string): Result => ({ content: { error }, isError: true })
const round1 = (n: number) => Math.round(n * 10) / 10
const nullable = (t: string, description?: string) => ({ type: [t, 'null'], ...(description ? { description } : {}) })
const placeSchema = {
  type: 'object',
  description: 'A place from find_place or get_my_places, or their location from the context ("Your location"): its name and coordinates.',
  properties: { name: { type: 'string' }, lat: { type: 'number' }, lng: { type: 'number' } },
  required: ['lat', 'lng'],
} as const

function asPoint(v: unknown): Point | null {
  const p = v as { lat?: unknown; lng?: unknown } | null
  return p && typeof p.lat === 'number' && typeof p.lng === 'number' ? { lat: p.lat, lng: p.lng } : null
}

/** Their saved Home, for "near me" when the phone didn't share where it is. */
async function homePoint(ctx: Ctx): Promise<Point | null> {
  if (!ctx.userId) return null
  const { data } = await ctx.user.from('saved_locations').select('lat, lng').eq('user_id', ctx.userId).ilike('label', 'home').limit(1)
  const h = ((data ?? [])[0] as { lat: number | null; lng: number | null } | undefined)
  return h?.lat != null && h?.lng != null ? { lat: h.lat, lng: h.lng } : null
}

/** Boston's wall clock as a Date whose local fields read it: repairStatus
 *  reads getDay()/getHours(), and the server runs on UTC. */
function bostonWallClock(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
}

export const LOOKUP_ACTIVITY: Record<string, string> = {
  find_repair: 'Finding a place to fix your bike',
  find_guides: 'Looking through the guides',
  get_guide: 'Reading the guide',
  get_my_pinned_lines: 'Checking your pinned lines',
}

export const LOOKUP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'find_repair',
    description: "Community bike repair near a place: the repair co-ops and fix-it nights Shift lists in Around You (Bikes Not Bombs, campus co-ops and others), within about 8 miles, nearest first, each with whether it's open now or when it opens next (from its published hours, the same line the app shows), the address, a note on its hours, and its website. Use for \"where can I fix my bike\", \"a flat tire\", \"somewhere to learn to fix my bike\". Near their location, else their Home, unless you pass a place. For a bike shop or the town's list, get_town_info topic bike_repair also has the town's own resources.",
    input_schema: { type: 'object', properties: { near: { ...placeSchema, type: ['object', 'null'], description: 'Where to look from. Leave empty for their location, else Home.' } } },
  },
  {
    name: 'find_guides',
    description: "Shift's how-to guides, the short guides in the app and on gogreenstreets.org/guides: biking in the rain or winter, arriving at work by bike, locking a bike, Bluebikes, the T's basics and backup plans, taking a bike on the train, walking, carpooling, kids, and more. Each with its id, title, a one-line summary and the minutes to read. Find by words (\"rain\", \"lock\", \"bluebikes\"), or leave empty for the whole list. Then get_guide for the one that fits.",
    input_schema: { type: 'object', properties: { query: nullable('string', 'Words about what they want to know ("rain", "winter", "lock my bike"). Leave empty to list all.') } },
  },
  {
    name: 'get_guide',
    description: "One guide in full, by its id from find_guides, with a button that opens it (in the app's guide reader, or on the website). Answer from it in a few sentences, in your own words: the two or three things that matter for them.",
    input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'get_my_pinned_lines',
    description: "The lines, buses and Bluebikes docks they pinned in Around You (\"Your usual ways\"), in their order, with the direction and any note they gave (\"to work\"), and the next departures of each pinned line from the stop nearest them (their location, else their Home). Use for \"when's my train\", \"my usual bus\", \"is my line running\", or before planning a trip they make often.",
    input_schema: { type: 'object', properties: {} },
  },
]

type GuideRow = { id: string; slug: string | null; title: string; summary: string | null; primary_mode: string | null; topics: string[] | null; read_time_minutes: number | null; body?: string | null }

export async function runLookupTool(ctx: Ctx, name: string, input: Record<string, unknown>): Promise<Result | null> {
  switch (name) {
    case 'find_repair': {
      const at = asPoint(input.near) ?? ctx.here ?? (await homePoint(ctx))
      if (!at) return fail('Their location is unknown and they have no Home saved. Ask which neighborhood or town, then find_place.')
      const near = nearbyRepair(await fetchRepairPlaces(), at.lat, at.lng).slice(0, 4)
      if (!near.length) {
        return { content: { places: [], note: `No community repair co-op within ${REPAIR_RADIUS_MILES} miles. Say so, and offer get_town_info topic bike_repair for the town's own list of bike shops and repair help.` } }
      }
      const now = bostonWallClock()
      const tr = (key: string, vars?: Record<string, string | number | null | undefined>) => nearbyT('en', key, vars)
      // A button to the nearest one's own page, where it posts its hours.
      const page = near[0].hoursUrl ?? near[0].url
      return {
        ...(page && /^https:\/\//.test(page) ? { link: { href: page, label: `${near[0].name}`.slice(0, 40), external: true } } : {}),
        content: {
          places: near.map((p) => {
            const line = repairStatusLine(repairStatus({ hours: p.hours, seasonality: p.seasonality, effectiveStart: p.effectiveStart, effectiveEnd: p.effectiveEnd, verifiedAt: p.verifiedAt }, now), tr, { note: p.note })
            return {
              name: p.name,
              miles: round1(p.distMiles),
              now: line.text,
              hours_note: line.sub ?? null,
              about: p.description ? p.description.replace(/\s+/g, ' ').slice(0, 240) : null,
              address: p.address,
              website: p.url,
              hours_updates: p.hoursUrl,
            }
          }),
          note: 'Lead with the nearest one that is open now or opens soonest, with its now line in plain words ("open until 6 PM", "usually open Tuesdays and Thursdays"). Never say open now unless now says so. Co-ops are do-it-yourself with help: say so in a few words. The nearest one\'s own page shows as a button under your reply; do not mention it.',
        },
      }
    }
    case 'find_guides': {
      const { data, error } = await ctx.user.from('content_items')
        .select('id, slug, title, summary, primary_mode, topics, read_time_minutes')
        .eq('content_type', 'micro_guide').eq('status', 'approved')
        .or('expires_at.is.null,expires_at.gt.now()')
        .order('title').limit(60)
      if (error) return fail('The guides are not answering right now.')
      const rows = (data ?? []) as GuideRow[]
      const words = typeof input.query === 'string' ? input.query.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2) : []
      const score = (g: GuideRow) => {
        const hay = [g.title, g.summary ?? '', g.primary_mode ?? '', ...(g.topics ?? [])].join(' ').toLowerCase()
        // Whole words from the start ("rain" is not in "train"; "lock" finds "locking").
        return words.reduce((n, w) => n + (new RegExp(`\\b${w.replace(/s$/, '')}`).test(hay) ? 1 : 0), 0)
      }
      const picked = words.length
        ? rows.map((g) => ({ g, s: score(g) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5).map((x) => x.g)
        : rows
      return {
        content: {
          guides: picked.map((g) => ({ id: g.id, title: g.title, summary: g.summary, minutes_to_read: g.read_time_minutes })),
          ...(words.length && !picked.length ? { note: 'No guide matches those words. Here is none; answer from what you know from other tools, or call find_guides with no words to see the list.' } : {}),
        },
      }
    }
    case 'get_guide': {
      const id = String(input.id ?? '')
      if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) return fail('Use an id from find_guides.')
      const { data } = await ctx.user.from('content_items')
        .select('id, slug, title, summary, read_time_minutes, body')
        .eq('id', id).eq('content_type', 'micro_guide').eq('status', 'approved').maybeSingle()
      const g = data as GuideRow | null
      if (!g) return fail('No guide with that id. Use an id from find_guides.')
      const body = (g.body ?? '').replace(/\{\{[^}]*\}\}/g, '').replace(/\n{3,}/g, '\n\n').trim()
      const label = 'Read the guide'
      const link: Link | undefined = ctx.screens?.has('guide')
        ? { screen: 'guide', params: { id: g.id }, label }
        : g.slug ? { href: `${SITE}/guides/${g.slug}?utm_source=assistant`, label, external: true } : undefined
      return {
        content: {
          title: g.title, summary: g.summary, minutes_to_read: g.read_time_minutes,
          text: body.length > 6000 ? `${body.slice(0, 6000)}…` : body,
          next: 'Answer what they asked from this guide in two to four sentences, in your own words; the button opens the whole guide. Do not mention the button.',
        },
        ...(link ? { link } : {}),
      }
    }
    case 'get_my_pinned_lines': {
      if (!ctx.userId) return fail('Pinned lines need a Shift account.')
      const { data, error } = await ctx.user.from('around_you_pins')
        .select('kind, ref_id, direction_id, headsign, label, destination, source')
        .eq('user_id', ctx.userId)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }).limit(20)
      if (error) return fail('Their pinned lines are not answering right now.')
      type Pin = { kind: string; ref_id: string; direction_id: number | null; headsign: string | null; label: string; destination: string | null; source: string | null }
      const pins = (data ?? []) as Pin[]
      if (!pins.length) {
        return { content: { pins: [], note: 'They have no pinned lines. Pinning lives in Around You ("Your usual ways"): offer open_screen around_you, and get_departures for the times near them now.' } }
      }
      const at = ctx.here ?? (await homePoint(ctx))
      const transit = pins.filter((p) => p.kind === 'train' || p.kind === 'bus' || p.kind === 'ferry')
      // One look-up per line, at most four, side by side.
      const seen = new Set<string>()
      const lines = transit.filter((p) => (seen.has(p.ref_id) ? false : (seen.add(p.ref_id), true))).slice(0, 4)
      const live = at
        ? await Promise.all(lines.map((p) => departuresNear(at, p.ref_id).then((d) => [p.ref_id, d] as const).catch(() => [p.ref_id, null] as const)))
        : []
      const byLine = new Map(live)
      return {
        content: {
          from: at ? (ctx.here ? 'their location' : 'their Home') : null,
          pins: pins.map((p) => ({
            kind: p.kind === 'dock' ? 'Bluebikes dock' : p.kind === 'shuttle' ? 'shuttle' : p.kind,
            name: p.label,
            ...(p.headsign ? { toward: p.headsign } : {}),
            ...(p.destination ? { their_note: p.destination } : {}),
            ...(p.source === 'auto' ? { pinned_by: 'Shift, from their trips' } : {}),
            ...(byLine.has(p.ref_id) ? { departures: byLine.get(p.ref_id) } : {}),
          })),
          note: at
            ? 'Departures are both ways from the stop nearest them; lead with the direction they pinned (toward). Bikes at a dock and shuttle times show in Around You (open_screen around_you).'
            : 'Their location is unknown and they have no Home saved, so no departures: ask which stop, then get_departures.',
        },
      }
    }
    default:
      return null
  }
}
