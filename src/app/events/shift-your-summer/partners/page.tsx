import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { RoamsRibbon, type RoamCard } from './RoamsRibbon'
import {
  taglineFromDescription,
  formatDuration,
  modeLabel,
  eventBadgeText,
} from './lib'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Partner with Shift Your Summer | Green Streets Initiative',
  description:
    "Sponsor or donate prizes to Greater Boston's 8-week active transportation challenge. Three sponsorship tiers from $1,000–$5,000.",
}

interface RoamRow {
  id: string
  name: string
  description: string
  tagline: string | null
  mode: string
  distance_miles: number
  estimated_minutes: number
  featured: boolean
  sort_order: number | null
  event_start: string | null
  event_end: string | null
  event_dates: string | null
  hero_image_url: string | null
  hero_image_attribution: string | null
  hero_image_attribution_url: string | null
  checkpoints: { id: string }[] | null
}

export default async function PartnersPage() {
  const supabase = createServerSupabaseClient()
  const { data: roamsRaw } = await supabase
    .from('roams')
    .select(
      `id, name, description, tagline, mode,
       distance_miles, estimated_minutes,
       featured, sort_order,
       event_start, event_end, event_dates,
       hero_image_url, hero_image_attribution, hero_image_attribution_url,
       checkpoints:roam_checkpoints(id)`
    )
    .eq('active', true)
    .not('name', 'ilike', '%Test Roam%')
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })

  const roams: RoamCard[] = ((roamsRaw ?? []) as RoamRow[]).map((r) => {
    const stops = r.checkpoints?.length ?? 0
    return {
      id: r.id,
      name: r.name,
      tagline: r.tagline ?? taglineFromDescription(r.description),
      modeLabel: modeLabel(r.mode),
      mode: r.mode,
      durationLabel: formatDuration(r.estimated_minutes),
      distanceLabel: `${r.distance_miles} mi`,
      stopsLabel: `${stops} stop${stops === 1 ? '' : 's'}`,
      heroImageUrl: r.hero_image_url,
      heroImageAttribution: r.hero_image_attribution,
      heroImageAttributionUrl: r.hero_image_attribution_url,
      eventBadge: eventBadgeText(r.event_dates, r.event_start, r.event_end),
    }
  })

  return (
    <div className="min-h-screen bg-[#191A2E] text-white font-sans">
      <Nav />

      <JumpBar />

      <Hero />

      <AboutSection />

      <RoamsSection roams={roams} />

      <SponsorshipSection />

      <PrizeSection />

      <ContactSection />

      <Footer />
    </div>
  )
}

/* ── Jump links ──────────────────────────────────────────── */

