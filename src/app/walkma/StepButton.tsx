'use client'

import { gaEvent } from '@/lib/ga'

/** One numbered step on /walkma: a big tappable card that opens the link. */
export default function StepButton({ n, label, sublabel, href }: { n: number; label: string; sublabel: string; href: string }) {
  return (
    <a
      href={href}
      onClick={() => gaEvent('walkma_step_click', { step: n })}
      className="group flex min-h-[72px] w-full items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4 text-navy shadow-sm transition-colors hover:border-forest hover:bg-accent-softer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest font-headline text-[20px] font-extrabold text-white"
      >
        {n}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] font-bold leading-snug">{label}</span>
        <span className="mt-0.5 block text-[15px] leading-snug text-ink-muted">{sublabel}</span>
      </span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-5 w-5 shrink-0 text-forest transition-transform group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7.5 4.5 13 10l-5.5 5.5" />
      </svg>
    </a>
  )
}
