// The help page's questions and answers (gogreenstreets.org/help), kept here
// so the page and the Shift assistant read the same words (Keith 2026-10-30:
// the assistant couldn't see the FAQ). Edit answers here; both follow.
import Link from 'next/link'
import { isValidElement, type ReactNode } from 'react'

const linkClass = 'underline hover:text-[#2966E5] transition-colors'

// Checked against the app (Update 21) and the live database 2026-10-30.
// Paths like "Profile > Settings > Trip tracking" follow the October 2026
// Settings redesign.
export const faqSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    items: [
      {
        question: 'What is Shift?',
        answer:
          'Shift is a free app from Green Streets Initiative that records your walking, biking, scooter and transit trips on its own and rewards you for them. You earn XP, badges and tiers, unlock offers at local businesses, get gift cards for trying new ways of getting around, and are entered in monthly prize drawings like Walk/Ride Day. It also shows the next buses and trains near you and plans routes.',
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
          'Open the app and enter your email, and we’ll send you a sign-in link. You can also continue with Google, or with Apple on an iPhone. Then add your name. To appear on your town’s leaderboard, add your Home under Profile > Your places.',
      },
      {
        question: 'Is Shift really free?',
        answer:
          'Yes. Shift is completely free to download and use. There are no premium tiers, in-app purchases, or hidden fees.',
      },
      {
        question: 'What do I get for inviting friends?',
        answer:
          'Your invite code is under Profile > Invite friends. When a friend joins with your code and makes 5 trips, you get $10 to spend at a local business.',
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
          'Shift uses your phone’s location in the background to notice when you walk, bike, scoot or take transit. Each trip is saved with its distance, time and mode, and shows up in your trip history. When Shift isn’t sure how you traveled, it asks you.',
      },
      {
        question: 'Which ways of getting around count?',
        answer:
          'Walking, biking, bus, subway, commuter rail, ferry, e-scooter and carpool trips earn XP. Carpools don’t count toward your tier. Driving doesn’t earn anything.',
      },
      {
        question: 'Shift stopped recording my trips. How do I fix it?',
        answer:
          'Open Profile > Settings > Trip tracking. It shows anything that’s off, like location not set to Always, Precise Location turned off, or Background App Refresh off on an iPhone, with a button to fix it. If tracking stops, a card at the top of Home walks you through it too. Trips under 0.1 mile or 2 minutes aren’t saved, and tunnels or underground stations can occasionally cause a missed trip.',
      },
      {
        question: 'I got signed out. Did I lose my trips?',
        answer:
          'No. While you’re signed out, Shift keeps the trips it records for up to 30 days and sends them once you sign in again.',
      },
      {
        question: 'Can I add a trip Shift missed?',
        answer:
          'Yes. Tap Log past trip on the Home tracking card, then pick how you traveled, the distance and the day, up to a week back. Trips added this way earn XP and count toward your tier, but they don’t earn drawing entries or gift-card rewards. For a trip to count for those, tap Start Trip as you set off. You can also import walks and rides from Apple Health or Health Connect in Profile > Settings > Trip tracking.',
      },
      {
        question: 'How do I fix a wrong travel mode?',
        answer:
          'Open the trip and pick the right travel mode. A trip you fix or confirm counts in full: XP, drawing entries and rewards.',
      },
      {
        question: 'Do trips outside Massachusetts count?',
        answer:
          'Shift saves them, but when a trip starts and ends outside Massachusetts, only walks earn XP and drawing entries. If you’re away for a while, you can turn on Vacation mode in Profile > Settings.',
      },
      {
        question: 'How accurate is background tracking?',
        answer:
          'Background tracking is generally accurate within a reasonable margin. GPS precision varies depending on your environment — dense urban areas with tall buildings and underground transit can reduce accuracy. The app uses intelligent filtering to distinguish modes, but occasional misclassifications can happen.',
      },
      {
        question: 'Does tracking drain my battery?',
        answer:
          'Shift uses efficient background location services designed to minimize battery impact. Most users see minimal additional drain. If you notice an issue, make sure your phone’s OS and the Shift app are both up to date.',
      },
    ],
  },
  {
    id: 'getting-around',
    title: 'Getting Around',
    items: [
      {
        question: 'How do I see departures near me or plan a trip?',
        answer:
          'Around You on the Home screen shows the next buses and trains near you, and nearby bikes. Tap Plan a route for directions to anywhere. You can save a trip you make often, and it shows up on Home and under Profile > Your trips.',
      },
    ],
  },
  {
    id: 'points-rewards',
    title: 'XP & Rewards',
    items: [
      {
        question: 'How do rewards work?',
        answer:
          'There are two kinds. Offers at local businesses (discounts, freebies and member deals) open once you reach Mover, the second tier. You don’t spend XP on them; your tier is your key. Gift cards come from winning a drawing, finishing a challenge, trying a new way to make a regular trip, or inviting a friend.',
      },
      {
        question: 'How do I earn XP?',
        answer:
          'You earn XP every time you take an active trip (walk, bike, transit, carpool, or e-scooter). The amount per trip depends on your tier: Starters earn 1 XP per trip, Movers 2, Shifters 3, Pacesetters 4, and Trailblazers 5. You can earn up to 15 XP per day from trips. On top of that, you earn bonus XP for hitting badge milestones (streaks, distances, mode mix) and for tier promotions. During a Featured Goal sprint, completing the goal in time gives you a 50% XP bonus on the badge. Trips added with Log past trip earn XP too, but not drawing entries or gift-card rewards.',
      },
      {
        question: 'Is XP a currency I can spend?',
        answer:
          'No. XP is a record of your progress, not a wallet. It drives tier advancement and shows how far you’ve come — but you never spend it to redeem an offer. Rewards Partner offers are unlocked by your tier.',
      },
      {
        question: 'I got a gift card. How do I use it?',
        answer:
          'Open the Rewards tab, tap Your rewards, and pick where to spend it before the pick-by date. Brand gift cards arrive right away; cards for local shops take a couple of business days.',
      },
      {
        question: 'How do I find and use a Rewards Partner offer?',
        answer:
          'The Rewards tab lists every partner offer with its location and details. All of them open at Mover. To use one in a store, show your tier badge on the offer screen to the cashier. For online offers, use the code or link shown in the app.',
      },
      {
        question: 'Where can I see my XP and tier?',
        answer:
          'Your tier is at the top of Home; tap it for details. Your XP total and history are on the Progress tab.',
      },
      {
        question: 'Does XP expire?',
        answer:
          'XP is a progression metric, so there’s nothing to "expire" — your lifetime XP and tier history are always part of your profile. If you stop using the app for a long time we may archive inactive accounts, but as long as you’re using Shift your progress is safe.',
      },
      {
        question:
          'A Rewards Partner didn’t honor an offer I should be eligible for. What do I do?',
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
    id: 'badges-streaks-tiers',
    title: 'Badges, Streaks & Tiers',
    items: [
      {
        question: 'What are the tier levels?',
        answer:
          'Shift has five tiers: Starter, Mover, Shifter, Pacesetter, and Trailblazer. You move up by taking active trips and keeping a strong 60-day Shift Rate. Each step up earns more XP per trip, and every partner offer opens at Mover.',
      },
      {
        question: 'What is Shift Rate?',
        answer:
          'Shift Rate is the share of your trips that weren’t made by driving: walking, biking, scooting, transit or carpooling. Home shows your 60-day Shift Rate, the same one that sets your tier, so a single off-week doesn’t bump you down.',
      },
      {
        question: 'How do achievement badges work?',
        answer:
          'Achievement badges are earned by reaching specific milestones — trying new modes, building streaks, hitting cumulative distance goals, completing Roams, and more. The Progress tab shows which badges you’ve unlocked and what’s next. Most badges award bonus XP when earned.',
      },
      {
        question: 'What is a Featured Goal?',
        answer:
          'A Featured Goal is a 14-day sprint highlighting the next badge you’re closest to earning. If you complete the goal within the 14-day window, you get a 50% XP bonus on top of the badge’s normal XP.',
      },
      {
        question: 'How do streaks work?',
        answer:
          'A streak counts the days when you take at least one active trip (walking, biking, transit, or e-scooter). You get a 2-day grace window — miss up to two days in a row and the streak stays alive. Three days in a row without an active trip resets it. New to Shift? Home counts weeks in a row with an active trip until your daily streak reaches 3 days. We also protect your streak during significant MBTA service disruptions, and if you’re going away, turn on Vacation mode in Profile > Settings and your streak waits for you.',
      },
      {
        question: 'What happens if I break a streak?',
        answer:
          'Your current streak resets to 1, but your longest streak is saved on your profile. Streaks are meant to be motivating, not punishing — start a new one whenever you’re ready.',
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
          'Open the Community tab and look for available Roams. Tap one to see its checkpoints on a map, the estimated distance, and which modes are recommended (walk, bike, transit, or any combination). When you’re ready, tap Start this Roam. The app will track your progress as you visit each checkpoint.',
      },
      {
        question: 'How does checkpoint detection work?',
        answer:
          'As you move near a checkpoint, the app detects your arrival automatically using your phone’s location. If auto-detection doesn’t trigger (GPS can be imprecise in dense areas), you can tap the checkpoint on the map and use the manual check-in button when you’re nearby. Either way counts the same.',
      },
      {
        question: 'Do I need to visit every checkpoint?',
        answer:
          'Most Roams require visiting all checkpoints to complete. Some trail Roams need only some of their stops, and bonus stops are always optional. The Roam detail screen shows how many checkpoints you need.',
      },
      {
        question: 'Do I need to follow a specific route between checkpoints?',
        answer:
          'No. You choose your own path between checkpoints. The map shows checkpoint locations, but how you get between them is up to you. Walk, bike, or take transit — whatever the Roam’s recommended modes include.',
      },
      {
        question: 'What do I earn for completing a Roam?',
        answer:
          'Completing a Roam earns you a badge and XP. Some Roams are part of collections — finish all Roams in a collection for a bonus badge.',
      },
      {
        question: 'Any safety tips for Roams?',
        answer:
          'Always follow traffic laws and use sidewalks, bike lanes, and crosswalks. Stay aware of your surroundings — don’t stare at your phone while moving. Plan your route before you start, especially for longer Roams. Bring water, wear weather-appropriate gear, and let someone know your plans for longer outings. The app is a guide, not a GPS navigator — use your own judgment about safe routes.',
      },
    ],
  },
  {
    id: 'competitions',
    title: 'Drawings & Challenges',
    items: [
      {
        question: 'What is Walk/Ride Day?',
        answer: (
          <p>
            One day a month, every walking, biking or transit trip you record
            in Shift enters you in a prize drawing. Entry is automatic, with
            nothing to sign up for. It&rsquo;s open to Massachusetts residents
            18 and older, and no purchase is necessary. The{' '}
            <Link href="/programs/walk-ride-days" className={linkClass}>
              Walk/Ride Day page
            </Link>{' '}
            has the dates and prizes, and the{' '}
            <Link href="/events/walk-ride-day/rules" className={linkClass}>
              official rules
            </Link>{' '}
            have the details.
          </p>
        ),
      },
      {
        question: 'Are there other challenges?',
        answer:
          'Workplaces and groups that use Shift run their own challenges, and you’ll see them in the app if you belong to one. Shift also gives gift cards for trying something new, like making a regular trip by bike or transit.',
      },
      {
        question: 'How are winners chosen, and what happens if I win?',
        answer:
          'Winners are drawn at random from all eligible entries after the drawing closes. Trips Shift tracked, or that you fixed or confirmed, earn entries; trips added with Log past trip don’t. If you win, we’ll email you and send a notice in the app. Claim your prize in the Rewards tab within the time shown.',
      },
      {
        question: 'What happened to Shift Your Summer?',
        answer: (
          <p>
            Shift Your Summer ran from June to August 2026 and has ended. Its{' '}
            <Link
              href="/events/shift-your-summer/rules"
              className={linkClass}
            >
              official rules
            </Link>{' '}
            are still online.
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
        answer: (
          <p>
            When a customer wants to use a Shift offer, they&rsquo;ll show you
            their tier badge on the app screen. That&rsquo;s your green light to
            apply the offer &mdash; no need to log into a dashboard at the time.
            When you join, we&rsquo;ll provide a{' '}
            <a href="/cashier-guide.html" className={linkClass}>
              1-page printed guide
            </a>{' '}
            you can keep at the register.
          </p>
        ),
      },
      {
        question: 'How do I access my business dashboard?',
        answer: (
          <p>
            Go to{' '}
            <Link href="/shift/rewards-partners" className={linkClass}>
              gogreenstreets.org/shift/rewards-partners
            </Link>{' '}
            and enter your email under Partner login. We&rsquo;ll send you a
            sign-in link. Your dashboard shows your offer, redemptions and
            locations.
          </p>
        ),
      },
      {
        question: 'What does it cost to be a Rewards Partner?',
        answer:
          'Nothing. There are no fees to join the Shift Rewards Partner network. You set the reward you’re comfortable offering, and you benefit from exposure to an engaged community of sustainability-minded local customers.',
      },
      {
        question: 'Can I change or pause my reward offer?',
        answer:
          'Yes. From your dashboard you can edit your offer, turn locations on or off, and pause your listing. While it’s paused, your offer and locations are hidden in the app until you reactivate. To change who qualifies, email us at info@gogreenstreets.org.',
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
          'The Shift app is for people 13 and older, and some features are for adults 18 and older. The Shift for Schools classroom challenge is a separate, app-free experience \u2014 students participate through their teacher\u2019s daily show-of-hands tally without needing any device or account.',
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
            Your email, your name, the places you save, and your trips (where
            they start and end, distance, time and mode). Also anything you
            choose to add: a school or work email, workouts imported from Apple
            Health or Health Connect, and your birth date if you enter a prize
            drawing. If you use the AI assistant, your conversations go to
            Anthropic&rsquo;s Claude to answer you, and we keep them for 12
            months. We never sell your personal data. For full details, see our{' '}
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
          'Location data is used to detect and record your trips: to calculate distances, identify how you traveled, and count your trips toward your town’s and groups’ leaderboards. We do not share raw location data with third parties.',
      },
      {
        question: 'Who can see my profile?',
        answer:
          'Profiles are public by default, so others in Shift can see your name, photo and badges, and you appear on leaderboards. To hide them, turn off Public profile in Profile > Settings > Privacy. Your trips still count for your groups either way.',
      },
      {
        question: 'How do I delete my account and data?',
        answer: (
          <p>
            Go to Profile &gt; Settings &gt; Account &gt; Delete account. This
            permanently removes your profile and trip history. If you have any
            trouble, email{' '}
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
        question: 'How do I sign in? Is there a password?',
        answer:
          'Shift doesn’t use passwords. Enter your email on the sign-in screen and we’ll send you a sign-in link; open it on the same phone. You can also continue with Google, or with Apple on an iPhone. If a link doesn’t work, send yourself a new one, and check your spam folder.',
      },
      {
        question: 'How do I change my name or neighborhood?',
        answer:
          'Profile > Edit profile changes your name and photo. Your neighborhood follows your Home place, which you can change in Profile > Your places.',
      },
      {
        question: 'Can I use Shift in another language?',
        answer:
          'Yes. Shift is available in English, Spanish, Portuguese and Chinese. Choose yours in Profile > Settings > Language.',
      },
      {
        question: 'How do I update Shift or see my version?',
        answer:
          'Most updates install on their own the next time you open Shift. Profile > Help shows your version and when it last updated. For bigger updates, the App Store or Google Play will offer the new version.',
      },
      {
        question: 'How do I get help or send feedback from inside the app?',
        answer: (
          <p>
            Open Profile &gt; Help. Tap <strong>Help &amp; FAQ</strong> to come
            right back to this page, or <strong>Send feedback</strong> to email
            us with your phone and app details filled in. You can also email{' '}
            <a href="mailto:info@gogreenstreets.org" className={linkClass}>
              info@gogreenstreets.org
            </a>{' '}
            directly.
          </p>
        ),
      },
      {
        question: 'I’m having a technical issue not listed here.',
        answer: (
          <p>
            Use <strong>Send feedback</strong> in Profile &gt; Help. It fills in
            your phone model, OS and app version, and a short tracking summary
            (no locations), which helps us find the problem quickly. Or email{' '}
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

const SITE = 'https://www.gogreenstreets.org'

/** An answer as plain text, links written out, for the assistant. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isValidElement(node)) return ''
  const props = node.props as { children?: ReactNode; href?: string }
  const inner = textOf(props.children)
  if (props.href) {
    const target = props.href.startsWith('mailto:') ? props.href.slice(7) : props.href.startsWith('/') ? SITE + props.href : props.href
    return inner.includes(target) ? inner : `${inner} (${target})`
  }
  if (node.type === 'li') return `\n- ${inner}`
  if (node.type === 'p') return `\n${inner}\n`
  return inner
}

const clean = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim()

export const HELP_TOPICS = faqSections.map((s) => s.id)

/** One help topic, questions and answers as plain text. */
export function helpTopic(id: string): { topic: string; page: string; questions: { question: string; answer: string }[] } | null {
  const s = faqSections.find((x) => x.id === id)
  if (!s) return null
  return {
    topic: s.title,
    page: `${SITE}/help#${s.id}`,
    questions: s.items.map((it) => ({ question: it.question, answer: clean(textOf(it.answer)) })),
  }
}

/** Each topic and its questions, for the assistant's tool description. */
export function helpIndex(): string {
  return faqSections.map((s) => `${s.id}: ${s.items.map((it) => it.question).join(' ')}`).join('\n')
}
