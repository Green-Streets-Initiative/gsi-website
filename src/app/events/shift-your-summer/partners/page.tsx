import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveUnsplashPhoto } from '@/lib/unsplash'
import { RoamsRibbon, type RoamCard } from './RoamsRibbon'
import PartnerForm from './PartnerForm'
import { PILL } from '@/components/org/Section'
import {
  taglineFromDescription,
  formatDuration,
  modeLabel,
  eventBadgeText,
} from './lib'

export const revalidate = 600

export const metadata: Metadata = {
  title: 'Shift Your Summer 2026 Partners | Green Streets Initiative',
  description:
    "The sponsors and prize donors behind Shift Your Summer 2026, Massachusetts's 8-week active transportation challenge, and how to partner on the next campaign.",
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
  pinned_photo_id: string | null
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
       pinned_photo_id,
       hero_image_url, hero_image_attribution, hero_image_attribution_url,
       checkpoints:roam_checkpoints(id)`
    )
    .eq('active', true)
    .not('name', 'ilike', '%Test Roam%')
    .order('featured', { ascending: false })
    .order('sort_order', { ascending: true })

  const roams: RoamCard[] = await Promise.all(
    ((roamsRaw ?? []) as RoamRow[]).map(async (r) => {
      const stops = r.checkpoints?.length ?? 0
      const photo = r.pinned_photo_id
        ? await resolveUnsplashPhoto(r.pinned_photo_id)
        : null
      return {
        id: r.id,
        name: r.name,
        tagline: r.tagline ?? taglineFromDescription(r.description),
        modeLabel: modeLabel(r.mode),
        mode: r.mode,
        durationLabel: formatDuration(r.estimated_minutes),
        distanceLabel: `${r.distance_miles} mi`,
        stopsLabel: `${stops} stop${stops === 1 ? '' : 's'}`,
        heroImageUrl: photo?.url ?? r.hero_image_url,
        heroImageAttribution: photo?.attribution ?? r.hero_image_attribution,
        heroImageAttributionUrl:
          photo?.attributionUrl ?? r.hero_image_attribution_url,
        eventBadge: eventBadgeText(r.event_dates, r.event_start, r.event_end),
      }
    })
  )

  return (
    <div className="min-h-screen bg-cream text-navy font-sans">
      <Nav variant="light" />

      <JumpBar />

      <Hero />

      <AboutSection />

      <RoamsSection roams={roams} />

      <SponsorshipSection />

      <PrizeSection />

      <PartnerFormSection />

      <ContactSection />

      <Footer variant="light" />
    </div>
  )
}

/* ── Jump links ──────────────────────────────────────────── */

function JumpBar() {
  return (
    <div className="border-b border-navy/10 px-6 lg:px-8">
      <div className="max-w-[1120px] mx-auto flex gap-8 py-3.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <a
          href="#sponsorship"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy hover:text-forest transition-colors whitespace-nowrap"
        >
          Sponsorship
        </a>
        <a
          href="#prizes"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy hover:text-forest transition-colors whitespace-nowrap"
        >
          Prize donations
        </a>
        <a
          href="#partner-form"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy hover:text-forest transition-colors whitespace-nowrap"
        >
          Sponsor the next campaign
        </a>
        <a
          href="#contact"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-navy hover:text-forest transition-colors whitespace-nowrap"
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
    <section className="px-6 lg:px-8 py-8 lg:py-10">
      <div className="max-w-[1120px] mx-auto">
        <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-forest mb-4">
          Partners
        </span>
        <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy mb-5">
          The partners behind
          <br />
          <span className="text-forest">Shift Your Summer 2026</span>
        </h1>
        <p className="text-[1.0625rem] leading-[1.7] text-ink-soft max-w-[680px]">
          Shift Your Summer 2026 was an 8-week active transportation challenge, open to anyone
          in Massachusetts, that encouraged people to walk, bike, and ride transit from
          June 15 to August 15. The Shift app detected active trips automatically, and
          participants built streaks, unlocked achievements, rose through status tiers, and
          became eligible for prizes.
        </p>
        <p className="text-[1.0625rem] leading-[1.7] text-ink-soft max-w-[680px] mt-3">
          Corporate sponsors and prize donors made it happen. Thank you. The 2026 sponsor roll
          is on the{' '}
          <Link href="/events/shift-your-summer" className="font-semibold text-forest underline-offset-4 hover:underline">challenge page</Link>,
          and planning for the next campaign is underway &mdash;{' '}
          <Link href="/contact" className="font-semibold text-forest underline-offset-4 hover:underline">get in touch</Link>{' '}
          to be part of it.
        </p>
        <div className="flex flex-wrap gap-8 mt-10 pt-8 border-t border-navy/10">
          <div className="flex flex-col gap-1">
            <span className="font-serif text-[2rem] leading-none text-navy">8</span>
            <span className="text-[13px] text-ink-soft">Weeks · June 15 – August 15, 2026</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-serif text-[2rem] leading-none text-navy">Open</span>
            <span className="text-[13px] text-ink-soft">To all of Massachusetts</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-serif text-[2rem] leading-none text-navy">2006</span>
            <span className="text-[13px] text-ink-soft">Year GSI was founded</span>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── About ───────────────────────────────────────────────── */

function AboutSection() {
  return (
    <section className="px-6 lg:px-8 py-8 lg:py-10 border-t border-navy/10">
      <div className="max-w-[1120px] mx-auto">
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy mb-6">
          Active transportation is <span className="text-forest">surging.</span>
        </h2>
        <div className="text-[1.0625rem] leading-[1.7] text-ink-soft max-w-[700px] space-y-4">
          <p>
            Massachusetts is in the middle of a generational shift. New protected bike
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
    <section className="px-6 lg:px-8 py-8 lg:py-10 border-t border-navy/10 overflow-hidden">
      <div className="max-w-[1120px] mx-auto">
        <div className="mb-6">
          <h3 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy mb-3">
            Explore Massachusetts with <span className="text-forest">Roams</span>
          </h3>
          <p className="text-[15px] leading-relaxed text-ink-soft max-w-[640px]">
            Roams are curated, multi-stop active transportation adventures built into the
            Shift app — guided explorations by foot, by bike, or by transit. Each Roam
            includes a map, turn-by-turn stops, terrain details, and contextual information
            like nearby Bluebikes docks (with real-time availability), transit boarding
            points (with next arrival times), and tips for people trying a mode for the
            first time. Completing Roams during Shift Your Summer unlocked prize eligibility.
          </p>
        </div>
        <RoamsRibbon roams={roams} />
        <div className="flex items-center gap-2 mt-3 text-[13px] text-ink-soft">
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
    accent: '#2D6A4F',
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
    accent: '#1B4332',
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
    <section id="sponsorship" className="px-6 lg:px-8 py-8 lg:py-10 border-t border-navy/10">
      <div className="max-w-[1120px] mx-auto">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest mb-4 block">
          Sponsorship
        </span>
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy mb-3">
          Three ways sponsors <span className="text-forest">partnered.</span>
        </h2>
        <p className="text-[1.0625rem] leading-[1.7] text-ink-soft max-w-[680px] mb-12">
          Corporate sponsors underwrote and promoted Shift Your Summer 2026. Sponsorship
          funds supported paid advertising on Reddit, Nextdoor, Facebook, and Instagram to
          drive app installs, as well as event operations, prize fulfillment, and press
          outreach. Every sponsor received co-branded promotional materials to distribute
          through their own channels. The 2026 tiers are below as a reference for the next
          campaign.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className="relative overflow-hidden bg-white rounded-[14px] border border-navy/10 p-8"
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
              <div className="font-serif text-[2rem] leading-none text-navy mb-5">
                {tier.price}
              </div>
              <ul className="flex flex-col gap-2.5">
                {tier.benefits.map((benefit, i) => (
                  <li
                    key={i}
                    className="text-[15px] text-navy leading-snug pl-5 relative"
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

        <p className="text-[15px] text-ink-soft italic text-center">
          Custom packages are available for multi-year or multi-event commitments.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 pt-12 border-t border-navy/10">
          <ValueCard
            dot="#1B4332"
            title="Brand Alignment"
            body="Associate your brand with Massachusetts's largest active transportation initiative — a positive, community-driven campaign backed by a nonprofit with nearly two decades of credibility in the region."
          />
          <ValueCard
            dot="#2966E5"
            title="Employee Engagement"
            body="Your team gets a custom challenge with its own leaderboard. The employer platform gives HR or sustainability teams a dashboard with participation data, trip counts, and environmental impact."
          />
          <ValueCard
            dot="#2D6A4F"
            title="Impact Reporting"
            body="Every sponsor receives an impact report at challenge close: total trips, miles traveled, carbon emissions avoided, and communities activated. Champion and Presenting sponsors also receive team-level data and a ready-to-use paragraph for sustainability filings."
          />
          <ValueCard
            dot="#1B4332"
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
    <div className="p-6 bg-white rounded-[14px] border border-navy/10">
      <h4 className="font-serif text-[1.375rem] leading-tight text-navy mb-2 flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: dot }}
        />
        {title}
      </h4>
      <p className="text-[15px] text-ink-soft leading-relaxed">{body}</p>
    </div>
  )
}

/* ── Prize donations ─────────────────────────────────────── */

function PrizeSection() {
  return (
    <section id="prizes" className="px-6 lg:px-8 py-8 lg:py-10 border-t border-navy/10">
      <div className="max-w-[1120px] mx-auto">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest mb-4 block">
          Prize Donations
        </span>
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy mb-3">
          Donated prizes <span className="text-forest">reached an audience.</span>
        </h2>
        <p className="text-[1.0625rem] leading-[1.7] text-ink-soft max-w-[680px] mb-10">
          Shift Your Summer participants became eligible for prizes by building streaks,
          hitting active trip milestones, and completing Roams. In-kind donations came in
          across three categories — and every donated prize came with brand visibility for
          the donor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          <PrizeCard
            title="Grand Prize"
            example="E-bikes, annual transit passes, high-value gear"
            exampleColor="#1B4332"
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
            exampleColor="#2D6A4F"
            body="Rewards from local businesses that participants access as they rise through status tiers. Great for local shops, restaurants, and service providers who want ongoing visibility with active transportation users."
          />
        </div>

        <div className="bg-white rounded-[14px] border border-navy/10 p-8 md:p-10">
          <h3 className="font-serif text-[1.375rem] leading-tight text-navy mb-5">
            What prize donors received
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
              <li key={item} className="text-[15px] text-navy leading-snug pl-5 relative">
                <span className="absolute left-0 top-[0.4375rem] w-1.5 h-1.5 rounded-full bg-forest" />
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
    <div className="bg-white rounded-[14px] border border-navy/10 p-7">
      <h4 className="font-serif text-[1.375rem] leading-tight text-navy mb-2">{title}</h4>
      <div
        className="text-[13px] font-semibold mb-3"
        style={{ color: exampleColor }}
      >
        {example}
      </div>
      <p className="text-[15px] text-ink-soft leading-relaxed">{body}</p>
    </div>
  )
}

/* ── Partner form ────────────────────────────────────────── */

function PartnerFormSection() {
  return (
    <section id="partner-form" className="px-6 lg:px-8 py-8 lg:py-10 border-t border-navy/10">
      <div className="max-w-[840px] mx-auto">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-forest mb-4 block">
          Sponsor the next campaign
        </span>
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy mb-3">
          Want in <span className="text-forest">next time?</span>
        </h2>
        <p className="text-[1.0625rem] leading-[1.7] text-ink-soft max-w-[680px] mb-10">
          Tell us about your organization and how you&rsquo;d like to take part in a future
          campaign. We&rsquo;ll follow up within two business days.
        </p>
        <PartnerForm />
      </div>
    </section>
  )
}

/* ── Contact CTA ─────────────────────────────────────────── */

function ContactSection() {
  return (
    <section id="contact" className="px-6 lg:px-8 py-8 lg:py-10 border-t border-navy/10">
      <div className="max-w-[1120px] mx-auto">
        <h2 className="font-serif text-[clamp(1.75rem,3.5vw,2.5rem)] font-normal leading-[1.1] text-navy mb-6">
          Let&rsquo;s shift
          <br />
          Massachusetts
          <br />
          <span className="text-forest">together.</span>
        </h2>
        <p className="text-[1.0625rem] leading-[1.7] text-ink-soft max-w-[540px] mb-8">
          Shift Your Summer 2026 wrapped on August 15. Sponsorships and prize donations for
          the next campaign open soon, and presenting sponsorship is limited to one partner.
          Reach out to discuss the right fit for your organization.
        </p>
        <div className="flex flex-col gap-1 mb-8">
          <span className="text-[1.125rem] font-semibold text-navy">Keith Anderson</span>
          <span className="text-[15px] text-ink-soft">
            Executive Director, Green Streets Initiative
          </span>
          <a
            href="mailto:keith@gogreenstreets.org"
            className="text-[15px] font-semibold text-forest underline-offset-4 hover:underline mt-2 inline-block"
          >
            keith@gogreenstreets.org
          </a>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 mt-6">
          <Link href="/contact" className={PILL}>
            Get in touch →
          </Link>
          <Link
            href="/events/shift-your-summer"
            className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-navy/25 px-6 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
          >
            See the 2026 challenge →
          </Link>
        </div>
      </div>
    </section>
  )
}
