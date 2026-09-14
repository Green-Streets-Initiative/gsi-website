import 'server-only'
import QRCode from 'qrcode'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCampusEvents } from '@/lib/semester/events'
import { getTownRoams, type TownEvent, type TownRoam } from '@/lib/towns/queries'
import { getSchoolStandings } from '@/lib/schools/queries'
import { MIN_RANKED_SCHOOLS, type SchoolStanding } from '@/lib/schools/types'
import { getSchool, type School } from '@/lib/semester/schools'
import { SEMESTER_CODE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS, buildSemesterAppHref } from '@/lib/semester/campaign'
import { withUtm } from '@/lib/utm'

/*
 * Everything the Shift Your Semester pages read, free of markup. The
 * production routes call these with the real code-live flag; the staging
 * routes under /preview/shift-your-semester/live force it on so both states
 * can be reviewed before launch.
 */

export const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
export const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
export const IS_LIVE = !!(IOS_URL && ANDROID_URL)

export type GroupRow = {
  id: string
  name: string
  slug: string | null
  invite_code: string
  status: string
  access_ends_at: string | null
}

async function fetchGroup(groupSlug: string | null): Promise<GroupRow | null> {
  if (!groupSlug) return null
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
      .from('groups')
      .select('id, name, slug, invite_code, status, access_ends_at')
      .eq('slug', groupSlug)
      .eq('status', 'active')
      .maybeSingle()
    if (!data) return null
    const row = data as GroupRow
    if (row.access_ends_at && new Date(row.access_ends_at) < new Date()) return null
    return row
  } catch {
    return null
  }
}

/** The school's primary email domain from the server registry ("bu.edu"). */
async function fetchPrimaryDomain(slug: string): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient()
    const { data } = await supabase.from('campaign_schools').select('email_domains').eq('slug', slug).maybeSingle()
    const domains = (data as { email_domains?: string[] } | null)?.email_domains
    return domains?.[0] ?? null
  } catch {
    return null
  }
}

export interface HubData {
  standings: SchoolStanding[]
  boardLive: boolean
}

export async function loadHubPage(): Promise<HubData> {
  const standings = await getSchoolStandings().catch(() => [])
  return { standings, boardLive: standings.length >= MIN_RANKED_SCHOOLS }
}

export interface SchoolData {
  school: School
  codeLive: boolean
  group: GroupRow | null
  events: TownEvent[]
  roams: TownRoam[]
  standings: SchoolStanding[]
  boardLive: boolean
  primaryDomain: string | null
  qrSvg: string | null
  joinUrl: string | null
  pageUrl: string
  appHref: string
  nearbyHref: string
  blurb: string
  iosUrl: string
  androidUrl: string
}

export async function loadSchoolPage(slug: string, opts: { codeLive: boolean }): Promise<SchoolData | null> {
  const school = getSchool(slug)
  if (!school) return null
  const { codeLive } = opts

  const centroid = { lat: school.lat, lng: school.lng }
  const [group, events, roams, standings, primaryDomain] = await Promise.all([
    fetchGroup(school.groupSlug),
    getCampusEvents(centroid).catch(() => []),
    getTownRoams(centroid).catch(() => []),
    getSchoolStandings().catch(() => []),
    fetchPrimaryDomain(school.slug),
  ])

  const joinUrl = group ? `https://shift.gogreenstreets.org/join/${group.invite_code}` : null
  const pageUrl = `https://www.gogreenstreets.org/shift-your-semester/${school.slug}`
  const appHref = buildSemesterAppHref({ school: school.slug, source: 'web_school', medium: 'school_page' })
  const qrSvg = joinUrl
    ? await QRCode.toString(joinUrl, { type: 'svg', margin: 0, color: { dark: '#191A2E', light: '#ffffff' } })
    : null
  const nearbyHref = `/nearby?lat=${school.lat}&lng=${school.lng}&label=${encodeURIComponent(school.name)}&utm_source=school_page&utm_campaign=semester&utm_content=${school.slug}`

  // One utm_campaign for all campaign traffic; the school rides in utm_content.
  const iosUrl =
    (IS_LIVE && withUtm(IOS_URL, { source: 'web_school', medium: 'school_page', campaign: 'semester', content: school.slug })) || IOS_URL
  const androidUrl =
    (IS_LIVE && withUtm(ANDROID_URL, { source: 'web_school', medium: 'school_page', campaign: 'semester', content: school.slug })) || ANDROID_URL

  const blurb = group
    ? codeLive
      ? `${school.shortName} is on Shift! Get the app, enter code ${SEMESTER_CODE}, verify your school email, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days and pick a ${SEMESTER_REWARD} reward from local shops. ${pageUrl}`
      : `${school.shortName} is on Shift! Walk, bike, and ride the T — take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days and pick a ${SEMESTER_REWARD} reward from local merchants. Tap to join our school: ${joinUrl}`
    : ''

  return {
    school,
    codeLive,
    group,
    events,
    roams,
    standings,
    boardLive: standings.length >= MIN_RANKED_SCHOOLS,
    primaryDomain,
    qrSvg,
    joinUrl,
    pageUrl,
    appHref,
    nearbyHref,
    blurb,
    iosUrl,
    androidUrl,
  }
}
