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
import { EventsRoamsPanels } from '@/components/towns/TownSections'
import { getSchool, SCHOOLS, type SchoolFact } from '@/lib/semester/schools'
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

export function generateStaticParams() {
  return SCHOOLS.map((s) => ({ school: s.slug }))
}

type Props = { params: Promise<{ school: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { school: slug } = await params
  const school = getSchool(slug)
  if (!school) return { title: 'Shift Your Semester | Green Streets Initiative' }
  const title = `Shift Your Semester at ${school.name} | Green Streets Initiative`
  const description = `Walk, bike, and ride the T at ${school.name}. Join your school on Shift, take 10 active trips in 30 days, and pick a $25 reward.`
  const url = `https://www.gogreenstreets.org/shift-your-semester/${school.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Green Streets Initiative' },
  }
}

function FactList({ facts }: { facts: SchoolFact[] }) {
  return (
    <ul className="space-y-3">
      {facts.map((f) => (
        <li key={f.sourceUrl + f.text.slice(0, 24)} className="flex gap-3 text-[0.9375rem] leading-relaxed text-white/85">
          <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#BAF14D]" />
          <span>
            {f.text}{' '}
            <a
              href={f.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-xs font-semibold text-white/70 underline underline-offset-2 hover:text-white"
            >
              source
            </a>
          </span>
        </li>
      ))}
    </ul>
  )
}

export default async function SchoolPage({ params }: Props) {
  const { school: slug } = await params
  const school = getSchool(slug)
  if (!school) notFound()

  const centroid = { lat: school.lat, lng: school.lng }
  const [group, events, roams] = await Promise.all([
    fetchGroup(school.groupSlug),
    getCampusEvents(centroid).catch(() => []),
    getTownRoams(centroid).catch(() => []),
  ])

  const joinUrl = group ? `https://shift.gogreenstreets.org/join/${group.invite_code}` : null
  const pageUrl = `https://www.gogreenstreets.org/shift-your-semester/${school.slug}`
  const qrSvg = joinUrl
    ? await QRCode.toString(joinUrl, { type: 'svg', margin: 0, color: { dark: '#191A2E', light: '#ffffff' } })
    : null

  const iosUrl = (IS_LIVE && withUtm(IOS_URL, { source: 'web_school', medium: 'school_page', campaign: school.slug })) || IOS_URL
  const androidUrl = (IS_LIVE && withUtm(ANDROID_URL, { source: 'web_school', medium: 'school_page', campaign: school.slug })) || ANDROID_URL

  const blurb = group
    ? `${school.shortName} is on Shift! Walk, bike, and ride the T — take 10 active trips in 30 days and pick a $25 reward from local merchants. Tap to join our school: ${joinUrl}`
    : ''

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E] text-white" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="px-8 pt-16 pb-10 md:pt-24">
          <div className="mx-auto max-w-[860px]">
            <Link
              href="/shift-your-semester"
              className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
            >
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
              Join {school.shortName} on the free Shift app, take 10 active trips in 30
              days — walking, biking, or transit — and pick a $25 reward from ~60 local
              merchants or national gift cards.
            </p>
          </div>
        </section>

        {/* Join */}
        <section className="px-8 pb-14 pt-4" id="join">
          <div className="mx-auto max-w-[860px]">
            {group && joinUrl ? (
              <>
                <div className="mb-5 rounded-[14px] border border-[#BAF14D]/20 bg-[#BAF14D]/[0.06] p-6">
                  <span className="mb-2 inline-block rounded-full bg-[#BAF14D]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#BAF14D]">
                    Live now
                  </span>
                  <h2 className="mb-2 text-lg font-bold text-white">Join {school.shortName} in one tap</h2>
                  <p className="mb-5 text-[0.9375rem] leading-[1.6] text-white/85">
                    This link opens the Shift app and fills in {school.shortName}&rsquo;s join code.
                    Don&rsquo;t have the app yet? The same link shows you download links first.
                  </p>
                  <a
                    href={joinUrl}
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#BAF14D] px-8 py-4 text-center text-lg font-extrabold text-[#191A2E] transition-opacity hover:opacity-85 sm:w-auto"
                  >
                    {`Join ${school.shortName} on Shift`} &rarr;
                  </a>
                </div>
                <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
                  <div className="flex flex-col items-center">
                    <div className="flex h-[140px] w-[140px] items-center justify-center rounded-2xl bg-white p-2">
                      <div className="h-[120px] w-[120px]" dangerouslySetInnerHTML={{ __html: qrSvg! }} />
                    </div>
                    <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-white/75">
                      Scan to join
                    </p>
                  </div>
                  <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-5">
                    <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/75">
                      Or enter the code in the app
                    </p>
                    <p className="mb-3 font-mono text-2xl font-extrabold tracking-[0.2em] text-[#BAF14D]">
                      {group.invite_code}
                    </p>
                    <p className="text-sm leading-[1.6] text-white/85">
                      In Shift, open the Community tab, tap Join, and enter the code. Your
                      trips count for {school.shortName} from that moment on.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-6">
                <span className="mb-2 inline-block rounded-full border border-white/[0.18] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/75">
                  Joining this fall
                </span>
                <h2 className="mb-2 text-lg font-bold text-white">
                  {school.shortName}&rsquo;s group opens soon
                </h2>
                <p className="text-[0.9375rem] leading-[1.6] text-white/85">
                  Get the app now and start exploring — we&rsquo;ll flip the switch on{' '}
                  {school.shortName}&rsquo;s group shortly, and joining takes one tap. Want it
                  sooner, or want to help lead it on campus?{' '}
                  <Link href="/contact" className="font-semibold text-[#BAF14D] underline underline-offset-2">
                    Tell us
                  </Link>
                  .
                </p>
              </div>
            )}
            {IS_LIVE && <StoreButtons iosUrl={iosUrl} androidUrl={androidUrl} className="mt-6" />}
          </div>
        </section>

        {/* Getting around */}
        <section className="px-8 pb-14" id="benefits">
          <div className="mx-auto max-w-[860px]">
            <h2 className="mb-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              Getting around {school.shortName}
            </h2>
            <p className="mb-6 max-w-[620px] text-[0.9375rem] leading-relaxed text-white/80">
              Your school already gives you a head start — these are the transit, bike, and
              campus-mobility benefits {school.shortName} students can use today.
            </p>
            <div className="space-y-5">
              <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#5BD6C0]">Transit</h3>
                <FactList facts={school.transit} />
              </div>
              <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#BAF14D]">Bike</h3>
                <FactList facts={school.bike} />
              </div>
              <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-[#EDB93C]">Around campus</h3>
                <FactList facts={school.moving} />
              </div>
            </div>
            <p className="mt-4 text-xs text-white/70">
              Programs and prices change each term — check the linked school pages for current details.
            </p>
          </div>
        </section>

        {/* Events + roams near campus */}
        {(events.length > 0 || roams.length > 0) && (
          <section className="px-8 pb-14" id="events">
            <div className="mx-auto max-w-[860px]">
              <EventsRoamsPanels events={events} roams={roams} townName={school.shortName} />
            </div>
          </section>
        )}

        {/* Share kit */}
        {group && joinUrl && (
          <section className="px-8 pb-14" id="share">
            <div className="mx-auto max-w-[860px]">
              <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-6">
                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/75">
                  Spread it on campus
                </p>
                <p className="mb-5 text-sm leading-[1.6] text-white/85">
                  Running a club, an orientation group, or a dorm floor? Share the join
                  link, post the code, or print the poster.
                </p>
                <CorporateShareKit
                  shareUrl={pageUrl}
                  blurb={blurb}
                  emailSubject={`Join ${school.shortName} on Shift — $25 for 10 active trips`}
                  emailBody={blurb}
                  inviteCode={group.invite_code}
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
              Your first 10 trips are worth $25.
            </h2>
            <p className="mb-6 text-[1.0625rem] leading-relaxed text-white/80">
              Download Shift, join {school.shortName}, and turn the walk to class into
              something more.
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
