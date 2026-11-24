/**
 * "Did you mean …@gmail.com?" for a mistyped email domain (2026-11-24: a
 * lesson request came in as …@gmail.comt, so every email to the learner
 * bounced and the instructor's Reply went nowhere).
 *
 * Returns the corrected address, or null when the address looks right or we
 * can't tell. Only a suggestion: the person can keep what they typed.
 */

/** Domains people in Massachusetts sign up with most. Exact matches are never flagged. */
const KNOWN = [
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com', 'hotmail.com', 'outlook.com',
  'live.com', 'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'comcast.net', 'verizon.net',
  'att.net', 'rcn.com', 'protonmail.com', 'proton.me', 'pm.me', 'fastmail.com', 'hey.com', 'mail.com',
  'gmx.com', 'email.com', 'zoho.com', 'yahoo.co.uk', 'hotmail.co.uk',
]

/** Endings that are almost always a slip of the finger on .com, .net, .org or .edu. */
const ENDINGS: Record<string, string> = {
  comt: 'com', con: 'com', cpm: 'com', cmo: 'com', ocm: 'com', vom: 'com', xom: 'com', cim: 'com',
  comm: 'com', coom: 'com', cm: 'com', om: 'com', 'com.': 'com', cmm: 'com', clm: 'com', cok: 'com',
  nett: 'net', ner: 'net', nte: 'net', nwt: 'net', ogr: 'org', orgg: 'org', prg: 'org', edi: 'edu', eud: 'edu',
}

/** Edits between two words, a swap of neighbors counting as one. */
function distance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

export function emailSuggestion(email: string): string | null {
  const s = email.trim()
  const at = s.lastIndexOf('@')
  if (at < 1 || at === s.length - 1) return null
  const local = s.slice(0, at)
  const domain = s.slice(at + 1).toLowerCase()
  if (KNOWN.includes(domain)) return null

  // A slipped ending: gmail.comt, bu.edi, comcast.ner.
  const dot = domain.lastIndexOf('.')
  let fixed = domain
  if (dot > 0 && ENDINGS[domain.slice(dot + 1)]) fixed = `${domain.slice(0, dot)}.${ENDINGS[domain.slice(dot + 1)]}`
  if (dot < 0 && KNOWN.some((k) => k.startsWith(`${domain}.`))) fixed = KNOWN.find((k) => k.startsWith(`${domain}.`))!
  if (KNOWN.includes(fixed)) return `${local}@${fixed}`

  // A misspelled provider: gmial.com, hotmial.com, yaho.com, gmail.co.
  let best: string | null = null
  let bestD = Infinity
  for (const k of KNOWN) {
    const dd = distance(fixed, k)
    if (dd < bestD) {
      best = k
      bestD = dd
    }
  }
  const limit = fixed.length >= 9 ? 2 : 1
  if (best && bestD <= limit) return `${local}@${best}`

  return fixed !== domain ? `${local}@${fixed}` : null
}
