# Privacy Policy — Shift by Green Streets Initiative

**Effective Date:** [INSERT DATE]  
**Last Updated:** [INSERT DATE]  
**Contact:** privacy@gogreenstreets.org

---

## Who We Are

Shift is a mobile application operated by Green Streets Initiative ("GSI," "we," "us," or "our"), a nonprofit organization dedicated to reducing vehicle miles traveled in our communities. This Privacy Policy explains how we collect, use, store, and protect your personal information when you use the Shift app.

---

## What Data We Collect

### Location Data
Shift collects your precise GPS location **continuously in the background**, including when the app is not open or in use. This is core to how the app works: we use location data to detect when you complete a trip by foot, bike, or transit so that trips are logged automatically without manual input.

We collect:
- GPS coordinates during detected trips
- Trip start and end points
- Distance and duration of each trip
- Detected travel mode (walking, cycling, transit, or vehicle)

We do **not** collect continuous raw location history. Location data is used to identify completed trips, after which only the trip record (mode, distance, duration, neighborhood, timestamp) is stored. Raw GPS coordinates are processed on-device or in transit and are not stored indefinitely.

### Motion and Activity Data
We use your device's accelerometer and motion sensors, along with the device's activity recognition capabilities, to classify your travel mode. This data is used only for trip detection and is not stored independently of trip records.

### Account Information
When you create an account, we collect:
- Your name and email address
- Authentication credentials (stored securely; passwords are never stored in plaintext)
- Optional profile information such as your neighborhood or school/employer affiliation

### Trip Records
For each detected or manually logged trip, we store:
- Date and time
- Trip mode (walk, bike, transit, car)
- Distance
- Neighborhood or general area (not precise endpoints)
- Calculated impact metrics (CO₂ avoided, estimated cost savings, calories burned)

### Competition and Community Data
If you join a challenge or leaderboard, we store your participation, scores, and rankings associated with that competition. Your display name and aggregate stats may be visible to other participants depending on the competition's visibility settings.

### Usage Data
We collect standard app usage data including crash reports, feature interactions, and performance diagnostics. This data is used to improve the app and is not linked to your trip history or location data.

---

### Route Profile (inferred, not declared)

To power transit trip classification and streak protection, Shift builds an inferred
route profile from your trip history after you have completed at least 10 trips.
This profile stores:

- Approximate home area (centroid of your morning trip start points — not a precise address)
- Approximate work area (centroid of your morning trip end points — not a precise address)
- Nearby MBTA stops and typical routes inferred from your trip patterns

This profile is **never based on information you enter manually** — it is derived
entirely from your trip history. It is deleted when you delete your account, and
you can view and delete it at any time in app settings.

### Saved Locations

You may optionally save named locations to your profile — such as your home address,
work address, or frequently visited places. Unlike the inferred route profile, saved
locations are based on information you enter directly and store precise addresses.

Saved locations are used to:
- Pre-populate trip context (e.g., identifying a trip as your "commute to work")
- Improve trip detection accuracy near your frequently visited places
- Power personalized features such as commute suggestions and nearby transit alerts

Saved locations are visible only to you. They are never shared with other users,
employers, schools, or third parties. You can view, edit, or delete your saved
locations at any time in app settings. Saved locations are deleted when you delete
your account.

---

### What Moves Us Campaign Data

If you choose to participate in a What Moves Us community storytelling campaign,
we collect the following additional data:

- Short video or audio recordings of your responses to campaign prompts
- Your consent acknowledgment and the date it was given
- Which campaign prompts you responded to and whether you skipped any

**How this data is used:** Your recordings may be shared publicly on a Green Streets
Initiative webpage and provided to the organization that commissioned the campaign
(typically a municipality or transportation planning agency) as part of an anonymized
community storytelling report. You will be shown the specific sharing terms for each
campaign before you record anything.

**Retention:** Campaign recordings are retained for the duration of the project
they were collected for, typically 12–24 months. You may request deletion of your
recordings at any time in app settings or by contacting privacy@gogreenstreets.org.

**What is never shared:** Your individual trip data, Shift Rate, or location history
is never included in What Moves Us deliverables. Campaign participation data is
kept entirely separate from your trip and competition records.

---

## How We Use Your Data

We use your data exclusively to operate and improve Shift. Specifically:

