import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import JsonLd from '@/components/JsonLd'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getCampusEvents } from '@/lib/semester/events'
import { getTownRoams } from '@/lib/towns/queries'
import { getSchoolStandings } from '@/lib/schools/queries'
import { EventsRoamsPanels } from '@/components/towns/TownSections'
import TownToc from '@/components/towns/TownToc'
import SemesterJoinCard from '@/components/semester/SemesterJoinCard'
import SchoolLeaderboardBoard from '@/components/schools/SchoolLeaderboardBoard'
import { TramFront, Bike, Footprints, ArrowUpRight } from 'lucide-react'
import { getSchool, SCHOOLS, sourceName, type SchoolFact } from '@/lib/semester/schools'
import {
  SEMESTER_CODE, SEMESTER_CODE_LIVE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS,
  buildSemesterAppHref,
} from '@/lib/semester/campaign'
import { withUtm } from '@/lib/utm'
import CorporateShareKit from '@/app/events/shift-your-summer/share/[slug]/CorporateShareKit'

export const revalidate = 3600

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const IS_LIVE = !!(IOS_URL && ANDROID_URL)

type GroupRow = {
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

export function generateStaticParams() {
  return SCHOOLS.map((s) => ({ school: s.slug }))
}

type Props = { params: Promise<{ school: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { school: slug } = await params
  const school = getSchool(slug)
  if (!school) return { title: 'Shift Your Semester | Green Streets Initiative' }
  // Per-school search titles: these pages rank on page one for what students
  // actually search ("bu cycle kitchen", "mit t pass"); the campaign template
  // is the fallback only.
  const title = school.seoTitle ?? `Shift Your Semester at ${school.name} | Green Streets Initiative`
  const description =
    school.seoDescription ??
    `Walk, bike, and ride the T at ${school.name}. Verify your school email on Shift, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days, and unlock a ${SEMESTER_REWARD} reward.`
  const url = `https://www.gogreenstreets.org/shift-your-semester/${school.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Green Streets Initiative' },
  }
}

function FactCards({ facts }: { facts: SchoolFact[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {facts.map((f) => (
        <div
          key={f.sourceUrl + f.text.slice(0, 24)}
          className="flex flex-col rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/85"
        >
          <span>{f.text}</span>
          <a
            href={f.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 self-start text-xs font-semibold text-white/75 no-underline transition-colors hover:text-[#BAF14D]"
          >
            {sourceName(f.sourceUrl)}
            <ArrowUpRight size={13} strokeWidth={2.5} aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      ))}
    </div>
  )
}

const BENEFIT_GROUPS = [
  { key: 'transit', label: 'Transit', Icon: TramFront, color: '#5BD6C0' },
  { key: 'bike', label: 'Bike', Icon: Bike, color: '#BAF14D' },
  { key: 'moving', label: 'Around campus', Icon: Footprints, color: '#EDB93C' },
] as const

export default async function SchoolPage({ params }: Props) {
  const { school: slug } = await params
  const school = getSchool(slug)
  if (!school) notFound()

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

  // One utm_campaign for all campaign traffic; the school rides in utm_content.
  const iosUrl = (IS_LIVE && withUtm(IOS_URL, { source: 'web_school', medium: 'school_page', campaign: 'semester', content: school.slug })) || IOS_URL
  const androidUrl = (IS_LIVE && withUtm(ANDROID_URL, { source: 'web_school', medium: 'school_page', campaign: 'semester', content: school.slug })) || ANDROID_URL

  const blurb = group
    ? SEMESTER_CODE_LIVE
      ? `${school.shortName} is on Shift! Get the app, enter code ${SEMESTER_CODE}, verify your school email, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days and pick a ${SEMESTER_REWARD} reward from local shops. ${pageUrl}`
      : `${school.shortName} is on Shift! Walk, bike, and ride the T — take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days and pick a ${SEMESTER_REWARD} reward from local merchants. Tap to join our school: ${joinUrl}`
    : ''

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E] text-white" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="px-8 pt-16 pb-10 md:pt-24">
          <div className="mx-auto max-w-[860px]">
            <Link href="/shift-your-semester" className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white">
              &larr; Shift Your Semester
            </Link>
            <div className="mb-5">
              <span className="inline-flex h-16 items-center rounded-2xl bg-white px-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={school.logo} alt={school.name} className="h-[44px] w-auto max-w-[220px] object-contain" />
              </span>
            </div>
            <h1 className="mb-4 font-display text-[clamp(1.9rem,4.5vw,2.9rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Shift Your Semester at {school.name}
            </h1>
            <p className="max-w-[560px] text-[1.0625rem] leading-relaxed text-white/80">
              {school.highlight ? `${school.highlight} ` : ''}
              Join {school.shortName} on the free Shift app, take {SEMESTER_TRIPS} active trips in {SEMESTER_WINDOW_DAYS} days
              — walking, biking, or transit — and pick a {SEMESTER_REWARD} reward from ~60 local merchants or a digital gift
              card you choose.
            </p>
          </div>
        </section>

        <TownToc
          sections={[
            ['#join', group ? 'Join' : 'Get the app'],
            ['#standings', 'Standings'],
            ['#around', 'Around campus'],
            ['#benefits', 'Campus perks'],
            ...(events.length > 0 || roams.length > 0 ? [['#events', 'Events'] as [string, string]] : []),
            ...(group ? [['#share', 'Share'] as [string, string]] : []),
          ]}
        />

        {/* Join */}
        <section className="scroll-mt-28 px-8 pb-14 pt-10" id="join">
          <div className="mx-auto max-w-[860px]">
            {group && joinUrl && qrSvg ? (
              <>
                <SemesterJoinCard
                  schoolSlug={school.slug}
                  shortName={school.shortName}
                  primaryDomain={primaryDomain}
                  appHref={appHref}
                  joinUrl={joinUrl}
                  inviteCode={group.invite_code}
                  qrSvg={qrSvg}
                  codeLive={SEMESTER_CODE_LIVE}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/shift-app/shift-join-sequence.png"
                  alt="How to enter your school code in the Shift app: tap the + button on the Community tab, then enter your invite code and tap Join."
                  className="mx-auto mt-6 max-w-[340px] rounded-xl"
                />
              </>
            ) : (
              <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-6">
                <h2 className="mb-2 text-lg font-bold text-white">Get the Shift app</h2>
                <p className="text-[0.9375rem] leading-[1.6] text-white/85">
                  {school.shortName}&rsquo;s group is being set up. Get the app now, verify your school email inside it,
                  and you&rsquo;re in the moment the group is live.
                </p>
              </div>
            )}
            {IS_LIVE && <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} className="mt-6" />}
          </div>
        </section>

        {/* Standings */}
        <section className="scroll-mt-28 px-8 pb-14" id="standings">
          <div className="mx-auto max-w-[820px]">
            <SchoolLeaderboardBoard standings={standings} highlightGroupId={group?.id} />
          </div>
        </section>

        {/* Around campus — hands off to /nearby, campus pre-filled. */}
        <section className="scroll-mt-28 px-8 pb-14" id="around">
          <div className="mx-auto max-w-[860px]">
            <h2 className="mb-1 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              What&rsquo;s around campus
            </h2>
            <p className="mb-5 max-w-[560px] text-[0.9375rem] leading-relaxed text-white/80">
              A live map of everywhere you can walk, bike, or ride to from {school.shortName} — opens centered on campus.
            </p>
            <a
              href={`/nearby?lat=${school.lat}&lng=${school.lng}&label=${encodeURIComponent(school.name)}&utm_source=school_page&utm_campaign=semester&utm_content=${school.slug}`}
              className="block rounded-[18px] border border-white/[0.12] bg-white/[0.03] p-6 no-underline transition-colors hover:border-[#BAF14D]/40 hover:bg-white/[0.05]"
            >
              <span className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
                <span>T stops &amp; live bus arrivals</span>
                <span>Bluebikes docks</span>
                <span>Protected bike paths</span>
              </span>
              <span className="text-[0.9375rem] font-semibold text-[#BAF14D]">Open the {school.shortName} map &rarr;</span>
            </a>
          </div>
        </section>

        {/* Campus perks */}
        <section className="scroll-mt-28 px-8 pb-14" id="benefits">
          <div className="mx-auto max-w-[860px]">
            <h2 className="mb-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              {school.shortName} campus perks
            </h2>
            <p className="mb-6 max-w-[620px] text-[0.9375rem] leading-relaxed text-white/80">Your school already gives you a head start.</p>
            <div className="space-y-6">
              {BENEFIT_GROUPS.map(({ key, label, Icon, color }) => (
                <div key={key}>
                  <div className="mb-2.5 flex items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ backgroundColor: `${color}29` }}>
                      <Icon size={16} style={{ color }} />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
                  </div>
                  <FactCards facts={school[key]} />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-white/75">
              Programs and prices change each term — check the linked school pages for current details.
            </p>
          </div>
        </section>

        {(events.length > 0 || roams.length > 0) && (
          <section className="scroll-mt-28 px-8 pb-14" id="events">
            <div className="mx-auto max-w-[860px]">
              <EventsRoamsPanels events={events} roams={roams} townName={school.shortName} />
            </div>
          </section>
        )}

        {group && joinUrl && (
          <section className="scroll-mt-28 px-8 pb-14" id="share">
            <div className="mx-auto max-w-[860px]">
              <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/75">Spread it on campus</p>
                <p className="mb-5 text-sm leading-[1.6] text-white/85">
                  Running a club, an orientation group, or a dorm floor? Share the page, post the code, or print the poster.
                </p>
                <CorporateShareKit
                  shareUrl={pageUrl}
                  blurb={blurb}
                  emailSubject={`Join ${school.shortName} on Shift — ${SEMESTER_REWARD} for ${SEMESTER_TRIPS} active trips`}
                  emailBody={blurb}
                  inviteCode={SEMESTER_CODE_LIVE ? SEMESTER_CODE : group.invite_code}
                />
                <div className="mt-6 border-t border-white/[0.08] pt-5">
                  <Link
                    href={`/shift-your-semester/${school.slug}/poster`}
                    className="inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
                  >
                    Open the printable poster &rarr;
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="px-8 pb-24 pt-4 text-center">
          <div className="mx-auto max-w-[560px]">
            <h2 className="mb-3 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              Your first {SEMESTER_TRIPS} trips are worth {SEMESTER_REWARD}.
            </h2>
            <p className="mb-6 text-[1.0625rem] leading-relaxed text-white/80">
              {SEMESTER_CODE_LIVE
                ? <>Download Shift, enter {SEMESTER_CODE}, verify your {school.shortName} email, and turn the walk to class into something more.</>
                : <>Download Shift, join {school.shortName}, and turn the walk to class into something more.</>}
            </p>
            {IS_LIVE && <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} className="justify-center" />}
          </div>
        </section>
      </main>
      <Footer />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `Shift Your Semester at ${school.name}`,
          url: pageUrl,
          about: { '@type': 'EducationalOrganization', name: school.name },
        }}
      />
    </>
  )
}
