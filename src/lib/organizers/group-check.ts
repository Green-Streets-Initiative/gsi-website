import 'server-only'
import { createHmac } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Proving a group is yours with a code (Keith 2026-11-21: no manual GSI step).
 *
 * A claim on a group (event_organizer_admins, Shift 00802) is verified on the
 * spot when the sign-in email is at the group's website domain (Shift 01563).
 * Volunteer groups run from Gmail can't do that, so each pending claim gets a
 * short code, `shift-verify-xxxxxxxx`. The organizer puts it somewhere only
 * the group can edit: its website (any page, or a meta tag), or the bio of a
 * social profile the group lists (Instagram, Facebook, Linktree...). This
 * fetches those public pages, as a plainly named visitor, and when the code
 * is there, the claim is verified. Instagram and Facebook often hide a
 * profile from outside sites; then the organizer is told so and pointed to
 * the website or a link-in-bio page, which always read.
 *
 * The code is an HMAC of the claim's id with a server secret, so it can't be
 * forged or read from the database (a claimant may update their own pending
 * row, Shift 00816), and a new claim always gets a new code.
 *
 * The places checked are the group's own website and links as GSI or a
 * verified organizer listed them, never one the claimant types, except:
 *   - a page on the group's own website (same host, and under the listed
 *     path when the site lives on a shared host like sites.google.com);
 *   - a group the claimant added themself that nobody is verified for yet:
 *     they may give it a website or link first (it's their own new group).
 */

export const CODE_PREFIX = 'shift-verify-'
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** The claim's code: stable for the claim, unguessable without the server secret. */
export function claimCode(claimId: string): string {
  const secret = process.env.ORGANIZER_CLAIM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!secret) throw new Error('Group check is not set up on this server')
  const mac = createHmac('sha256', secret).update(`org-claim:${claimId}`).digest()
  let s = ''
  for (let i = 0; i < 8; i++) s += ALPHABET[mac[i] % ALPHABET.length]
  return CODE_PREFIX + s
}

export type PlaceKind = 'website' | 'instagram' | 'facebook' | 'linktree' | 'other'
export interface CheckPlace { kind: PlaceKind; label: string; url: string; where: string }

const LINK_LABEL: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linktree: 'Linktree', bluesky: 'Bluesky',
  meetup: 'Meetup', strava: 'Strava club', tiktok: 'TikTok', youtube: 'YouTube',
}
// Places whose page text a server can read and an organizer can edit. Chat
// invites (WhatsApp, Discord) and Partiful aren't pages the group writes on.
const CHECKABLE = ['instagram', 'facebook', 'linktree', 'bluesky', 'meetup', 'strava', 'tiktok', 'youtube']
// Hosts many unrelated sites share: a page there proves nothing unless it is
// under the group's own listed path.
export const SHARED_HOST = /(^|\.)(sites\.google\.com|google\.com|facebook\.com|instagram\.com|linktr\.ee|meetup\.com|strava\.com|github\.com|notion\.site|bsky\.app|tiktok\.com|youtube\.com|eventbrite\.com|medium\.com|substack\.com|wordpress\.com|blogspot\.com)$/i

export function hostOf(url: string | null | undefined): string | null {
  try { return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') : null } catch { return null }
}

function kindOf(url: string): PlaceKind {
  const h = hostOf(url) ?? ''
  if (/(^|\.)instagram\.com$/.test(h)) return 'instagram'
  if (/(^|\.)(facebook|fb)\.com$/.test(h)) return 'facebook'
  if (/(^|\.)linktr\.ee$/.test(h)) return 'linktree'
  return 'other'
}

const WHERE: Record<PlaceKind, string> = {
  website: 'Anywhere on the home page, or on any page of the site (then paste that page’s address below). A hidden tag works too: <meta name="shift-verify" content="CODE">',
  instagram: 'In the bio. You can take it out once you’re verified.',
  facebook: 'In the page’s Intro or About text. You can take it out once you’re verified.',
  linktree: 'In the bio, or as the title of a link.',
  other: 'In the profile’s bio or description.',
}

const isWeb = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v.trim())

/** Where this group can show the code: its website first, then its profiles. */
export function placesFor(org: { url: string | null; social_links: Record<string, string> | null }): CheckPlace[] {
  const out: CheckPlace[] = []
  const seen = new Set<string>()
  const add = (p: CheckPlace) => { const k = p.url.replace(/\/+$/, '').toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(p) } }
  if (isWeb(org.url)) {
    const k = kindOf(org.url)
    add({ kind: k === 'other' ? 'website' : k, label: k === 'other' ? hostOf(org.url)! : LINK_LABEL[k] ?? 'Website', url: org.url.trim(), where: WHERE[k === 'other' ? 'website' : k] })
  }
  for (const key of CHECKABLE) {
    const v = org.social_links?.[key]
    if (!isWeb(v)) continue
    const k = kindOf(v)
    add({ kind: k, label: LINK_LABEL[key] ?? key, url: v.trim(), where: WHERE[k] })
  }
  return out
}

