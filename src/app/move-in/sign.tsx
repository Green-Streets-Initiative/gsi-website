import type { ReactNode } from 'react'

/*
 * The "street sign" pieces /move-in uses: Overpass ExtraBold headlines, the
 * hero headline in white on a borderless forest-green panel, everything else
 * in Trebuchet MS (the GSI wordmark face).
 *
 * A page-local copy of the site-wide kit (components/street/Street.tsx, part
 * of the site redesign that is not published yet), with the type set
 * directly instead of through the redesign's font-headline utility and
 * .street class, so this page builds and looks the same on the published
 * site today. Once the redesign ships, switch the imports to the shared kit
 * and delete this file.
 */

export const GSI_FONT = "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif"
const HEADLINE = '[font-family:var(--font-overpass),Trebuchet_MS,sans-serif]'

export const CONTAINER = 'mx-auto w-full max-w-[1120px] px-6 lg:px-8'

/** The line at the top of the sign. */
export function SignTop({ strong, children }: { strong?: ReactNode; children?: ReactNode }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[1.0625rem] leading-snug text-white md:text-[1.25rem]">
      {strong && <span className="font-bold">{strong}</span>}
      {children && <span>{children}</span>}
    </p>
  )
}

/** The page's hero: a forest-green sign holding the top line, the headline
 *  and the lede; `after` sits under the sign on the page background. */
export function SignHero({ top, title, lede, after }: { top?: ReactNode; title: ReactNode; lede?: ReactNode; after?: ReactNode }) {
  return (
    <section className="bg-cream pt-[60px]">
      <div className={`${CONTAINER} pb-8 pt-6 md:pt-10 lg:pb-10`}>
        <div className="rounded-[20px] bg-forest px-5 pb-8 pt-7 text-white sm:px-10 sm:pb-11 sm:pt-9 md:rounded-[24px]">
          {top}
          <h1 className={`${top ? 'mt-4 md:mt-5' : ''} ${HEADLINE} text-[clamp(2rem,5.2vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.01em] text-white`}>
            {title}
          </h1>
          {lede && <div className="mt-5 max-w-[600px] text-[1.0625rem] leading-[1.55] text-white md:text-[1.1875rem]">{lede}</div>}
        </div>
        {after}
      </div>
    </section>
  )
}

/** A smaller headline: card titles. */
export const H3 = `${HEADLINE} text-[1.375rem] font-extrabold leading-[1.15] text-navy`

/** The navy button on cream. */
export const BUTTON =
  'inline-flex min-h-[48px] items-center justify-center rounded-full bg-navy px-7 text-[16px] font-bold text-white transition-opacity hover:opacity-90'
