# /help — Help Center Page Spec

## Overview

Single-page help center at `gogreenstreets.org/help`. Accordion-style FAQ organized by section. Each section has a heading and a set of expandable Q&A items. No emojis. Follow existing site design system (Bricolage Grotesque display, DM Sans body, navy/lime/blue tokens).

## Page Structure

### Hero

- **Heading:** How can we help?
- **Subhead:** Everything you need to know about using Shift, redeeming rewards, running a schools challenge, or joining as a partner.

### Quick Links (by audience)

Three cards at the top that anchor-link visitors to the relevant sections:

- **App Users** → Getting Started, Tracking Your Trips, Points & Rewards, Badges Streaks & Tiers, Finding Rewards Partners
- **Rewards Partners** → For Rewards Partners
- **Schools** → For Schools

### Section anchors

Each section should have an `id` attribute so `/help#for-schools`, `/help#points-rewards`, etc. work as direct links from the app, emails, and partner materials.

---

## Section 1: Getting Started {#getting-started}

**Q: What is Shift?**
Shift is a free app from Green Streets Initiative that logs your walking, biking, and transit trips — and rewards you for choosing active transportation. You'll earn points, unlock achievement badges, climb tier levels, and redeem rewards at local businesses.

**Q: How do I download the Shift app?**
Shift is available on the App Store (iPhone) and Google Play (Android). Search for "Shift by Green Streets Initiative" or follow the download links on our homepage.

**Q: How do I create an account?**
Open the app and tap "Get Started." You can sign up with your email address, or sign in with Apple or Google. You'll be asked to choose a display name and can add your neighborhood to appear on local leaderboards.

**Q: Is Shift really free?**
Yes. Shift is completely free to download and use. There are no premium tiers, in-app purchases, or hidden fees.

---

## Section 2: Tracking Your Trips {#trip-tracking}

**Q: How does trip tracking work?**
Shift uses background location services on your phone to automatically detect when you're walking, biking, or taking transit. When a trip is detected, it's logged with the distance, duration, and mode. You'll see it appear in your trip history.

**Q: What transportation modes count?**
Shift recognizes three active modes: walking, biking, and public transit (bus, subway, commuter rail). These are the modes that earn points. Driving does not earn points.

**Q: Why didn't my trip get logged?**
A few common reasons: (1) Location permissions may not be set to "Always Allow" — check your phone's Settings > Shift > Location. (2) Very short trips (under a couple of minutes) may not register. (3) Poor GPS signal in areas like tunnels or underground stations can occasionally cause a trip to be missed. If a trip is missing, you can always log it manually.

**Q: Can I log a trip manually?**
Yes. The Log tab is one of the app's four main tabs. Tap it to enter the mode, approximate distance, and date. Manual trips earn points the same way automatic trips do.

**Q: How accurate is background tracking?**
Background tracking is generally accurate within a reasonable margin. GPS precision varies depending on your environment — dense urban areas with tall buildings and underground transit can reduce accuracy. The app uses intelligent filtering to distinguish modes, but occasional misclassifications can happen.

**Q: Does tracking drain my battery?**
Shift uses efficient background location services designed to minimize battery impact. Most users see minimal additional drain. If you notice an issue, make sure your phone's OS and the Shift app are both up to date.

---

## Section 3: Points & Rewards {#points-rewards}

**Q: How do I earn points?**
You earn points every time you log an active trip (walk, bike, or transit). The number of points you earn per trip depends on your current tier: Starters earn 1 point per trip, Movers earn 2, Shifters earn 3, Pacesetters earn 4, and Trailblazers earn 5. You can also earn points for unlocking achievements and by submitting your story to What Moves Us campaigns, if eligible. The maximum you can earn is 15 points per day.

**Q: How do I redeem points at a Rewards Partner?**
Browse available rewards in the Rewards tab of the app. When you find one you'd like to redeem, tap it to generate a QR code. Show this QR code to the cashier at the partner location — they'll scan it with any phone to confirm your redemption. Each reward listing shows the point cost and any terms.

**Q: Where can I see my points balance?**
Your current points balance is displayed at the top of the Rewards tab and on your profile screen.

**Q: Do points expire?**
Points expire one year from the date they were earned, unless your account is active.

**Q: I redeemed points but the partner didn't accept my code. What do I do?**
Contact us at help@gogreenstreets.org with the redemption details, partner name, and date. We'll sort it out and make sure you're not out any points.

---

## Section 4: Badges, Streaks & Tiers {#badges-streaks-tiers}

**Q: What are the tier levels?**
Shift has five tiers: Starter, Mover, Shifter, Pacesetter, and Trailblazer. You advance through tiers by accumulating active trips and maintaining each tier's target Shift Rate — the percentage of your total trips that are active (walk, bike, or transit).

**Q: What is Shift Rate?**
Shift Rate is the percentage of your total trips that are active — walking, biking or scooting, or taking transit. It's the core metric Shift uses to measure your transportation habits, and it's one of the factors that determines your tier level.

**Q: How do achievement badges work?**
Achievement badges are earned by reaching specific milestones — trying new modes, completing challenges, hitting cumulative distance goals, and more. Check your profile to see which achievements you've unlocked and what's next.

**Q: How do streaks work?**
A streak counts consecutive days where you log at least one active trip. There's a built-in 2-day grace period — if you miss a single day, your streak stays alive. Miss two consecutive days and the streak resets. We also protect your streak during MBTA service disruptions, so you won't be penalized for something outside your control.

