import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.07] bg-[#191A2E] px-8 pb-8 pt-14">
      <div className="mx-auto max-w-[1120px]">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="mb-4 inline-flex items-center gap-2.5 no-underline">
              <span className="font-display text-base font-semibold text-white">
                <span className="text-lime">Green Streets</span> Initiative
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-white/40">
              Helping people move better in Greater Boston since 2006.
            </p>
          </div>

          {/* Shift app */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/50">
              Shift app
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/shift" className="text-sm text-white/55 transition-colors hover:text-white">
                  Download
                </Link>
              </li>
              <li>
                <Link href="/shift/employers" className="text-sm text-white/55 transition-colors hover:text-white">
                  For employers
                </Link>
              </li>
              <li>
                <Link href="/shift/schools" className="text-sm text-white/55 transition-colors hover:text-white">
                  For schools
                </Link>
              </li>
              <li>
                <Link href="/shift/cities" className="text-sm text-white/55 transition-colors hover:text-white">
                  For cities
                </Link>
              </li>
              <li>
                <Link href="/shift/rewards-partners" className="text-sm text-white/55 transition-colors hover:text-white">
                  Rewards partners
                </Link>
              </li>
              <li>
                <Link href="/events/shift-your-summer" className="text-sm text-white/55 transition-colors hover:text-white">
                  Flagship events
                </Link>
              </li>
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/50">
              Programs
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/programs/walk-ride-days" className="text-sm text-white/55 transition-colors hover:text-white">
                  Walk/Ride Days
                </Link>
              </li>
              <li>
                <Link href="/programs/what-moves-us" className="text-sm text-white/55 transition-colors hover:text-white">
                  What Moves Us
                </Link>
              </li>
              <li>
                <Link href="/programs/corporate-challenge" className="text-sm text-white/55 transition-colors hover:text-white">
                  Corporate Challenge
                </Link>
              </li>
            </ul>
          </div>

          {/* Organization */}
          <div>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/50">
              Organization
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <Link href="/about" className="text-sm text-white/55 transition-colors hover:text-white">
                  Our story
                </Link>
              </li>
              <li>
                <Link href="/about/team" className="text-sm text-white/55 transition-colors hover:text-white">
                  Team
                </Link>
              </li>
              <li>
                <Link href="/about/press" className="text-sm text-white/55 transition-colors hover:text-white">
                  Press
                </Link>
              </li>
              <li>
                <Link href="/get-involved/volunteer" className="text-sm text-white/55 transition-colors hover:text-white">
                  Volunteer
                </Link>
              </li>
              <li>
                <Link href="/donate" className="text-sm text-white/55 transition-colors hover:text-white">
                  Donate
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/[0.07] pt-8 text-xs text-white/50 md:flex-row">
          <p>&copy; 2026 Green Streets Initiative. Cambridge, MA. 501(c)(3) nonprofit.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-white/50">
              Privacy policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-white/50">
              Terms of use
            </Link>
            <Link href="/contact" className="transition-colors hover:text-white/50">
              Contact
            </Link>
            <a href="mailto:info@gogreenstreets.org" className="transition-colors hover:text-white/50">
              info@gogreenstreets.org
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
