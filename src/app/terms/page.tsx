import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Terms of Service – Green Streets Initiative',
  description: 'Terms of Service for Shift by Green Streets Initiative and the gogreenstreets.org website.',
}

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="bg-navy pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
          {/* Header */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-lime">Legal</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-white">
            Shift by Green Streets Initiative &middot; Last updated March 2026
          </p>
          <p className="mt-1 text-sm text-white">
            Contact: <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>
          </p>

          <hr className="my-10 border-white/[0.08]" />

          {/* Content */}
          <div className="space-y-10">
            <Section title="1. Who We Are and What This Covers">
              <P>
                Shift is a mobile application operated by Green Streets Initiative
                (&ldquo;GSI,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
                a 501(c)(3) nonprofit organization based in Cambridge, Massachusetts. These
                Terms of Service (&ldquo;Terms&rdquo;) govern your use of the Shift app and
                the Green Streets Initiative website at gogreenstreets.org.
              </P>
              <P>
                By downloading the app or using the website, you agree to these Terms. If you
                don&apos;t agree, please don&apos;t use our services.
              </P>
            </Section>

            <Section title="2. Eligibility">
              <P>
                You must be at least 13 years old to create a Shift account. If you are between
                13 and 18, you confirm that you have permission from a parent or guardian to use
                the app.
              </P>
              <P>
                The Shift school program is designed for children under 13, but it operates
                through teacher and school administrator accounts — not student accounts. Students
                do not create accounts or interact with the app directly.
              </P>
            </Section>

            <Section title="3. Your Account">
              <P>
                You are responsible for keeping your account credentials secure. Don&apos;t share
                your login with others. If you think your account has been compromised, contact
                us at <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a> immediately.
              </P>
              <P>
                You agree to provide accurate information when creating your account and to keep
                it up to date. We reserve the right to suspend or terminate accounts that contain
                false information or that violate these Terms.
              </P>
            </Section>

            <Section title="4. Acceptable Use">
              <P>
                You agree to use Shift only for its intended purpose — tracking and celebrating
                active transportation trips. You agree not to:
              </P>
              <Ul>
                <li>Submit false or fabricated trips</li>
                <li>Manipulate leaderboards, challenges, or competition standings through any means other than legitimate active trips</li>
                <li>Use automated tools, scripts, or bots to interact with the app</li>
                <li>Attempt to access other users&apos; accounts or data</li>
                <li>Reverse-engineer, decompile, or tamper with the app or its infrastructure</li>
                <li>Use the app in any way that violates applicable law</li>
              </Ul>
              <P>
                We use automated verification to detect implausible trip patterns. Accounts found
                gaming the system may have their trips adjusted, their competition standings
                removed, or their accounts suspended.
              </P>
            </Section>

            <Section title="5. Shift Points">
              <P>
                Shift points are a loyalty discount mechanism with no monetary value. Points are
                not currency, property, or a financial instrument of any kind. Specifically:
              </P>
              <Ul>
                <li>Points have no cash value and cannot be redeemed for cash</li>
                <li>Points cannot be transferred, sold, gifted, or exchanged between accounts</li>
                <li>Points cannot be combined across multiple accounts</li>
                <li>Point values, earning rates, and redemption costs may change at any time at GSI&apos;s sole discretion</li>
                <li>Points expire after 12 months of account inactivity</li>
                <li>Points are forfeited upon account deletion or termination</li>
              </Ul>
              <P>
                Earning points does not create any contractual right to a specific reward. The
                rewards catalog is subject to change, and specific rewards may be discontinued
                at any time.
              </P>
            </Section>

            <Section title="6. Competitions and Prizes">
              <P>
                Shift competitions are governed by separate Official Rules posted for each event.
                In the event of a conflict between these Terms and the Official Rules for a
                specific competition, the Official Rules govern.
              </P>
              <P>
                Prize winners may be required to complete additional steps to claim their prize,
                including providing identification, completing tax forms (where required by law),
                and acknowledging receipt. Prizes are non-transferable. GSI reserves the right to
                substitute prizes of equal or greater value.
              </P>
              <P>
                Competitions that include a sweepstakes element require no purchase to enter. A
                free alternative method of entry will be specified in the Official Rules.
              </P>
            </Section>

            <Section title="7. Rewards Redemptions">
              <P>When you redeem points at a participating business, you agree that:</P>
              <Ul>
                <li>Redemptions are final and non-reversible once confirmed in the app</li>
                <li>The participating business is solely responsible for fulfilling the offer</li>
                <li>GSI is not responsible for the quality, accuracy, or availability of any reward offered by a partner business</li>
                <li>Redemption confirmations shown on your phone screen are for one-time use</li>
              </Ul>
            </Section>

            <Section title="8. User Content">
              <P>
                If you submit content through Shift — including What Moves Us video or audio
                recordings, profile information, or any other user-generated material — you grant
                GSI a non-exclusive, royalty-free license to use, display, and distribute that
                content in connection with GSI&apos;s programs and mission.
              </P>
              <P>
                For What Moves Us submissions specifically, the sharing and usage terms are
                governed by the consent agreement you accept within that program, which may allow
                your content to be shared with third-party planning organizations. You may
                withdraw consent and request deletion of your submissions at any time by
                contacting <a href="mailto:privacy@gogreenstreets.org" className="text-lime">privacy@gogreenstreets.org</a>.
              </P>
              <P>
                You represent that any content you submit does not violate the rights of any
                third party, including copyright, privacy, or publicity rights.
              </P>
            </Section>

            <Section title="9. Privacy">
              <P>
                Your use of Shift is also governed by our{' '}
                <a href="/privacy" className="text-lime">Privacy Policy</a>, which is
                incorporated into these Terms by reference. By using Shift, you agree to the
                collection and use of your information as described in the Privacy Policy.
              </P>
            </Section>

            <Section title="10. Employer and School Programs">
              <P>
                If you join Shift through an employer or school challenge, your participation is
                voluntary. You may leave any employer or school group at any time through the app
                settings. Leaving a group does not delete your account or trip history.
              </P>
              <P>
                Employers and schools receive only aggregate, anonymized data about their
                group&apos;s participation. They do not receive individual trip data, location
                information, or your personal Shift Rate without your explicit consent.
              </P>
            </Section>

            <Section title="11. Rewards Partner Program">
              <P>
                If you apply to become a Shift rewards partner through our partner portal, your
                participation is governed by the Shift Rewards Partner Agreement you sign during
                the application process, in addition to these Terms.
              </P>
            </Section>

            <Section title="12. Intellectual Property">
              <P>
                The Shift app, the Green Streets Initiative name and logo, and all content we
                produce are owned by GSI or licensed to us. You may not use our name, logo, or
                content without our written permission.
              </P>
              <P>
                The Shift mark and the two-chevron Shift icon are proprietary to Green Streets
                Initiative.
              </P>
            </Section>

            <Section title="13. Third-Party Services">
              <P>
                Shift integrates with third-party services including Supabase (data
                infrastructure), Apple and Google (app distribution and notifications), and the
                Massachusetts Bay Transportation Authority API (transit data). Your use of these
                services is also subject to their respective terms of service.
              </P>
            </Section>

            <Section title="14. Disclaimers">
              <P>
                Shift is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; We make no
                warranties, express or implied, about the accuracy of trip detection, the
                availability of the app, or the completeness of any data.
              </P>
              <P>
                Active transportation involves physical activity and inherent risks. By using
                Shift to track active trips, you acknowledge that you are responsible for your
                own safety, and that GSI is not liable for any injury, accident, or incident
                that occurs during your trips.
              </P>
            </Section>

            <Section title="15. Limitation of Liability">
              <P>
                To the fullest extent permitted by law, GSI&apos;s total liability to you for
                any claims arising from your use of Shift shall not exceed the greater of $100
                or the total amount you have paid to GSI in the 12 months preceding the claim.
                As Shift is a free service, this effectively means GSI&apos;s liability is
                limited to $100.
              </P>
            </Section>

            <Section title="16. Indemnification">
              <P>
                You agree to indemnify and hold GSI harmless from any claims, damages, or
                expenses (including reasonable attorneys&apos; fees) arising from your use of
                the app, your violation of these Terms, or your violation of any third
                party&apos;s rights.
              </P>
            </Section>

            <Section title="17. Changes to These Terms">
              <P>
                We may update these Terms from time to time. If we make material changes, we
                will notify you via the app or email before the changes take effect. Continued
                use of the app after notification constitutes your acceptance of the updated
                Terms.
              </P>
            </Section>

            <Section title="18. Governing Law and Disputes">
              <P>
                These Terms are governed by the laws of the Commonwealth of Massachusetts,
                without regard to conflict of law principles. Any disputes arising from these
                Terms or your use of Shift shall be resolved in the state or federal courts
                located in Middlesex County, Massachusetts, and you consent to personal
                jurisdiction in those courts.
              </P>
            </Section>

            <Section title="19. Contact">
              <P>
                Green Streets Initiative<br />
                Cambridge, Massachusetts<br />
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>
              </P>
              <P>
                If you have questions about these Terms, please reach out. We&apos;re a small
                team and we&apos;ll get back to you personally.
              </P>
            </Section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}

/* ── Typography helpers ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 font-display text-xl font-bold tracking-tight text-white">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.9375rem] leading-[1.7] text-white">{children}</p>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-[1.7] text-white">{children}</ul>
}
