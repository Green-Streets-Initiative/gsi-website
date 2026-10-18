'use client'

import { gaEvent } from '@/lib/ga'
import { taggedBioLinkUrl, type BioLink } from '@/content/bio-links'

export default function LinkButton({ link, section }: { link: BioLink; section: 'week' | 'always' }) {
  return (
    <a
      href={taggedBioLinkUrl(link)}
      onClick={() => gaEvent('links_page_click', { slug: link.slug, section })}
      className="group flex min-h-[56px] w-full items-center gap-3 rounded-xl border border-line bg-white px-5 py-3.5 text-navy shadow-sm transition-colors hover:border-forest hover:bg-accent-softer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold leading-snug">{link.label}</span>
        {link.sublabel ? (
          <span className="mt-0.5 block text-[14.5px] leading-snug text-ink-muted">{link.sublabel}</span>
        ) : null}
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
