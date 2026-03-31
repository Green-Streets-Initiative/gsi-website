import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'

export const metadata = {
  title: 'Help — Green Streets Initiative',
  description:
    'Everything you need to know about using Shift, redeeming rewards, running a schools challenge, or joining as a partner.',
}

/* ------------------------------------------------------------------ */
/*  Quick-link card data                                               */
/* ------------------------------------------------------------------ */

const quickLinks = [
  {
    label: 'App Users',
    sections: [
      { name: 'Getting Started', anchor: '#getting-started' },
      { name: 'Tracking Your Trips', anchor: '#trip-tracking' },
      { name: 'Points & Rewards', anchor: '#points-rewards' },
      { name: 'Badges, Streaks & Tiers', anchor: '#badges-streaks-tiers' },
      { name: 'Finding Rewards Partners', anchor: '#rewards-partners-users' },
    ],
  },
  {
    label: 'Rewards Partners',
    sections: [
      { name: 'For Rewards Partners', anchor: '#for-rewards-partners' },
    ],
  },
  {
    label: 'Schools',
    sections: [{ name: 'For Schools', anchor: '#for-schools' }],
  },
]

/* ------------------------------------------------------------------ */
/*  FAQ section data                                                   */
/* ------------------------------------------------------------------ */

const linkClass = 'underline hover:text-[#2966E5] transition-colors'

const faqSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        question: 'What is Shift?',
        answer:
          'Shift is a free app from Green Streets Initiative that logs your walking, biking, and transit trips \u2014 and rewards you for choosing active transportation. You\u2019ll earn points, unlock achievement badges, climb tier levels, and redeem rewards at local businesses.',
      },
      {
        question: 'How do I download the Shift app?',
        answer: (
          <p>
            Shift is available on the App Store (iPhone) and Google Play
            (Android). Search for &ldquo;Shift by Green Streets Initiative&rdquo;
            or follow the download links on our{' '}
            <Link href="/" className={linkClass}>
              homepage
            </Link>
            .
          </p>
        ),
      },
      {
        question: 'How do I create an account?',
        answer:
          'Open the app and tap "Get Started." You can sign up with your email address, or sign in with Apple or Google. You\u2019ll be asked to choose a display name and can add your neighborhood to appear on local leaderboards.',
      },
      {
        question: 'Is Shift really free?',
        answer:
          'Yes. Shift is completely free to download and use. There are no premium tiers, in-app purchases, or hidden fees.',
      },
    ],
  },
  {
    id: 'trip-tracking',
    title: 'Tracking Your Trips',
    items: [
      {
        question: 'How does trip tracking work?',
        answer:
          'Shift uses background location services on your phone to automatically detect when you\u2019re walking, biking, or taking transit. When a trip is detected, it\u2019s logged with the distance, duration, and mode. You\u2019ll see it appear in your trip history.',
      },
      {
        question: 'What transportation modes count?',
        answer:
          'Shift recognizes walking, biking, public transit (bus, subway, commuter rail), carpooling, and e-scooter rides. These are the modes that earn points. Driving does not earn points.',
      },
      {
        question: 'Why didn\u2019t my trip get logged?',
        answer:
          'A few common reasons: (1) Location permissions may not be set to "Always Allow" \u2014 check your phone\u2019s Settings > Shift > Location. (2) Very short trips (under a couple of minutes) may not register. (3) Poor GPS signal in areas like tunnels or underground stations can occasionally cause a trip to be missed. If a trip is missing, you can always log it manually.',
      },
      {
        question: 'Can I log a trip manually?',
        answer:
          'Yes. The Log tab is one of the app\u2019s four main tabs. Tap it to enter the mode, approximate distance, and date. Manual trips earn points the same way automatic trips do.',
      },
      {
        question: 'How accurate is background tracking?',
        answer:
          'Background tracking is generally accurate within a reasonable margin. GPS precision varies depending on your environment \u2014 dense urban areas with tall buildings and underground transit can reduce accuracy. The app uses intelligent filtering to distinguish modes, but occasional misclassifications can happen.',
      },
      {
        question: 'Does tracking drain my battery?',
        answer:
          'Shift uses efficient background location services designed to minimize battery impact. Most users see minimal additional drain. If you notice an issue, make sure your phone\u2019s OS and the Shift app are both up to date.',
      },
    ],
  },
  {
    id: 'points-rewards',
    title: 'Points & Rewards',
    items: [
      {
        question: 'How do I earn points?',
        answer:
          'You earn points every time you log an active trip (walk, bike, transit, carpool, or e-scooter). The number of points you earn per trip depends on your current tier: Starters earn 1 point per trip, Movers earn 2, Shifters earn 3, Pacesetters earn 4, and Trailblazers earn 5. You can also earn points for unlocking achievements and by submitting your story to What Moves Us campaigns, if eligible. The maximum you can earn is 15 points per day.',
      },
      {
        question: 'How do I redeem points at a Rewards Partner?',
        answer:
          'Browse available rewards in the Rewards tab of the app. When you find one you\u2019d like to redeem, tap it to generate a QR code. Show this QR code to the cashier at the partner location \u2014 they\u2019ll scan it with any phone to confirm your redemption. Each reward listing shows the point cost and any terms.',
      },
      {
        question: 'Where can I see my points balance?',
        answer:
          'Your current points balance is displayed at the top of the Rewards tab and on your profile screen.',
      },
      {
        question: 'Do points expire?',
        answer:
          'Points expire after 12 months of account inactivity. As long as you\u2019re taking active trips, your points are safe.',
      },
      {
        question:
          'I redeemed points but the partner didn\u2019t accept my code. What do I do?',
        answer: (
          <p>
            Contact us at{' '}
            <a href="mailto:help@gogreenstreets.org" className={linkClass}>
              help@gogreenstreets.org
            </a>{' '}
            with the redemption details, partner name, and date. We&rsquo;ll
            sort it out and make sure you&rsquo;re not out any points.
          </p>
        ),
      },
    ],
  },
  {
    id: 'badges-streaks-tiers',
    title: 'Badges, Streaks & Tiers',
    items: [
      {
        question: 'What are the tier levels?',
        answer:
          'Shift has five tiers: Starter, Mover, Shifter, Pacesetter, and Trailblazer. You advance through tiers by accumulating active trips and maintaining each tier\u2019s target Shift Rate \u2014 the percentage of your total trips that are active (walk, bike, or transit).',
      },
      {
        question: 'What is Shift Rate?',
        answer:
          'Shift Rate is the percentage of your total trips that are active \u2014 walking, biking or scooting, or taking transit. It\u2019s calculated over the last 7 days and is the core metric Shift uses to measure your transportation habits. It\u2019s one of the factors that determines your tier level.',
      },
      {
        question: 'How do achievement badges work?',
        answer:
          'Achievement badges are earned by reaching specific milestones \u2014 trying new modes, completing challenges, hitting cumulative distance goals, and more. Check your profile to see which achievements you\u2019ve unlocked and what\u2019s next.',
      },
      {
        question: 'How do streaks work?',
        answer:
          'A streak counts consecutive days where you log at least one active trip. There\u2019s a built-in 2-day grace period \u2014 if you miss a single day, your streak stays alive. Miss two consecutive days and the streak resets. We also protect your streak during MBTA service disruptions, so you won\u2019t be penalized for something outside your control.',
      },
      {
        question: 'What happens if I break a streak?',
        answer:
          'Your streak counter resets to zero, but your longest streak is saved on your profile. Streaks are meant to be motivating, not punishing \u2014 just start a new one whenever you\u2019re ready.',
      },
    ],
  },
  {
    id: 'rewards-partners-users',
    title: 'Finding Rewards Partners',
    items: [
      {
        question: 'How do I find Rewards Partners near me?',
        answer:
          'The Rewards tab in the app shows available partner offers in your area. You can browse the list to find partners near you.',
      },
      {
        question: 'What kinds of rewards are available?',
        answer:
          'Rewards vary by partner \u2014 they can include discounts, free items, or special offers. Each partner sets their own reward and the points required to redeem it.',
      },
      {
        question: 'Can I suggest a business as a Rewards Partner?',
        answer: (
          <p>
            Absolutely. If there&rsquo;s a local business you&rsquo;d love to
            see in the Shift network, let us know at{' '}
            <a
              href="mailto:partners@gogreenstreets.org"
              className={linkClass}
            >
              partners@gogreenstreets.org
            </a>{' '}
            or share their info through the app. We&rsquo;re always growing the
            network.
          </p>
        ),
      },
    ],
  },
  {
    id: 'for-rewards-partners',
    title: 'For Rewards Partners',
    items: [
      {
        question: 'How do I become a Shift Rewards Partner?',
        answer: (
          <p>
            We&rsquo;d love to have you. Visit{' '}
            <Link href="/shift/rewards-partners" className={linkClass}>
              gogreenstreets.org/shift/rewards-partners
            </Link>{' '}
            or email{' '}
            <a
              href="mailto:partners@gogreenstreets.org"
              className={linkClass}
            >
              partners@gogreenstreets.org
            </a>
            . We&rsquo;ll walk you through the setup \u2014 it&rsquo;s simple
            and free to participate.
          </p>
        ),
      },
      {
        question: 'How do I verify a Shift redemption?',
        answer:
          'Using any phone, have your cashier scan the QR code shown on the Shift user\u2019s app screen. That\u2019s it \u2014 no need to log into a dashboard or verify anything else at the time of redemption. When you join, we\u2019ll provide a 1-page printed guide to redemptions that you can keep at the register.',
      },
      {
        question: 'How do I access my business dashboard?',
        answer: (
          <p>
            Log in at{' '}
            <Link href="/shift/rewards-partners" className={linkClass}>
              gogreenstreets.org/shift/rewards-partners
            </Link>{' '}
            with the credentials you set up during onboarding. The dashboard
            shows your active offers, redemption history, and monthly summary
            reports.
          </p>
        ),
      },
      {
        question: 'What does it cost to be a Rewards Partner?',
        answer:
          'Nothing. There are no fees to join the Shift Rewards Partner network. You set the reward you\u2019re comfortable offering, and you benefit from exposure to an engaged community of sustainability-minded local customers.',
      },
      {
        question: 'Can I change or pause my reward offer?',
        answer:
          'Yes. You can update your offer, change the points required, or temporarily pause your listing from your business dashboard at any time.',
      },
    ],
  },
  {
    id: 'for-schools',
    title: 'For Schools',
    items: [
      {
        question: 'How does the Shift for Schools program work?',
        answer:
          'Shift for Schools is a classroom-based active transportation challenge. Each day, teachers take a quick tally using a simple show of hands to see how students got to school. Classrooms earn recognition for walking, biking, and taking transit \u2014 and can compete within and across schools. The program is designed to be fun, easy to run, and fully COPPA-compliant. No student accounts or personal data are collected.',
      },
      {
        question: 'How do classroom codes work?',
        answer: (
          <p>
            Each participating classroom receives a unique 6-character code. The
            teacher uses this code to submit the classroom&rsquo;s daily tally
            through the{' '}
            <Link href="/shift/schools" className={linkClass}>
              Shift for Schools portal
            </Link>
            . Codes are assigned during program setup and stay the same for the
            duration of the challenge.
          </p>
        ),
      },
      {
        question: 'I\u2019m a School Coordinator \u2014 where do I start?',
        answer: (
          <p>
            Welcome! As School Coordinator, you&rsquo;re the main point of
            contact between your school and Green Streets Initiative. Start by
            reviewing the program overview and School Coordinator Quick-Start
            Card we&rsquo;ll share during onboarding. Your first steps are
            confirming participating classrooms, distributing classroom codes to
            teachers, and sharing the parent information sheet. Reach out to{' '}
            <a
              href="mailto:schools@gogreenstreets.org"
              className={linkClass}
            >
              schools@gogreenstreets.org
            </a>{' '}
            any time.
          </p>
        ),
      },
      {
        question: 'I\u2019m a parent \u2014 how can I help?',
        answer: (
          <p>
            Parents play a key role as Parent Volunteers and Walk &amp; Bike Bus
            Leaders. A Walk &amp; Bike Bus is a group of families who walk or
            bike a set route to school together. If you&rsquo;re interested in
            starting or joining one, talk to your School Coordinator or email{' '}
            <a
              href="mailto:schools@gogreenstreets.org"
              className={linkClass}
            >
              schools@gogreenstreets.org
            </a>
            .
          </p>
        ),
      },
      {
        question: 'Is student data private?',
        answer:
          'Yes. Shift for Schools is designed with student privacy at its core. No individual student accounts are created. Data is collected at the classroom level only (e.g., "12 students walked today") \u2014 no names, locations, or personal information are ever involved. The program is fully COPPA-compliant.',
      },
      {
        question: 'Can students use the Shift app?',
        answer:
          'The Shift app is designed for users 13 and older. The Shift for Schools classroom challenge is a separate, app-free experience \u2014 students participate through their teacher\u2019s daily show-of-hands tally without needing any device or account.',
      },
    ],
  },
  {
    id: 'privacy-data',
    title: 'Privacy & Data',
    items: [
      {
        question: 'What data does Shift collect?',
        answer: (
          <p>
            Shift collects your email, display name, and trip data (start/end
            location area, distance, duration, mode). Location data is used to
            detect and log trips. We never sell your personal data. For full
            details, see our{' '}
            <Link href="/privacy" className={linkClass}>
              Privacy Policy
            </Link>
            .
          </p>
        ),
      },
      {
        question: 'How is my location data used?',
        answer:
          'Location data is used solely to detect and record your trips. We use it to calculate distances, identify transportation modes, and place you on neighborhood leaderboards (if you\u2019ve opted in). We do not share raw location data with third parties.',
      },
      {
        question: 'How do I delete my account and data?',
        answer: (
          <p>
            You can delete your account from the Settings screen in the app.
            This permanently removes your profile, trip history, and all
            associated data. If you have any trouble, email{' '}
            <a href="mailto:help@gogreenstreets.org" className={linkClass}>
              help@gogreenstreets.org
            </a>{' '}
            and we&rsquo;ll take care of it.
          </p>
        ),
      },
    ],
  },
  {
    id: 'account-settings',
    title: 'Account & Settings',
    items: [
      {
        question: 'How do I reset my password?',
        answer:
          'Tap "Forgot Password" on the login screen and enter your email. You\u2019ll receive a password reset link. If you don\u2019t see it, check your spam folder.',
      },
      {
        question: 'How do I change my display name or neighborhood?',
        answer:
          'Go to Settings > Profile in the app. You can update your display name and neighborhood at any time.',
      },
      {
        question: 'I\u2019m having a technical issue not listed here.',
        answer: (
          <p>
            Email us at{' '}
            <a href="mailto:help@gogreenstreets.org" className={linkClass}>
              help@gogreenstreets.org
            </a>{' '}
            with a description of the issue, your phone model, and OS version.
            Screenshots help too. We&rsquo;ll get back to you as quickly as we
            can.
          </p>
        ),
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HelpPage() {
  return (
    <>
      <Nav />
      <main style={{ paddingTop: '60px' }}>
        {/* ---- Hero ---- */}
        <section className="bg-[#191A2E] px-8 py-24 md:py-32">
          <div className="mx-auto max-w-[1120px] text-center">
            <h1 className="font-display text-[clamp(2.25rem,5vw,3.5rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              How can we help?
            </h1>
            <p className="mx-auto mt-5 max-w-[640px] text-[1.0625rem] leading-[1.65] text-white/70">
              Everything you need to know about using Shift, redeeming rewards,
              running a schools challenge, or joining as a partner.
            </p>
          </div>
        </section>

        {/* ---- Quick Links ---- */}
        <section className="bg-[#F4F8EE] px-8 py-16">
          <div className="mx-auto grid max-w-[1120px] gap-6 md:grid-cols-3">
            {quickLinks.map((card) => (
              <div
                key={card.label}
                className="rounded-[18px] border border-[rgba(25,26,46,0.09)] bg-white p-6"
              >
                <h2 className="font-display text-lg font-bold tracking-tight text-[#191A2E]">
                  {card.label}
                </h2>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {card.sections.map((s) => (
                    <li key={s.anchor}>
                      <a
                        href={s.anchor}
                        className="text-sm text-[#2966E5] transition-colors hover:text-[#191A2E]"
                      >
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ---- FAQ Sections ---- */}
        <section className="bg-[#F4F8EE] px-8 pb-24">
          <div className="mx-auto max-w-[1120px]">
            {faqSections.map((section, i) => (
              <div
                key={section.id}
                id={section.id}
                className={i > 0 ? 'mt-16 scroll-mt-24' : 'scroll-mt-24'}
              >
                <h2 className="mb-2 font-display text-xl font-bold tracking-tight text-[#191A2E]">
                  {section.title}
                </h2>
                <FAQ items={section.items} theme="light" />
              </div>
            ))}
          </div>
        </section>

        {/* ---- Contact ---- */}
        <section className="bg-[#191A2E] px-8 py-24">
          <div className="mx-auto max-w-[1120px] text-center">
            <h2 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.12] tracking-tighter text-white">
              Still need help?
            </h2>
            <p className="mx-auto mt-4 max-w-[520px] text-[1.0625rem] leading-[1.65] text-white/70">
              We&rsquo;re a small team and we read every message. Reach out and
              we&rsquo;ll get back to you as quickly as we can.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="mailto:help@gogreenstreets.org"
                className="inline-flex items-center rounded-full bg-[#BAF14D] px-7 py-3.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-90"
              >
                General Support
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  className="ml-2"
                >
                  <path
                    d="M1 7h12M8 2l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
              <a
                href="mailto:partners@gogreenstreets.org"
                className="inline-flex items-center rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.1]"
              >
                Partner Inquiries
              </a>
              <a
                href="mailto:schools@gogreenstreets.org"
                className="inline-flex items-center rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/[0.1]"
              >
                Schools Program
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
