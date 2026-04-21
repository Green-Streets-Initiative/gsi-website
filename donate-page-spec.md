# /donate Page Spec — Final with Donorbox Embed
**For: Claude Code implementation**
**Version: April 2026**
**Replaces: donate section of about-press-donate-spec.md**

---

## Overview

Replace the existing `/donate` placeholder with a complete donation page
embedding the Donorbox web component. The page uses the established GSI
design system — dark navy background, lime accent, Bricolage Grotesque
display type, DM Sans body.

---

## Donorbox embed code

```html
<script
  type="module"
  src="https://donorbox.org/widgets.js"
  async
></script>
<dbox-widget
  campaign="main-green-streets-donation-form"
  type="donation_form"
  enable-auto-scroll="true"
></dbox-widget>
```

**Important implementation notes:**
- The `<script>` tag must be loaded once per page — add it to the page
  component, not a shared layout, to avoid conflicts
- The web component renders with its own white background — do not attempt
  to override Donorbox's internal styles
- Wrap the widget in a white/light card container so the white form
  sits intentionally on the dark navy page
- The `enable-auto-scroll="true"` attribute scrolls the form into view
  on multi-step completion — leave it enabled

In Next.js, the script tag needs to be loaded via next/script to avoid
hydration issues:

```tsx
import Script from 'next/script'

// In the page component:
<Script
  src="https://donorbox.org/widgets.js"
  strategy="lazyOnload"
  type="module"
/>
```

---

## Page sections

### 1. Hero

Background: dark navy.
Eyebrow: "DONATE"
Headline: "Help make shift happen."
Subhead: "Green Streets Initiative is a 501(c)(3) nonprofit. Your donation
funds the platform, the programs, and the people working to make active
transportation the obvious choice across Massachusetts."

---

### 2. Impact cards — three columns

Background: #242538.
Padding: generous vertical padding above and below.

Card 1: "The app is free."
"Shift is free to download and use. Every active commuter who joins, every
school that runs the program, every neighborhood that climbs the leaderboard
— none of it costs them anything. Donations make that possible."

Card 2: "We measure what others assume."
"Most transportation initiatives run on estimated impact. GSI verifies it
— trip by trip, neighborhood by neighborhood. Donors fund infrastructure
that produces real data for real decisions."

Card 3: "We're just getting started."
"Shift is built to scale across Massachusetts — and eventually beyond.
Every donation funds the platform, the programs, and the communities
we haven't reached yet."

---

### 3. Donation form

Background: dark navy.
Max-width: 680px, centered.
Section headline: "Make a gift" — Bricolage Grotesque, centered above the card.

**Card container:**
White background (#FFFFFF), rounded corners (rounded-2xl),
generous padding (p-8 or p-10), subtle shadow.
This creates an intentional white card on the dark page — do not
use a dark or translucent container.

**Inside the card:**
Render the Donorbox web component:
```tsx
<div className="bg-white rounded-2xl p-8 shadow-2xl shadow-black/40
                mx-auto max-w-[680px]">
  {/* Donorbox web component renders here */}
  <dbox-widget
    campaign="main-green-streets-donation-form"
    type="donation_form"
    enable-auto-scroll="true"
  />
</div>
```

Note: `dbox-widget` is a custom HTML element — TypeScript will complain
about it not being a known JSX element. Add a type declaration:

```typescript
// src/types/donorbox.d.ts
declare namespace JSX {
  interface IntrinsicElements {
    'dbox-widget': {
      campaign: string
      type: string
      'enable-auto-scroll'?: string
      [key: string]: string | undefined
    }
  }
}
```

---

### 4. Tax and legal

Background: dark navy.
Small, centered, muted (white/40 opacity).
Two lines:

"Green Streets Initiative is a registered 501(c)(3) nonprofit organization.
All donations are tax-deductible to the extent permitted by law. EIN: 26-1484405"

"Questions about giving? Contact us at info@gogreenstreets.org"

---

### 5. Other ways to help — closing strip

Full-width dark strip, centered.
For donors who aren't ready to give money but want to contribute.

Headline: "Not ready to donate? There are other ways to help."

Two cards side by side:
- "Volunteer" — "Join our growing volunteer team." CTA: "See volunteer roles →" → /get-involved
- "Spread the word" — "Share the Shift app with someone whose commute
  could be better." CTA: "Learn about Shift →" → /shift

---

## Nav and footer updates

- Ensure "Donate" ghost button in primary nav links to /donate ✓
  (already specced in about-press-donate-spec.md)
- Ensure "Donate" in footer Organization column links to /donate ✓

---

## Implementation notes

**Script loading:**
Use `next/script` with `strategy="lazyOnload"` to avoid blocking
page render. The Donorbox widget initializes after the script loads
— there may be a brief moment where the widget container appears
empty. This is normal and acceptable.

**No custom styling of the Donorbox form:**
Do not attempt to override Donorbox's internal CSS. The white card
container approach means the form's default styling looks intentional.
Any attempt to style the internals of the web component will likely
break on Donorbox updates.

**Mobile:**
The white card should be full-width on mobile with reduced padding (p-4).
The Donorbox widget is responsive by default.

**Testing before launch:**
Do a $1 test donation to confirm:
1. Form renders correctly
2. Stripe processes the payment
3. Receipt email arrives with correct content
4. Donorbox dashboard shows the donation
After confirming, issue a refund from the Stripe dashboard.