/** A page the organizer named: only on the group's own website. */
export function pageOnSite(siteUrl: string | null, page: string): string | null {
  if (!isWeb(siteUrl) || !isWeb(page)) return null
  let site: URL, p: URL
  try { site = new URL(siteUrl); p = new URL(page.trim()) } catch { return null }
  const sh = site.hostname.toLowerCase().replace(/^www\./, '')
  const ph = p.hostname.toLowerCase().replace(/^www\./, '')
  if (sh !== ph) return null
  if (SHARED_HOST.test(sh)) {
    const base = site.pathname.replace(/\/+$/, '')
    if (!base || !(p.pathname === base || p.pathname.startsWith(`${base}/`))) return null
  }
  return p.toString()
}

// ── Fetching ──

// Says plainly who is asking, so a site owner can see it in their logs.
const UA = 'GreenStreetsShift-GroupCheck/1.0 (+https://www.gogreenstreets.org/organizers)'

const LOCAL_OK = () => process.env.NODE_ENV !== 'production' && process.env.GROUP_CHECK_ALLOW_LOCALHOST === '1'

function privateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase()
    if (v.startsWith('::ffff:')) return privateIp(v.slice(7))
    return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')
  }
  const [a, b] = ip.split('.').map(Number)
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
}

/** Public web pages only: never this server's own network (each hop of a redirect too). */
async function safeTarget(url: string): Promise<boolean> {
  let u: URL
  try { u = new URL(url) } catch { return false }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return false
  if (u.port && !['80', '443'].includes(u.port) && !LOCAL_OK()) return false
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  try {
    const addrs = isIP(h) ? [{ address: h }] : await lookup(h, { all: true })
    if (!addrs.length) return false
    if (addrs.some((x) => privateIp(x.address))) return LOCAL_OK()
    return true
  } catch { return false }
}

export async function readText(url: string): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  let at = url
  let res: Response | null = null
  for (let hop = 0; hop < 5; hop++) {
    if (!(await safeTarget(at))) return { ok: false, status: 0, text: '', finalUrl: at }
    res = await fetch(at, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    })
    const next = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null
    if (!next) break
    at = new URL(next, at).toString()
    res = null
  }
  if (!res) return { ok: false, status: 0, text: '', finalUrl: at }
  // Read at most 2 MB.
  const reader = res.body?.getReader()
  const chunks: Buffer[] = []
  let size = 0
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(Buffer.from(value))
      size += value.length
      if (size > 2_000_000) { await reader.cancel().catch(() => {}); break }
    }
  }
  return { ok: res.ok, status: res.status, text: Buffer.concat(chunks).toString('utf8'), finalUrl: at }
}

