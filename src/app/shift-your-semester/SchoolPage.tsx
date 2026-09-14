import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import JsonLd from '@/components/JsonLd'
import { EventsRoamsPanels } from '@/components/towns/TownSections'
import TownToc from '@/components/towns/TownToc'
import SemesterJoinCard from '@/components/semester/SemesterJoinCard'
import SchoolLeaderboardBoard from '@/components/schools/SchoolLeaderboardBoard'
import OfferLedger from '@/components/semester/OfferLedger'
import CampusMap from '@/components/semester/CampusMap'
import SchoolPerks from '@/components/semester/SchoolPerks'
import CopyLinkButton from '@/components/semester/CopyLinkButton'
import { LANE, RouteSegment } from '@/components/home/RouteLine'
import { PILL, Section, SectionHeading } from '@/components/org/Section'
import CorporateShareKit from '@/app/events/shift-your-summer/share/[slug]/CorporateShareKit'
import { SEMESTER_CLOSES, SEMESTER_CODE, SEMESTER_OPENS, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS } from '@/lib/semester/campaign'
import { IS_LIVE, type SchoolData } from './_lib/load'
import { activeCampusChallenge } from './_lib/campus-challenge'

/*
 * One school's page. Rendered by the production route and by the staging
 * route with the code-live flag forced on. `capture={false}` keeps preview
 * traffic out of the PostHog funnel.
 */
