import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#191A2E] px-8 pb-8 pt-14">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="mb-4 inline-flex items-center no-underline">
              <span className="text-base tracking-[0.3px]" style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}>
                <span className="font-bold text-[#52B788]">Green Streets</span>{' '}
                <span className="font-normal text-white">Initiative</span>
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-white">
              Helping people move better in Massachusetts since 2006.
            </p>
          </div>

          {/* Shift app */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white">
              Shift app
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/shift" className="text-sm text-white transition-colors hover:text-white">
                  Download
                </Link>
              </li>
              <li>
                <Link href="/shift/employers" className="text-sm text-white transition-colors hover:text-white">
                  For employers
                </Link>
              </li>
              <li>
                <Link href="/shift/schools" className="text-sm text-white transition-colors hover:text-white">
                  For schools
                </Link>
              </li>
              <li>
                <Link href="/shift/cities" className="text-sm text-white transition-colors hover:text-white">
                  For cities
                </Link>
              </li>
              <li>
                <Link href="/shift/rewards-partners" className="text-sm text-white transition-colors hover:text-white">
                  Rewards partners
                </Link>
              </li>
              <li>
                <Link href="/events/shift-your-summer" className="text-sm text-white transition-colors hover:text-white">
                  Flagship events
                </Link>
              </li>
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white">
              Programs
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/programs/walk-ride-days" className="text-sm text-white transition-colors hover:text-white">
                  Walk/Ride Days
                </Link>
              </li>
              <li>
                <Link href="/programs/what-moves-us" className="text-sm text-white transition-colors hover:text-white">
                  What Moves Us
                </Link>
              </li>
              <li>
                <Link href="/programs/corporate-challenge" className="text-sm text-white transition-colors hover:text-white">
                  Corporate Challenge
                </Link>
              </li>
              <li>
                <Link href="/shift/schools" className="text-sm text-white transition-colors hover:text-white">
                  Shift for Schools
                </Link>
              </li>
            </ul>
          </div>

          {/* Organization */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white">
              Organization
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/about" className="text-sm text-white transition-colors hover:text-white">
                  Our story
                </Link>
              </li>
              <li>
                <Link href="/press" className="text-sm text-white transition-colors hover:text-white">
                  Press
                </Link>
              </li>
              <li>
                <Link href="/get-involved" className="text-sm text-white transition-colors hover:text-white">
                  Volunteer
                </Link>
              </li>
              <li>
                <Link href="/donate" className="text-sm text-white transition-colors hover:text-white">
                  Donate
                </Link>
              </li>
              <li>
                <Link href="/help" className="text-sm text-white transition-colors hover:text-white">
                  Help
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-white transition-colors hover:text-white">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-white transition-colors hover:text-white">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-8 text-xs text-white md:flex-row">
          <p>&copy; 2026 Green Streets Initiative. Cambridge, MA. 501(c)(3) nonprofit.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-white">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white">
              Terms of use
            </Link>
            <Link href="/contact" className="transition-colors hover:text-white">
              Contact
            </Link>
            <a href="mailto:info@gogreenstreets.org" className="transition-colors hover:text-white">
              info@gogreenstreets.org
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