/** HTML entities and escapes a page may wrap the code in, undone enough to find it. */
function normalize(text: string): string {
  return text
    .replace(/\\u002d|&#45;|&#x2d;|&hyphen;|&dash;/gi, '-')
    .replace(/[‐-―−]/g, '-')
    .replace(/[​-‍⁠﻿]/g, '')
    .toLowerCase()
}

export type PlaceResult = { url: string; label: string; found: boolean; problem?: 'not_found' | 'unreadable' }

/** Looks for the code at one place. Never throws. */
export async function lookAt(place: { url: string; label: string; kind: PlaceKind }, code: string): Promise<PlaceResult> {
  const want = code.toLowerCase()
  try {
    const r = await readText(place.url)
    if (!r.ok || !r.text) return { url: place.url, label: place.label, found: false, problem: 'unreadable' }
    const found = normalize(r.text).includes(want)
    if (found) return { url: place.url, label: place.label, found: true }
    // Instagram and Facebook often show a sign-in wall to servers: say we
    // couldn't read it, not that the code isn't there.
    const walled = (place.kind === 'instagram' || place.kind === 'facebook') && /log ?in|sign ?up|login_form|loginForm/i.test(r.text.slice(0, 200_000)) && !/"biography"|og:description/i.test(r.text)
    return { url: place.url, label: place.label, found: false, problem: walled ? 'unreadable' : 'not_found' }
  } catch {
    return { url: place.url, label: place.label, found: false, problem: 'unreadable' }
  }
}

// ── The claim ──

export interface GroupCheckState {
  organizer_id: string
  name: string
  status: 'pending' | 'verified'
  code: string | null
  places: CheckPlace[]
  /** A group they added themself that nobody runs yet: they may give it a website or link. */
  can_add_link: boolean
}

type Claim = { id: string; status: string }
type Org = { id: string; name: string; url: string | null; social_links: Record<string, string> | null; created_by: string | null }

async function load(admin: SupabaseClient, userId: string, organizerId: string): Promise<{ claim: Claim; org: Org; canAdd: boolean } | null> {
  const [{ data: claim }, { data: org }, { count }] = await Promise.all([
    admin.from('event_organizer_admins').select('id, status').eq('organizer_id', organizerId).eq('user_id', userId).maybeSingle(),
    admin.from('event_organizers').select('id, name, url, social_links, created_by').eq('id', organizerId).maybeSingle(),
    admin.from('event_organizer_admins').select('id', { count: 'exact', head: true }).eq('organizer_id', organizerId).eq('status', 'verified'),
  ])
  if (!claim || !org) return null
  return { claim: claim as Claim, org: org as Org, canAdd: (org as Org).created_by === userId && (count ?? 0) === 0 }
}

export async function groupCheckState(admin: SupabaseClient, userId: string, organizerId: string): Promise<GroupCheckState | null> {
  const l = await load(admin, userId, organizerId)
  if (!l) return null
  const verified = l.claim.status === 'verified'
  return {
    organizer_id: l.org.id,
    name: l.org.name,
    status: verified ? 'verified' : 'pending',
    code: verified ? null : claimCode(l.claim.id),
    places: placesFor(l.org),
    can_add_link: !verified && l.canAdd,
  }
}

export type CheckOutcome =
  | { ok: true; verified: true; name: string; found_at: string; already?: boolean }
  | { ok: true; verified: false; name: string; code: string; results: PlaceResult[]; places: CheckPlace[] }
  | { ok: false; error: string }

/**
 * Looks for the claim's code at the group's places (and `page`, a page on
 * its website), and verifies the claim when it's there. `addLink` gives a
 * group they added themself, that nobody runs yet, a website or profile
 * link first.
 */
export async function checkGroupCode(admin: SupabaseClient, userId: string, organizerId: string, opts: { page?: string | null; addLink?: string | null } = {}): Promise<CheckOutcome> {
  const l = await load(admin, userId, organizerId)
  if (!l) return { ok: false, error: 'You haven’t said you run this group yet. Pick it under Organization when you set up a ride.' }
  if (l.claim.status === 'verified') return { ok: true, verified: true, name: l.org.name, found_at: '', already: true }

  const org = { ...l.org }
  const add = opts.addLink?.trim()
  if (add) {
    if (!l.canAdd) return { ok: false, error: 'Only someone who already runs this group can change its links.' }
    if (!isWeb(add)) return { ok: false, error: 'Links start with https://' }
    const k = kindOf(add)
    const key = k === 'other' ? null : k
    if (key) {
      org.social_links = { ...(org.social_links ?? {}), [key]: add }
      const { error } = await admin.from('event_organizers').update({ social_links: org.social_links }).eq('id', org.id)
      if (error) return { ok: false, error: error.message }
    } else {
      org.url = add
      const { error } = await admin.from('event_organizers').update({ url: add }).eq('id', org.id)
      if (error) return { ok: false, error: error.message }
    }
  }

  const code = claimCode(l.claim.id)
  const places = placesFor(org)
  const targets: { url: string; label: string; kind: PlaceKind }[] = [...places]
  const page = opts.page?.trim()
  if (page) {
    const onSite = pageOnSite(org.url, page)
    if (!onSite) return { ok: false, error: org.url ? `That page isn’t on ${hostOf(org.url)}. Use a page on the group’s own website.` : 'This group has no website on file, so put the code on one of its profiles.' }
    if (!targets.some((t) => t.url === onSite)) targets.unshift({ url: onSite, label: hostOf(onSite) ?? 'Your page', kind: 'website' })
  }
  if (!targets.length) return { ok: true, verified: false, name: org.name, code, results: [], places }

  const results = await Promise.all(targets.slice(0, 8).map((t) => lookAt(t, code)))
  const hit = results.find((r) => r.found)
  if (!hit) return { ok: true, verified: false, name: org.name, code, results, places }

  const { data: done, error } = await admin.from('event_organizer_admins')
    .update({ status: 'verified', verified_at: new Date().toISOString(), verified_by: null })
    .eq('id', l.claim.id).eq('status', 'pending').select('id').maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (done) {
    // A record of how, for anyone who later asks why this person runs the group.
    await admin.from('admin_notifications').insert({
      level: 'info',
      source: 'organizer_console',
      title: `Group verified by code: ${org.name}`,
      body: `The claim's code was found at ${hit.url}.`,
      context: { kind: 'organizer_claim_code_verified', organizer_id: org.id, user_id: userId, found_at: hit.url },
    }).then(() => {}, () => {})
  }
  return { ok: true, verified: true, name: org.name, found_at: hit.url }
}
