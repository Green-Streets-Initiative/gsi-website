import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import WaitlistEmailForm from '@/components/WaitlistEmailForm'
import SchoolLeaderboardBoard from '@/components/schools/SchoolLeaderboardBoard'
import { SCHOOLS } from '@/lib/semester/schools'
import {
  SEMESTER_CAP, SEMESTER_CLOSES, SEMESTER_CODE, SEMESTER_CODE_LIVE, SEMESTER_OPENS,
  SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS,
} from '@/lib/semester/campaign'
import { getSchoolStandings } from '@/lib/schools/queries'

export const revalidate = 3600

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const IS_LIVE = !!(IOS_URL && ANDROID_URL)

export const metadata: Metadata = {
  title: `Shift Your Semester — ${SEMESTER_REWARD} for getting around like a local | Green Streets Initiative`,
  description: `College students, faculty, and staff in Massachusetts: walk, bike, and ride the T with Shift. Verify your school email, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days, and unlock a ${SEMESTER_REWARD} reward from local merchants or a gift card you choose.`,
  alternates: { canonical: 'https://www.gogreenstreets.org/shift-your-semester' },
  openGraph: {
    title: 'Shift Your Semester',
    description: `Verify your school email on Shift, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days, unlock a ${SEMESTER_REWARD} reward.`,
    url: 'https://www.gogreenstreets.org/shift-your-semester',
  },
}

const STEPS_LIVE = [
  { title: 'Get the Shift app', body: 'Free on iOS and Android. Sign up with whatever email you already use — Gmail, Apple, anything.' },
  { title: `Enter code ${SEMESTER_CODE}`, body: 'Tap your school’s link from this site, or type the code in the code field when you sign up. Installing from the store? The link won’t carry over — the code does.' },
  { title: 'Verify your school email in the app', body: 'Add your .edu address. We match it to your school, put you in your campus group, and you’re enrolled. Your account stays on the email you signed up with.' },
  { title: `Take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days`, body: 'Walk to class, bike the Esplanade, ride the T or the ferry. Shift logs them on its own — no check-ins.' },
  { title: `Pick your ${SEMESTER_REWARD} reward`, body: 'A gift card at one of ~60 local shops in the rewards catalog, or a digital gift card you choose.' },
]

const STEPS_PRE = [
  { title: 'Get the Shift app', body: 'Free on iOS and Android. Set up takes about a minute.' },
  { title: 'Join your school', body: 'One tap from your school’s page — your trips count for your campus.' },
  { title: `Take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days`, body: 'Walk to class, bike the Esplanade, ride the T — every trip counts automatically.' },
  { title: `Pick your ${SEMESTER_REWARD} reward`, body: 'Choose from ~60 local merchants — cafés, bike shops, restaurants — or a digital gift card you choose.' },
]

export default async function ShiftYourSemesterPage() {
  const standings = await getSchoolStandings().catch(() => [])
  const steps = SEMESTER_CODE_LIVE ? STEPS_LIVE : STEPS_PRE

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="px-8 pt-16 pb-10 md:pt-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">Shift Your Semester</div>
            <h1 className="mb-5 max-w-[760px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Get around like a local. Get {SEMESTER_REWARD} for it.
            </h1>
            <p className="mb-7 max-w-[560px] text-[1.0625rem] leading-relaxed text-white/80">
              Boston is one of the best cities in the country to explore on foot, by bike, and on the T. Shift turns
              those trips into rewards — starting with {SEMESTER_REWARD} for your first {SEMESTER_TRIPS} active trips.
            </p>
            {IS_LIVE ? <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} /> : <WaitlistEmailForm source="shift_your_semester" />}
          </div>
        </section>

        {/* How it works */}
        <section className="px-8 pb-14 pt-6">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-7 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">How it works</h2>
            <div className={`grid gap-4 sm:grid-cols-2 ${steps.length === 5 ? 'md:grid-cols-3 lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
              {steps.map((s, i) => (
                <div key={s.title} className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#BAF14D] font-display text-base font-bold text-[#191A2E]">
                    {i + 1}
                  </div>
                  <h3 className="mb-1.5 font-display text-[1.0625rem] font-bold text-white">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-white/75">{s.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-[640px] text-sm leading-relaxed text-white/75">
              Active trips are walks, bike rides, and transit or ferry trips the app detects automatically. For
              verified students, faculty, and staff at Massachusetts colleges and universities. First {SEMESTER_CAP} to
              qualify; {SEMESTER_OPENS} through {SEMESTER_CLOSES}. One campaign code per account — if you already
              used NEWROUTES, you&rsquo;re covered by that one.
              {!SEMESTER_CODE_LIVE && (
                <> Reward enrollment — the {SEMESTER_CODE} code and school-email check — opens in the app shortly. Get
                the app and join your school&rsquo;s group now.</>
              )}
            </p>
          </div>
        </section>

        {/* Schools */}
        <section className="px-8 pb-14">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">Find your school</h2>
            <p className="mb-7 max-w-[620px] text-[0.9375rem] leading-relaxed text-white/80">
              Every school page has your campus&rsquo;s transit and bike perks, events nearby, and your school&rsquo;s
              join code — and you can see how your school stacks up below.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SCHOOLS.map((school) => (
                <Link
                  key={school.slug}
                  href={`/shift-your-semester/${school.slug}`}
                  className="group rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-5 transition-colors hover:bg-white/[0.07]"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="flex h-[52px] items-center rounded-[10px] bg-white px-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={school.logo} alt={school.name} className="h-[36px] w-auto max-w-[130px] object-contain" />
                    </span>
                  </div>
                  <p className="font-display text-[0.9375rem] font-bold text-white">{school.name}</p>
                  {school.highlight && <p className="mt-1 text-[13px] leading-snug text-white/75">{school.highlight}</p>}
                  <p className="mt-2 text-[13px] font-semibold text-[#BAF14D]">Campus page &rarr;</p>
                </Link>
              ))}
            </div>
            <p className="mt-5 text-sm text-white/75">
              Featured schools are colleges within the MBTA&rsquo;s core service area. Any Massachusetts college or
              university qualifies — verify your school email in the app and you&rsquo;re in. Want your school
              featured?{' '}
              <Link href="/contact" className="font-semibold text-[#BAF14D] underline underline-offset-2">Tell us</Link>.
            </p>
          </div>
        </section>

        {/* Standings */}
        <section className="px-8 pb-14">
          <div className="mx-auto max-w-[820px]">
            <SchoolLeaderboardBoard standings={standings} />
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-8 pb-24 pt-4 text-center">
          <div className="mx-auto max-w-[560px]">
            <h2 className="mb-3 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              Your first {SEMESTER_TRIPS} trips are worth {SEMESTER_REWARD}.
            </h2>
            <p className="mb-6 text-[1.0625rem] leading-relaxed text-white/80">
              {SEMESTER_CODE_LIVE
                ? <>Download Shift, enter {SEMESTER_CODE}, verify your school email, and turn the walk to class into something more.</>
                : <>Download Shift, join your school, and turn the walk to class into something more.</>}
            </p>
            {IS_LIVE ? (
              <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} className="justify-center" />
            ) : (
              <WaitlistEmailForm source="shift_your_semester" />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
