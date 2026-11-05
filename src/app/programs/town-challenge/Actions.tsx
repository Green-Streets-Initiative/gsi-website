'use client'

import posthog from 'posthog-js'
import { BUTTON } from '../../move-in/sign'
import { BOOK_URL } from './book'

/**
 * The page's actions: book a call (the yes), print or save the page to pass to
 * a colleague or a board, and email for anyone who would rather write. All are
 * counted so the town funnel (email → page → call) can be read in PostHog.
 */
export default function Actions({ town, slug, light = false }: { town: string | null; slug: string | null; light?: boolean }) {
  const subject = town ? `Town Challenge for ${town}` : 'Town Challenge'
  const body = town
    ? `Hi Keith,\n\n${town} would like to hear more about a Town Challenge this spring.\n\n`
    : 'Hi Keith,\n\nWe would like to hear more about a Town Challenge. Our town: \n\n'
  const mailto = `mailto:keith@gogreenstreets.org?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const track = (action: 'book' | 'email' | 'print') => {
    // Analytics is never a reason not to act.
    try {
      posthog.capture('town_challenge_cta', { action, town: slug })
    } catch { /* blocked or not yet loaded */ }
  }
  return (
    <div className="print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={BOOK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('book')}
          className={`${BUTTON} ${light ? '!bg-white !text-navy' : ''}`}
        >
          Book a call with Keith
        </a>
        <button
          type="button"
          onClick={() => {
            track('print')
            window.print()
          }}
          className={`inline-flex min-h-[48px] items-center justify-center rounded-full border px-6 text-[16px] font-bold transition-colors ${
            light ? 'border-white/60 text-white hover:bg-white/10' : 'border-navy/25 text-navy hover:bg-navy/[0.05]'
          }`}
        >
          Print or save as PDF
        </button>
      </div>
      <p className={`mt-3 text-[15px] ${light ? 'text-white/85' : 'text-navy/75'}`}>
        Rather write?{' '}
        <a href={mailto} onClick={() => track('email')} className="font-bold underline underline-offset-2">
          keith@gogreenstreets.org
        </a>
      </p>
    </div>
  )
}
