import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
  brandLabel,
  achievementGatedLabel,
  type Prize,
  type PrizeTier,
  type PrizeEntryType,
  type EligibilityCriteria,
} from '../_lib/prizes'

export const metadata: Metadata = {
  title: 'Shift Your Summer · Official Rules | Green Streets Initiative',
  description:
    'Official rules for the Shift Your Summer 2026 active transportation sweepstakes.',
}

const TOC = [
  { id: 'promotion', title: 'Promotion Name and Sponsor' },
  { id: 'eligibility', title: 'Eligibility' },
  { id: 'promotion-period', title: 'Promotion Period' },
  { id: 'how-to-enter', title: 'How to Enter' },
  { id: 'prizes', title: 'Prizes' },
  { id: 'winner-selection', title: 'Winner Selection and Notification' },
  { id: 'prize-conditions', title: 'Prize Conditions' },
  { id: 'tax-obligations', title: 'Tax Obligations' },
  { id: 'general-conditions', title: 'General Conditions' },
  { id: 'privacy', title: 'Privacy' },
  { id: 'publicity-release', title: 'Publicity Release' },
  { id: 'limitation-of-liability', title: 'Limitation of Liability' },
  { id: 'disputes', title: 'Disputes' },
  { id: 'contact', title: 'Contact' },
]

