import Link from 'next/link'
import NewsletterSignupForm from './NewsletterSignupForm'
import { SITE_LOCALES, SITE_LOCALE_NAMES, SITE_LOCALE_TAG, translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { chromeStrings } from '@/lib/site-strings/chrome'

/**
 * `variant="light"` is the cream-page treatment that pairs with Nav's light
 * variant. Default stays `dark`, so every existing caller is untouched.
 */
type Variant = 'dark' | 'light'

const THEME: Record<Variant, {
  shell: string
  rule: string
  brandA: string
  brandB: string
  body: string
  link: string
  heading: string
  fine: string
}> = {
  dark: {
    shell: 'border-t border-white/[0.07] bg-[#191A2E]',
    rule: 'border-white/[0.07]',
    brandA: 'text-[#52B788]',
    brandB: 'text-white',
    body: 'text-white',
    link: 'text-white',
    heading: 'text-white',
    fine: 'text-white',
  },
  light: {
    shell: 'border-t border-navy/10 bg-cream',
    rule: 'border-navy/10',
    brandA: 'text-forest',
    brandB: 'text-navy',
    body: 'text-ink-soft',
    link: 'text-ink-soft hover:text-navy',
    heading: 'text-navy',
    fine: 'text-ink-soft',
  },
}

/**
 * `locale`: a translated page passes its language, which also shows the
 * language switch. Every other page leaves it out and stays English.
 */
export default function Footer({ variant = 'dark', locale }: { variant?: Variant; locale?: SiteLocale } = {}) {
  const t = THEME[variant]
  const lang = locale ?? 'en'
  const tr = translator(chromeStrings, lang)
  const href = (h: string) => withLang(h, lang)
  return (
    <footer className={`${t.shell} px-8 pb-8 pt-14`}>
      <div className="mx-auto max-w-[1120px]">
        {/* Newsletter signup strip */}
        <div id="newsletter" className={`scroll-mt-24 mb-12 border-b ${t.rule} pb-12 md:mb-14 md:pb-14`}>
          <div className="grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
            <div>
              <h3 className={`text-2xl font-bold ${t.heading} sm:text-3xl`}>{tr('footer.stay_title')}</h3>
              <p className={`mt-3 text-sm leading-relaxed ${t.body}`}>
                {tr('footer.stay_body')}
              </p>
            </div>
            <NewsletterSignupForm variant={variant} locale={lang} />
          </div>
        </div>

        <div className="grid gap-12 md:grid-cols-5">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href={href('/')} className="mb-4 inline-flex items-center no-underline">
              <span className="text-base tracking-[0.3px]" style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
                <span className={`font-bold ${t.brandA}`}>Green Streets</span>{' '}
                <span className={`font-normal ${t.brandB}`}>Initiative</span>
              </span>
            </Link>
            <p className={`mt-3 text-sm leading-relaxed ${t.body}`}>
              {tr('footer.tagline')}
            </p>
          </div>

          {/* Shift app */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              {tr('footer.shift_app')}
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href={href('/shift')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.download')}
                </Link>
              </li>
              <li>
                <Link href={href('/shift/employers')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.employers')}
                </Link>
              </li>
              <li>
                <Link href={href('/shift/schools')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.schools')}
                </Link>
              </li>
              <li>
                <Link href={href('/shift/rewards-partners')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.rewards_partners')}
                </Link>
              </li>
              <li>
                <Link href={href('/nearby')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.near_you')}
                </Link>
              </li>
              <li>
                <Link href={href('/commute-advisor')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.advisor')}
                </Link>
              </li>
              <li>
                <Link href={href('/guides')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.guides')}
                </Link>
              </li>
              <li>
                <Link href={href('/trails')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.trails')}
                </Link>
              </li>
              <li>
                <Link href={href('/events')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.events')}
                </Link>
              </li>
              <li>
                <Link href={href('/challenges')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.challenges')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Shift Towns — civic pages; also crawler equity */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              {tr('footer.towns')}
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href={href('/shift/towns/somerville-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Somerville
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/cambridge-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Cambridge
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/boston-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Boston
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/medford-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Medford
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/arlington-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Arlington
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/brookline-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Brookline
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/watertown-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Watertown
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/everett-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Everett
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns/newton-ma')} className={`text-sm transition-colors ${t.link}`}>
                  Newton
                </Link>
              </li>
              <li>
                <Link href={href('/shift/towns')} className={`text-sm font-semibold transition-colors ${t.link}`}>
                  {tr('footer.all_towns')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              {tr('footer.programs')}
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href={href('/programs/walk-ride-days')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.wrd')}
                </Link>
              </li>
              <li>
                <Link href={href('/programs/what-moves-us')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.wmu')}
                </Link>
              </li>
              <li>
                <Link href={href('/programs/corporate-challenge')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.corporate')}
                </Link>
              </li>
              <li>
                <Link href={href('/shift/schools')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.schools_program')}
                </Link>
              </li>
              <li>
                <Link href={href('/events/submit')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.submit_event')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Organization */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              {tr('footer.organization')}
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href={href('/about')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.story')}
                </Link>
              </li>
              <li>
                <Link href={href('/press')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.press')}
                </Link>
              </li>
              <li>
                <Link href={href('/get-involved')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.volunteer')}
                </Link>
              </li>
              <li>
                <Link href={href('/donate')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.donate')}
                </Link>
              </li>
              <li>
                <Link href={href('/contact')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.sponsor')}
                </Link>
              </li>
              <li>
                <Link href={href('/help')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.help')}
                </Link>
              </li>
              <li>
                <Link href={href('/privacy')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.privacy')}
                </Link>
              </li>
              <li>
                <Link href={href('/terms')} className={`text-sm transition-colors ${t.link}`}>
                  {tr('footer.terms')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {locale ? (
          <nav aria-label={tr('footer.language')} className={`mt-14 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm ${t.body} md:justify-start`}>
            {SITE_LOCALES.map((l) => (
              <a
                key={l}
                href={`?lang=${l}`}
                hrefLang={SITE_LOCALE_TAG[l]}
                lang={SITE_LOCALE_TAG[l]}
                aria-current={l === locale ? 'true' : undefined}
                className={l === locale ? 'font-bold underline underline-offset-4' : `transition-colors ${t.link}`}
              >
                {SITE_LOCALE_NAMES[l]}
              </a>
            ))}
          </nav>
        ) : null}

        <div className={`${locale ? 'mt-6' : 'mt-14'} flex flex-col items-center justify-between gap-4 border-t ${t.rule} pt-8 text-xs ${t.fine} md:flex-row`}>
          <p>{tr('footer.copyright')}</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 md:justify-end">
            <Link href={href('/privacy')} className={`transition-colors ${t.link}`}>
              {tr('footer.privacy_policy')}
            </Link>
            <Link href={href('/terms')} className={`transition-colors ${t.link}`}>
              {tr('footer.terms_of_use')}
            </Link>
            <Link href={href('/contact')} className={`transition-colors ${t.link}`}>
              {tr('footer.contact')}
            </Link>
            <a href="mailto:info@gogreenstreets.org" className={`transition-colors ${t.link}`}>
              info@gogreenstreets.org
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
