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
            Shift by Green Streets Initiative &middot; Last updated May 2026
          </p>
          <p className="mt-1 text-sm text-white">
            Contact: <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>
          </p>

          <hr className="my-10 border-white/[0.08]" />

          {/* Content */}
          <div className="space-y-10">
            <Section title="Who We Are and What This Covers">
              <P>
                Shift is a mobile application operated by Green Streets Initiative
                (&ldquo;GSI,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;),
                a 501(c)(3) nonprofit organization based in Cambridge, Massachusetts. These
                Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
                Shift mobile application, the Green Streets Initiative website at
                gogreenstreets.org, and any related content, features, challenges, competitions,
                rewards, programs, services, communications, and materials we make available.
                Please read these Terms in full before using Shift or the Green Streets
                Initiative website.
              </P>
              <P>
                By downloading the app, creating an account, accepting these Terms, accessing
                the website, or otherwise using Shift or our services, you agree to be legally
                bound by these Terms, our{' '}
                <a href="/privacy" className="text-lime">Privacy Policy</a>, any applicable
                Official Rules, program-specific consent terms, rewards partner agreements, and
                any other terms that apply to a specific feature, campaign, competition, reward,
                or program. If you do not agree to these Terms, please do not use Shift, the
                website, or our services.
              </P>
            </Section>

            <Section title="Access to Site and App">
              <P>
                You may be able to access public portions of the Green Streets Initiative
                website without registering an account.
              </P>
              <P>
                Certain features of Shift, including trip tracking, XP, tier status, challenges,
                competitions, offers, rewards, employer or school programs, and account-based
                settings, may require you to create and maintain a Shift account.
              </P>
              <P>
                You may not attempt to gain access to any portion of Shift, the website, any
                account, data, content, service, system, or infrastructure for which you are
                not authorized.
              </P>
            </Section>

            <Section title="Eligibility">
              <P>
                You must be at least 13 years old to create a Shift account. If you are between
                13 and 18, you confirm that you have permission from a parent or guardian to use
                the app.
              </P>
              <P>
                The Shift school program is designed for children under 13, but it operates
                through teacher and school administrator accounts &mdash; not student accounts.
                Students do not create accounts or interact with the app directly.
              </P>
              <P>
                You are responsible for ensuring that your use of Shift and the website complies
                with all laws that apply to you.
              </P>
              <P>
                We are not responsible for any damages that result from a user&apos;s
                misrepresentation of age, authority, eligibility, or permission to use Shift.
              </P>
            </Section>

            <Section title="Your Account">
              <P>
                You are responsible for keeping your account credentials secure, maintaining the
                confidentiality of your login information, and all activity that occurs under
                your account. If you believe your account has been compromised, contact us
                at{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>{' '}
                immediately.
              </P>
              <P>
                You agree to provide accurate information when creating your account and to keep
                it up to date. We reserve the right to suspend, restrict, or terminate accounts
                that contain false, inaccurate, misleading, or incomplete information, that
                violate these Terms, that misuse Shift, or that otherwise create security,
                legal, operational, or integrity concerns.
              </P>
              <P>
                You may not use another person&apos;s account, attempt to access another
                person&apos;s account or data, misrepresent your identity or affiliation, or
                falsely represent your eligibility, group membership, trip activity, challenge
                participation, or reward entitlement.
              </P>
            </Section>

            <Section title="Acceptable Use and User Conduct">
              <P>
                You agree to use Shift and the website only for lawful purposes and only for
                their intended purposes, including tracking and celebrating active transportation
                trips, participating in GSI programs, and accessing GSI information, content,
                and services. You agree not to:
              </P>
              <Ul>
                <li>Submit false or fabricated trips</li>
                <li>Manipulate leaderboards, challenges, or competition standings through any means other than legitimate active trips</li>
                <li>Use automated tools, scripts, bots, scraping tools, or other automated methods to interact with Shift or the website except as expressly authorized by GSI</li>
                <li>Attempt to access other users&apos; accounts or data, trip records, location information, or other non-public information</li>
                <li>Reverse-engineer, decompile, disassemble, copy, scrape, modify, interfere with, or tamper with Shift, the website, services, code, systems, security features, data, or infrastructure</li>
                <li>Use Shift or the website in any way that violates applicable law</li>
                <li>Post, upload, transmit, submit, or send content for which you have not obtained all necessary rights, permissions, and consents</li>
                <li>Post, upload, transmit, submit, or send content that is discriminatory, obscene, pornographic, defamatory, invasive of privacy, in breach of confidentiality, likely to cause annoyance or inconvenience, likely to incite hatred, likely to constitute or encourage a criminal offense, likely to give rise to civil liability, or otherwise unlawful</li>
                <li>Post, upload, transmit, submit, or send content that contains viruses, Trojan horses, corrupted data, malware, harmful code, or other potentially harmful software or data</li>
                <li>Damage, disable, overburden, impair, interfere with, or attempt to disrupt Shift, the website, our equipment, systems, infrastructure, accounts, data, content, services, or any other user&apos;s use and enjoyment of Shift or the website</li>
                <li>Actively interact with Shift or the website while distracted or preoccupied, including while operating a motor vehicle or in any other situation where active use could affect your safety or the safety of others</li>
                <li>Use Shift, the website, or any content or service for commercial profit or gain except as expressly authorized by GSI in writing or under a separate agreement</li>
                <li>Misrepresent your relationship with GSI or present false information about GSI, Shift, a competition, a reward, or a partner program</li>
              </Ul>
              <P>
                We use automated verification to detect implausible trip patterns. Accounts found
                gaming the system, submitting fabricated trips, manipulating challenges, or
                otherwise violating these Terms may have trips adjusted, XP adjusted, tier status
                adjusted, challenge or competition standings removed, offer or reward access
                denied, or accounts suspended, restricted, or terminated. We may cooperate with
                law enforcement authorities or court orders requiring us to disclose information
                relating to users or materials that violate these Terms.
              </P>
            </Section>

            <Section title="XP and Tier Status">
              <P>
                Shift uses XP as a non-spendable progression metric to recognize active
                transportation activity and help determine tier status.
              </P>
              <P>
                XP is not money, currency, stored value, property, a gift card, a financial
                instrument, a discount balance, or a cash equivalent.
              </P>
              <P>XP has no cash value and cannot be redeemed for cash.</P>
              <P>
                XP cannot be transferred, sold, gifted, combined across accounts, converted to
                cash, or exchanged.
              </P>
              <P>XP cannot be purchased from GSI or any rewards partner.</P>
              <P>
                XP cannot be spent, redeemed, consumed, reduced, or used as payment to GSI, a
                rewards partner, a sponsor, or any other third party.
              </P>
              <P>
                XP may help determine your eligibility for status tiers, app features, challenges,
                offers, rewards, or other program benefits, but accessing an offer, reward,
                discount, or benefit does not reduce your XP.
              </P>
              <P>
                Tier status may depend on XP, Shift Rate, account status, program rules,
                eligibility criteria, and GSI&apos;s fraud-prevention and program-integrity
                determinations.
              </P>
              <P>
                Under the current program design, XP does not expire solely because of the
                passage of time.
              </P>
              <P>
                However, GSI may modify, suspend, or discontinue XP formulas, tier requirements,
                eligibility criteria, tiers, offers, rewards, or program features prospectively.
              </P>
              <P>
                XP and tier status do not create any contractual, property, monetary, payment,
                redemption, or vested right to any specific offer, reward, prize, discount,
                status level, or program feature.
              </P>
              <P>
                GSI may adjust XP, tier status, challenge standings, competition standings, reward
                eligibility, offer access, or account access if GSI determines that a user
                submitted false trips, manipulated activity, violated these Terms, violated
                applicable program rules, or otherwise misused Shift.
              </P>
            </Section>

            <Section title="Competitions and Prizes">
              <P>
                Shift competitions are governed by separate Official Rules posted for each event.
                In the event of a conflict between these Terms and the Official Rules for a
                specific competition, the Official Rules govern.
              </P>
              <P>
                Prize winners may be required to complete additional steps to claim their prize,
                including providing identification, completing tax forms (where required by law),
                and acknowledging receipt. Prizes are non-transferable. GSI reserves the right to
                substitute prizes of equal or greater value where permitted by the applicable
                Official Rules and applicable law.
              </P>
              <P>
                Competitions that include a sweepstakes element require no purchase to enter. A
                free alternative method of entry will be specified in the Official Rules. If a
                competition uses XP, tier status, Shift Rate, active trips, or another activity
                threshold as an eligibility criterion, the applicable Official Rules will describe
                that criterion, and no XP will be spent, redeemed, consumed, reduced, or
                exchanged to enter.
              </P>
              <P>
                GSI may verify eligibility, compliance with Official Rules, trip validity, and
                identity before awarding any prize.
              </P>
            </Section>

            <Section title="Offers, Rewards, and Partner Benefits">
              <P>
                Shift may make certain offers, discounts, benefits, or rewards available to
                eligible users based on tier status, program participation, activity thresholds,
                challenge participation, or other eligibility criteria described in the app or
                applicable program terms.
              </P>
              <P>
                Some merchant-funded offers are access-based, meaning an eligible user may present
                an in-app eligibility screen, confirmation, code, or other approved method to
                access the offer.
              </P>
              <P>
                Accessing a merchant-funded offer does not spend, redeem, consume, reduce,
                transfer, convert, or exchange XP.
              </P>
              <P>
                Participating businesses are solely responsible for funding, honoring, and
                fulfilling merchant-funded offers.
              </P>
              <P>
                GSI is not responsible for the quality, accuracy, availability, pricing,
                fulfillment, goods, services, or customer experience associated with any
                partner offer.
              </P>
              <P>
                Some funded rewards may be separately funded by an employer, municipality, school,
                grant program, sponsor, or other third-party funder and may have separate
                eligibility rules, claim procedures, expiration dates, quantity limits,
                verification requirements, tax treatment, or reward terms.
              </P>
              <P>
                Offer confirmations, reward confirmations, discount codes, or other access
                credentials shown in the app are for the eligible user&apos;s personal use only
                unless the applicable terms expressly state otherwise.
              </P>
              <P>
                Offer confirmations, reward confirmations, discount codes, or other access
                credentials may not be copied, transferred, sold, exchanged, reused, captured
                for later use, or otherwise misused.
              </P>
              <P>
                GSI may deny, reverse, invalidate, suspend, or revoke offer access, reward
                access, or reward eligibility if GSI reasonably believes the access or eligibility
                resulted from fraud, error, misuse, fabricated activity, unauthorized transfer,
                or violation of these Terms or applicable program rules.
              </P>
              <P>
                Earning XP, reaching a tier, or participating in Shift does not guarantee that
                any specific offer, reward, prize, discount, or benefit will remain available.
              </P>
            </Section>

            <Section title="User Content">
              <P>
                If you submit, upload, record, post, transmit, or otherwise provide content
                through Shift, including What Moves Us video or audio recordings, profile
                information, feedback, suggestions, or any other user-generated material, you
                grant GSI a non-exclusive, worldwide, royalty-free, sublicensable license to use,
                reproduce, display, perform, distribute, modify, adapt, publish, and otherwise
                process that content in connection with GSI&apos;s programs, services,
                communications, research, planning, reporting, and mission. This license is
                subject to any applicable campaign-specific consent terms, our Privacy Policy,
                and any withdrawal, deletion, or other rights that apply under those terms or
                applicable law.
              </P>
              <P>
                For What Moves Us submissions specifically, the sharing and usage terms are
                governed by the consent agreement you accept within that program, which may allow
                your content to be shared with third-party planning organizations. You may
                withdraw consent and request deletion of your submissions at any time by
                contacting{' '}
                <a href="mailto:info@gogreenstreets.org" className="text-lime">info@gogreenstreets.org</a>.
              </P>
              <P>
                You represent and warrant that you have all rights, permissions, and consents
                necessary to submit your content and to grant the rights described in these Terms.
              </P>
              <P>
                You further represent and warrant that your content does not violate any third
                party&apos;s copyright, trademark, privacy, publicity, confidentiality,
                proprietary, or other rights.
              </P>
              <P>
                You may not submit content that is unlawful, discriminatory, obscene,
                pornographic, defamatory, invasive of privacy, harmful, malicious, or otherwise
                prohibited by these Terms.
              </P>
              <P>
                GSI may remove, restrict, or decline to use user content that violates these
                Terms, applicable law, program rules, consent terms, or the rights of any
                third party.
              </P>
            </Section>

            <Section title="Privacy">
              <P>
                Your use of Shift, the website, and related services is governed by our{' '}
                <a href="/privacy" className="text-lime">Privacy Policy</a>, which is
                incorporated into and made part of these Terms by reference. By using Shift, the
                website, or related services, you agree that GSI may collect, use, disclose,
                retain, and protect information as described in the Privacy Policy and any
                applicable program-specific consent terms or notices.
              </P>
            </Section>

            <Section title="Employer and School Programs">
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
              <P>
                You are responsible for using only invite codes, group credentials, or program
                access links that you are authorized to use.
              </P>
              <P>
                GSI may remove you from a school, employer, or other group if we determine that
                you are not eligible or authorized to participate in that group.
              </P>
            </Section>

            <Section title="Rewards Partner Program">
              <P>
                If you apply to become a Shift rewards partner through our partner portal, your
                participation is governed by the Shift Rewards Partner Agreement you sign during
                the application process, in addition to these Terms. If there is a conflict
                between these Terms and an executed Shift Rewards Partner Agreement regarding
                partner-specific rights or obligations, the Shift Rewards Partner Agreement will
                control for that partner relationship.
              </P>
            </Section>

            <Section title="Intellectual Property">
              <P>
                The Shift app, the Green Streets Initiative name and logo, the Shift mark, the
                two-chevron Shift icon, the website, and all images, data, text, audio, video,
                photographs, graphics, logos, button icons, descriptions, software, content,
                materials, and compilations that GSI produces or makes available are owned by GSI,
                licensed to GSI, or otherwise protected by intellectual property laws. You may not
                use, reproduce, modify, transmit, display, publish, sell, create derivative works
                from, distribute, copy, scrape, or exploit any GSI name, logo, mark, icon,
                content, software, data, or service except as expressly permitted by these Terms
                or with GSI&apos;s prior written permission.
              </P>
              <P>
                The Shift mark and the two-chevron Shift icon are proprietary to Green Streets
                Initiative.
              </P>
              <P>
                The contents of Shift and the website may be used only for personal,
                informational, participation, and program-related purposes. Nothing in these
                Terms or on Shift or the website transfers any intellectual property or
                proprietary rights to you. Any trademarks or service marks appearing on Shift or
                the website that are not owned by GSI are the property of their respective owners.
                The absence of a trademark symbol does not constitute a waiver of any intellectual
                property rights that GSI or any third party has established in any name, logo,
                product, feature, or service.
              </P>
            </Section>

            <Section title="Third-Party Services and Links">
              <P>
                Shift integrates with third-party services including Supabase (data
                infrastructure), Apple and Google (app distribution and notifications), and the
                Massachusetts Bay Transportation Authority API (transit data). Your use of
                third-party services is subject to those third parties&apos; respective terms,
                privacy policies, and practices. Shift and the website may include links or
                integrations that allow you to access third-party websites, services, content,
                offers, APIs, or data that are not under GSI&apos;s control. GSI is not
                responsible for the content, accuracy, policies, practices, transmissions,
                availability, or changes of any third-party website, service, integration, offer,
                API, or linked resource. GSI provides third-party links and integrations as a
                convenience, and inclusion of any link, integration, API, reward, partner
                reference, or third-party service does not imply endorsement by GSI unless GSI
                expressly states otherwise. If you link to the Green Streets Initiative website,
                you may do so only in a way that does not replicate our content, imply
                unauthorized endorsement, misrepresent your relationship with GSI, present false
                information about GSI, link from a website that is not owned or controlled by
                you, or appear on a website containing unlawful, offensive, controversial, or
                infringing content.
              </P>
            </Section>

            <Section title="Site and App Availability">
              <P>
                We take reasonable steps to make Shift and the website available, but we do not
                guarantee that Shift, the website, or any feature, service, content, integration,
                reward, challenge, or data will be available at any particular time or without
                interruption.
              </P>
              <P>
                Shift and the website may be temporarily unavailable due to system failure,
                maintenance, repair, updates, third-party service issues, or reasons beyond
                our control.
              </P>
              <P>
                Where reasonably possible, we may try to give users advance warning of planned
                maintenance, but we are not obligated to do so.
              </P>
            </Section>

            <Section title="Disclaimers">
              <P>
                Shift, the website, and all related content, features, programs, challenges,
                competitions, rewards, services, integrations, and information are provided on
                an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the fullest
                extent permitted by law, GSI disclaims all warranties, express, implied,
                statutory, or otherwise, including warranties of accuracy, completeness,
                usefulness, reliability, timeliness, merchantability, fitness for a particular
                purpose, title, non-infringement, availability, error-free operation, virus-free
                operation, and uninterrupted access.
              </P>
              <P>
                GSI does not warrant that Shift, the website, third-party services, links, APIs,
                rewards, trip detection, XP calculations, leaderboards, competition standings,
                route classifications, transit data, or any related data will be accurate,
                complete, current, available, uninterrupted, secure, or error-free.
              </P>
              <P>
                Information made available through Shift or the website may include technical
                inaccuracies, typographical errors, incomplete information, or outdated
                information, and GSI may make improvements or changes at any time.
              </P>
              <P>
                You should take reasonable and appropriate precautions to protect your computer,
                mobile device, data, and account when using Shift or the website.
              </P>
              <P>
                Active transportation involves physical activity and inherent risks. By using
                Shift to track active trips or participate in related activities, you acknowledge
                that you are responsible for your own safety and that GSI is not liable for any
                injury, accident, incident, loss, or damage that occurs during or in connection
                with your trips, except to the extent liability cannot be excluded under
                applicable law.
              </P>
            </Section>

            <Section title="Limitation of Liability">
              <P>
                Your use of Shift, the website, and related services is at your own risk.
              </P>
              <P>
                To the fullest extent permitted by law, GSI will not be responsible to you or to
                any third party for any indirect, incidental, consequential, special, exemplary,
                punitive, or similar damages, losses, or injuries arising out of or relating to
                your access to, use of, inability to use, or reliance on Shift, the website, any
                content, data, services, rewards, competitions, third-party services, or
                information made available through them.
              </P>
              <P>
                This limitation applies regardless of the type of claim or nature of the cause of
                action, including claims arising from mistakes, omissions, interruptions,
                deletions, service unavailability, system failures, inaccurate data, trip
                detection errors, leaderboard errors, reward issues, or any failure of
                performance.
              </P>
              <P>
                To the fullest extent permitted by law, GSI&apos;s total liability to you for any
                claims arising from or relating to Shift, the website, these Terms, or any
                related content, data, services, programs, competitions, rewards, or third-party
                integrations will not exceed the greater of $100 or the total amount you paid to
                GSI in the 12 months preceding the claim. Because Shift is currently provided as
                a free service, this generally means GSI&apos;s liability is limited to $100.
              </P>
            </Section>

            <Section title="Indemnification">
              <P>
                You agree to defend, indemnify, and hold harmless GSI and its officers, directors,
                employees, volunteers, agents, licensors, service providers, partners, and
                suppliers from and against any claims, actions, demands, liabilities, damages,
                losses, settlements, costs, and expenses, including reasonable legal, accounting,
                and attorneys&apos; fees, arising out of or alleged to arise out of your access to
                or use of Shift or the website, your content, your violation of these Terms, your
                violation of applicable law, or your violation of any third-party right, including
                any trademark, copyright, proprietary, privacy, publicity, or confidentiality
                right.
              </P>
            </Section>

            <Section title="Assignment">
              <P>
                You may not transfer or assign these Terms, your account, or any rights or
                licenses granted under these Terms without GSI&apos;s prior written consent.
              </P>
              <P>
                GSI may assign or transfer these Terms in connection with a reorganization,
                program transition, merger, asset transfer, or similar event, subject to
                applicable law.
              </P>
            </Section>

            <Section title="Changes to These Terms">
              <P>
                We may update these Terms from time to time, and we encourage you to review them
                periodically. If we make material changes, we will notify you through the app, by
                email, by posting a notice on our website, or by another reasonable method before
                the changes take effect where required by applicable law. Your continued use of
                Shift, the website, or related services after the effective date of updated Terms
                constitutes your acceptance of the updated Terms.
              </P>
              <P>
                If you do not agree to updated Terms, you should stop using Shift, the website,
                and related services.
              </P>
            </Section>

            <Section title="Applicable Law and Disputes">
              <P>
                We make no representation that Shift, the website, or any content is appropriate,
                available, or lawful for use outside the United States.
              </P>
              <P>
                If you access Shift or the website from outside the United States, you do so at
                your own risk and are responsible for complying with the laws of the jurisdiction
                from which you access the services.
              </P>
              <P>
                These Terms, Shift, the website, and any disputes arising out of or relating to
                them are governed by and construed in accordance with the laws of the Commonwealth
                of Massachusetts, without regard to conflict-of-law principles, and applicable
                United States federal law. Subject to the Arbitration and Class Action Waiver
                section below, you agree that the state and federal courts located in Middlesex
                County, Massachusetts will have jurisdiction over disputes arising out of or
                relating to these Terms, Shift, the website, or related services, and you consent
                to personal jurisdiction in those courts.
              </P>
              <P>
                Shift and the website may be subject to United States export control laws and
                regulations and may be subject to export or import regulations in other countries.
              </P>
              <P>
                You agree to comply with applicable export, re-export, and import laws and
                regulations and acknowledge that you are responsible for obtaining any required
                authorization.
              </P>
            </Section>

            <Section title="Arbitration and Class Action Waiver">
              <P>
                Any dispute, claim, or controversy arising out of or relating to these Terms, the
                Privacy Policy, Shift, the website, or any breach, termination, enforcement,
                interpretation, or validity of these Terms, including the determination of the
                scope or applicability of this agreement to arbitrate, will be determined by
                arbitration in Middlesex County, Massachusetts before one arbitrator.
              </P>
              <P>
                All disputes, including the arbitrability of any issue or dispute, will be decided
                by the arbitrator.
              </P>
              <P>
                The arbitration will be administered by JAMS under its Streamlined Arbitration
                Rules and Procedures.
              </P>
              <P>
                GSI will bear arbitration-related fees and expenses, including the fees of the
                arbitrator and JAMS&apos; administrative fees, but not your attorneys&apos; fees,
                except where applicable law requires otherwise.
              </P>
              <P>
                The language to be used in the arbitral proceedings will be English.
              </P>
              <P>
                Judgment on the award may be entered in any court having jurisdiction.
              </P>
              <P>
                This arbitration clause does not prevent either party from seeking provisional
                remedies in aid of arbitration from a court of appropriate jurisdiction.
              </P>
              <P>
                GSI and you agree that any arbitration will proceed only on an individual basis
                and not as a class, collective, consolidated, representative, or private attorney
                general action.
              </P>
              <P>
                GSI and you waive any right to join or consolidate disputes by or against others
                as a representative or member of a class, to obtain relief in arbitration in the
                interests of the general public, or to act as a private attorney general, except
                to the extent such waiver is not enforceable under applicable law.
              </P>
              <P>
                If any part of this arbitration or class action waiver provision is found illegal
                or unenforceable, that part will be severed from the arbitration provision, and
                the remainder will remain enforceable to the fullest extent permitted by law.
              </P>
              <P>
                GSI or you may exercise any lawful rights or use other available remedies to
                preserve or obtain possession of property, exercise self-help remedies, including
                setoff rights, or obtain injunctive relief, attachment, garnishment, or
                appointment of a receiver from a court of competent jurisdiction, subject to the
                arbitration requirements in this section.
              </P>
              <P>
                The substance of any dispute for which public injunctive relief is available will
                be decided by the arbitrator.
              </P>
              <P>
                Only if the claimant succeeds on a claim permitting the remedy of a public
                injunction may the claimant request that a court of competent jurisdiction enter
                an injunction in conformity with the arbitral award.
              </P>
            </Section>

            <Section title="General">
              <P>
                These Terms, together with the Privacy Policy, any Official Rules, program terms,
                campaign consent terms, rewards partner agreements, legal notices, and other
                applicable agreements published or made available by GSI, constitute the entire
                agreement between you and GSI regarding your use of Shift, the website, and
                related services.
              </P>
              <P>
                If any provision of these Terms is deemed invalid, illegal, or unenforceable by a
                court or arbitrator of competent jurisdiction, the remaining provisions will
                remain in full force and effect.
              </P>
              <P>
                No waiver of any term will be deemed a further or continuing waiver of that term
                or any other term, and GSI&apos;s failure to assert any right or provision under
                these Terms will not constitute a waiver of that right or provision.
              </P>
              <P>
                To the fullest extent permitted by law, any cause of action arising out of or
                relating to Shift, the website, or these Terms must commence within one year
                after the cause of action accrues, or the cause of action is permanently barred.
              </P>
              <P>
                Any provisions that by their nature should survive termination or expiration of
                these Terms will survive, including provisions concerning intellectual property,
                user content licenses, XP, tier status, offers, and rewards, disclaimers,
                limitation of liability, indemnification, dispute resolution, arbitration,
                governing law, and general terms.
              </P>
            </Section>

            <Section title="Contact">
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
