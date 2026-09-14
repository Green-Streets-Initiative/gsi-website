// Store links, with the same fallbacks the home preview uses.
export const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL || 'https://apps.apple.com/us/app/shift-by-gsi/id6761119037'
export const ANDROID_URL =
  process.env.NEXT_PUBLIC_ANDROID_URL || 'https://play.google.com/store/apps/details?id=org.greenstreets.shift'

// Mirrors the gate in /rules/page.tsx — keeps the "official rules" link out
// of the public UI until the legal [TBD] blocks on the rules page are
// populated. Flip both this and the rules page on by setting
// NEXT_PUBLIC_RULES_PUBLISHED=true.
export const RULES_PUBLISHED = process.env.NEXT_PUBLIC_RULES_PUBLISHED === 'true'
