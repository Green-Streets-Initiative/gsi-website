import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import FAQ from '@/components/FAQ'

export const metadata = {
  title: 'Help — Green Streets Initiative',
  description:
    'Everything you need to know about using Shift, unlocking rewards, running a schools challenge, or joining as a partner.',
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
      { name: 'Earning XP & Unlocking Rewards', anchor: '#points-rewards' },
      { name: 'Badges, Streaks & Tiers', anchor: '#badges-streaks-tiers' },
      { name: 'Roams', anchor: '#roams' },
      { name: 'Finding Rewards Partners', anchor: '#rewards-partners-users' },
      { name: 'Shift Your Summer', anchor: '#competitions' },
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
          'Shift is a free app from Green Streets Initiative that logs your walking, biking, and transit trips \u2014 and rewards you for choosing active transportation. You\u2019ll earn XP, unlock achievement badges, climb tier levels, and unlock perks at local Rewards Partners as you go. You can also enter prize draws during seasonal events like Shift Your Summer.',
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
          'Shift recognizes walking, biking, public transit (bus, subway, commuter rail), carpooling, and e-scooter rides. These are the modes that earn XP and count toward your tier. Driving does not.',
      },
      {
        question: 'Why didn\u2019t my trip get logged?',
        answer:
          'A few common reasons: (1) Location permissions may not be set to "Always Allow" \u2014 check your phone\u2019s Settings > Shift > Location. (2) Very short trips (under a couple of minutes) may not register. (3) Poor GPS signal in areas like tunnels or underground stations can occasionally cause a trip to be missed. If a trip is missing, you can always log it manually.',
      },
      {
        question: 'Can I log a trip manually?',
        answer:
          'Yes. The Log tab is one of the app\u2019s four main tabs. Tap it to enter the mode, approximate distance, and date. Manual trips earn XP and count toward your tier the same way automatic trips do.',
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
    title: 'Earning XP & Unlocking Rewards',
    items: [
      {
        question: 'How does the rewards model work?',
        answer:
          'Shift uses an access-based rewards model. As you take active trips you earn XP and climb through five tiers. Each tier unlocks more perks at local Rewards Partners \u2014 discounts, freebies, or member-only offers. You don\u2019t spend XP to redeem; reaching a tier unlocks the offers automatically.',
      },
      {
        question: 'How do I earn XP?',
        answer:
          'You earn XP every time you log an active trip (walk, bike, transit, carpool, or e-scooter). The amount per trip depends on your tier: Starters earn 1 XP per trip, Movers 2, Shifters 3, Pacesetters 4, and Trailblazers 5. You can earn up to 15 XP per day from trips. On top of that, you earn bonus XP for hitting badge milestones (streaks, distances, mode mix) and for tier promotions. During a Featured Goal sprint, completing the goal in time gives you a 50% XP bonus on the badge.',
      },
      {
        question: 'Is XP a currency I can spend?',
        answer:
          'No. XP is a record of your progress, not a wallet. It drives tier advancement and shows up on your profile so you can see how far you\u2019ve come \u2014 but you never spend it to redeem an offer. Rewards Partner offers are unlocked by your tier.',
      },
      {
        question: 'How do I unlock and use a Rewards Partner offer?',
        answer:
          'Open the Rewards tab to see what\u2019s available. Each offer shows the minimum tier required to unlock it. If you\u2019re at or above that tier, the offer is yours \u2014 tap it to see the details, the partner location, and any terms. To redeem in-store, show your tier badge on the app screen to the cashier and they\u2019ll apply the offer.',
      },
      {
        question: 'Where can I see my XP and tier?',
        answer:
          'Your current XP total and tier are visible on your profile screen and on the home screen status card. The Rewards tab also shows your tier so you can quickly see which offers are unlocked.',
      },
      {
        question: 'Does XP expire?',
        answer:
          'XP is a progression metric, so there\u2019s nothing to "expire" \u2014 your lifetime XP and tier history are always part of your profile. If you stop using the app for a long time we may archive inactive accounts, but as long as you\u2019re using Shift your progress is safe.',
      },
      {
        question:
          'A Rewards Partner didn\u2019t honor an offer I should be eligible for. What do I do?',
        answer: (
          <p>
            Email us at{' '}
            <a href="mailto:info@gogreenstreets.org" className={linkClass}>
              info@gogreenstreets.org
            </a>{' '}
            with the partner name, date, and what happened. We&rsquo;ll sort it
            out with the partner directly so you get the offer.
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
          'Shift has five tiers: Starter, Mover, Shifter, Pacesetter, and Trailblazer. You advance by accumulating active trips and maintaining a strong Shift Rate. Each step up unlocks more Rewards Partner offers and increases the XP you earn per trip.',
      },
      {
        question: 'What is Shift Rate?',
        answer:
          'Shift Rate is the percentage of your total trips that are active \u2014 walking, biking or scooting, or taking transit. The home screen shows your 7-day Shift Rate as a quick read on how the week is going. Tier advancement uses your 60-day Shift Rate so a single off-week doesn\u2019t bump you down a tier.',
      },
      {
        question: 'How do achievement badges work?',
        answer:
          'Achievement badges are earned by reaching specific milestones \u2014 trying new modes, building streaks, hitting cumulative distance goals, completing Roams, and more. Check your profile to see which badges you\u2019ve unlocked and what\u2019s next. Most badges award bonus XP when earned.',
      },
      {
        question: 'What is a Featured Goal?',
        answer:
          'A Featured Goal is a 14-day sprint highlighting the next badge you\u2019re closest to earning. If you complete the goal within the 14-day window, you get a 50% XP bonus on top of the badge\u2019s normal XP. Featured Goals replace the older "challenges" concept \u2014 same idea, more personalized.',
      },
      {
        question: 'How do streaks work?',
        answer:
          'A streak counts the days when you take at least one active trip (walking, biking, transit, or e-scooter). You get a 2-day grace window \u2014 miss up to two days in a row and the streak stays alive. Take an active trip on the third day or sooner to keep going. Three consecutive days without an active trip resets the streak. We also automatically protect your streak during significant MBTA service disruptions so you\u2019re not penalized for something outside your control.',
      },
      {
        question: 'What happens if I break a streak?',
        answer:
          'Your current streak resets to 1, but your longest streak is saved on your profile. Streaks are meant to be motivating, not punishing \u2014 start a new one whenever you\u2019re ready.',
      },
    ],
  },
  {
    id: 'roams',
    title: 'Roams',
    items: [
      {
        question: 'What is a Roam?',
        answer:
          'A Roam is a curated outing — a set of checkpoints along a walking, biking, transit, or multi-modal route that you visit in any order. Think of it as a self-guided tour that rewards you for exploring your city by active transportation. Roams range from quick neighborhood loops to longer cross-city adventures.',
      },
      {
        question: 'How do I start a Roam?',
        answer:
          'Open the Community tab and look for available Roams. Tap one to see its checkpoints on a map, the estimated distance, and which modes are recommended (walk, bike, transit, or any combination). When you’re ready, tap Start. The app will track your progress as you visit each checkpoint.',
      },
      {
        question: 'How does checkpoint detection work?',
        answer:
          'As you move near a checkpoint, the app detects your arrival automatically using your phone’s location. If auto-detection doesn’t trigger (GPS can be imprecise in dense areas), you can tap the checkpoint on the map and use the manual check-in button when you’re nearby. Either way counts the same.',
      },
      {
        question: 'Do I need to visit every checkpoint?',
        answer:
          'Most Roams require visiting all checkpoints to complete. Some longer Roams have a lower threshold — for example, a 20-checkpoint trail Roam might only require 16. The Roam detail screen shows how many checkpoints you need.',
      },
      {
        question: 'Do I need to follow a specific route between checkpoints?',
        answer:
          'No. You choose your own path between checkpoints. The map shows checkpoint locations, but how you get between them is up to you. Walk, bike, or take transit — whatever the Roam’s recommended modes include.',
      },
      {
        question: 'What do I earn for completing a Roam?',
        answer:
          'Completing a Roam earns you a badge and XP. Some Roams are part of collections — finish all Roams in a collection for a bonus badge. During Shift Your Summer, completing a Roam also earns bonus sweepstakes entries.',
      },
      {
        question: 'Any safety tips for Roams?',
        answer:
          'Always follow traffic laws and use sidewalks, bike lanes, and crosswalks. Stay aware of your surroundings — don’t stare at your phone while moving. Plan your route before you start, especially for longer Roams. Bring water, wear weather-appropriate gear, and let someone know your plans for longer outings. The app is a guide, not a GPS navigator — use your own judgment about safe routes.',
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
          'The Rewards tab in the app shows available partner offers in your area. Each offer lists the partner location, the offer details, and the minimum tier required to unlock it.',
      },
      {
        question: 'What kinds of rewards are available?',
        answer:
          'Rewards vary by partner \u2014 discounts, free items, member-only deals, or special online offers. Each partner sets the offer and the minimum tier required to unlock it. Higher tiers unlock more offers.',
      },
      {
        question: 'Can I suggest a business as a Rewards Partner?',
        answer: (
          <p>
            Absolutely. If there&rsquo;s a local business you&rsquo;d love to
            see in the Shift network, let us know at{' '}
            <a
              href="mailto:info@gogreenstreets.org"
              className={linkClass}
            >
              info@gogreenstreets.org
            </a>
            . We&rsquo;re always growing the network.
          </p>
        ),
      },
    ],
  },
  {
    id: 'competitions',
    title: 'Shift Your Summer',
    items: [
      {
        question: 'What is Shift Your Summer?',
        answer:
          'Shift Your Summer is our flagship summer event \u2014 a sweepstakes where your active trips, Roam completions, referrals, and other actions earn you entries into prize draws from leading brands and local partners. It runs from mid-June through mid-August. Check the Community tab during the event for full details and a live look at available prizes.',
      },
      {
        question: 'Who is eligible?',
        answer: (
          <p>
            Shift Your Summer is open to Massachusetts residents aged 18 and
            older. You must have a Shift account and opt in to the sweepstakes
            through the app. No purchase is necessary to enter. See the{' '}
            <Link
              href="/events/shift-your-summer/rules"
              className={linkClass}
            >
              official rules
            </Link>{' '}
            for full details.
          </p>
        ),
      },
      {
        question: 'How do I earn sweepstakes entries?',
        answer: (
          <div>
            <p>There are several ways to earn entries during the event:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong>Active trips</strong> &mdash; Each walk, bike, or
                transit trip earns 1 entry, up to 6 entries per day.
              </li>
              <li>
                <strong>Roam completion</strong> &mdash; Completing a Roam earns
                10 bonus entries.
              </li>
              <li>
                <strong>Checkpoint visits</strong> &mdash; Each Roam checkpoint
                you visit earns 1 entry.
              </li>
              <li>
                <strong>Collection completion</strong> &mdash; Finishing all
                Roams in a collection earns 50 bonus entries.
              </li>
              <li>
                <strong>What Moves Us videos</strong> &mdash; Submitting a video
                to an eligible What Moves Us campaign earns 5 entries.
              </li>
              <li>
                <strong>Referrals</strong> &mdash; Each friend who joins Shift
                using your referral link earns you entries &mdash; 2 for your
                first referral, 3 for the second, and 5 for each one after that,
                up to 10 friends.
              </li>
              <li>
                <strong>Free mail-in entry (AMOE)</strong> &mdash; You can enter
                without using the app by mailing a handwritten request. See
                the{' '}
                <Link
                  href="/events/shift-your-summer/rules"
                  className={linkClass}
                >
                  official rules
                </Link>{' '}
                for details.
              </li>
            </ul>
          </div>
        ),
      },
      {
        question: 'Is there a limit on how many entries I can earn?',
        answer:
          'Trip entries are capped at 6 per day. Referral entries max out at 10 referred friends. All other entry types (Roams, checkpoints, collections, What Moves Us) have no daily cap \u2014 the more you do, the more entries you earn.',
      },
      {
        question: 'How are winners chosen?',
        answer:
          'Winners are drawn after the event ends using a verifiable random selection from all eligible entries for each prize. More entries means better odds, but every eligible entrant has a chance. If you win, you’ll get an in-app notification with instructions to claim your prize.',
      },
      {
        question: 'What happens if I win?',
        answer:
          'You’ll receive an in-app notification and an email with claiming instructions. You have 7 days to claim your prize. If you don’t claim in time, we redraw to the next eligible person.',
      },
      {
        question: 'Where are the official rules?',
        answer: (
          <p>
            Full official rules, including legal terms, prize descriptions, and
            the free mail-in entry process, are available at{' '}
            <Link
              href="/events/shift-your-summer/rules"
              className={linkClass}
            >
              gogreenstreets.org/events/shift-your-summer/rules
            </Link>
            .
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
              href="mailto:info@gogreenstreets.org"
              className={linkClass}
            >
              info@gogreenstreets.org
            </a>
            . We&rsquo;ll walk you through the setup &mdash; it&rsquo;s simple
            and free to participate.
          </p>
        ),
      },
      {
        question: 'How do I verify a Shift redemption?',
        answer:
          'When a customer wants to use a Shift offer, they\u2019ll show you their tier badge on the app screen. That\u2019s your green light to apply the offer \u2014 no need to log into a dashboard at the time. When you join, we\u2019ll provide a 1-page printed guide you can keep at the register.',
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
          'Yes. You can update your offer, change the minimum tier required, or temporarily pause your listing from your business dashboard at any time.',
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
              href="mailto:info@gogreenstreets.org"
              className={linkClass}
            >
              info@gogreenstreets.org
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
              href="mailto:info@gogreenstreets.org"
              className={linkClass}
            >
              info@gogreenstreets.org
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
            <a href="mailto:info@gogreenstreets.org" className={linkClass}>
              info@gogreenstreets.org
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
        question: 'How do I get help or send feedback from inside the app?',
        answer: (
          <p>
            Open the Profile tab and scroll to the Account section. Tap{' '}
            <strong>Help &amp; FAQ</strong> to come right back to this page, or{' '}
            <strong>Send feedback</strong> to email us with the basics about
            your phone and app version pre-filled. You can also email{' '}
            <a href="mailto:info@gogreenstreets.org" className={linkClass}>
              info@gogreenstreets.org
            </a>{' '}
            directly.
          </p>
        ),
      },
      {
        question: 'I\u2019m having a technical issue not listed here.',
        answer: (
          <p>
            Use the in-app <strong>Send feedback</strong>{' '}link (Profile &rarr;
            Account) &mdash; it pre-fills your phone model, OS version, and app
            build, which helps us reproduce the issue quickly. Or email{' '}
            <a href="mailto:info@gogreenstreets.org" className={linkClass}>
              info@gogreenstreets.org
            </a>{' '}
            with a description and a screenshot if you have one. We&rsquo;ll
            get back to you as quickly as we can.
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
              Everything you need to know about using Shift, unlocking rewards,
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
                href="mailto:info@gogreenstreets.org"
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
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
