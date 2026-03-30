'use client'

import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-[#191A2E]" style={{ paddingTop: '60px' }}>
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(186,241,77,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(186,241,77,0.04) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div className="absolute -right-[5%] -top-[10%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(186,241,77,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="relative mx-auto max-w-[1120px] px-8">
        <div className="grid min-h-[calc(100vh-60px)] items-center gap-16 lg:grid-cols-2">

          {/* Left copy */}
          <div className="py-20 lg:py-16">
            <div className="mb-5 inline-flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-[7px] font-display text-lg font-extrabold tracking-tighter text-white">
                Shift
                <svg viewBox="0 0 36 28" width="22" height="13" className="mt-px shrink-0">
                  <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
                  <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
                </svg>
              </span>
              <span className="ml-1.5 text-xs font-medium uppercase tracking-[0.05em] text-white">
                by Green Streets Initiative
              </span>
            </div>

            <h1 className="mb-6 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Every trip<br />counts<span className="text-lime">.</span>
            </h1>

            <p className="mb-9 max-w-[480px] text-lg leading-[1.65] text-white">
              Walk it. Bike it. Take the bus. Shift how you move and see the impact &mdash; on your health, your wallet, and your neighborhood.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/shift"
                className="inline-block rounded-full bg-lime px-7 py-3.5 text-sm font-bold text-navy transition-opacity hover:opacity-85"
              >
                Download the app
              </Link>
              <Link
                href="/about"
                className="inline-block rounded-full border border-white/[0.15] bg-white/[0.06] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                Our story
              </Link>
            </div>

            <div className="mt-5 flex gap-6 text-[13px] text-white">
              <a href="/shift/employers" className="transition-opacity hover:opacity-80">For employers &#8599;</a>
              <a href="/shift/schools" className="transition-opacity hover:opacity-80">For schools &#8599;</a>
            </div>
          </div>

          {/* Right — phone mockup */}
          <div className="relative hidden items-end justify-center lg:flex" style={{ paddingBottom: '60px' }}>
            <div className="relative">
              {/* Phone frame */}
              <div className="relative z-10 w-[260px] rounded-[36px] border-2 border-white/[0.12] bg-[#242538] p-3.5 shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)]" style={{ animation: 'float 4s ease-in-out infinite' }}>
                <div className="mx-auto mb-3.5 h-2 w-[60px] rounded-full bg-black/50" />
                <div className="flex flex-col gap-2 rounded-3xl bg-[#191A2E] p-3.5">

                  {/* App header */}
                  <div className="mb-1 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span className="font-display text-base font-bold text-lime">Shift</span>
                      <svg viewBox="0 0 36 28" width="16" height="9" className="mt-px shrink-0">
                        <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
                        <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
                      </svg>
                    </div>
                  </div>

                  {/* Greeting */}
                  <p className="text-xs font-semibold text-white">Good morning, Sam</p>

                  {/* Tier card */}
                  <div className="rounded-xl bg-[#242538] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M4,2 L12,12 L4,22 L4,16 L9,12 L4,8Z" fill="#BAF14D" />
                        <path d="M11,2 L19,12 L11,22 L11,16 L16,12 L11,8Z" fill="#BAF14D" />
                      </svg>
                      <span className="text-[10px] font-bold text-[#BAF14D]">Shifter</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="h-1 flex-1 rounded-full bg-white/10">
                        <div className="h-full w-[72%] rounded-full bg-[#BAF14D]" />
                      </div>
                      <span className="text-[8px] text-white/50">72 / 100</span>
                    </div>
                    <p className="mt-1 text-[8px] text-white/40">28 trips to Pacesetter</p>
                  </div>

                  {/* Shift Rate ring */}
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#242538] p-2.5">
                    <div className="relative h-[42px] w-[42px] shrink-0">
                      <svg viewBox="0 0 36 36" className="h-[42px] w-[42px] -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#BAF14D" strokeWidth="3" strokeDasharray="62 26" strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center font-display text-[10px] font-bold text-[#BAF14D]">71%</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-white">Shift Rate</p>
                      <p className="text-[8px] text-white/50">Last 7 days &middot; &uarr; from 58%</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-1.5">
                    {[
                      { icon: '\uD83D\uDD25', val: '14', label: 'Day streak' },
                      { icon: '\uD83D\uDCB0', val: '$62', label: 'Saved' },
                      { icon: '\uD83C\uDF3F', val: '18kg', label: 'CO\u2082 avoided' },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 rounded-lg bg-[#242538] p-2">
                        <p className="text-[10px]">{s.icon}</p>
                        <p className="font-display text-[11px] font-bold text-[#BAF14D]">{s.val}</p>
                        <p className="text-[7px] text-white/60">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Points balance */}
                  <div className="flex items-center gap-2 rounded-xl bg-[#242538] p-2.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#BAF14D]">
                      <span className="text-[8px] font-bold text-[#191A2E]">P</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-[#BAF14D]">840 pts</p>
                      <p className="text-[7px] text-white/50">50 pts to next reward</p>
                    </div>
                  </div>

                  {/* Impact row */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { val: '62', label: 'Active trips' },
                      { val: '3h 20m', label: 'Active minutes' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-lg bg-[#242538] p-2 text-center">
                        <p className="font-display text-[11px] font-bold text-white">{s.val}</p>
                        <p className="text-[7px] text-white/50">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Tab bar */}
                  <div className="mt-1 flex justify-around border-t border-white/[0.07] pt-2">
                    {['Home', 'Log', 'Community', 'Profile'].map((item) => (
                      <div key={item} className="text-center">
                        <div className={`mx-auto mb-0.5 h-1 w-1 rounded-full ${item === 'Home' ? 'bg-lime' : ''}`} />
                        <span className={`text-[7px] ${item === 'Home' ? 'text-lime' : 'text-white/50'}`}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating leaderboard card */}
              <div className="absolute -bottom-6 -right-10 z-20 w-[220px] rounded-2xl border border-white/[0.07] bg-[#1E2038] p-3 shadow-[0_20px_48px_rgba(0,0,0,0.4)]">
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/70">Somerville &mdash; this month</p>
                <div className="flex flex-col gap-1">
                  {[
                    { name: 'Davis Square', rate: '82%', width: '82%' },
                    { name: 'Union Square', rate: '71%', width: '71%' },
                    { name: 'Porter Square', rate: '64%', width: '64%' },
                  ].map((t) => (
                    <div key={t.name} className="flex items-center gap-2">
                      <span className="w-[72px] shrink-0 text-[10px] font-semibold text-white">{t.name}</span>
                      <div className="h-[3px] flex-1 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-lime" style={{ width: t.width }} />
                      </div>
                      <span className="font-display text-[10px] font-bold text-lime">{t.rate}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
