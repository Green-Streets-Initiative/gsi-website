import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import TrackedLink from '@/components/TrackedLink'
import type { Audience } from './tracking'
import { LANE, RouteSegment } from './RouteLine'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { homeStrings } from '@/lib/site-strings/home'

// `until` hides a dated row by itself once its campaign ends (ISO date, last
// day shown). Shift Your Semester takes sign-ups through Dec 15, 2026.
type Row = 'you' | 'students' | 'employers' | 'schools' | 'towns' | 'business' | 'partners' | 'donors'
const ALL_ROWS: { key: Row; href: string; audience: Audience; until?: string }[] = [
  { key: 'you', href: '/nearby?plan=1', audience: 'individual' },
  { key: 'students', href: '/shift-your-semester', audience: 'individual', until: '2026-12-15' },
  { key: 'employers', href: '/shift/employers', audience: 'employer' },
  { key: 'schools', href: '/shift/schools', audience: 'school' },
  { key: 'towns', href: '/shift/towns', audience: 'town' },
  { key: 'business', href: '/shift/rewards-partners', audience: 'business' },
  { key: 'partners', href: '/contact', audience: 'partner' },
  { key: 'donors', href: '/donate', audience: 'donor' },
]

export default function AudienceIndex({ locale = 'en' }: { locale?: SiteLocale }) {
  const t = translator(homeStrings, locale)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const ROWS = ALL_ROWS.filter((r) => !r.until || today <= r.until)
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="wanderLeft" />
        <div className="hidden md:block" />
        <div className="grid gap-8 py-10 lg:grid-cols-[1fr_2fr] lg:gap-16 lg:py-12">
          <div className="relative lg:sticky lg:top-24 lg:self-start">
            {/* No eyebrow: the heading already says what the section is. */}
            <h2 className="font-serif text-[clamp(2.25rem,4.5vw,3.5rem)] font-normal leading-[1.05] text-navy">
              {t('home.aud_title_a')}{locale === 'zh-Hans' ? '' : ' '}<em className="text-green-deep">{t('home.aud_title_b')}</em>
            </h2>
            <p className="mt-5 max-w-[380px] text-[1.0625rem] leading-[1.65] text-ink-soft">
              {t('home.aud_body')}
            </p>
          </div>

          <ul className="border-t border-navy/15">
            {ROWS.map((r) => (
              <li key={r.href} className="border-b border-navy/15">
                <TrackedLink
                  href={withLang(r.href, locale)}
                  placement="audience_index"
                  audience={r.audience}
                  className="group grid min-h-[72px] grid-cols-[1fr_auto] items-center gap-4 py-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest md:grid-cols-[220px_1fr_auto]"
                >
                  <span className="font-serif text-[1.5rem] leading-none text-navy">{t(`home.aud_${r.key}_label`)}</span>
                  <span className="col-span-2 text-[15px] leading-relaxed text-ink-soft md:col-span-1">{t(`home.aud_${r.key}_body`)}</span>
                  <ArrowRight
                    size={20}
                    className="col-start-2 row-start-1 text-forest transition-transform group-hover:translate-x-1 md:col-start-3"
                  />
                </TrackedLink>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