export default function SchoolPage({ d, capture = true }: { d: SchoolData; capture?: boolean }) {
  const { school, codeLive, group, joinUrl, qrSvg } = d
  const hasEvents = d.events.length > 0 || d.roams.length > 0
  const challenge = activeCampusChallenge(school)

  const toc: Array<[string, string]> = [
    ['#join', group ? 'Join' : 'Get the app'],
    ...(challenge ? [['#campus-challenge', challenge.navLabel] as [string, string]] : []),
    ...(d.boardLive ? [['#standings', 'Standings'] as [string, string]] : []),
    ['#around', 'Around campus'],
    ['#benefits', 'Campus perks'],
    ...(hasEvents ? [['#events', 'Events'] as [string, string]] : []),
    ...(group ? [['#share', 'Share'] as [string, string]] : []),
  ]

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream">
        {/* Hero: copy left, the school's mark right. */}
        <section className="relative overflow-x-clip bg-cream" style={{ paddingTop: '60px' }}>
          <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
            <RouteSegment shape="wanderLeft" />
            <div className="hidden md:block" />
            <div className="grid items-center gap-8 pb-10 pt-12 md:pt-16 lg:grid-cols-[7fr_5fr] lg:gap-10">
              <div>
                <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">
                  <Link href="/shift-your-semester" className="underline-offset-4 hover:underline">
                    Shift Your Semester
                  </Link>{' '}
                  · {SEMESTER_OPENS.replace(', 2026', '')} – {SEMESTER_CLOSES}
                </p>
                <h1 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.05] tracking-[-0.01em] text-navy">
                  Shift Your Semester at {school.name}
                </h1>
                <p className="mt-5 max-w-[540px] text-[1.125rem] leading-[1.6] text-ink-soft">
                  {school.highlight ? `${school.highlight} ` : ''}
                  Join {school.shortName} on the free Shift app, take {SEMESTER_TRIPS} active trips in {SEMESTER_WINDOW_DAYS} days, and pick a{' '}
                  {SEMESTER_REWARD} reward from ~60 local merchants or a gift card you choose.
                </p>
              </div>
              <div className="flex h-[160px] items-center justify-center rounded-[18px] border border-navy/10 bg-white px-8 md:h-[220px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={school.logo} alt={school.name} className="max-h-[96px] w-auto max-w-[78%] object-contain md:max-h-[132px]" />
              </div>
            </div>
          </div>
        </section>

        <OfferLedger />

        <TownToc sections={toc} tone="light" />

        {/* Join */}
        <Section shape="straight" tone="white" id="join" className="scroll-mt-28">
          {group && joinUrl && qrSvg ? (
            <>
              <SemesterJoinCard
                schoolSlug={school.slug}
                shortName={school.shortName}
                primaryDomain={d.primaryDomain}
                appHref={d.appHref}
                joinUrl={joinUrl}
                inviteCode={group.invite_code}
                qrSvg={qrSvg}
                codeLive={codeLive}
                capture={capture}
              />
              <details className="group mt-6 max-w-[640px]">
                <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-forest underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                  Where do I enter the code? <span aria-hidden className="transition-transform group-open:rotate-90">&rsaquo;</span>
                </summary>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/shift-app/shift-join-sequence.png"
                  alt="How to enter your school code in the Shift app: tap the + button on the Community tab, then enter your invite code and tap Join."
                  width={840}
                  height={3433}
                  loading="lazy"
                  className="mt-4 h-auto w-full max-w-[340px] rounded-xl border border-navy/10"
                />
              </details>
            </>
          ) : (
            <div className="max-w-[620px]">
              <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.1] text-navy">Get the Shift app</h2>
              <p className="mt-4 text-[1.0625rem] leading-[1.65] text-ink-soft">
                {school.shortName}&rsquo;s group is being set up. Get the app now, verify your school email inside it, and you&rsquo;re in the
                moment the group is live.
              </p>
            </div>
          )}
          {IS_LIVE && <StoreButtons iosUrl={d.iosUrl} androidUrl={d.androidUrl} placement="semester_school" tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />}
        </Section>

        {/* The school's own challenge, while it is on. Ours and theirs count
            the same trip, so the ask is to do both. */}
        {challenge && (
          <Section shape="wanderRight" width="read" id="campus-challenge" className="scroll-mt-28">
            <SectionHeading
              title={
                <>
                  {school.shortName} is running <em className="text-green-deep">its own challenge too.</em>
                </>
              }
              lede={`${challenge.name}, ${challenge.period}.`}
            />
            <div className="grid gap-8 md:grid-cols-2 md:gap-12">
              <div>
                <p className="text-[1.0625rem] leading-[1.65] text-navy">{challenge.summary}</p>
                {challenge.thisMonth && (
                  <p className="mt-3 text-[1.0625rem] leading-[1.65] text-navy">
                    This month&rsquo;s prize is {challenge.thisMonth}.
                  </p>
                )}
                <a
                  href={challenge.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline"
                >
                  Join the {challenge.name} <span aria-hidden>&rarr;</span>
                </a>
              </div>
              <div className="border-t border-navy/15 pt-5 md:border-l md:border-t-0 md:pl-10 md:pt-0">
                <h3 className="font-serif text-[1.375rem] leading-tight text-navy">Do both.</h3>
                <p className="mt-2 text-[1.0625rem] leading-[1.65] text-ink-soft">
                  The same walk to class counts in each. Log it in {challenge.logsWith} for the {school.shortName} drawings, and let Shift
                  count it on its own toward your {SEMESTER_REWARD}.
                </p>
              </div>
            </div>
          </Section>
        )}

        {/* Standings, only once three schools clear the floor. */}
        {d.boardLive && (
          <Section shape="wanderRight" width="read" id="standings" className="scroll-mt-28">
            <SchoolLeaderboardBoard standings={d.standings} highlightGroupId={group?.id} />
          </Section>
        )}

        {/* Around campus: a real map, handing off to /nearby centred on campus. */}
        <Section shape="wanderLeft" width="read" id="around" className="scroll-mt-28">
          <SectionHeading
            title="What’s around campus"
            lede={`Everywhere you can walk, bike, or ride to from ${school.shortName}. The live map opens centred on campus.`}
          />
          <CampusMap lat={school.lat} lng={school.lng} href={d.nearbyHref} shortName={school.shortName} />
        </Section>

        {/* Campus perks */}
        <Section shape="straight" tone="white" id="benefits" className="scroll-mt-28">
          <SectionHeading title={`${school.shortName} campus perks`} lede="Your school already gives you a head start." />
          <SchoolPerks school={school} />
          <p className="mt-5 text-[13px] text-ink-soft">Programs and prices change each term. Check the linked school pages for current details.</p>
        </Section>

        {hasEvents && (
          <Section shape="wanderRight" id="events" className="scroll-mt-28">
            <EventsRoamsPanels events={d.events} roams={d.roams} townName={school.shortName} tone="light" />
          </Section>
        )}

        {group && joinUrl && (
          <Section shape="straight" tone="white" width="read" id="share" className="scroll-mt-28">
            <SectionHeading
              title="Spread it on campus"
              lede="Running a club, an orientation group, or a dorm floor? Post the poster, share the page, or pass the code along."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/shift-your-semester/${school.slug}/poster`} className={PILL}>
                Print the poster &rarr;
              </Link>
              <CopyLinkButton url={d.pageUrl} />
            </div>
            <details className="group mt-6">
              <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-forest underline-offset-4 hover:underline [&::-webkit-details-marker]:hidden">
                Blurb, email, and the code <span aria-hidden className="transition-transform group-open:rotate-90">&rsaquo;</span>
              </summary>
              <div className="mt-5 max-w-[640px]">
                <CorporateShareKit
                  shareUrl={d.pageUrl}
                  blurb={d.blurb}
                  emailSubject={`Join ${school.shortName} on Shift — ${SEMESTER_REWARD} for ${SEMESTER_TRIPS} active trips`}
                  emailBody={d.blurb}
                  inviteCode={codeLive ? SEMESTER_CODE : group.invite_code}
                  codeLabel={codeLive ? 'Campaign code' : 'Group code'}
                  tone="light"
                />
              </div>
            </details>
          </Section>
        )}

        <Section shape="terminal" closing>
          <h2 className="font-serif text-[clamp(2.25rem,5vw,3.75rem)] font-normal leading-[1.02] text-navy">
            Your first {SEMESTER_TRIPS} trips <em className="text-green-deep">are worth {SEMESTER_REWARD}.</em>
          </h2>
          <p className="mt-5 max-w-[520px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            {codeLive
              ? <>Get Shift, enter {SEMESTER_CODE}, verify your {school.shortName} email, and turn the walk to class into something more.</>
              : <>Get Shift, join {school.shortName}, and turn the walk to class into something more.</>}
          </p>
          {IS_LIVE && <StoreButtons iosUrl={d.iosUrl} androidUrl={d.androidUrl} placement="semester_school" tone="light" className="mt-8 [&>a]:max-[420px]:basis-full" />}
          <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-navy/15 pt-8 text-[15px]">
            <li>
              <Link href="/shift-your-semester#schools" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                All schools
              </Link>
            </li>
            <li>
              <Link href="/challenges" className="inline-flex min-h-[44px] items-center font-semibold text-navy underline-offset-4 hover:underline">
                Every challenge
              </Link>
            </li>
          </ul>
        </Section>
      </main>
      <Footer variant="light" />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `Shift Your Semester at ${school.name}`,
          url: d.pageUrl,
          about: { '@type': 'EducationalOrganization', name: school.name },
        }}
      />
    </>
  )
}
