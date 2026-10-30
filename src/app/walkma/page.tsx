import type { Metadata } from 'next'
import Link from 'next/link'
import StepButton from './StepButton'

/**
 * gogreenstreets.org/walkma: the one link for GSI's team in WalkMassachusetts's
 * Beat the Bay State (Nov 1-30, 2026). Keith 2026-10-30: two steps, nothing
 * else. Step 1 is RunSignUp's own join link for our team (RaceGroup 2258507)
 * with Keith's referral code; step 2 is the Shift group (code WALKMA, Shift
 * migration 01529). Same look as /links.
 */

const REGISTER_URL = 'https://runsignup.com/Race/Register/RaceGroup-2258507?raceId=98597&raceRefCode=Ga0nqDWm'
const SHIFT_JOIN_URL = 'https://shift.gogreenstreets.org/join/WALKMA'

export const metadata: Metadata = {
  title: 'Walk around Massachusetts with us | Green Streets Initiative',
  description:
    "Join Team Green Streets in WalkMassachusetts's Beat the Bay State challenge, Nov 1 to 30. Shift counts your walking miles for you.",
  alternates: { canonical: '/walkma' },
  robots: { index: true, follow: true },
}

export default function WalkMaPage() {
  return (
    <main className="street min-h-screen bg-cream px-4 pb-14 pt-6 text-navy sm:pt-12">
      <div className="mx-auto w-full max-w-[560px]">
        <header className="rounded-2xl bg-forest px-6 pb-6 pt-5 text-white shadow-md ring-2 ring-white ring-inset">
          <p
            className="text-[17px] leading-tight tracking-[0.3px] text-white/90"
            style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}
          >
            <span className="font-bold">Green Streets</span> <span className="font-normal">Initiative</span>
          </p>
          <h1 className="mt-3 font-headline text-[clamp(26px,7vw,34px)] font-extrabold leading-[1.1]">
            Walk around Massachusetts with us
          </h1>
          <p className="mt-3 text-[16px] leading-snug text-white/90">
            WalkMassachusetts&rsquo;s Beat the Bay State: teams walk the 900 miles around the state in
            November. We&rsquo;re in, and Shift counts your miles.
          </p>
        </header>

        <ol className="mt-8 flex flex-col gap-3">
          <li>
            <StepButton
              n={1}
              label="Register on our team"
              sublabel="$20 to WalkMassachusetts, Nov 1 to 30. Then come back for step 2."
              href={REGISTER_URL}
            />
          </li>
          <li>
            <StepButton
              n={2}
              label="Join our group in Shift"
              sublabel="Code WALKMA. Shift counts the walks you take."
              href={SHIFT_JOIN_URL}
            />
          </li>
        </ol>

        <p className="mt-8 text-[16px] leading-relaxed text-navy">
          Then just walk: to the train, the store, school. Twice in November we&rsquo;ll email your walking
          miles so entering them for the team takes a minute.
        </p>

        <p className="mt-10 text-center text-[15px] text-ink-muted">
          <Link href="/" className="font-bold text-forest underline underline-offset-4 hover:text-green-deep">
            gogreenstreets.org
          </Link>
        </p>
      </div>
    </main>
  )
}