export default async function ShiftYourSummerRulesPage() {
  const supabase = createServerSupabaseClient()

  const { data: competitionsRaw } = await supabase
    .from('competitions')
    .select('id, name, starts_at, ends_at, is_public')
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Shift Your Summer%')
    .order('starts_at', { ascending: false })
    .limit(5)

  const competitions = (competitionsRaw ?? []) as {
    id: string; name: string; starts_at: string; ends_at: string
  }[]
  const nowMs = Date.now()
  const competition =
    competitions.find(c => {
      const s = new Date(c.starts_at).getTime()
      const e = new Date(c.ends_at).getTime()
      return s <= nowMs && e >= nowMs
    }) ??
    competitions.find(c => new Date(c.starts_at).getTime() > nowMs) ??
    competitions[0] ??
    null

  let prizes: Prize[] = []
  if (competition) {
    const { data } = await supabase
      .from('competition_prizes')
      .select('id, place, prize_type, description, value_amount, funded_by_sponsorship_id, tier, display_order, brand_name_override, image_url, product_url, entry_type, eligibility_criteria, quantity, funder:funded_by_sponsorship_id(id, sponsors(id, name, logo_url, website_url))')
      .eq('competition_id', competition.id)
      .eq('prize_type', 'individual')
      .order('display_order', { ascending: true })

    prizes = (data ?? []).map((row: any) => {
      const funderRaw = row.funder
      const funder = Array.isArray(funderRaw) ? (funderRaw[0] ?? null) : (funderRaw ?? null)
      const sponsorRaw = funder?.sponsors
      const sponsor = Array.isArray(sponsorRaw) ? (sponsorRaw[0] ?? null) : (sponsorRaw ?? null)
      return {
        id: row.id,
        place: row.place,
        prize_type: row.prize_type,
        description: row.description,
        value_amount: row.value_amount,
        funded_by_sponsorship_id: row.funded_by_sponsorship_id ?? null,
        tier: (row.tier ?? 'standard') as PrizeTier,
        display_order: row.display_order ?? 0,
        brand_name_override: row.brand_name_override ?? null,
        image_url: row.image_url ?? null,
        product_url: row.product_url ?? null,
        quantity: row.quantity ?? 1,
        entry_type: (row.entry_type ?? 'achievement_gated') as PrizeEntryType,
        eligibility_criteria: (row.eligibility_criteria ?? null) as EligibilityCriteria | null,
        funder: funder ? { id: funder.id, sponsors: sponsor } : null,
      } as Prize
    })
  }

  return (
    <>
      <Nav />
      <main className="bg-navy pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
          {/* Header */}
          <Link
            href="/events/shift-your-summer"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
          >
            &larr; Back to Shift Your Summer
          </Link>

          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-lime">Legal</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Official Rules
          </h1>
          <p className="mt-3 text-sm text-white">
            Shift Your Summer 2026 &middot; Green Streets Initiative
          </p>

          <hr className="my-10 border-white/[0.08]" />

          {/* Table of contents */}
          <nav aria-label="Table of contents" className="mb-10">
            <h2 className="mb-4 font-display text-base font-bold text-white">Contents</h2>
            <ol className="list-decimal space-y-1 pl-5 text-[0.875rem] leading-[1.6]">
              {TOC.map(s => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-white/75 transition-colors hover:text-white">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <hr className="my-10 border-white/[0.08]" />

          {/* Content */}
          <div className="space-y-10">

            {/* 1. Promotion Name and Sponsor */}
            <Section id="promotion" title="1. Promotion Name and Sponsor">
              <Ul>
                <li><strong>Promotion:</strong> Shift Your Summer 2026</li>
                <li><strong>Sponsor:</strong> Green Streets Initiative, Inc., a 501(c)(3) nonprofit, Cambridge, MA (&ldquo;GSI&rdquo;)</li>
                <li>
                  Administered through the Shift mobile app, available on the{' '}
                  <a href="https://apps.apple.com/us/app/shift-by-gsi/id6761119037" className="text-lime">App Store</a>{' '}
                  and{' '}
                  <a href="https://play.google.com/store/apps/details?id=org.greenstreets.shift" className="text-lime">Google Play</a>
                </li>
              </Ul>
            </Section>

            {/* 2. Eligibility */}
            <Section id="eligibility" title="2. Eligibility">
              <Ul>
                <li>
                  The Sweepstakes is open to U.S. residents who are at least 18 years of age and
                  reside in the Commonwealth of Massachusetts.
                </li>
                <li>
                  Employees and Directors of GSI, the employees of their advertising agency, and the
                  members of the immediate family of all such persons are not eligible to win the
                  prize. The winner may be required to provide his/her Tax Identification Number for
                  IRS reporting purposes. The Sweepstakes is subject to all Federal, State, and local
                  laws and regulations.
                </li>
                <li>
                  To enter, either (a) download the Shift app, create an account, and opt in to the
                  sweepstakes (see Section 4 below); or (b) enter by the Alternative Method of Entry
                  explained below.
                  <Ul>
                    <li>
                      Download the app directly: <strong>iPhone/iPad</strong> &mdash;{' '}
                      <a href="https://apps.apple.com/us/app/shift-by-gsi/id6761119037" className="text-lime">Shift on the App Store</a>.{' '}
                      <strong>Android</strong> &mdash;{' '}
                      <a href="https://play.google.com/store/apps/details?id=org.greenstreets.shift" className="text-lime">Shift on Google Play</a>.
                    </li>
                  </Ul>
                </li>
                <li>
                  No purchase is necessary to enter or win. All entries will become the property of
                  GSI and will not be acknowledged.
                </li>
              </Ul>
            </Section>

            {/* 3. Promotion Period */}
            <Section id="promotion-period" title="3. Promotion Period">
              <Ul>
                <li>
                  The Promotion Period starts on June 15, 2026 and ends on August 15, 2026, at 11:59
                  PM ET.
                </li>
                <li>All entries must be submitted during the Promotion Period.</li>
              </Ul>
            </Section>

            {/* 4. How to Enter */}
            <Section id="how-to-enter" title="4. How to Enter">
              <P>
                Entries may be made through multiple methods during the promotion period. The
                specific entry value for each method is displayed on each prize card within the Shift
                app. Entry values are fixed for the duration of the promotion period.
              </P>
              <P>
                Entries from every method &mdash; trips, Roams, checkpoints, collections, What Moves
                Us videos, referrals, and AMOE postcards &mdash; apply to all prize drawings.
              </P>

              <SubSection title="Sweepstakes opt-in (required for app-based entry)">
                <P>
                  To be eligible for prize drawings via the Shift app, participants must opt in to
                  the sweepstakes within the Shift app by:
                </P>
                <Ul>
                  <li>Declaring their date of birth (must be 18 or older)</li>
                  <li>Declaring their state of residence (must be Massachusetts)</li>
                  <li>Acknowledging and accepting these Official Rules</li>
                </Ul>
                <P>
                  Participants have a maximum of three (3) opt-in attempts. Activities completed
                  before opting in, or after failing all three attempts, do not generate entries.
                </P>
              </SubSection>

              <SubSection title="Trip-based entries">
                <Ul>
                  <li>
                    One (1) entry per verified active-transportation trip taken during the promotion
                    period
                  </li>
                  <li>Qualifying modes: walking, biking, bus, train, or commuter rail</li>
                  <li>
                    Trips are detected by the Shift app using background location and must be
                    confirmed by the participant. Trips may also be verified through a participating
                    school or employer program.
                  </li>
                  <li>
                    All trips are verified via GPS with minimum distance and duration thresholds as
                    defined by the Shift app
                  </li>
                  <li>
                    Maximum six (6) verified trips per calendar day (Eastern Time), resulting in a
                    maximum of approximately 336 trip-based entries over the 56-day promotion period
                  </li>
                  <li>More trips = more entries = higher probability of winning</li>
                </Ul>
              </SubSection>

              <SubSection title="Roam-based entries">
                <P>
                  Roams are curated multi-stop walking, biking, or transit adventures available in
                  the Shift app. Each Roam consists of GPS-verified checkpoints that must be
                  physically visited.
                </P>
                <Ul>
                  <li>
                    Ten (10) entries per completed Roam (all required checkpoints visited during a
                    single attempt)
                  </li>
                  <li>
                    One (1) entry per individual checkpoint visited, even on incomplete Roam attempts
                  </li>
                  <li>
                    Fifty (50) entries per completed Roam Collection (a designated set of related
                    Roams, all completed during the promotion period)
                  </li>
                  <li>
                    There is no daily cap on Roam-based entries, but Roams require physical presence
                    at each checkpoint location
                  </li>
                </Ul>
              </SubSection>

              <SubSection title="What Moves Us video entries">
                <P>
                  What Moves Us is a feature within the Shift app where participants submit short
                  video recordings about their active-transportation experiences.
                </P>
                <Ul>
                  <li>Five (5) entries per approved What Moves Us video submission</li>
                  <li>
                    Videos must be submitted during the promotion period and approved by GSI
                    moderators
                  </li>
                  <li>
                    There is no daily cap on video entries, but each submission is individually
                    reviewed
                  </li>
                </Ul>
              </SubSection>

              <SubSection title="Referral-based entries">
                <P>
                  You can enter by referring new users to the Shift app. For each friend who joins
                  using your referral code and takes verified trips, you can enter up to ten (10)
                  times. New users who join through a referral start with two (2) entries.
                </P>
                <Ul>
                  <li>
                    Limit: ten (10) referred friends per person who take at least one verified trip,
                    for a maximum of 100 referral entries
                  </li>
                  <li>All referral activity must occur during the promotion period</li>
                  <li>
                    Referral entries from accounts exhibiting shared-device or suspicious-IP patterns
                    are automatically flagged for review and may be voided by GSI (see Section 9)
                  </li>
                </Ul>
                <P>
                  <em>Entry values are displayed on each prize card in the app.</em>
                </P>
              </SubSection>

              <SubSection title="Alternative Method of Entry (AMOE)">
                <P>
                  No app download or smartphone is required to enter. To enter without using the
                  Shift app, hand-print your full name, mailing address, email address, and date of
                  birth on a 3&Prime;&times;5&Prime; postcard and mail it to:
                </P>
                <div className="my-4 rounded-[12px] border border-white/[0.08] bg-white/[0.04] px-5 py-4 text-[0.9375rem] leading-[1.7] text-white">
                  Green Streets Initiative<br />
                  Shift Your Summer 2026 Sweepstakes<br />
                  519 Somerville Ave, Ste 2, Box 103<br />
                  Somerville, MA 02143
                </div>
                <P>
                  Each postcard received during the promotion period will be treated as one (1)
                  entry. Limit one postcard entry per person per day. Postcards must be postmarked
                  during the promotion period (June 15 &ndash; August 15, 2026) and received by
                  August 21, 2026. Mechanically reproduced entries will not be accepted.
                </P>
              </SubSection>
            </Section>

            {/* 5. Prizes */}
            <Section id="prizes" title="5. Prizes">
              <P>
                Prizes for this sweepstakes are rendered dynamically from the event&rsquo;s confirmed
                prize table. Each prize is displayed with its description, approximate retail value
                (ARV), quantity, donor/sponsor, entry mechanic, and drawing date, followed by the
                total ARV of all prizes.
              </P>
              <PrizeTable prizes={prizes} />
            </Section>

            {/* 6. Winner Selection and Notification */}
            <Section id="winner-selection" title="6. Winner Selection and Notification">
              <Ul>
                <li>
                  <strong>Weekly drawings:</strong> Certain prizes (e.g., Kryptonite bike locks) are
                  awarded via weekly drawings held once per week during the promotion period, for a
                  total of up to eight (8) weekly drawings. Each weekly drawing selects one (1)
                  winner from all eligible entries accumulated as of that drawing date.
                </li>
                <li>
                  <strong>End-of-promotion drawings:</strong> Remaining prizes (including grand
                  prizes) are drawn on or about August 22, 2026.
                </li>
                <li>
                  For weighted-entry prizes: each entry (from trips, Roams, checkpoints, collections,
                  referrals, What Moves Us videos, and AMOE) = one chance in the drawing. More
                  entries = higher probability of winning.
                </li>
                <li>
                  For achievement-gated prizes: all eligible participants who met the achievement
                  criteria have an equal chance.
                </li>
                <li>
                  For AMOE entries: each postcard = one chance, treated equivalently to one app-based
                  entry.
                </li>
                <li>
                  Drawing uses a cryptographic hash-based weighted lottery to ensure fair, auditable
                  selection.
                </li>
                <li>
                  <strong>Same-prize limit:</strong> A participant may not win the same prize more
                  than once. However, winning one prize does not exclude a participant from drawings
                  for other prizes. For example, a weekly Kryptonite lock winner remains eligible for
                  the grand prize drawing.
                </li>
                <li>
                  Winners are notified via push notification and email on the same day as the
                  drawing.
                </li>
                <li>
                  Winners must respond within seven (7) days or an alternate winner will be selected.
                </li>
                <li>
                  Odds of winning depend on the total number of eligible entries received from all
                  participants.
                </li>
                <li>
                  GSI is not responsible for any returned/undeliverable prize or delays in prize
                  delivery caused by the delivery carrier. Returned or undeliverable prizes will be
                  forfeited.
                </li>
              </Ul>
            </Section>

            {/* 7. Prize Conditions */}
            <Section id="prize-conditions" title="7. Prize Conditions">
              <Ul>
                <li>Prizes are non-transferable and cannot be exchanged for cash.</li>
                <li>Prizes awarded &ldquo;as is&rdquo; with no warranty by GSI.</li>
                <li>Winner responsible for any applicable taxes.</li>
                <li>
                  GSI may issue IRS Form 1099 or W-2G for prizes valued at $600 or more, or where
                  required by law.
                </li>
                <li>
                  Winners may be required to complete an affidavit of eligibility and
                  liability/publicity release.
                </li>
              </Ul>
            </Section>

            {/* 8. Tax Obligations */}
            <Section id="tax-obligations" title="8. Tax Obligations">
              <Ul>
                <li>
                  Winner is solely responsible for reporting and paying any applicable taxes.
                </li>
                <li>
                  For prizes valued at $600+, GSI will request the winner&rsquo;s SSN/TIN for tax
                  reporting purposes. If the winner declines to provide it, the prize may be
                  forfeited.
                </li>
              </Ul>
            </Section>

            {/* 9. General Conditions */}
            <Section id="general-conditions" title="9. General Conditions">
              <Ul>
                <li>
                  GSI reserves the right to cancel, suspend, or modify the promotion if fraud,
                  technical issues, or other causes compromise integrity. The prize is
                  non-transferable and non-refundable. GSI reserves the right, in its sole
                  discretion, to substitute the prize or any portion of the prize with a prize of
                  comparable value if the stated item becomes unavailable for any reason.
                </li>
                <li>
                  GSI reserves the right to disqualify any participant who tampers with the entry
                  process or violates the rules.
                </li>
                <li>
                  Anti-fraud provisions: fake accounts, device manipulation, and automated referrals
                  will result in disqualification. Referral entries associated with shared-device or
                  suspicious-IP patterns are automatically flagged for review and may be voided by
                  GSI without notice. Decisions by GSI shall be final.
                </li>
                <li>
                  Winner acknowledges that GSI and its agents do not make, nor are in any manner
                  responsible for, any warranty or representations, expressed or implied, in fact or
                  in law, relative to the quality, condition, fitness, or merchantability of any
                  aspect of the prizes. Prize images depicted in advertising and promotional
                  materials may vary from the actual prize, as any depiction of a prize is for
                  illustrative purposes only. Reference to any brand name and/or trademarked name in
                  connection with the prize is for reference and identification purposes only and is
                  not intended to suggest endorsement or sponsorship.
                </li>
                <li>By participating, entrants agree to be bound by these rules.</li>
              </Ul>
            </Section>

            {/* 10. Privacy */}
            <Section id="privacy" title="10. Privacy">
              <Ul>
                <li>
                  Personal information collected through the Shift app is governed by GSI&rsquo;s{' '}
                  <Link href="/privacy" className="text-lime">Privacy Policy</Link>.
                </li>
                <li>
                  Use of the Shift app is also governed by GSI&rsquo;s{' '}
                  <Link href="/terms" className="text-lime">Terms of Service</Link>.
                </li>
                <li>
                  For referral-gated prizes: users who share referral links are sharing their
                  referral code only, not personal data.
                </li>
                <li>
                  GSI does not share individual trip data, routes, or location history with prize
                  donors or other third parties.
                </li>
              </Ul>
            </Section>

            {/* 11. Publicity Release */}
            <Section id="publicity-release" title="11. Publicity Release">
              <Ul>
                <li>
                  Winners may be asked to participate in promotional activities (social media post,
                  photo, testimonial).
                </li>
                <li>
                  Acceptance of a prize may constitute permission to use the winner&rsquo;s name and
                  likeness for promotional purposes (except where prohibited by law).
                </li>
                <li>
                  For a list of winners (available after the final drawing on August 22, 2026), send
                  a self-addressed, stamped envelope to: Green Streets Initiative, Shift Your Summer
                  2026 Sweepstakes, 519 Somerville Ave, Ste 2, Box 103, Somerville, MA 02143,
                  postmarked by October 22, 2026.
                </li>
              </Ul>
            </Section>

            {/* 12. Limitation of Liability */}
            <Section id="limitation-of-liability" title="12. Limitation of Liability">
              <P>
                GSI is not responsible for any damages, loss, or liability with respect to the use of
                the prizes awarded in the sweepstakes. GSI reserves the right to cancel or modify the
                sweepstakes if fraud or technical problems question the integrity of the sweepstakes.
                Apple and Google are not responsible for any damages, loss, or liability with respect
                to this sweepstakes. This sweepstakes is in no way sponsored, endorsed, or
                administered by, or associated with, Apple or Google. By entering, you (i) agree to
                be bound by these Official Rules, including all eligibility requirements; (ii) agree
                to be bound by the decisions of GSI, which are final and binding in all matters
                relating to the sweepstakes; and (iii) release, hold harmless, and indemnify GSI
                from, and hereby waive any claims to, all claims, losses, injury, damages, and
                liability of any kind to person(s), including death, or property damage arising
                directly or indirectly from or relating to your acceptance, possession, use, and/or
                misuse of a prize, and participation in the Sweepstakes, including privacy or
                right-of-publicity claims or claims related to merchandise delivery.
              </P>
              <P>
                GSI does not warrant that access to the Sweepstakes will be uninterrupted and is not
                responsible for: (a) Entries from persons residing, or physically located, outside
                the eligible area mentioned in Section 2 above; (b) Entries that are altered,
                delayed, deleted, destroyed, forged, fraudulent, improperly accessed, inaccurate,
                incomplete, interrupted, irregular in any way, misrouted, multiple, non-delivered,
                stolen, tampered with, unauthorized, unintelligible, or otherwise not in compliance
                with these Official Rules; (c) lost, interrupted, or unavailable networks, servers,
                satellites, or other connection, availability, or accessibility problems arising in
                connection with or over the course of the Sweepstakes; (d) failure of personal
                computers and/or software and hardware configurations, any technical malfunctions,
                failures, or difficulties, clerical, typographical, or other errors in connection
                with the administration of the Sweepstakes, the processing of Entries, or the
                offering or announcement of the prize or in any prize notification documents;
                (e) any other errors of any kind relating to or in connection with the Sweepstakes,
                whether human, mechanical, clerical, electronic, or technical in nature; (f) the
                incorrect or inaccurate capture of information, or the failure to capture any
                information in connection with the Sweepstakes; or (g) damage to an entrant&rsquo;s
                system occasioned by participation in this Sweepstakes or downloading any information
                necessary to participate in this Sweepstakes; even if caused by the negligence of
                GSI. GSI reserves the right to cancel, modify, or suspend the Sweepstakes at any
                time if fraud, technical failures, any unanticipated occurrence that is not fully
                addressed in these Official Rules, or any other errors or other causes corrupt the
                administration, security, or integrity of the Sweepstakes. In the event of
                cancellation, GSI reserves the right to select the winner by random drawing from
                among all eligible, non-suspect entries received up to the time of such cancellation,
                and in a manner determined by GSI to be fair, appropriate, and consistent with these
                Official Rules.
              </P>
            </Section>

            {/* 13. Disputes */}
            <Section id="disputes" title="13. Disputes">
              <Ul>
                <li>Governing law: Commonwealth of Massachusetts.</li>
              </Ul>
              <P>
                By entering into the sweepstakes, entrants accept and agree to be bound by these
                Official Rules and the decision of GSI as to who is the prize winner. If any part of
                these Official Rules is deemed to be invalid or otherwise unenforceable or illegal,
                the balance of these Official Rules will remain in effect and will be construed in
                accordance with its terms as if the invalid or illegal provision were not contained
                herein. Except where prohibited, entrants agree that: (a) any and all disputes,
                claims, and causes of action arising out of or connected with this Sweepstakes or any
                prize awarded must be resolved individually, without resort to any form of class
                action, and exclusively by a federal or state court located in Boston, Massachusetts;
                (b) the sweepstakes will be governed and enforced pursuant to the laws of the
                Commonwealth of Massachusetts and the federal laws of the United States of America,
                without regard to the conflicts-of-laws provisions thereof; (c) any and all claims,
                judgments, and awards will be limited to actual out-of-pocket costs incurred,
                including costs associated with entering this sweepstakes, but in no event
                attorneys&rsquo; fees; and (d) UNDER NO CIRCUMSTANCES WILL ENTRANT BE PERMITTED TO
                OBTAIN AWARDS FOR DAMAGES, AND ENTRANT HEREBY WAIVES ALL RIGHTS TO CLAIM INDIRECT,
                PUNITIVE, INCIDENTAL, AND CONSEQUENTIAL DAMAGES AND ANY OTHER DAMAGES, OTHER THAN FOR
                ACTUAL OUT-OF-POCKET EXPENSES, AND ANY AND ALL RIGHTS TO HAVE DAMAGES MULTIPLIED OR
                OTHERWISE INCREASED.
              </P>
            </Section>

            {/* 14. Contact */}
            <Section id="contact" title="14. Contact">
              <Ul>
                <li>Green Streets Initiative</li>
                <li><a href="mailto:keith@gogreenstreets.org" className="text-lime">keith@gogreenstreets.org</a></li>
                <li>519 Somerville Ave, Ste 2, Box 103, Somerville, MA 02143</li>
              </Ul>
            </Section>

          </div>

          <hr className="my-10 border-white/[0.08]" />

          <div className="text-center">
            <Link
              href="/events/shift-your-summer"
              className="inline-flex items-center justify-center rounded-full bg-[#BAF14D] px-8 py-4 text-center text-lg font-extrabold text-[#191A2E] transition-opacity hover:opacity-85"
            >
              Learn about Shift Your Summer
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}

/* ── layout helpers ─────────────────────────────────────────── */

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id}>
      <h2 className="mb-4 font-display text-xl font-bold tracking-tight text-white">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 font-display text-base font-bold text-white">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.9375rem] leading-[1.7] text-white">{children}</p>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-[1.7] text-white">{children}</ul>
}

/* ── dynamic prize table ────────────────────────────────────── */

function entryMechanicLabel(p: Prize): string {
  switch (p.entry_type) {
    case 'weighted_entries':
      return 'Weighted drawing'
    case 'achievement_gated':
      return achievementGatedLabel(p.eligibility_criteria)
    case 'event':
      return 'Celebration event drawing'
    default:
      return 'See details'
  }
}

function drawingDateLabel(p: Prize): string {
  if (p.entry_type === 'event') return 'At celebration event'
  if (p.tier === 'grand' || p.tier === 'featured') return 'On or about Aug 22, 2026'
  return 'Weekly drawing'
}

function PrizeTable({ prizes }: { prizes: Prize[] }) {
  if (prizes.length === 0) {
    return (
      <P>
        <em>
          The confirmed prize table will appear here once prizes are finalized. Check back soon.
        </em>
      </P>
    )
  }

  const totalArv = prizes.reduce((sum, p) => {
    if (p.value_amount == null) return sum
    return sum + p.value_amount * Math.max(p.quantity, 1)
  }, 0)

  return (
    <div className="mt-6">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-[0.875rem]">
          <thead>
            <tr className="border-b border-white/[0.08]">
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-white/70">Prize</th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-white/70">ARV</th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-white/70">Qty</th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-white/70">Donated by</th>
              <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-white/70">Entry mechanic</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-widest text-white/70">Drawing date</th>
            </tr>
          </thead>
          <tbody>
            {prizes.map(p => (
              <tr key={p.id} className="border-b border-white/[0.06]">
                <td className="py-3 pr-4 text-white">{p.description}</td>
                <td className="py-3 pr-4 text-white">{p.value_amount != null ? `$${p.value_amount.toLocaleString()}` : '—'}</td>
                <td className="py-3 pr-4 text-white">{p.quantity}</td>
                <td className="py-3 pr-4 text-white">{brandLabel(p) ?? '—'}</td>
                <td className="py-3 pr-4 text-white">{entryMechanicLabel(p)}</td>
                <td className="py-3 text-white">{drawingDateLabel(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards */}
      <div className="md:hidden space-y-3">
        {prizes.map(p => (
          <div key={p.id} className="rounded-[12px] border border-white/[0.08] bg-white/[0.04] p-4">
            <p className="font-semibold text-white">{p.description}</p>
            <div className="mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
              <span className="text-white/75">ARV</span>
              <span className="text-white">{p.value_amount != null ? `$${p.value_amount.toLocaleString()}` : '—'}</span>
              <span className="text-white/75">Qty</span>
              <span className="text-white">{p.quantity}</span>
              <span className="text-white/75">Donated by</span>
              <span className="text-white">{brandLabel(p) ?? '—'}</span>
              <span className="text-white/75">Entry</span>
              <span className="text-white">{entryMechanicLabel(p)}</span>
              <span className="text-white/75">Drawing</span>
              <span className="text-white">{drawingDateLabel(p)}</span>
            </div>
          </div>
        ))}
      </div>

      {totalArv > 0 && (
        <p className="mt-6 text-[0.9375rem] leading-[1.7] text-white">
          <strong>Total approximate retail value of all prizes: ${totalArv.toLocaleString()}.</strong>
        </p>
      )}
    </div>
  )
}
