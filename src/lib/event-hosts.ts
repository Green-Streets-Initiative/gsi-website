/**
 * Who hosts an event, one by one (Keith 2026-11-19: show each host's logo).
 *
 * Calendars give co-hosts as one joined name ("Seaport TMA, A Better City
 * TMA, & Lower Mystic TMA") or only in the description ("Join Seaport TMA
 * and MassBike to learn..."). A joined name is split where its pieces are
 * organizers we know; pieces we don't know stay together, so "Holyoke
 * Bicycle and Pedestrian Committee" is still one host. From the description
 * only known organizers named right after "Join", "hosted by" and the like
 * are taken.
 *
 * Pure functions, no imports, so `node --test` can run them.
 */

export type KnownOrganizer = {
  id: string
  name: string
  aliases?: string[] | null
  logo_url?: string | null
  url?: string | null
}

export type EventHost = {
  id: string | null
  name: string
  logo: string | null
  url: string | null
}

/** Lowercase, no parentheses, no leading "the", letters and digits only. */
export function normHost(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the\s+/, '')
}

export function hostIndex(orgs: KnownOrganizer[]): Map<string, KnownOrganizer> {
  const m = new Map<string, KnownOrganizer>()
  for (const o of orgs) {
    for (const n of [o.name, ...(o.aliases ?? [])]) {
      const k = normHost(n ?? '')
      // A one-word piece like "Pedestrian" must never match; real short names ("MassBike", "MAPC") are one word but specific.
      if (k && k.length >= 4 && !m.has(k)) m.set(k, o)
    }
  }
  return m
}

const SEP = /(\s*,\s*(?:and\s+|&\s+)?|\s+(?:and|&)\s+|\s*\/\s*|\s*\|\s*)/i

/**
 * Split a joined name into hosts. Returns one host (the name as given) unless
 * at least one piece is a known organizer and the split gives two or more.
 */
export function splitHosts(joined: string, index: Map<string, KnownOrganizer>): EventHost[] {
  const parts = joined.split(SEP)
  // parts alternates piece, separator, piece, ...
  const pieces: string[] = []
  const seps: string[] = []
  parts.forEach((p, i) => (i % 2 === 0 ? pieces.push(p.trim()) : seps.push(p)))
  const out: EventHost[] = []
  let pending: string | null = null
  let i = 0
  let matched = 0
  while (i < pieces.length) {
    // Longest run of pieces that is a known organizer ("Walk Bike Springfield" + nothing; "Cambridge Bike" + "Ped Committee" if known as one).
    let hit: { o: KnownOrganizer; j: number } | null = null
    for (let j = pieces.length; j > i; j--) {
      const text = pieces.slice(i, j).map((p, k) => (k === 0 ? p : seps[i + k - 1] + p)).join('')
      const o = index.get(normHost(text))
      if (o) { hit = { o, j }; break }
    }
    if (hit) {
      if (pending) out.push({ id: null, name: pending, logo: null, url: null })
      pending = null
      out.push(fromOrg(hit.o))
      matched++
      i = hit.j
    } else if (pending !== null && !/[,/|]/.test(seps[i - 1])) {
      // "Holyoke Bike and Pedestrian Committee": an unknown "and" stays inside one name.
      pending = pending + seps[i - 1] + pieces[i]
      i++
    } else {
      // A comma starts the next name in a list ("A Better City TMA, & Lower Mystic TMA").
      if (pending) out.push({ id: null, name: pending, logo: null, url: null })
      pending = pieces[i]
      i++
    }
  }
  if (pending) out.push({ id: null, name: pending, logo: null, url: null })
  const named = out.filter((h) => h.name.replace(/^the\s+/i, '').trim().length > 0)
  // A slash or bar always lists separate hosts ("SASS / PTAC").
  return (matched > 0 || /\s[/|]\s/.test(joined)) && named.length > 1 ? named : [{ id: null, name: joined.trim(), logo: null, url: null }]
}

function fromOrg(o: KnownOrganizer): EventHost {
  return { id: o.id, name: o.name, logo: o.logo_url ?? null, url: o.url ?? null }
}

/** Known organizers named right after "Join", "hosted by", "in partnership with" and the like. */
export function hostsInText(text: string, index: Map<string, KnownOrganizer>): EventHost[] {
  const out: EventHost[] = []
  const lead = /\b(?:join(?:\s+us\s+and)?|(?:co-?)?hosted\s+by|presented\s+by|organized\s+by|in\s+partnership\s+with|together\s+with|partnering\s+with)\s+([^.!?\n;:]{2,140})/gi
  for (const m of text.matchAll(lead)) {
    // The names end where the sentence goes on: "Join Seaport TMA and MassBike to learn ...".
    const run = m[1].split(/\s+(?:to|for|at|on|in|this|that|as|who|from|every|each|we|our|$)\b/i)[0]
    for (const h of splitHosts(run, index)) if (h.id) out.push(h)
    // A single known name with nothing joined ("hosted by MassBike").
    const whole = index.get(normHost(run))
    if (whole) out.push(fromOrg(whole))
  }
  return out
}

/**
 * Every host of an event, the listed organizer first. The listed organizer
 * row (when the event has one) supplies the logo and website if the name
 * isn't split.
 */
export function eventHosts(
  ev: { organizer_name: string | null; organizer_url?: string | null; body?: string | null },
  organizer: KnownOrganizer | null,
  orgs: KnownOrganizer[],
): EventHost[] {
  const index = hostIndex(orgs)
  const name = ev.organizer_name?.trim()
  let hosts: EventHost[] = []
  if (name) {
    const split = splitHosts(name, index)
    hosts = split.length > 1
      ? split
      : [{ id: organizer?.id ?? null, name, logo: organizer?.logo_url ?? null, url: ev.organizer_url ?? organizer?.url ?? null }]
  }
  if (ev.body) hosts.push(...hostsInText(ev.body, index))
  const seen = new Set<string>()
  return hosts.filter((h) => {
    const k = h.id ?? normHost(h.name)
    if (seen.has(k) || seen.has(normHost(h.name))) return false
    seen.add(k)
    seen.add(normHost(h.name))
    return true
  }).slice(0, 5)
}