- **Trip detection and logging:** Location and motion data is used to detect when you complete a trip and classify the mode of travel.
- **Impact calculation:** Trip records are used to calculate your personal environmental and financial impact metrics.
- **Community features:** Aggregate trip data is used to power neighborhood leaderboards, school and employer challenges, and community impact dashboards.
- **Notifications:** We use your trip patterns to send relevant nudges, milestone alerts, streak notifications, and weekly summaries.
- **App improvement:** Usage and diagnostic data is used to fix bugs, improve accuracy, and develop new features.
- **Transit trip classification:** For trips where your movement pattern matches a vehicle speed, we compare your route against real-time MBTA vehicle position data to automatically classify the trip as bus, subway, or commuter rail. This comparison happens at the time of trip detection; we do not store raw MBTA data.
- **Streak protection:** If a significant MBTA service disruption is active on your typical transit route, we may use your inferred route profile — derived from your trip history — to automatically protect your active streak. Your route profile stores approximate home and work area coordinates, not precise addresses. See the Route Profile section below.

We do **not** use your data for advertising. We do **not** sell your data to third parties. We do **not** share your individual location history or trip records with employers, schools, sponsors, or any other third party without your explicit consent.

---

## Data Sharing

### With Other Shift Users
Your display name and aggregate impact stats may be visible to other users within shared competitions or community leaderboards, based on the visibility settings of those competitions. Private competitions (e.g., school or employer challenges) are only visible to verified participants.

### With Service Providers
We use a limited number of third-party service providers to operate the app:

- **Supabase** (database and authentication infrastructure): Your account and trip data is stored in Supabase's secure cloud infrastructure.
- **Expo / EAS** (app delivery and updates): Used to deliver the app and push over-the-air updates.
- **Push notification services** (Apple APNs / Google FCM): Used to deliver notifications to your device. These services receive your device token but not your location or trip data.

All service providers are contractually prohibited from using your data for any purpose other than providing their services to us.

### With Sponsors and Partners
If you redeem a partner reward or benefit, we may share your first name and redemption details with the relevant partner to fulfill the reward. We do not share your location history or trip records with sponsors or partners.

### With Schools and Employers
If you join a school or employer challenge using an invite code, your aggregate trip counts and impact statistics may be included in reports provided to that organization. These reports contain only anonymized or aggregated data unless you have explicitly opted in to individual attribution.

### Legal Requirements
We may disclose your information if required to do so by law, regulation, or valid legal process, or to protect the rights and safety of GSI, our users, or the public.

---

## Data Retention

- **Active account:** Trip records and account data are retained for as long as your account is active.
- **Account deletion:** When you delete your account, your personal data (name, email, location-derived trip records) is deleted within 30 days. Anonymized, aggregate data (e.g., total trips in a neighborhood during a challenge period) may be retained for reporting purposes.
- **Inactive accounts:** Accounts with no activity for 24 consecutive months may be deactivated and data deleted, with prior notice sent to your registered email.
- **Points and rewards:** Your points balance and redemption history are deleted when you delete your account. Aggregate, anonymized redemption counts (e.g., total redemptions at a partner location during a month) may be retained for partner reporting purposes — these contain no personally identifiable information.
- **Route profile:** Your inferred route profile is deleted within 30 days of account deletion.

---

## Your Rights and Choices

You have the following rights with respect to your data:

- **Access:** You may request a copy of the personal data we hold about you.
- **Correction:** You may update your account information at any time within the app.
- **Deletion:** You may delete your account and associated data at any time from the Profile screen in the app, or by contacting us at privacy@gogreenstreets.org.
- **Location permissions:** You may revoke background location permission at any time in your device settings. Note that revoking background location will disable automatic trip detection; you can still use the app to log trips manually.
- **Notifications:** You may adjust or disable notifications at any time in the app's notification settings or in your device settings.
- **Data portability:** You may request an export of your trip history and account data in a machine-readable format.

To exercise any of these rights, contact us at privacy@gogreenstreets.org. We will respond within 30 days.

---

## Children's Privacy

Shift is designed for use by adults and by minors under the supervision of a parent, guardian, or school. We do not knowingly collect personal information from children under 13 without verifiable parental consent. School challenges are administered through institutional accounts; student participation requires school authorization.

If you believe we have inadvertently collected information from a child under 13 without appropriate consent, please contact us immediately at privacy@gogreenstreets.org and we will delete the information promptly.

---

## Security

We implement industry-standard security measures to protect your data, including:

- Encrypted data transmission (TLS/HTTPS for all data in transit)
- Encrypted data storage (Supabase uses AES-256 encryption at rest)
- Row-level security on our database, ensuring users can only access their own data
- Authentication tokens that expire and are rotated regularly

No method of transmission or storage is completely secure. We cannot guarantee absolute security, but we are committed to protecting your information using reasonable and appropriate measures.

---

## Changes to This Policy

We may update this Privacy Policy from time to time. If we make material changes — particularly to how we collect or use location data — we will notify you via the app and/or email before the changes take effect. Continued use of the app after notification constitutes acceptance of the updated policy.

---

## Contact Us

Green Streets Initiative  
[Address]  
privacy@gogreenstreets.org

If you have questions about this policy or how your data is handled, please reach out. We're a small team and we'll get back to you personally.
