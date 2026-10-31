import type { Metadata } from 'next'
import QRCode from 'qrcode'
import PrintButton from '../../events/shift-your-summer/flyer/PrintButton'

/**
 * gogreenstreets.org/walkma/flyer: the one-page printable flyer for GSI's
 * team in WalkMassachusetts's Beat the Bay State (Nov 1-30, 2026), to go with
 * the event listing (Keith 2026-10-31). Both logos, the $20 entry fee paid to
 * WalkMassachusetts, the same steps as /walkma, and one QR code to /walkma so
 * the long RunSignUp and Shift links never have to be typed. Letter, portrait.
 */

const WALKMA_URL = 'https://www.gogreenstreets.org/walkma'

export const metadata: Metadata = {
  title: 'Walk around Massachusetts with us: printable flyer | Green Streets Initiative',
  description:
    "A one-page flyer for Team Green Streets in WalkMassachusetts's Beat the Bay State, Nov 1 to 30. Print it for a break room, a lobby or a community board.",
  robots: { index: false, follow: false },
}

const steps = [
  {
    label: 'Register on our team',
    body: '$20 to WalkMassachusetts, which works for safer streets to walk on. Scan the code and tap step 1.',
  },
  {
    label: 'Join our group in Shift',
    body: 'Code WALKMA. The free Shift app counts the walks you take, so you never have to.',
  },
  {
    label: 'Walk anywhere, Nov 1 to 30',
    body: 'To the train, the store, school. Twice in November we email your walking miles; entering them for the team takes a minute.',
  },
]

export default async function WalkMaFlyerPage() {
  // Inline SVG so it prints crisp at any size with no network round-trip.
  const qrSvg = await QRCode.toString(WALKMA_URL, {
    type: 'svg',
    margin: 0,
    color: { dark: '#191A2E', light: '#ffffff' },
  })

  return (
    <main className="flyer-root min-h-screen bg-white text-navy">
      <style>{`
        @page { size: letter; margin: 0.4in 0.5in; }
        @media print {
          body { background: white !important; }
          .flyer-no-print { display: none !important; }
          .flyer-root { background: white !important; min-height: 0 !important; }
          body > :not(.flyer-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
          .flyer-article { padding: 0 !important; }
        }
        .flyer-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      {/* On-screen print button, hidden when printing */}
      <div className="flyer-no-print bg-navy px-8 py-4 text-white">
        <div className="mx-auto flex max-w-[8.5in] items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold">Printable flyer</p>
            <p className="text-xs text-white/85">Use Cmd/Ctrl-P or the button to print or save as PDF.</p>
          </div>
          <PrintButton />
        </div>
      </div>

      <article className="flyer-article mx-auto max-w-[8.5in] px-8 py-6">
        {/* Green street-sign header, the same block as /walkma and /links */}
        <header className="rounded-2xl bg-forest px-7 pb-6 pt-5 text-white ring-2 ring-white ring-inset">
          <p
            className="text-[20px] leading-tight tracking-[0.3px] text-white"
            style={{ fontFamily: "'Trebuchet MS', 'Lucida Grande', Verdana, sans-serif" }}
          >
            <span className="font-bold">Green Streets</span> <span className="font-normal">Initiative</span>
          </p>
          <h1 className="mt-3 font-headline text-[38px] font-extrabold leading-[1.05]">
            Walk around Massachusetts with us
          </h1>
          <p className="mt-3 max-w-[6.6in] text-[18px] leading-snug text-white/95">
            WalkMassachusetts&rsquo;s Beat the Bay State, Nov 1 to 30: walk anywhere, log your miles, and
            move your team around a map of the state&rsquo;s 900-mile perimeter. We&rsquo;re in, and Shift
            counts your miles.
          </p>
        </header>

        {/* Whose challenge, what it costs */}
        <section className="mt-5 flex items-center gap-5 rounded-2xl border border-line px-6 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/partners/walkmassachusetts-logo.png"
            alt="WalkMassachusetts"
            className="h-[56px] w-auto shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-muted">A team in</p>
            <p className="font-headline text-[22px] font-extrabold leading-tight">Beat the Bay State</p>
            <p className="text-[14px] text-ink-muted">Virtual team challenge, Nov 1 to 30</p>
          </div>
          <div className="shrink-0 rounded-2xl bg-navy px-4 py-3 text-center text-white">
            <p className="font-headline text-[26px] font-extrabold leading-none">
              $20 <span className="text-[13px] font-bold uppercase tracking-[0.1em]">entry fee</span>
            </p>
            <p className="mt-1 text-[12px] font-semibold text-white/90">paid to WalkMassachusetts</p>
          </div>
        </section>

        {/* Steps + QR */}
        <section className="mt-5 grid grid-cols-[1fr_2.2in] gap-6">
          <ol className="flex flex-col gap-3">
            {steps.map((step, i) => (
              <li
                key={step.label}
                className="flex items-start gap-4 rounded-2xl border border-line bg-white px-5 py-4"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest font-headline text-[20px] font-extrabold text-white"
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[20px] font-bold leading-snug">{step.label}</span>
                  <span className="mt-1 block text-[16px] leading-snug text-ink-muted">{step.body}</span>
                </span>
              </li>
            ))}
          </ol>

          <div className="flex flex-col items-center justify-center rounded-2xl bg-accent-softer px-4 py-5 text-center">
            <div className="h-[1.8in] w-[1.8in] rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.14em]">Scan for both steps</p>
            <p className="mt-1 font-headline text-[17px] font-extrabold leading-tight text-forest">
              gogreenstreets.org
              <br />
              /walkma
            </p>
            <p className="mt-2 text-[12px] leading-snug text-ink-muted">
              Or type it in. One page, two taps: register, then join.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-6 flex items-end justify-between gap-6 border-t border-line pt-4 text-[13px] text-ink-muted">
          <p className="max-w-[5.6in] leading-snug">
            Green Streets Initiative is a Somerville nonprofit helping people across Massachusetts walk, bike and
            take transit more often. Shift, our free app, counts your trips and enters you in monthly prize draws.
            Questions: info@gogreenstreets.org
          </p>
          <p className="shrink-0 font-bold text-navy">gogreenstreets.org</p>
        </footer>
      </article>
    </main>
  )
}