**Q: What happens if I break a streak?**
Your streak counter resets to zero, but your longest streak is saved on your profile. Streaks are meant to be motivating, not punishing — just start a new one whenever you're ready.

---

## Section 5: Finding Rewards Partners {#rewards-partners-users}

**Q: How do I find Rewards Partners near me?**
The Rewards tab in the app shows available partner offers in your area. You can browse the list to find partners near you.

**Q: What kinds of rewards are available?**
Rewards vary by partner — they can include discounts, free items, or special offers. Each partner sets their own reward and the points required to redeem it.

**Q: Can I suggest a business as a Rewards Partner?**
Absolutely. If there's a local business you'd love to see in the Shift network, let us know at partners@gogreenstreets.org or share their info through the app. We're always growing the network.

---

## Section 6: For Rewards Partners {#for-rewards-partners}

**Q: How do I become a Shift Rewards Partner?**
We'd love to have you. Visit gogreenstreets.org/shift/rewards-partners or email partners@gogreenstreets.org. We'll walk you through the setup — it's simple and free to participate.

**Q: How do I verify a Shift redemption?**
Using any phone, have your cashier scan the QR code shown on the Shift user's app screen. That's it — no need to log into a dashboard or verify anything else at the time of redemption. When you join, we'll provide a 1-page printed guide to redemptions that you can keep at the register.

**Q: How do I access my business dashboard?**
Log in at gogreenstreets.org/shift/rewards-partners with the credentials you set up during onboarding. The dashboard shows your active offers, redemption history, and monthly summary reports.

**Q: What does it cost to be a Rewards Partner?**
Nothing. There are no fees to join the Shift Rewards Partner network. You set the reward you're comfortable offering, and you benefit from exposure to an engaged community of sustainability-minded local customers.

**Q: Can I change or pause my reward offer?**
Yes. You can update your offer, change the points required, or temporarily pause your listing from your business dashboard at any time.

---

## Section 7: For Schools {#for-schools}

**Q: How does the Shift for Schools program work?**
Shift for Schools is a classroom-based active transportation challenge. Each day, teachers take a quick tally using a simple show of hands to see how students got to school. Classrooms earn recognition for walking, biking, and taking transit — and can compete within and across schools. The program is designed to be fun, easy to run, and fully COPPA-compliant. No student accounts or personal data are collected.

**Q: How do classroom codes work?**
Each participating classroom receives a unique 6-character code. The teacher uses this code to submit the classroom's daily tally through the Shift for Schools portal. Codes are assigned during program setup and stay the same for the duration of the challenge.

**Q: I'm a School Coordinator — where do I start?**
Welcome! As School Coordinator, you're the main point of contact between your school and Green Streets Initiative. Start by reviewing the program overview and School Coordinator Quick-Start Card we'll share during onboarding. Your first steps are confirming participating classrooms, distributing classroom codes to teachers, and sharing the parent information sheet. Reach out to schools@gogreenstreets.org any time.

**Q: I'm a parent — how can I help?**
Parents play a key role as Parent Volunteers and Walk & Bike Bus Leaders. A Walk & Bike Bus is a group of families who walk or bike a set route to school together. If you're interested in starting or joining one, talk to your School Coordinator or email schools@gogreenstreets.org.

**Q: Is student data private?**
Yes. Shift for Schools is designed with student privacy at its core. No individual student accounts are created. Data is collected at the classroom level only (e.g., "12 students walked today") — no names, locations, or personal information are ever involved. The program is fully COPPA-compliant.

**Q: Can students use the Shift app?**
The Shift app is designed for users 13 and older. The Shift for Schools classroom challenge is a separate, app-free experience — students participate through their teacher's daily show-of-hands tally without needing any device or account.

---

## Section 8: Privacy & Data {#privacy-data}

**Q: What data does Shift collect?**
Shift collects your email, display name, and trip data (start/end location area, distance, duration, mode). Location data is used to detect and log trips. We never sell your personal data. For full details, see our Privacy Policy at gogreenstreets.org/privacy.

**Q: How is my location data used?**
Location data is used solely to detect and record your trips. We use it to calculate distances, identify transportation modes, and place you on neighborhood leaderboards (if you've opted in). We do not share raw location data with third parties.

**Q: How do I delete my account and data?**
You can delete your account from the Settings screen in the app. This permanently removes your profile, trip history, and all associated data. If you have any trouble, email help@gogreenstreets.org and we'll take care of it.

---

## Section 9: Account & Settings {#account-settings}

**Q: How do I reset my password?**
Tap "Forgot Password" on the login screen and enter your email. You'll receive a password reset link. If you don't see it, check your spam folder.

**Q: How do I change my display name or neighborhood?**
Go to Settings > Profile in the app. You can update your display name and neighborhood at any time.

**Q: I'm having a technical issue not listed here.**
Email us at help@gogreenstreets.org with a description of the issue, your phone model, and OS version. Screenshots help too. We'll get back to you as quickly as we can.

---

## Contact Section (bottom of page)

**Heading:** Still need help?
**Subtext:** We're a small team and we read every message. Reach out and we'll get back to you as quickly as we can.

Three CTA buttons:

- **General Support** → mailto:help@gogreenstreets.org (primary/lime CTA)
- **Partner Inquiries** → mailto:partners@gogreenstreets.org (secondary/outline)
- **Schools Program** → mailto:schools@gogreenstreets.org (secondary/outline)
