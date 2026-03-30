import Link from 'next/link'

const journeySteps = [
  { name: 'Receptive moment', sub: 'New job, new neighborhood, life transition' },
  { name: 'First experience', sub: 'School program, e-bike demo, a friend\'s invite' },
  { name: 'Commitment', sub: 'Sign up, log first trip' },
]

const engineSteps = [
  { icon: '🔍', name: 'Barrier', sub: 'Identify friction' },
  { icon: '💬', name: 'Nudge', sub: 'Contextual prompt' },
  { icon: '🗺️', name: 'Resource', sub: 'Micro-guides, links, local info' },
  { icon: '📍', name: 'Reinforcement', sub: 'Track, reward, reflect' },
]

const tierIcons = {
  Starter: (
    <svg viewBox="0 0 32 32" fill="none" width="18" height="18">
      <path d="M7 5L25 16L7 27L7 22L14 16L7 10Z" stroke="#8A8DA8" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Mover: (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <path d="M7 5L25 16L7 27L7 22L14 16L7 10Z" fill="#2966E5" />
    </svg>
  ),
  Shifter: (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <path d="M2 5L14 16L2 27L2 22L8 16L2 10Z" fill="#BAF14D" />
      <path d="M17 5L29 16L17 27L17 22L23 16L17 10Z" fill="#BAF14D" />
    </svg>
  ),
  Pacesetter: (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <path d="M1 5L9.5 16L1 27L1 23L5 16L1 9Z" fill="#EDB93C" />
      <path d="M11 5L19.5 16L11 27L11 23L15 16L11 9Z" fill="#EDB93C" />
      <path d="M21 5L29.5 16L21 27L21 23L25 16L21 9Z" fill="#EDB93C" />
    </svg>
  ),
  Trailblazer: (
    <svg viewBox="0 0 32 32" width="18" height="18">
      <defs>
        <linearGradient id="tg" x1="1" y1="0" x2="30" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2966E5" />
          <stop offset="100%" stopColor="#BAF14D" />
        </linearGradient>
      </defs>
      <path d="M1 5L9.5 16L1 27L1 23L5 16L1 9Z" fill="url(#tg)" />
      <path d="M11 5L19.5 16L11 27L11 23L15 16L11 9Z" fill="url(#tg)" />
      <path d="M21 5L29.5 16L21 27L21 23L25 16L21 9Z" fill="url(#tg)" />
    </svg>
  ),
}

const tiers = [
  { name: 'Starter', req: '0 trips', fill: '5%', badgeBg: 'rgba(144,144,160,0.15)', barColor: '#9090A0', barOpacity: 0.5 },
  { name: 'Mover', req: '25 trips', fill: '25%', badgeBg: 'rgba(41,102,229,0.12)', barColor: '#2966E5', barOpacity: 1 },
  { name: 'Shifter', req: '100 trips', fill: '50%', badgeBg: 'rgba(186,241,77,0.15)', barColor: '#BAF14D', barOpacity: 1 },
  { name: 'Pacesetter', req: '250 trips', fill: '75%', badgeBg: 'rgba(237,185,60,0.15)', barColor: '#EDB93C', barOpacity: 1 },
  { name: 'Trailblazer', req: '500 trips', fill: '95%', badgeBg: 'rgba(41,102,229,0.15)', barColor: '#7BA8FF', barOpacity: 1 },
]

export default function ShiftSection() {
  return (
    <section className="relative overflow-hidden bg-[#191A2E] px-8 py-12">
      <div className="pointer-events-none absolute -left-[10%] -top-[20%] h-[800px] w-[800px] rounded-full bg-[radial-gradient(circle,rgba(41,102,229,0.08)_0%,transparent_60%)]" />

      <div className="relative z-10 mx-auto max-w-[1120px]">
        <div className="grid items-start gap-20 lg:grid-cols-2">

          {/* Left — copy + BCE diagram */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BAF14D]">
              How Shift works
            </div>
            <h2 className="mb-4 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Move better.<br />One trip at a time.
            </h2>
            <p className="mb-10 max-w-[560px] text-[1.0625rem] leading-[1.65] text-white">
              Lasting behavior change follows a pattern. Shift is engineered around it — from the moment someone is open to change, through the habit that sticks.
            </p>

            {/* BCE diagram */}
            <div>
              {/* Journey to first shift */}
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                Journey to first shift
              </p>
              <div className="mb-5 flex items-stretch">
                {journeySteps.map((step, i) => (
                  <div key={step.name} className="flex min-w-0 flex-1 items-stretch">
                    <div className="flex-1 rounded-lg border border-white/10 border-t-[#BAF14D] border-t-2 bg-white/[0.05] p-3">
                      <p className="font-display text-[13px] font-bold text-white">{step.name}</p>
                      <p className="mt-1 text-[11px] leading-snug text-white">{step.sub}</p>
                    </div>
                    {i < journeySteps.length - 1 && (
                      <span className="flex shrink-0 items-center px-1.5 text-sm text-white">→</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Behavior change engine */}
              <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-white">
                Behavior change engine
              </p>
              <div className="mb-4 flex items-stretch">
                {engineSteps.map((step, i) => (
                  <div key={step.name} className="flex min-w-0 flex-1 items-stretch">
                    <div className="flex-1 rounded-lg border border-[rgba(41,102,229,0.2)] bg-[rgba(41,102,229,0.1)] px-2 py-3 text-center">
                      <p className="mb-1 text-[14px]">{step.icon}</p>
                      <p className="font-display text-xs font-bold text-white">{step.name}</p>
                      <p className="mt-0.5 text-[10px] leading-snug text-white">{step.sub}</p>
                    </div>
                    {i < engineSteps.length - 1 && (
                      <span className="flex shrink-0 items-center px-1 text-sm text-[rgba(41,102,229,0.5)]">→</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Incentives bar */}
              <div className="mt-2 flex flex-wrap items-center gap-4 rounded-lg border border-[rgba(186,241,77,0.18)] bg-[rgba(186,241,77,0.07)] px-3.5 py-2.5">
                <span className="font-display text-xs font-bold text-[#BAF14D]">&uarr; Incentives &amp; community</span>
                <span className="text-[11px] text-white">Tiers · leaderboards · local rewards · Walk/Ride Day events</span>
              </div>

              {/* Outcome bar */}
              <div className="mt-2 rounded-lg border-[1.5px] border-[rgba(186,241,77,0.3)] bg-[rgba(186,241,77,0.12)] px-3.5 py-3">
                <p className="font-display text-sm font-extrabold text-[#BAF14D]">Sustained mode shift</p>
                <p className="mt-0.5 text-[11px] text-white">Habit formation · ongoing engagement · measurable community impact</p>
              </div>
            </div>
          </div>

          {/* Right — tiers progression */}
          <div>
            <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white">
              Your progression
            </p>

            <div className="flex flex-col gap-2.5">
              {tiers.map((tier) => (
                <div
                  key={tier.name}
                  className="flex items-center gap-3.5 rounded-[10px] border border-white/[0.08] bg-[#242538] px-4 py-3.5 transition-colors hover:border-[rgba(186,241,77,0.2)]"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ background: tier.badgeBg }}
                  >
                    {tierIcons[tier.name as keyof typeof tierIcons]}
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-[13px] font-bold text-white">{tier.name}</p>
                    <p className="text-[11px] text-white">{tier.req}</p>
                  </div>
                  <div className="w-[120px]">
                    <div className="h-[5px] rounded-full bg-white/10">
                      <div
                        className="h-[5px] rounded-full"
                        style={{ width: tier.fill, background: tier.barColor, opacity: tier.barOpacity }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href="/shift"
                className="inline-block rounded-full bg-[#BAF14D] px-6 py-3 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Download the app →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