function JumpBar() {
  return (
    <div className="border-b border-white/[0.08] px-8">
      <div className="max-w-[1100px] mx-auto flex gap-8 py-3.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <a
          href="#sponsorship"
          className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/70 hover:text-[#52B788] transition-colors whitespace-nowrap"
        >
          Sponsorship
        </a>
        <a
          href="#prizes"
          className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/70 hover:text-[#52B788] transition-colors whitespace-nowrap"
        >
          Prize donations
        </a>
        <a
          href="#contact"
          className="text-[0.8125rem] font-semibold uppercase tracking-wider text-white/70 hover:text-[#52B788] transition-colors whitespace-nowrap"
        >
          Get in touch
        </a>
      </div>
    </div>
  )
}

/* ── Hero ────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="px-8 pt-20 pb-16">
      <div className="max-w-[1100px] mx-auto">
        <span className="inline-block text-xs font-bold uppercase tracking-[0.08em] text-[#52B788] mb-4">
          Partnership Opportunities
        </span>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] font-extrabold leading-[1.1] text-white mb-5">
          Partner with
          <br />
          <span className="text-[#BAF14D]">Shift Your Summer 2026</span>
        </h1>
        <p className="text-[1.125rem] leading-[1.7] text-white/75 max-w-[680px]">
          Shift Your Summer is an 8-week active transportation challenge, open to anyone in
          Massachusetts, that encourages people to walk, bike, and ride transit all summer
          long. The Shift app automatically detects active trips — no manual logging — and
          participants build streaks, unlock achievements, rise through status tiers, and
          become eligible for prizes.
        </p>
        <p className="text-[1.125rem] leading-[1.7] text-white/75 max-w-[680px] mt-3">
          We&rsquo;re looking for corporate sponsors and prize donors to help make it happen.
        </p>
        <div className="flex flex-wrap gap-8 mt-10 pt-8 border-t border-white/[0.08]">
          <div className="flex flex-col gap-1">
            <span className="text-[1.75rem] font-extrabold text-[#BAF14D] font-display">8</span>
            <span className="text-[0.8125rem] text-white/75">Weeks · June 15 – August 15</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[1.75rem] font-extrabold text-[#2966E5] font-display">Open</span>
            <span className="text-[0.8125rem] text-white/75">To all of Massachusetts</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[1.75rem] font-extrabold text-[#52B788] font-display">2006</span>
            <span className="text-[0.8125rem] text-white/75">Year GSI was founded</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── About ───────────────────────────────────────────────── */

function AboutSection() {
  return (
    <section className="px-8 py-12 border-t border-white/[0.08]">
      <div className="max-w-[1100px] mx-auto">
        <h2 className="font-display text-[2rem] font-bold text-white mb-6">
          Active transportation is <span className="text-[#BAF14D]">surging.</span>
        </h2>
        <div className="text-base leading-[1.8] text-white/80 max-w-[700px] space-y-4">
          <p>
            Greater Boston is in the middle of a generational shift. New protected bike
            lanes, expanded transit service, and redesigned streetscapes are changing how
            people move. Ridership is climbing. Bike commuting is up. Walking rates in
            metro Boston consistently rank among the highest in the country.
          </p>
          <p>
            The infrastructure is improving — and people are ready to use it. What&rsquo;s
            missing is the nudge: a reason to try that first bike commute, take transit to
            work, or walk to the store. Active trips are faster, healthier, cheaper — and
            genuinely fun. Most people just haven&rsquo;t built the habit yet.
          </p>
          <p>
            For partners, it&rsquo;s an opportunity to align your brand with a visible,
            positive, community-driven campaign — one that generates measurable
            environmental impact and authentic engagement with an audience that values
            sustainability.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ── Roams ───────────────────────────────────────────────── */

function RoamsSection({ roams }: { roams: RoamCard[] }) {
  return (
    <section className="px-8 py-12 border-t border-white/[0.08] overflow-hidden">
      <div className="max-w-[1100px] mx-auto">
        <div className="mb-6">
          <h3 className="font-display text-[1.5rem] font-bold text-white mb-3">
            Explore Greater Boston with <span className="text-[#BAF14D]">Roams</span>
          </h3>
          <p className="text-[0.9375rem] leading-[1.7] text-white/75 max-w-[640px]">
            Roams are curated, multi-stop active transportation adventures built into the
            Shift app — guided explorations by foot, by bike, or by transit. Each Roam
            includes a map, turn-by-turn stops, terrain details, and contextual information
            like nearby Bluebikes docks (with real-time availability), transit boarding
            points (with next arrival times), and tips for people trying a mode for the
            first time. Completing Roams during Shift Your Summer unlocks prize eligibility.
          </p>
        </div>
        <RoamsRibbon roams={roams} />
        <div className="flex items-center gap-2 mt-3 text-xs text-white/75">
          Scroll to explore <span className="inline-block">→</span>
        </div>
      </div>
    </section>
  )
}

/* ── Sponsorship tiers ───────────────────────────────────── */

interface Tier {
  name: string
  price: string
  accent: string
  benefits: string[]
}

const TIERS: Tier[] = [
  {
    name: 'Community',
    price: '$1,000',
    accent: '#52B788',
    benefits: [
      'Logo on challenge sponsors page',
      'Custom team sign-up link & QR code for employees',
      'Co-branded digital promo kit',
      'Aggregate impact report at challenge close',
      'Social media mentions (2×) during the 8-week campaign',
      '1 co-branded social graphic',
    ],
  },
  {
    name: 'Champion',
    price: '$2,500',
    accent: '#2966E5',
    benefits: [
      'Everything in Community, plus:',
      'App spotlight card in community feed (1 week)',
      'Logo in all challenge email communications',
      'Social media tags (6×) with co-branded assets',
      '3 co-branded social graphics',
      'Sustainability report paragraph (ready-to-use)',
      'Employer platform access for 1 year',
      'Team-level impact report',
    ],
  },
  {
    name: 'Presenting',
    price: '$5,000',
    accent: '#BAF14D',
    benefits: [
      'Everything in Champion, plus:',
      '"Presented by" naming across all channels',
      'Priority mention in press releases & media',
      'Wrap event hosting opportunity',
      'Prize association & winner announcement',
      'Social media tags (8×) across campaign',
      'Full social asset kit (6+ graphics)',
      'Monthly sponsor report (automated)',
      'Logo on Shift app challenge home screen',
    ],
  },
]

function SponsorshipSection() {
  return (
    <section id="sponsorship" className="px-8 py-20 border-t border-white/[0.08]">
      <div className="max-w-[1100px] mx-auto">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#52B788] mb-4 block">
          Sponsorship
        </span>
        <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.25rem)] font-extrabold text-white mb-3">
          Three ways to <span className="text-[#BAF14D]">partner.</span>
        </h2>
        <p className="text-base leading-[1.7] text-white/80 max-w-[680px] mb-12">
          Corporate sponsors help underwrite and promote Shift Your Summer. Sponsorship
          funds support paid advertising on Reddit, Nextdoor, Facebook, and Instagram to
          drive app installs, as well as event operations, prize fulfillment, and press
          outreach. Every sponsor receives co-branded promotional materials to distribute
          through their own channels.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="relative overflow-hidden bg-[#242538] rounded-xl border border-white/[0.08] p-8"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ background: tier.accent }}
              />
              <div
                className="text-base font-bold mb-1"
                style={{ color: tier.accent }}
              >
                {tier.name}
              </div>
              <div className="font-display text-[2rem] font-extrabold text-white mb-5">
                {tier.price}
              </div>
              <ul className="flex flex-col gap-2.5">
                {tier.benefits.map((benefit, i) => (
                  <li
                    key={i}
                    className="text-[0.8125rem] text-white leading-snug pl-5 relative"
                  >
                    <span
                      className="absolute left-0 top-[0.4375rem] w-1.5 h-1.5 rounded-full"
                      style={{ background: tier.accent }}
                    />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-[0.8125rem] text-white/75 italic text-center">
          Custom packages available for multi-year or multi-event commitments.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 pt-12 border-t border-white/[0.08]">
          <ValueCard
            dot="#BAF14D"
            title="Brand Alignment"
            body="Associate your brand with Greater Boston's largest active transportation initiative — a positive, community-driven campaign backed by a nonprofit with nearly two decades of credibility in the region."
          />
          <ValueCard
            dot="#2966E5"
            title="Employee Engagement"
            body="Your team gets a custom challenge with its own leaderboard. The employer platform gives HR or sustainability teams a dashboard with participation data, trip counts, and environmental impact."
          />
          <ValueCard
            dot="#52B788"
            title="Impact Reporting"
            body="Every sponsor receives an impact report at challenge close: total trips, miles traveled, carbon emissions avoided, and communities activated. Champion and Presenting sponsors also receive team-level data and a ready-to-use paragraph for sustainability filings."
          />
          <ValueCard
            dot="#BAF14D"
            title="Press & Visibility"
            body="GSI conducts PR outreach to local media including the Boston Globe, GBH, Boston.com, Patch, and neighborhood outlets. All sponsors are listed on the challenge page with linked logos."
          />
        </div>
      </div>
    </section>
  )
}

function ValueCard({ dot, title, body }: { dot: string; title: string; body: string }) {
  return (
    <div className="p-6 bg-[#242538] rounded-[10px] border border-white/[0.08]">
      <h4 className="text-base font-bold text-white mb-2 flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: dot }}
        />
        {title}
      </h4>
      <p className="text-sm text-white/80 leading-relaxed">{body}</p>
    </div>
  )
}

/* ── Prize donations ─────────────────────────────────────── */

function PrizeSection() {
  return (
    <section id="prizes" className="px-8 py-20 border-t border-white/[0.08]">
      <div className="max-w-[1100px] mx-auto">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#52B788] mb-4 block">
          Prize Donations
        </span>
        <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.25rem)] font-extrabold text-white mb-3">
          Donate a prize, <span className="text-[#BAF14D]">reach an audience.</span>
        </h2>
        <p className="text-base leading-[1.7] text-white/80 max-w-[680px] mb-10">
          Shift Your Summer participants become eligible for prizes by building streaks,
          hitting active trip milestones, and completing Roams. We&rsquo;re looking for
          in-kind donations across three categories — and every donated prize comes with
          brand visibility for the donor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <PrizeCard
            title="Grand Prize"
            example="E-bikes, annual transit passes, high-value gear"
            exampleColor="#BAF14D"
            body="The headline prize that draws attention to the challenge. Featured prominently in press outreach, social campaigns, and the winner announcement at the wrap event."
          />
          <PrizeCard
            title="Weekly & Milestone Prizes"
            example="Bike accessories, gift cards, fitness gear"
            exampleColor="#2966E5"
            body="Awarded throughout the 8-week challenge for achievements like streak milestones and trip count thresholds. Keeps participants engaged and creates recurring social content."
          />
          <PrizeCard
            title="Reward Catalog Items"
            example="Coffee, meals, local experiences"
            exampleColor="#52B788"
            body="Rewards from local businesses that participants access as they rise through status tiers. Great for local shops, restaurants, and service providers who want ongoing visibility with active transportation users."
          />
        </div>

        <div className="bg-[#242538] rounded-xl border border-white/[0.08] p-8 md:p-10">
          <h3 className="font-display text-[1.25rem] font-bold text-white mb-5">
            What prize donors receive
          </h3>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            {[
              'Logo and link on the Shift Your Summer prizes page',
              '"Prize provided by" branding in the app when your prize is featured',
              'Social media mention when your prize is awarded',
              'Inclusion in the challenge wrap report',
              'Photo opportunity at the winner announcement (grand prize donors)',
              'Mention in press outreach (grand prize donors)',
            ].map((item) => (
              <li key={item} className="text-sm text-white leading-snug pl-5 relative">
                <span className="absolute left-0 top-[0.4375rem] w-1.5 h-1.5 rounded-full bg-[#52B788]" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function PrizeCard({
  title,
  example,
  exampleColor,
  body,
}: {
  title: string
  example: string
  exampleColor: string
  body: string
}) {
  return (
    <div className="bg-[#242538] rounded-[10px] border border-white/[0.08] p-7">
      <h4 className="font-display text-[1.125rem] font-bold text-white mb-2">{title}</h4>
      <div
        className="text-[0.8125rem] font-semibold mb-3"
        style={{ color: exampleColor }}
      >
        {example}
      </div>
      <p className="text-sm text-white/80 leading-relaxed">{body}</p>
    </div>
  )
}

/* ── Contact CTA ─────────────────────────────────────────── */

function ContactSection() {
  return (
    <section id="contact" className="px-8 py-20 border-t border-white/[0.08]">
      <div className="max-w-[1100px] mx-auto">
        <h2 className="font-display text-[clamp(2rem,4vw,2.5rem)] font-extrabold text-white mb-6 leading-[1.15]">
          Let&rsquo;s shift
          <br />
          Greater Boston
          <br />
          <span className="text-[#BAF14D]">together.</span>
        </h2>
        <p className="text-base leading-[1.7] text-white/80 max-w-[540px] mb-8">
          Sponsorship commitments and prize donations for Shift Your Summer 2026 are open
          now. Presenting sponsorship is limited to one partner. Reach out to discuss the
          right fit for your organization.
        </p>
        <div className="flex flex-col gap-1 mb-8">
          <span className="text-[1.125rem] font-semibold text-white">Keith Anderson</span>
          <span className="text-sm text-white/75">
            Executive Director, Green Streets Initiative
          </span>
          <a
            href="mailto:keith@gogreenstreets.org"
            className="text-base font-medium text-[#52B788] hover:opacity-80 mt-2 inline-block"
          >
            keith@gogreenstreets.org
          </a>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <a
            href="mailto:keith@gogreenstreets.org"
            className="inline-flex items-center gap-2 bg-[#52B788] text-[#191A2E] px-6 py-3.5 rounded-[10px] font-bold text-[0.9375rem] hover:opacity-90 transition-opacity"
          >
            Get in touch →
          </a>
          <Link
            href="/events/shift-your-summer"
            className="inline-flex items-center gap-2 bg-transparent text-white px-6 py-3.5 rounded-[10px] font-semibold text-[0.9375rem] border border-white/[0.12] hover:border-white/30 hover:text-white transition-colors"
          >
            See the public challenge page →
          </Link>
        </div>
      </div>
    </section>
  )
}
