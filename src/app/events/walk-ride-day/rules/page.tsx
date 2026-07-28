import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const metadata: Metadata = {
  title: 'Walk/Ride Day · Official Rules | Green Streets Initiative',
  description:
    'Official rules for the Green Streets Initiative Walk/Ride Day gift card drawing.',
}

// Revalidate hourly so a newly configured month's prizes appear without a deploy.
export const revalidate = 3600

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
  { id: 'limitation-of-liability', title: 'Limitation of Liability' },
  { id: 'disputes', title: 'Disputes' },
  { id: 'contact', title: 'Contact' },
]

const ET = 'America/New_York'

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: ET,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

/** The day a Walk/Ride Day competition covers. ends_at is 03:59 UTC the next
 *  calendar day, so it is not a safe source for the event date — use starts_at. */
function eventDay(startsAt: string): string {
  return longDate(startsAt)
}

type PrizeRow = {
  id: string
  description: string
  value_amount: number | null
  quantity: number
}

export default async function WalkRideDayRulesPage() {
  const supabase = createServerSupabaseClient()

  const { data: competitionsRaw } = await supabase
    .from('competitions')
    .select('id, name, starts_at, ends_at')
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Walk/Ride Day%')
    .order('starts_at', { ascending: true })

  const competitions = (competitionsRaw ?? []) as {
    id: string; name: string; starts_at: string; ends_at: string
  }[]

  // Active first, then the next upcoming, then the most recent past — so the
  // page reads correctly on the day, in the run-up, and in the days after.
  const nowMs = Date.now()
  const competition =
    competitions.find(c =>
      new Date(c.starts_at).getTime() <= nowMs &&
      new Date(c.ends_at).getTime() >= nowMs) ??
    competitions.find(c => new Date(c.starts_at).getTime() > nowMs) ??
    [...competitions].reverse().find(c => new Date(c.ends_at).getTime() < nowMs) ??
    null

  let prizes: PrizeRow[] = []
  let maxEntries = 3
  if (competition) {
    const { data } = await supabase
      .from('competition_prizes')
      .select('id, description, value_amount, quantity, eligibility_criteria')
      .eq('competition_id', competition.id)
      .eq('prize_type', 'individual')
      .order('display_order', { ascending: true })

    prizes = (data ?? []).map((row: any) => ({
      id: row.id,
      description: row.description,
      value_amount: row.value_amount != null ? Number(row.value_amount) : null,
      quantity: row.quantity ?? 1,
    }))

    const cap = (data ?? [])
      .map((r: any) => r.eligibility_criteria?.max_daily_entries)
      .find((v: unknown) => typeof v === 'number')
    if (typeof cap === 'number') maxEntries = cap
  }

  const dayLabel = competition ? eventDay(competition.starts_at) : null
  const drawLabel = competition
    ? longDate(new Date(new Date(competition.ends_at).getTime() + 6 * 60 * 60 * 1000).toISOString())
    : null

  const totalArv = prizes.reduce(
    (sum, p) => (p.value_amount == null ? sum : sum + p.value_amount * Math.max(p.quantity, 1)),
    0,
  )

  return (
    <>
      <Nav />
      <main className="bg-navy pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
          <Link
            href="/events"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
          >
            &larr; Back to events
          </Link>

          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-lime">Legal</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Official Rules
          </h1>
          <p className="mt-3 text-sm text-white">
            {competition?.name ?? 'Walk/Ride Day'}{' '}&middot; Green Streets Initiative
          </p>

          <div className="mt-6 rounded-[12px] border border-lime/25 bg-lime/[0.06] p-5">
            <p className="text-[0.9375rem] leading-[1.7] text-white">
              <strong>You are entered automatically.</strong> There is nothing to sign up for.
              Every qualifying trip you record in the Shift app on Walk/Ride Day enters you in
              the drawing. No purchase, payment, or entry action of any kind is necessary.
            </p>
          </div>

          <hr className="my-10 border-white/[0.08]" />

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

          <div className="space-y-10">

            <Section id="promotion" title="1. Promotion Name and Sponsor">
              <Ul>
                <li><strong>Promotion:</strong> {competition?.name ?? 'Walk/Ride Day'} Gift Card Drawing</li>
                <li><strong>Sponsor:</strong> Green Streets Initiative, Inc., a 501(c)(3) nonprofit, Cambridge, MA (&ldquo;GSI&rdquo;)</li>
                <li>
                  Administered through the Shift mobile app, available on the{' '}
                  <a href="https://apps.apple.com/us/app/shift-by-gsi/id6761119037" className="text-lime">App Store</a>{' '}
                  and{' '}
                  <a href="https://play.google.com/store/apps/details?id=org.greenstreets.shift" className="text-lime">Google Play</a>
                </li>
                <li>
                  This drawing is separate from, and independent of, the Shift Your Summer 2026
                  sweepstakes. Entries in one do not affect the other.
                </li>
              </Ul>
            </Section>

            <Section id="eligibility" title="2. Eligibility">
              <Ul>
                <li>
                  Open to U.S. residents who are at least 18 years of age and reside in the
                  Commonwealth of Massachusetts.
                </li>
                <li>
                  Employees and Directors of GSI, and the members of the immediate family of all
                  such persons, are not eligible to win.
                </li>
                <li>
                  <strong>Eligibility is confirmed when a prize is claimed, not when an entry is
                  earned.</strong> Entries accrue automatically from qualifying trips, so a person
                  who does not meet the eligibility requirements may nonetheless be selected. Any
                  selected entrant who does not confirm that they are 18 or older and a Massachusetts
                  resident forfeits the prize, and the prize is awarded to a replacement entrant
                  selected by the same method. See Section 7.
                </li>
                <li>
                  GSI does not require entrants to have a date of birth or state of residence on
                  file in order to earn entries. An entrant whose records do not establish
                  eligibility remains in the drawing and is asked to confirm eligibility if selected.
                </li>
                <li>
                  No purchase is necessary to enter or win. This promotion is subject to all
                  Federal, State, and local laws and regulations, and is void where prohibited.
                </li>
              </Ul>
            </Section>

            <Section id="promotion-period" title="3. Promotion Period">
              <Ul>
                {dayLabel ? (
                  <li>
                    The Promotion Period is {dayLabel}, from 12:00 AM to 11:59 PM Eastern Time.
                  </li>
                ) : (
                  <li>
                    The Promotion Period is a single Walk/Ride Day, from 12:00 AM to 11:59 PM
                    Eastern Time. Walk/Ride Day falls on the last Friday of most months.
                  </li>
                )}
                <li>
                  Only trips recorded within the Promotion Period earn entries. Trips recorded
                  before or after it do not, regardless of when they are confirmed in the app.
                </li>
              </Ul>
            </Section>

            <Section id="how-to-enter" title="4. How to Enter">
              <P>
                Entry is automatic. Record a qualifying trip in the Shift app during the Promotion
                Period and you are entered. There is no opt-in, no form, and no separate
                registration.
              </P>

              <SubSection title="What counts as a qualifying trip">
                <Ul>
                  <li>
                    A trip taken on foot, by bicycle, by bus, by subway or light rail, by commuter
                    rail, or by ferry.
                  </li>
                  <li>
                    The trip must be recorded and location-verified by the Shift app. Trips that
                    are manually entered, or that the app cannot verify, do not earn entries.
                  </li>
                  <li>Trips taken by car, including as a passenger, do not earn entries.</li>
                </Ul>
              </SubSection>

              <SubSection title="How many entries">
                <Ul>
                  <li>Each qualifying trip earns one (1) entry.</li>
                  <li>
                    A maximum of {maxEntries} {maxEntries === 1 ? 'entry' : 'entries'} may be
                    earned per person during the Promotion Period. Additional qualifying trips are
                    welcome but do not increase the number of entries.
                  </li>
                  <li>
                    Entries are per person, not per device or per account. Attempting to earn
                    additional entries through multiple accounts is grounds for disqualification.
                  </li>
                </Ul>
              </SubSection>

              <SubSection title="No alternate method of entry is required">
                <P>
                  Because entry requires no purchase, no payment, no subscription, and no entry
                  action of any kind &mdash; entries accrue from ordinary use of a free app &mdash;
                  no alternate method of entry is offered for this drawing. The Shift app is free to
                  download and free to use.
                </P>
              </SubSection>
            </Section>

            <Section id="prizes" title="5. Prizes">
              {prizes.length === 0 ? (
                <P>
                  <em>
                    Prizes for this Walk/Ride Day will be listed here once they are finalized.
                  </em>
                </P>
              ) : (
                <>
                  <Ul>
                    {prizes.map(p => (
                      <li key={p.id}>
                        <strong>{p.quantity} &times;</strong> {p.description}
                        {p.value_amount != null && (
                          <> &mdash; approximate retail value ${p.value_amount.toLocaleString()} each</>
                        )}
                      </li>
                    ))}
                  </Ul>
                  {totalArv > 0 && (
                    <P>
                      <strong>
                        Total approximate retail value of all prizes: ${totalArv.toLocaleString()}.
                      </strong>
                    </P>
                  )}
                </>
              )}
              <Ul>
                <li>
                  Prizes are digital gift cards, delivered electronically. A winner selects their
                  merchant from the options GSI makes available at the time of redemption.
                </li>
                <li>
                  Prizes are not transferable and no substitution is offered, except that GSI may
                  substitute a prize of equal or greater value if a prize becomes unavailable.
                </li>
                <li>Prizes have no cash value and cannot be redeemed for cash.</li>
                <li>Limit one prize per person.</li>
              </Ul>
            </Section>

            <Section id="winner-selection" title="6. Winner Selection and Notification">
              <Ul>
                <li>
                  Winners are selected at random from all entries earned during the Promotion
                  Period. An entrant&rsquo;s chance of winning is proportional to the number of
                  entries they earned, up to the maximum in Section 4.
                </li>
                <li>
                  {drawLabel
                    ? <>The drawing will be conducted on or about {drawLabel}.</>
                    : <>The drawing will be conducted on or about the day after the Promotion Period ends.</>}
                </li>
                <li>
                  The drawing is conducted by GSI using an automated random selection process, and
                  each drawing is recorded in an audit log retained by GSI. All decisions of GSI
                  regarding winner selection are final.
                </li>
                <li>
                  Winners are notified in the Shift app, and by push notification and email where
                  the winner has enabled them. GSI is not responsible for a notification that fails
                  to reach a winner because of an incorrect email address, a full mailbox, a spam
                  filter, or disabled notifications.
                </li>
              </Ul>
            </Section>

            <Section id="prize-conditions" title="7. Prize Conditions">
              <Ul>
                <li>
                  To claim a prize, a selected entrant must confirm in the Shift app that they are
                  18 years of age or older and a Massachusetts resident, acknowledge these Official
                  Rules, and provide a valid email address for delivery.
                </li>
                <li>
                  <strong>A prize must be claimed within seven (7) days of notification.</strong>{' '}
                  An unclaimed prize is forfeited and awarded to a replacement entrant selected by
                  the same method.
                </li>
                <li>
                  A selected entrant who confirms that they are under 18, or that they reside
                  outside Massachusetts, forfeits the prize. The prize is then awarded to a
                  replacement entrant. Forfeiting for this reason carries no other penalty and does
                  not affect any other part of the entrant&rsquo;s Shift account.
                </li>
                <li>
                  A selected entrant may decline a prize. A declined prize is awarded to a
                  replacement entrant.
                </li>
              </Ul>
            </Section>

            <Section id="tax-obligations" title="8. Tax Obligations">
              <Ul>
                <li>
                  Winners are responsible for any federal, state, and local taxes arising from a
                  prize.
                </li>
                <li>
                  GSI reports prize income where required by law. A winner may be required to
                  provide a Taxpayer Identification Number before a prize is awarded if reporting
                  obligations apply.
                </li>
              </Ul>
            </Section>

            <Section id="general-conditions" title="9. General Conditions">
              <Ul>
                <li>
                  By participating, entrants agree to be bound by these Official Rules.
                </li>
                <li>
                  GSI reserves the right to disqualify any entrant who tampers with the entry
                  process, records trips fraudulently, operates multiple accounts, or otherwise acts
                  in a manner GSI reasonably determines to be in violation of these Rules or in bad
                  faith.
                </li>
                <li>
                  GSI reserves the right to modify, suspend, or cancel this drawing if it cannot be
                  conducted as planned, including because of a technical failure. If the drawing is
                  cancelled, GSI may award prizes from among eligible entries earned up to the point
                  of cancellation.
                </li>
                <li>
                  Nothing in these Rules requires anyone to take a trip they would not otherwise
                  take, or to travel in a way they judge unsafe. Participants are responsible for
                  their own safety and for obeying all traffic laws.
                </li>
              </Ul>
            </Section>

            <Section id="privacy" title="10. Privacy">
              <Ul>
                <li>
                  Information collected in connection with this drawing is used to administer the
                  drawing and deliver prizes. It is handled in accordance with the{' '}
                  <Link href="/privacy" className="text-lime">GSI Privacy Policy</Link>.
                </li>
                <li>
                  Date of birth and state of residence supplied when claiming a prize are used to
                  confirm eligibility and are retained as a record of that confirmation.
                </li>
                <li>
                  GSI does not sell personal information, and does not share entrant information
                  with prize merchants beyond what is required to deliver a gift card.
                </li>
              </Ul>
            </Section>

            <Section id="limitation-of-liability" title="11. Limitation of Liability">
              <Ul>
                <li>
                  By participating, entrants release GSI, its directors, officers, employees, and
                  volunteers from any liability for loss, harm, or damage arising from
                  participation in this drawing or from the acceptance or use of a prize.
                </li>
                <li>
                  GSI is not responsible for entries that are not recorded because of a device
                  failure, a location-services failure, a network outage, or any other technical
                  problem beyond its reasonable control.
                </li>
              </Ul>
            </Section>

            <Section id="disputes" title="12. Disputes">
              <Ul>
                <li>
                  These Official Rules are governed by the laws of the Commonwealth of
                  Massachusetts, without regard to its conflict of laws provisions.
                </li>
                <li>
                  Any dispute arising out of this drawing shall be resolved in the state or federal
                  courts located in Massachusetts.
                </li>
              </Ul>
            </Section>

            <Section id="contact" title="13. Contact">
              <P>
                Questions about this drawing, or about a prize, can be sent to{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">
                  info@gogreenstreets.org
                </a>
                .
              </P>
              <P>
                Green Streets Initiative, Inc. &middot; Cambridge, Massachusetts
              </P>
            </Section>

          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}

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
