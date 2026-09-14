import Link from 'next/link'
import NewsletterSignupForm from './NewsletterSignupForm'

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

export default function Footer({ variant = 'dark' }: { variant?: Variant } = {}) {
  const t = THEME[variant]
  return (
    <footer className={`${t.shell} px-8 pb-8 pt-14`}>
      <div className="mx-auto max-w-[1120px]">
        {/* Newsletter signup strip */}
        <div id="newsletter" className={`scroll-mt-24 mb-12 border-b ${t.rule} pb-12 md:mb-14 md:pb-14`}>
          <div className="grid gap-8 md:grid-cols-2 md:items-center md:gap-12">
            <div>
              <h3 className={`text-2xl font-bold ${t.heading} sm:text-3xl`}>Stay in touch</h3>
              <p className={`mt-3 text-sm leading-relaxed ${t.body}`}>
                Get our newsletter for stories, impact updates, and new ways to move better.
              </p>
            </div>
            <NewsletterSignupForm variant={variant} />
          </div>
        </div>

        <div className="grid gap-12 md:grid-cols-5">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="mb-4 inline-flex items-center no-underline">
              <span className="text-base tracking-[0.3px]" style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
                <span className={`font-bold ${t.brandA}`}>Green Streets</span>{' '}
                <span className={`font-normal ${t.brandB}`}>Initiative</span>
              </span>
            </Link>
            <p className={`mt-3 text-sm leading-relaxed ${t.body}`}>
              Helping people move better in Massachusetts since 2006.
            </p>
          </div>

          {/* Shift app */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              Shift app
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/shift" className={`text-sm transition-colors ${t.link}`}>
                  Download
                </Link>
              </li>
              <li>
                <Link href="/shift/employers" className={`text-sm transition-colors ${t.link}`}>
                  For employers
                </Link>
              </li>
              <li>
                <Link href="/shift/schools" className={`text-sm transition-colors ${t.link}`}>
                  For schools
                </Link>
              </li>
              <li>
                <Link href="/shift/rewards-partners" className={`text-sm transition-colors ${t.link}`}>
                  Rewards partners
                </Link>
              </li>
              <li>
                <Link href="/nearby" className={`text-sm transition-colors ${t.link}`}>
                  What&rsquo;s near you
                </Link>
              </li>
              <li>
                <Link href="/commute-advisor" className={`text-sm transition-colors ${t.link}`}>
                  Commute Advisor
                </Link>
              </li>
              <li>
                <Link href="/guides" className={`text-sm transition-colors ${t.link}`}>
                  Guides
                </Link>
              </li>
              <li>
                <Link href="/events" className={`text-sm transition-colors ${t.link}`}>
                  Community events
                </Link>
              </li>
              <li>
                <Link href="/challenges" className={`text-sm transition-colors ${t.link}`}>
                  Challenges
                </Link>
              </li>
            </ul>
          </div>

          {/* Shift Towns — civic pages; also crawler equity */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              Shift Towns
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/shift/towns/somerville-ma" className={`text-sm transition-colors ${t.link}`}>
                  Somerville
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/cambridge-ma" className={`text-sm transition-colors ${t.link}`}>
                  Cambridge
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/boston-ma" className={`text-sm transition-colors ${t.link}`}>
                  Boston
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/medford-ma" className={`text-sm transition-colors ${t.link}`}>
                  Medford
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/arlington-ma" className={`text-sm transition-colors ${t.link}`}>
                  Arlington
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/brookline-ma" className={`text-sm transition-colors ${t.link}`}>
                  Brookline
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/watertown-ma" className={`text-sm transition-colors ${t.link}`}>
                  Watertown
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/everett-ma" className={`text-sm transition-colors ${t.link}`}>
                  Everett
                </Link>
              </li>
              <li>
                <Link href="/shift/towns/newton-ma" className={`text-sm transition-colors ${t.link}`}>
                  Newton
                </Link>
              </li>
              <li>
                <Link href="/shift/towns" className={`text-sm font-semibold transition-colors ${t.link}`}>
                  All towns &rarr;
                </Link>
              </li>
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              Programs
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/programs/walk-ride-days" className={`text-sm transition-colors ${t.link}`}>
                  Walk/Ride Days
                </Link>
              </li>
              <li>
                <Link href="/programs/what-moves-us" className={`text-sm transition-colors ${t.link}`}>
                  What Moves Us
                </Link>
              </li>
              <li>
                <Link href="/programs/corporate-challenge" className={`text-sm transition-colors ${t.link}`}>
                  Corporate Challenge
                </Link>
              </li>
              <li>
                <Link href="/shift/schools" className={`text-sm transition-colors ${t.link}`}>
                  Shift for Schools
                </Link>
              </li>
              <li>
                <Link href="/events/submit" className={`text-sm transition-colors ${t.link}`}>
                  Submit an event
                </Link>
              </li>
            </ul>
          </div>

          {/* Organization */}
          <div>
            <h4 className={`mb-4 text-xs font-semibold uppercase tracking-widest ${t.heading}`}>
              Organization
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/about" className={`text-sm transition-colors ${t.link}`}>
                  Our story
                </Link>
              </li>
              <li>
                <Link href="/press" className={`text-sm transition-colors ${t.link}`}>
                  Press
                </Link>
              </li>
              <li>
                <Link href="/get-involved" className={`text-sm transition-colors ${t.link}`}>
                  Volunteer
                </Link>
              </li>
              <li>
                <Link href="/donate" className={`text-sm transition-colors ${t.link}`}>
                  Donate
                </Link>
              </li>
              <li>
                <Link href="/sponsor" className={`text-sm transition-colors ${t.link}`}>
                  Sponsor an event
                </Link>
              </li>
              <li>
                <Link href="/help" className={`text-sm transition-colors ${t.link}`}>
                  Help
                </Link>
              </li>
              <li>
                <Link href="/privacy" className={`text-sm transition-colors ${t.link}`}>
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={`text-sm transition-colors ${t.link}`}>
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className={`mt-14 flex flex-col items-center justify-between gap-4 border-t ${t.rule} pt-8 text-xs ${t.fine} md:flex-row`}>
          <p>&copy; 2026 Green Streets Initiative. Cambridge, MA. 501(c)(3) nonprofit.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className={`transition-colors ${t.link}`}>
              Privacy policy
            </Link>
            <Link href="/terms" className={`transition-colors ${t.link}`}>
              Terms of use
            </Link>
            <Link href="/contact" className={`transition-colors ${t.link}`}>
              Contact
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
