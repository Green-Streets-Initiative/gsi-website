import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import StoreButtons from '@/components/StoreButtons'
import WaitlistEmailForm from '@/components/WaitlistEmailForm'

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

// Boston-area colleges inside the MBTA core service area — the campaign's
// catchment. `live: true` once the school's group exists in the Shift DB.
const SCHOOLS: { name: string; live?: boolean }[] = [
  { name: 'Emerson College', live: true },
  { name: 'Boston College' },
  { name: 'Boston University' },
  { name: 'Northeastern University' },
  { name: 'Harvard University' },
  { name: 'MIT' },
  { name: 'Tufts University' },
  { name: 'UMass Boston' },
  { name: 'Suffolk University' },
  { name: 'Berklee College of Music' },
  { name: 'Simmons University' },
  { name: 'Lesley University' },
]

const STEPS = [
  {
    n: '1',
    title: 'Get the Shift app',
    body: 'Free on iOS and Android. Set up takes about a minute.',
  },
  {
    n: '2',
    title: 'Join your school',
    body: 'Pick your school’s group in the app and rep your campus.',
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
      <main style={{ paddingTop: '60px' }}>
        {/* Hero */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              Shift Your Semester
            </div>
            <h1 className="mb-6 max-w-[760px] font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Get around like a local. Get $25 for it.
            </h1>
            <p className="mb-8 max-w-[560px] text-[1.0625rem] leading-relaxed text-white/80">
              Boston is one of the best cities in the country to explore on foot,
              by bike, and on the T. Shift turns those trips into rewards — starting
              with $25 back for your first 10 active trips.
            </p>
            {IS_LIVE ? (
              <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} />
            ) : (
              <WaitlistEmailForm source="shift_your_semester" />
            )}
          </div>
        </section>

        {/* How it works */}
        <section className="bg-[#12131F] px-8 py-20">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-12 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold tracking-tight text-white">
              How it works
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <div
                  key={s.n}
                  className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#BAF14D] font-display text-lg font-bold text-[#191A2E]">
                    {s.n}
                  </div>
                  <h3 className="mb-2 font-display text-lg font-bold text-white">
                    {s.title}
                  </h3>
                  <p className="text-[0.9375rem] leading-relaxed text-white/75">{s.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 max-w-[640px] text-sm leading-relaxed text-white/75">
              Active trips are walking, biking, and transit rides, verified
              automatically by the app. Full reward details and eligibility are in
              the app.
            </p>
          </div>
        </section>

        {/* Schools */}
        <section className="bg-[#191A2E] px-8 py-20">
          <div className="mx-auto max-w-[1120px]">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold tracking-tight text-white">
              Find your school
            </h2>
            <p className="mb-12 max-w-[560px] text-[1.0625rem] leading-relaxed text-white/80">
              Join your school&apos;s group in the app to count toward your campus —
              and keep an eye out for the school leaderboard this fall.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {SCHOOLS.map((school) => (
                <div
                  key={school.name}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.12] bg-white/[0.04] px-5 py-4"
                >
                  <span className="font-display text-[0.9375rem] font-bold text-white">
                    {school.name}
                  </span>
                  {school.live ? (
                    <span className="rounded-full bg-[#BAF14D] px-3 py-1 text-xs font-bold text-[#191A2E]">
                      Live now
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/[0.18] px-3 py-1 text-xs font-semibold text-white/75">
                      Joining this fall
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-white/75">
              Featured schools are colleges within the MBTA&apos;s core service area.
              Don&apos;t see yours? You can still use Shift and earn the reward —
              your school&apos;s group is coming.
            </p>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-[#12131F] px-8 py-20 text-center">
          <div className="mx-auto max-w-[640px]">
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold tracking-tight text-white">
              Your first 10 trips are on us.
            </h2>
            <p className="mb-8 text-[1.0625rem] leading-relaxed text-white/80">
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
