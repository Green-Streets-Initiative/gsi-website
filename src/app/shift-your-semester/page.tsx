import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import WaitlistEmailForm from '@/components/WaitlistEmailForm'
import { SCHOOLS } from '@/lib/semester/schools'

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || ''
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL || ''
const IS_LIVE = !!(IOS_URL && ANDROID_URL)

export const metadata: Metadata = {
  title: 'Shift Your Semester — $25 for getting around like a local | Green Streets Initiative',
  description:
    'College students: walk, bike, and ride the T with Shift. Join your school, take 10 active trips in 30 days, and pick a $25 reward from local merchants and national gift cards.',
  alternates: { canonical: 'https://www.gogreenstreets.org/shift-your-semester' },
  openGraph: {
    title: 'Shift Your Semester',
    description:
      'Join your school on Shift, take 10 active trips in 30 days, earn a $25 reward.',
    url: 'https://www.gogreenstreets.org/shift-your-semester',
  },
}

const STEPS = [
  {
    n: '1',
    title: 'Get the Shift app',
    body: 'Free on iOS and Android. Set up takes about a minute.',
  },
  {
    n: '2',
    title: 'Join your school',
    body: 'One tap from your school’s page — your trips count for your campus.',
  },
  {
    n: '3',
    title: 'Take 10 active trips in 30 days',
    body: 'Walk to class, bike the Esplanade, ride the T — every trip counts automatically.',
  },
  {
    n: '4',
    title: 'Pick your $25 reward',
    body: 'Choose from ~60 local merchants — cafés, bike shops, restaurants — or a national gift card.',
  },
]

export default function ShiftYourSemesterPage() {
  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="px-8 pt-16 pb-10 md:pt-24">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Shift Your Semester
            </div>
            <h1 className="mb-5 max-w-[760px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Get around like a local. Get $25 for it.
            </h1>
            <p className="mb-7 max-w-[560px] text-[1.0625rem] leading-relaxed text-white/80">
              Boston is one of the best cities in the country to explore on foot,
              by bike, and on the T. Shift turns those trips into rewards — starting
              with $25 for your first 10 active trips.
            </p>
            {IS_LIVE ? (
              <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} />
            ) : (
              <WaitlistEmailForm source="shift_your_semester" />
            )}
          </div>
        </section>

        {/* How it works */}
        <section className="px-8 pb-14 pt-6">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-7 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              How it works
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-5"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#BAF14D] font-display text-base font-bold text-[#191A2E]">
                    {s.n}
                  </div>
                  <h3 className="mb-1.5 font-display text-[1.0625rem] font-bold text-white">
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/75">{s.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 max-w-[640px] text-sm leading-relaxed text-white/75">
              Active trips are walking, biking, and transit rides, verified
              automatically by the app. The reward works through your school&rsquo;s
              group — full details and eligibility are in the app.
            </p>
          </div>
        </section>

        {/* Schools */}
        <section className="px-8 pb-14">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-2 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              Find your school
            </h2>
            <p className="mb-7 max-w-[620px] text-[0.9375rem] leading-relaxed text-white/80">
              Every school page has your campus&rsquo;s transit and bike benefits, events
              nearby, and the one-tap join for your school&rsquo;s group — plus the school
              leaderboard this fall.
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
                      <img
                        src={school.logo}
                        alt={school.name}
                        className="h-[36px] w-auto max-w-[130px] object-contain"
                      />
                    </span>
                    {school.groupSlug ? (
                      <span className="shrink-0 rounded-full bg-[#BAF14D] px-3 py-1 text-xs font-bold text-[#191A2E]">
                        Live now
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-white/[0.18] px-3 py-1 text-xs font-semibold text-white/75">
                        Joining this fall
                      </span>
                    )}
                  </div>
                  <p className="font-display text-[0.9375rem] font-bold text-white">
                    {school.name}
                  </p>
                  {school.highlight && (
                    <p className="mt-1 text-[13px] leading-snug text-white/75">{school.highlight}</p>
                  )}
                  <p className="mt-2 text-[13px] font-semibold text-[#BAF14D]">
                    Campus page &rarr;
                  </p>
                </Link>
              ))}
            </div>
            <p className="mt-5 text-sm text-white/75">
              Featured schools are colleges within the MBTA&rsquo;s core service area.
              Don&rsquo;t see yours?{' '}
              <Link href="/contact" className="font-semibold text-[#BAF14D] underline underline-offset-2">
                Tell us
              </Link>{' '}
              — we&rsquo;ll set your school&rsquo;s group up so you can earn the reward too.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-8 pb-24 pt-4 text-center">
          <div className="mx-auto max-w-[560px]">
            <h2 className="mb-3 font-display text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-white">
              Your first 10 trips are worth $25.
            </h2>
            <p className="mb-6 text-[1.0625rem] leading-relaxed text-white/80">
              Download Shift, join your school, and turn the walk to class into
              something more.
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
