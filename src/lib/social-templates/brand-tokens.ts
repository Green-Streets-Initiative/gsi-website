/**
 * Brand tokens for social-image rendering.
 *
 * These are MORE AGGRESSIVE than the app's muted/dim tokens because
 * social images are viewed at small sizes on phone feeds. Per the
 * addendum spec §7 + §12, body text never goes below #E8E8EE and
 * secondary/attribution never below 0.6 opacity.
 *
 * Canonical reference: docs/specs/social-image-templates.jsx
 */

export const BRAND = {
  // Core palette
  green: '#BAF14D',
  blue: '#2966E5',
  navy: '#191A2E',
  card: '#242538',
  leafWhite: '#F4F8EE',
  white: '#FFFFFF',

  // Contrast-safe text colors for social images.
  // NEVER USE rgba(255,255,255,0.45) or rgba(255,255,255,0.18) — those
  // are app-only tokens and are illegible in social images.
  body: '#E8E8EE',                       // body text floor
  secondary: 'rgba(255,255,255,0.7)',    // secondary info floor
  attribution: 'rgba(255,255,255,0.6)',  // attribution absolute floor

  // GSI brand
  gsiGreen: '#52B788',
  gsiGreenLight: '#2D6A4F',

  // MBTA line colors (raw hex for stripe / accent;
  // use brightened variants for body text on dark bg)
  mbta: {
    red: '#DA291C',
    orange: '#ED8B00',
    blue: '#003DA5',
    green: '#00843D',
  },
  // Brightened text variants for line-color text on navy
  mbtaText: {
    red: '#FF8A80',
    orange: '#FFB74D',
    blue: '#82B1FF',
    green: '#69F0AE',
  },

  // Border / divider
  border: 'rgba(255,255,255,0.08)',
} as const;

export const FONTS = {
  display: "'Bricolage Grotesque', 'Arial Black', sans-serif",
  mono: "'DM Mono', monospace",
  gsiSerif: "Georgia, 'Times New Roman', serif",
  // Google Fonts URL injected into each template's <head>
  googleFontsUrl:
    'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&family=DM+Mono:wght@400;500&display=swap',
} as const;
