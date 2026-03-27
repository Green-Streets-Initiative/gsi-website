import Nav from '@/components/Nav'
import Footer from '@/components/Footer'

export const metadata = {
  title: 'Privacy Policy – Green Streets Initiative',
  description: 'How Shift by Green Streets Initiative collects, uses, stores, and protects your personal information.',
}

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="bg-navy pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-16 sm:py-20">
          {/* Header */}
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-lime">Legal</p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-white">
            Shift by Green Streets Initiative &middot; Last updated March 2026
          </p>
          <p className="mt-1 text-sm text-white">
            Contact: <a href="mailto:privacy@gogreenstreets.org" className="text-lime">privacy@gogreenstreets.org</a>
          </p>

          <hr className="my-10 border-white/[0.08]" />

          {/* Content */}
          <div className="privacy-content space-y-10">
            <Section title="Who We Are">
              <P>
                Shift is a mobile application operated by Green Streets Initiative
                (&ldquo;GSI,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
                a nonprofit organization dedicated to helping people shift trips to healthier,
                cheaper, cleaner alternatives — and measuring the impact, trip by trip, community
                by community. This Privacy Policy explains how we collect, use, store, and protect
                your personal information when you use the Shift app.
              </P>
            </Section>

            <Section title="What Data We Collect">
              <H3>Location Data</H3>
              <P>
                Shift collects your precise GPS location <strong>continuously in the background</strong>,
                including when the app is not open or in use. This is core to how the app works: we
                use location data to detect when you complete a trip by foot, bike, or transit so that
                trips are logged automatically without manual input.
              </P>
              <P>We collect:</P>
              <Ul>
                <li>GPS coordinates during detected trips</li>
                <li>Trip start and end points</li>
                <li>Distance and duration of each trip</li>
                <li>Detected travel mode (walking, cycling, transit, or vehicle)</li>
              </Ul>
              <P>
                We do <strong>not</strong> collect continuous raw location history. Location data is
                used to identify completed trips, after which only the trip record (mode, distance,
                duration, neighborhood, timestamp) is stored. Raw GPS coordinates are processed
                on-device or in transit and are not stored indefinitely.
              </P>

              <H3>Motion and Activity Data</H3>
              <P>
                We use your device&apos;s accelerometer and motion sensors, along with the device&apos;s
                activity recognition capabilities, to classify your travel mode. This data is used only
                for trip detection and is not stored independently of trip records.
              </P>

              <H3>Account Information</H3>
              <P>When you create an account, we collect:</P>
              <Ul>
                <li>Your name and email address</li>
                <li>Authentication credentials (stored securely; passwords are never stored in plaintext)</li>
                <li>Optional profile information such as your neighborhood or school/employer affiliation</li>
              </Ul>

              <H3>Trip Records</H3>
              <P>For each detected or manually logged trip, we store:</P>
              <Ul>
                <li>Date and time</li>
                <li>Trip mode (walk, bike, transit, car)</li>
                <li>Distance</li>
                <li>Neighborhood or general area (not precise endpoints)</li>
                <li>Calculated impact metrics (CO&#8322; avoided, estimated cost savings, calories burned)</li>
              </Ul>

              <H3>Competition and Community Data</H3>
              <P>
                If you join a challenge or leaderboard, we store your participation, scores, and
                rankings associated with that competition. Your display name and aggregate stats may
                be visible to other participants depending on the competition&apos;s visibility settings.
              </P>

              <H3>Usage Data</H3>
              <P>
                We collect standard app usage data including crash reports, feature interactions, and
                performance diagnostics. This data is used to improve the app and is not linked to
                your trip history or location data.
              </P>

              <H3>Route Profile (inferred, not declared)</H3>
              <P>
                To power transit trip classification and streak protection, Shift builds an inferred
                route profile from your trip history after you have completed at least 10 trips.
                This profile stores:
              </P>
              <Ul>
                <li>Approximate home area (centroid of your morning trip start points — not a precise address)</li>
                <li>Approximate work area (centroid of your morning trip end points — not a precise address)</li>
                <li>Nearby MBTA stops and typical routes inferred from your trip patterns</li>
              </Ul>
              <P>
                This profile is <strong>never based on information you enter manually</strong> — it is
                derived entirely from your trip history. It is deleted when you delete your account, and
                you can view and delete it at any time in app settings.
              </P>

              <H3>Saved Locations</H3>
              <P>
                You may optionally save named locations to your profile — such as your home address,
                work address, or frequently visited places. Unlike the inferred route profile, saved
                locations are based on information you enter directly and store precise addresses.
              </P>
              <P>Saved locations are used to:</P>
              <Ul>
                <li>Pre-populate trip context (e.g., identifying a trip as your &ldquo;commute to work&rdquo;)</li>
                <li>Improve trip detection accuracy near your frequently visited places</li>
                <li>Power personalized features such as commute suggestions and nearby transit alerts</li>
              </Ul>
              <P>
                Saved locations are visible only to you. They are never shared with other users,
                employers, schools, or third parties. You can view, edit, or delete your saved
                locations at any time in app settings. Saved locations are deleted when you delete
                your account.
              </P>

              <H3>What Moves Us Campaign Data</H3>
              <P>
                If you choose to participate in a What Moves Us community storytelling campaign,
                we collect the following additional data:
              </P>
              <Ul>
                <li>Short video or audio recordings of your responses to campaign prompts</li>
                <li>Your consent acknowledgment and the date it was given</li>
                <li>Which campaign prompts you responded to and whether you skipped any</li>
              </Ul>
              <P>
                <strong>How this data is used:</strong> Your recordings may be shared publicly on a
                Green Streets Initiative webpage and provided to the organization that commissioned
                the campaign (typically a municipality or transportation planning agency) as part of
                an anonymized community storytelling report. You will be shown the specific sharing
                terms for each campaign before you record anything.
              </P>
              <P>
                <strong>Retention:</strong> Campaign recordings are retained for the duration of the
                project they were collected for, typically 12–24 months. You may request deletion of
                your recordings at any time in app settings or by contacting privacy@gogreenstreets.org.
              </P>
              <P>
                <strong>What is never shared:</strong> Your individual trip data, Shift Rate, or
                location history is never included in What Moves Us deliverables. Campaign participation
                data is kept entirely separate from your trip and competition records.
              </P>
            </Section>

            <Section title="How We Use Your Data">
              <P>We use your data exclusively to operate and improve Shift. Specifically:</P>
              <Ul>
                <li><strong>Trip detection and logging:</strong> Location and motion data is used to detect when you complete a trip and classify the mode of travel.</li>
                <li><strong>Impact calculation:</strong> Trip records are used to calculate your personal environmental and financial impact metrics.</li>
                <li><strong>Community features:</strong> Aggregate trip data is used to power neighborhood leaderboards, school and employer challenges, and community impact dashboards.</li>
                <li><strong>Notifications:</strong> We use your trip patterns to send relevant nudges, milestone alerts, streak notifications, and weekly summaries.</li>
                <li><strong>App improvement:</strong> Usage and diagnostic data is used to fix bugs, improve accuracy, and develop new features.</li>
                <li><strong>Transit trip classification:</strong> For trips where your movement pattern matches a vehicle speed, we compare your route against real-time MBTA vehicle position data to automatically classify the trip as bus, subway, or commuter rail.</li>
                <li><strong>Streak protection:</strong> If a significant MBTA service disruption is active on your typical transit route, we may use your inferred route profile to automatically protect your active streak.</li>
              </Ul>
              <P>
                We do <strong>not</strong> use your data for advertising. We do <strong>not</strong> sell
                your data to third parties. We do <strong>not</strong> share your individual location
                history or trip records with employers, schools, sponsors, or any other third party
                without your explicit consent.
              </P>
            </Section>

            <Section title="Data Sharing">
              <H3>With Other Shift Users</H3>
              <P>
                Your display name and aggregate impact stats may be visible to other users within
                shared competitions or community leaderboards, based on the visibility settings of
                those competitions. Private competitions (e.g., school or employer challenges) are
                only visible to verified participants.
              </P>

              <H3>With Service Providers</H3>
              <P>
                We use a limited number of third-party service providers to operate the app:
              </P>
              <Ul>
                <li><strong>Supabase</strong> (database and authentication infrastructure): Your account and trip data is stored in Supabase&apos;s secure cloud infrastructure.</li>
                <li><strong>Expo / EAS</strong> (app delivery and updates): Used to deliver the app and push over-the-air updates.</li>
                <li><strong>Push notification services</strong> (Apple APNs / Google FCM): Used to deliver notifications to your device. These services receive your device token but not your location or trip data.</li>
              </Ul>
              <P>
                All service providers are contractually prohibited from using your data for any purpose
                other than providing their services to us.
              </P>

              <H3>With Sponsors and Partners</H3>
              <P>
                If you redeem a partner reward or benefit, we may share your first name and redemption
                details with the relevant partner to fulfill the reward. We do not share your location
                history or trip records with sponsors or partners.
              </P>

              <H3>With Schools and Employers</H3>
              <P>
                If you join a school or employer challenge using an invite code, your aggregate trip
                counts and impact statistics may be included in reports provided to that organization.
                These reports contain only anonymized or aggregated data unless you have explicitly
                opted in to individual attribution.
              </P>

              <H3>Legal Requirements</H3>
              <P>
                We may disclose your information if required to do so by law, regulation, or valid
                legal process, or to protect the rights and safety of GSI, our users, or the public.
              </P>
            </Section>

            <Section title="Data Retention">
              <Ul>
                <li><strong>Active account:</strong> Trip records and account data are retained for as long as your account is active.</li>
                <li><strong>Account deletion:</strong> When you delete your account, your personal data (name, email, location-derived trip records) is deleted within 30 days. Anonymized, aggregate data may be retained for reporting purposes.</li>
                <li><strong>Inactive accounts:</strong> Accounts with no activity for 24 consecutive months may be deactivated and data deleted, with prior notice sent to your registered email.</li>
                <li><strong>Points and rewards:</strong> Your points balance and redemption history are deleted when you delete your account. Aggregate, anonymized redemption counts may be retained for partner reporting purposes — these contain no personally identifiable information.</li>
                <li><strong>Route profile:</strong> Your inferred route profile is deleted within 30 days of account deletion.</li>
              </Ul>
            </Section>

            <Section title="Your Rights and Choices">
              <P>You have the following rights with respect to your data:</P>
              <Ul>
                <li><strong>Access:</strong> You may request a copy of the personal data we hold about you.</li>
                <li><strong>Correction:</strong> You may update your account information at any time within the app.</li>
                <li><strong>Deletion:</strong> You may delete your account and associated data at any time from the Profile screen in the app, or by contacting us at privacy@gogreenstreets.org.</li>
                <li><strong>Location permissions:</strong> You may revoke background location permission at any time in your device settings. Note that revoking background location will disable automatic trip detection; you can still use the app to log trips manually.</li>
                <li><strong>Notifications:</strong> You may adjust or disable notifications at any time in the app&apos;s notification settings or in your device settings.</li>
                <li><strong>Data portability:</strong> You may request an export of your trip history and account data in a machine-readable format.</li>
              </Ul>
              <P>
                To exercise any of these rights, contact us
                at <a href="mailto:privacy@gogreenstreets.org" className="text-lime">privacy@gogreenstreets.org</a>.
                We will respond within 30 days.
              </P>
            </Section>

            <Section title="Children's Privacy">
              <P>
                Shift is designed for use by adults and by minors under the supervision of a parent,
                guardian, or school. We do not knowingly collect personal information from children
                under 13 without verifiable parental consent. School challenges are administered
                through institutional accounts; student participation requires school authorization.
              </P>
              <P>
                If you believe we have inadvertently collected information from a child under 13
                without appropriate consent, please contact us immediately
                at <a href="mailto:privacy@gogreenstreets.org" className="text-lime">privacy@gogreenstreets.org</a> and
                we will delete the information promptly.
              </P>
            </Section>

            <Section title="Security">
              <P>
                We implement industry-standard security measures to protect your data, including:
              </P>
              <Ul>
                <li>Encrypted data transmission (TLS/HTTPS for all data in transit)</li>
                <li>Encrypted data storage (Supabase uses AES-256 encryption at rest)</li>
                <li>Row-level security on our database, ensuring users can only access their own data</li>
                <li>Authentication tokens that expire and are rotated regularly</li>
              </Ul>
              <P>
                No method of transmission or storage is completely secure. We cannot guarantee
                absolute security, but we are committed to protecting your information using
                reasonable and appropriate measures.
              </P>
            </Section>

            <Section title="Changes to This Policy">
              <P>
                We may update this Privacy Policy from time to time. If we make material changes —
                particularly to how we collect or use location data — we will notify you via the app
                and/or email before the changes take effect. Continued use of the app after
                notification constitutes acceptance of the updated policy.
              </P>
            </Section>

            <Section title="Contact Us">
              <P>
                Green Streets Initiative<br />
                Cambridge, MA<br />
                <a href="mailto:privacy@gogreenstreets.org" className="text-lime">privacy@gogreenstreets.org</a>
              </P>
              <P>
                If you have questions about this policy or how your data is handled, please reach out.
                We&apos;re a small team and we&apos;ll get back to you personally.
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

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 font-display text-base font-semibold text-white">{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[0.9375rem] leading-[1.7] text-white">{children}</p>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-[1.7] text-white">{children}</ul>
}
