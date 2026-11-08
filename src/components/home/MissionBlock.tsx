import { ArrowRight, CalendarCheck, GraduationCap, Microphone } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'
import TrackedLink from '@/components/TrackedLink'
import type { Audience } from './tracking'
import { Eyebrow, LANE, RouteSegment } from './RouteLine'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { homeStrings } from '@/lib/site-strings/home'
import { chromeStrings } from '@/lib/site-strings/chrome'

// Program names as the footer says them in each language.
const PROGRAMS = [
  { icon: CalendarCheck, label: 'footer.wrd', href: '/programs/walk-ride-days', audience: 'general' },
  { icon: Microphone, label: 'footer.wmu', href: '/programs/what-moves-us', audience: 'general' },
  { icon: GraduationCap, label: 'footer.schools_program', href: '/shift/schools', audience: 'school' },
] as const satisfies readonly { icon: Icon; label: string; href: string; audience: Audience }[]

/** "*words*" in a translated line become the green italics the English always had. */
function withItalics(line: string) {
  return line.split('*').map((part, i) => (i % 2 ? <em key={i} className="text-green-deep">{part}</em> : part))
}

export default function MissionBlock({ locale = 'en' }: { locale?: SiteLocale }) {
  const t = translator(homeStrings, locale)
  const tc = translator(chromeStrings, locale)
  return (
    <section className="relative overflow-x-clip bg-white">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderRight" />
        <div className="hidden md:block" />
        <div className="relative max-w-[860px] py-10 lg:py-12">
          <Eyebrow>Green Streets Initiative</Eyebrow>
          <h2 className="font-serif text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.2] text-navy">
            {withItalics(t('home.mission_rich'))}
          </h2>
          <p className="mt-6 max-w-[620px] text-[1.0625rem] leading-[1.65] text-ink-soft">
            {t('home.mission_body')}
          </p>

          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            {PROGRAMS.map((p) => (
              <li key={p.href}>
                <TrackedLink
                  href={withLang(p.href, locale)}
                  placement="mission"
                  audience={p.audience}
                  className="inline-flex min-h-[44px] items-center gap-2 font-semibold text-navy underline-offset-4 hover:underline"
                >
                  <p.icon size={20} className="text-forest" />
                  {tc(p.label)}
                </TrackedLink>
              </li>
            ))}
            <li>
              <TrackedLink
                href={withLang('/about', locale)}
                placement="mission"
                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-forest underline-offset-4 hover:underline"
              >
                {t('home.mission_story')} <ArrowRight size={18} />
              </TrackedLink>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}
