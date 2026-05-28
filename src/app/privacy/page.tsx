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
            Shift by Green Streets Initiative &middot; Last updated May 2026
          </p>
          <p className="mt-1 text-sm text-white">
            Contact: <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>
          </p>

          <hr className="my-10 border-white/[0.08]" />

          {/* Content */}
          <div className="privacy-content space-y-10">
            <Section title="Who We Are">
              <P>
                Shift is a mobile application operated by Green Streets Initiative
                (&ldquo;GSI,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
                a nonprofit organization dedicated to helping people shift trips to healthier,
                cheaper, cleaner alternatives &mdash; and measuring the impact, trip by trip,
                community by community.
              </P>
              <P>
                This Privacy Policy explains how we collect, use, disclose, store, retain, and
                protect personal information when you use the Shift app, the Green Streets
                Initiative website, and related services, features, programs, challenges,
                leaderboards, rewards, communications, and community campaigns.
              </P>
              <P>
                By using Shift, the website, or any related service, you accept the practices
                described in this Privacy Policy.
              </P>
              <P>
                If you do not agree with this Privacy Policy, please do not use Shift, the
                website, or our related services.
              </P>
            </Section>

            <Section title="What Information We Collect">
              <P>
                We collect information directly from you, automatically from your device when you
                use Shift or our website, from your participation in programs, campaigns,
                competitions, rewards, and challenges, and from service providers or program
                partners that help us operate Shift.
              </P>
              <P>
                Some information Shift uses can be sensitive because of what it may reveal about
                you, including precise location data, saved locations, inferred route profile
                data, and information about minors or students where applicable.
              </P>
              <P>
                We use that information only to provide and protect Shift, operate the features
                described in this Privacy Policy, comply with law, or for another purpose we
                disclose to you.
              </P>
            </Section>

            <Section title="Location Data">
              <P>
                With your device permission, Shift may access precise GPS location in the
                background, including when the app is not open or in active use, because automatic
                trip detection depends on location access.
              </P>
              <P>
                We use location data to detect when you complete a trip by foot, bike, transit, or
                vehicle so that trips can be logged automatically without manual input.
              </P>
              <P>We collect:</P>
              <Ul>
                <li>GPS coordinates during detected trips</li>
                <li>Trip start and end points during trip detection and processing</li>
                <li>Distance and duration of each trip</li>
                <li>Detected travel mode (walking, cycling, transit, or vehicle)</li>
              </Ul>
              <P>We also may collect or derive:</P>
              <Ul>
                <li>Device permission status for location services</li>
                <li>General neighborhood, route, or area information used to support trip classification and impact calculations</li>
                <li>Technical metadata needed to process a trip, such as timestamps, device operating system, and app version</li>
              </Ul>
              <P>
                Shift is not designed to retain a continuous raw location history indefinitely.
                Location data is used to identify completed trips, after which we retain a trip
                record such as mode, distance, duration, general area or neighborhood, timestamp,
                and related impact metrics.
              </P>
              <P>
                Raw GPS coordinates may be processed on-device, in transit, or temporarily in our
                systems as needed for trip detection, debugging, security, fraud prevention, or
                service operation, but they are not retained indefinitely unless otherwise
                disclosed or required by law.
              </P>
            </Section>

            <Section title="Motion and Activity Data">
              <P>
                We use your device&apos;s accelerometer and motion sensors, along with the
                device&apos;s activity recognition capabilities, to classify your travel mode.
                This data is used only for trip detection and is not stored independently of
                trip records.
              </P>
            </Section>

            <Section title="Account Information">
              <P>When you create an account, we collect:</P>
              <Ul>
                <li>Your name and email address</li>
                <li>Authentication credentials (stored securely; passwords are never stored in plaintext)</li>
                <li>Optional profile information such as your neighborhood or school/employer affiliation</li>
              </Ul>
              <P>
                We may also collect communications you send to us, support requests, privacy
                questions or requests, feedback, and similar information when you contact us for
                any reason.
              </P>
              <P>
                You are responsible for keeping your account credentials secure and for contacting
                us promptly if you believe your account has been compromised.
              </P>
            </Section>

            <Section title="Trip Records">
              <P>For each detected or manually logged trip, we store:</P>
              <Ul>
                <li>Date and time</li>
                <li>Trip mode (walk, bike, transit, car)</li>
                <li>Distance</li>
                <li>Neighborhood or general area (not precise endpoints)</li>
                <li>Calculated impact metrics (CO&#8322; avoided, estimated cost savings, calories burned)</li>
              </Ul>
            </Section>

            <Section title="Competition and Community Data">
              <P>
                If you join a challenge or leaderboard, we store your participation, scores, and
                rankings associated with that competition. Your display name and aggregate stats
                may be visible to other participants depending on the competition&apos;s
                visibility settings.
              </P>
            </Section>

            <Section title="Usage Data">
              <P>
                We collect standard app and website usage data, including crash reports, feature
                interactions, performance diagnostics, device and browser information, IP address,
                access times, pages or screens viewed, and similar technical information.
              </P>
              <P>
                We use this information to operate, secure, troubleshoot, analyze, and improve
                Shift and the website.
              </P>
              <P>
                Where practical, diagnostic and usage data is separated from precise location and
                trip history, but some technical data may be associated with your account when
                needed to provide support, maintain security, investigate errors, or comply
                with law.
              </P>
            </Section>

            <Section title="Route Profile (inferred, not declared)">
              <P>
                To power transit trip classification and streak protection, Shift builds an
                inferred route profile from your trip history after you have completed at least
                10 trips. This profile stores:
              </P>
              <Ul>
                <li>Approximate home area (centroid of your morning trip start points &mdash; not a precise address)</li>
                <li>Approximate work area (centroid of your morning trip end points &mdash; not a precise address)</li>
                <li>Nearby MBTA stops and typical routes inferred from your trip patterns</li>
              </Ul>
              <P>
                This profile is <strong>never based on information you enter manually</strong>{' '}
                &mdash; it is derived entirely from your trip history. It is deleted when you
                delete your account, and you can view and delete it at any time in app settings.
              </P>
            </Section>

            <Section title="Saved Locations">
              <P>
                Saved locations are visible only to you within your account.
              </P>
              <P>
                We do not disclose saved locations to other Shift users, employers, schools,
                sponsors, or rewards partners without your explicit consent.
              </P>
              <P>
                Saved locations may be processed by our service providers as necessary to provide,
                host, secure, and support Shift, and may be disclosed if required by law or valid
                legal process.
              </P>
              <P>
                You can view, edit, or delete your saved locations at any time in app settings.
              </P>
              <P>
                Saved locations are deleted when you delete your account, subject to ordinary
                backup cycles, legal obligations, security needs, or other limited retention
                permitted by applicable law.
              </P>
            </Section>

            <Section title="What Moves Us Campaign Data">
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
                <strong>How this data is used:</strong> Your recordings may be shared publicly on
                a Green Streets Initiative webpage and may be provided to the organization that
                commissioned the campaign, such as a municipality, transportation planning agency,
                or similar planning organization, as described in the campaign-specific consent
                terms shown to you before you record anything.
              </P>
              <P>
                Because video or audio recordings may include your image, voice, statements, or
                other identifying characteristics, recordings may be identifiable even when
                related reports use aggregated or anonymized themes.
              </P>
              <P>
                You will be shown the specific sharing, publication, and deletion terms for each
                campaign before you submit any recording.
              </P>
              <P>
                <strong>Retention:</strong> Campaign recordings are retained for the duration of
                the project for which they were collected, typically 12&ndash;24 months, unless a
                shorter or longer period is disclosed in the campaign-specific consent terms or
                required by law. You may withdraw consent and request deletion of your recordings
                at any time in app settings or by contacting{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>,
                subject to legal, archival, operational, or already-published materials that
                cannot reasonably be withdrawn.
              </P>
              <P>
                <strong>What is never shared:</strong> Your individual trip data, Shift Rate, or
                location history is never included in What Moves Us deliverables. Campaign
                participation data is kept entirely separate from your trip and competition
                records.
              </P>
            </Section>

            <Section title="How We Use Your Data">
              <P>
                We use your information primarily to operate, provide, maintain, secure,
                personalize, analyze, and improve Shift, the website, and related services, and
                to fulfill the purposes for which you provided the information.
              </P>
              <Ul>
                <li><strong>Trip detection and logging:</strong> Location and motion data is used to detect when you complete a trip and classify the mode of travel.</li>
                <li><strong>Impact calculation:</strong> Trip records are used to calculate your personal environmental and financial impact metrics.</li>
                <li><strong>Community features:</strong> Aggregate trip data is used to power neighborhood leaderboards, school and employer challenges, and community impact dashboards.</li>
                <li><strong>Notifications:</strong> We use your trip patterns to send relevant nudges, milestone alerts, streak notifications, and weekly summaries.</li>
                <li><strong>App improvement:</strong> Usage and diagnostic data is used to fix bugs, improve accuracy, and develop new features.</li>
                <li><strong>Transit trip classification:</strong> For trips where your movement pattern matches a vehicle speed, we compare your route against real-time MBTA vehicle position data to automatically classify the trip as bus, subway, or commuter rail.</li>
                <li><strong>Streak protection:</strong> If a significant MBTA service disruption is active on your typical transit route, we may use your inferred route profile to automatically protect your active streak.</li>
                <li><strong>Account administration:</strong> We use account information to create and manage accounts, authenticate users, provide support, respond to requests, and maintain account security.</li>
                <li><strong>Fraud prevention and integrity:</strong> We use information to detect false or fabricated trips, leaderboard manipulation, misuse of XP, tiers, rewards, offers, discount codes, unauthorized account access, and other potential fraud, illegal activity, or violations of our terms.</li>
                <li><strong>Legal compliance:</strong> We may use information to comply with applicable law, regulation, court order, subpoena, legal process, tax obligation, or law enforcement request.</li>
                <li><strong>Service providers:</strong> We may use and disclose information to service providers that help us host, operate, secure, analyze, maintain, and improve Shift and related services.</li>
                <li><strong>Aggregated and anonymized reporting:</strong> We may anonymize or aggregate information so that it no longer identifies you, and we may use and disclose that anonymized or aggregated information for reporting, research, community impact measurement, partner reporting, grant reporting, planning, and other lawful purposes.</li>
                <li><strong>Program administration:</strong> We may use information to administer challenges, competitions, rewards, partner offer access or use, school and employer programs, What Moves Us campaigns, and related program terms.</li>
              </Ul>
              <P>
                We do not sell your personal information, use your personal information for
                targeted advertising, or use your personal information for third-party
                advertising.
              </P>
              <P>
                We do not share individual trip records, precise location history, saved locations,
                inferred route profile data, or personal Shift Rate with employers, schools,
                sponsors, rewards partners, or other third parties without your explicit consent,
                except as described in this Privacy Policy or required by law.
              </P>
              <P>
                If we materially change how we collect, use, share, or retain personal
                information, we will update this Privacy Policy and provide notice when
                appropriate.
              </P>
            </Section>

            <Section title="How We Share Your Information">
              <P>
                We share personal information as described in this Privacy Policy, as directed or
                consented to by you, as needed to provide Shift and related services, or as
                otherwise permitted or required by law.
              </P>

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
                <li><strong>MBTA API or transit-data providers:</strong> Used to compare trip patterns against transit data for transit trip classification and service disruption features.</li>
                <li><strong>Analytics, diagnostics, and infrastructure providers:</strong> Used to understand app performance, diagnose crashes, maintain security, and improve functionality.</li>
              </Ul>
              <P>
                Our service providers are authorized to use personal information only as needed to
                provide services to us and must handle personal information in accordance with
                applicable law and our instructions.
              </P>
              <P>
                Where appropriate, we enter into contracts requiring service providers to keep
                personal information confidential and not use it for purposes other than
                performing services for us.
              </P>

              <H3>With Sponsors and Partners</H3>
              <P>
                For most access-based partner offers, we do not provide the partner with
                individual location history, saved locations, inferred route profile data, trip
                records, or personal Shift Rate.
              </P>
              <P>
                If a reward, offer, or benefit requires verification, fulfillment, fraud
                prevention, customer support, or user-requested assistance, we may share only the
                limited information reasonably necessary for that purpose, such as an access
                confirmation, discount code status, offer activity, first name, or redemption
                details where applicable.
              </P>
              <P>
                We may share more information with a sponsor or partner only with your explicit
                consent or as required by law.
              </P>

              <H3>With Schools and Employers</H3>
              <P>
                If you join a school or employer challenge using an invite code, your participation
                is voluntary, and your aggregate trip counts and impact statistics may be included
                in reports provided to that organization.
              </P>
              <P>
                These reports contain only anonymized or aggregated data unless you have explicitly
                opted in to individual attribution.
              </P>
              <P>
                Schools and employers do not receive individual trip data, location information,
                saved locations, inferred route profile data, or your personal Shift Rate without
                your explicit consent.
              </P>

              <H3>Legal Requirements</H3>
              <P>
                We may disclose your information if required to do so by law, regulation, or valid
                legal process, or to protect the rights and safety of GSI, our users, or the
                public.
              </P>

              <H3>Business / Organizational Transfer</H3>
              <P>
                We may disclose or transfer personal information in connection with a merger,
                divestiture, restructuring, reorganization, dissolution, asset transfer, program
                transition, or similar transaction involving some or all of GSI&apos;s assets or
                operations, subject to applicable law.
              </P>

              <H3>Aggregated and Anonymized Data</H3>
              <P>
                We may use and disclose information that has been aggregated or anonymized so that
                it no longer identifies you for any lawful purpose, including community impact
                reporting, research, planning, partner reporting, grant reporting, and public
                communications.
              </P>
            </Section>

            <Section title="Data Retention">
              <P>
                We keep personal information for as long as reasonably necessary for the purposes
                for which it was collected, including to provide Shift, maintain your account,
                administer XP, tier status, rewards, offer activity, competitions, challenges,
                campaigns, and programs, comply with legal obligations, resolve disputes, enforce
                agreements, protect security, and maintain accurate business records.
              </P>
              <Ul>
                <li><strong>Active account:</strong> Trip records and account data are retained for as long as your account is active.</li>
                <li><strong>Account deletion:</strong> When you delete your account, your personal data, including name, email, saved locations, inferred route profile, and location-derived trip records, is deleted or de-identified from active systems within 30 days, unless a longer period is required or permitted by law, security needs, backup cycles, dispute resolution, fraud prevention, or limited operational needs described in this Privacy Policy. Anonymized or aggregated data may be retained for reporting, research, planning, partner reporting, grant reporting, and community impact measurement because it no longer identifies you.</li>
                <li><strong>Inactive accounts:</strong> Accounts with no activity for 24 consecutive months may be deactivated and data deleted, with prior notice sent to your registered email.</li>
                <li><strong>XP, rewards, and offer activity:</strong> Your XP or tier status, reward history, offer access history, and related records are deleted or de-identified when you delete your account, subject to ordinary backup cycles, legal obligations, fraud prevention, tax or accounting requirements, dispute resolution, and program, sponsor, or partner reporting needs. Aggregate or anonymized counts may be retained for program reporting, sponsor reporting, partner reporting, grant reporting, research, planning, and community impact measurement because they no longer identify you.</li>
                <li><strong>Route profile:</strong> Your inferred route profile is deleted within 30 days of account deletion.</li>
              </Ul>
            </Section>

            <Section title="Cookies and Other Tracking Technologies">
              <P>
                Our website and app may use cookies, pixels, SDKs, device identifiers, analytics
                tools, and similar tracking technologies to operate our services, maintain
                security, remember preferences, analyze functionality and performance, understand
                usage, and improve user experience.
              </P>
              <P>
                Strictly necessary technologies help us provide core functionality, such as
                account login, security, app functionality, and service operation.
              </P>
              <P>
                Analytics and performance technologies help us understand how users interact with
                the website or app and improve the way our services work.
              </P>
              <P>
                Functionality technologies may help us remember preferences or personalize app or
                website features.
              </P>
              <P>
                We do not use cookies or tracking technologies to sell personal information or
                serve targeted advertising.
              </P>
              <P>
                If our practices change, we will update this Privacy Policy before using cookies
                or similar technologies for targeted advertising.
              </P>
              <P>
                You can usually set your browser to block or restrict cookies, but some cookies or
                similar technologies may be necessary for the website or app to function properly.
              </P>
            </Section>

            <Section title="Your Privacy Choices and Account Controls">
              <P>You can manage many privacy choices directly in Shift:</P>
              <Ul>
                <li><strong>Account information:</strong> You may view and update certain account information in the app.</li>
                <li><strong>Location permissions:</strong> You may revoke background location permission at any time in your device settings. Revoking background location permission will disable automatic trip detection, but you may still be able to use Shift to log trips manually.</li>
                <li><strong>Saved locations:</strong> You may view, edit, or delete saved locations in app settings.</li>
                <li><strong>Inferred route profile:</strong> You may view and delete your inferred route profile in app settings.</li>
                <li><strong>Notifications:</strong> You may adjust or disable notifications in the app&apos;s notification settings or in your device settings.</li>
                <li><strong>Account deletion:</strong> You may delete your account in the app or by contacting <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>. When you delete your account, we delete or de-identify personal information associated with your account as described in the Data Retention section.</li>
                <li><strong>What Moves Us recordings:</strong> If you participate in a What Moves Us campaign, you may withdraw consent and request deletion of your recordings as described in the campaign-specific consent terms and in this Privacy Policy.</li>
                <li><strong>Marketing communications:</strong> You may opt out of marketing-related emails or text messages as described in the Marketing Emails and SMS/Text Messages section.</li>
              </Ul>
              <P>
                You may also contact us at{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>{' '}
                to ask questions about your information, request help accessing or deleting your
                account, or raise a privacy concern.
              </P>
              <P>
                We may need to verify your identity before helping with account access, deletion,
                or other account-specific requests. We will review and respond to privacy
                questions and requests within a reasonable time. We will follow privacy laws
                applicable to us. If we cannot complete a request, we will explain why when
                appropriate.
              </P>
            </Section>

            <Section title="Marketing Emails and SMS/Text Messages">
              <P>
                You may opt out of marketing-related emails by following the unsubscribe
                instructions in any marketing or promotional email you receive or by
                contacting{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>.
              </P>
              <P>
                If we send marketing SMS/text messages and you no longer want to receive them, you
                may opt out by replying &ldquo;STOP&rdquo; or by following any other opt-out
                instructions provided in the message.
              </P>
              <P>
                Operational, transactional, safety, account, and service-related messages may
                still be sent where permitted by law.
              </P>
            </Section>

            <Section title="Children&apos;s Privacy">
              <P>
                You must be at least 13 years old to create a Shift account.
              </P>
              <P>
                If you are between 13 and 18, you confirm that you have permission from a parent
                or guardian to use the app.
              </P>
              <P>
                The Shift school program is designed for children under 13, but it operates
                through teacher, school administrator, or institutional accounts, not direct
                student accounts.
              </P>
              <P>
                Students under 13 should not create personal Shift accounts or interact with the
                app directly unless GSI has implemented and disclosed an appropriate consent and
                school authorization process.
              </P>
              <P>
                We do not knowingly collect personal information directly from children under 13
                without verifiable parental consent, school authorization, or another legally
                permitted basis.
              </P>
              <P>
                If you believe we have inadvertently collected personal information from a child
                under 13 without appropriate consent or authorization, please contact us
                immediately at{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>{' '}
                and we will take reasonable steps to delete the information or otherwise comply
                with applicable law.
              </P>
            </Section>

            <Section title="Security">
              <P>
                We use commercially reasonable physical, electronic, technical, and managerial
                safeguards designed to protect the information we collect.
              </P>
              <P>
                We use commercially reasonable security measures designed to protect your data,
                including:
              </P>
              <Ul>
                <li>Encrypted data storage, including encryption at rest provided by our infrastructure providers where applicable</li>
                <li>Row-level security on our database, designed to help ensure users can access only their own data</li>
                <li>Authentication tokens that expire and are rotated regularly</li>
              </Ul>
              <P>
                No method of transmission or storage is completely secure. We cannot guarantee
                absolute security, but we are committed to protecting your information using
                reasonable and appropriate measures.
              </P>
              <P>
                The transmission of information via the internet or through mobile applications is
                not completely secure, and any transmission of information is at your own risk.
                You are responsible for maintaining the confidentiality of your account credentials
                and for notifying us promptly if you believe your account has been compromised.
              </P>
            </Section>

            <Section title="Third-Party Websites and Services">
              <P>
                Shift and the website may include links to, integrations with, or data from
                third-party websites, platforms, APIs, services, app stores, notification services,
                and transit-data providers.
              </P>
              <P>
                Your use of third-party websites or services may be subject to those third
                parties&apos; own terms and privacy policies.
              </P>
              <P>
                We are not responsible for the privacy practices, content, accuracy, availability,
                or policies of third-party websites or services that we do not control.
              </P>
            </Section>

            <Section title="Accessibility">
              <P>
                We are committed to making this Privacy Policy accessible to everyone.
              </P>
              <P>
                To request this Privacy Policy in an alternative format, please contact us
                at{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>.
              </P>
            </Section>

            <Section title="Changes to This Policy">
              <P>
                We may update this Privacy Policy from time to time and we encourage you to review
                it regularly. If we make material changes, including material changes to how we
                collect, use, share, or retain location data, we will notify you through the app,
                by email, by posting a notice on our website, or by another reasonable method
                before the changes take effect when appropriate.
              </P>
              <P>
                Your continued use of Shift, the website, or related services after the effective
                date of an updated Privacy Policy means that you accept the updated Privacy Policy.
              </P>
              <P>
                If you do not agree with the updated Privacy Policy, you should stop using Shift,
                the website, and related services.
              </P>
            </Section>

            <Section title="Contact Us">
              <P>
                Green Streets Initiative<br />
                Cambridge, MA<br />
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>
              </P>
              <P>
                If you have questions about this policy or how your data is handled, please reach
                out. We&apos;re a small team and we&apos;ll get back to you personally.
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
