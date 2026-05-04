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
                <div className="flex flex-col gap-2.5 rounded-3xl bg-[#191A2E] p-3">

                  {/* Greeting + bell */}
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-[12px] font-bold text-white">Good morning, Sam</p>
                    <div className="relative">
                      <svg viewBox="0 0 256 256" width="14" height="14"><path d="M221.8,175.94C216.25,166.38,208,139.33,208,104a80,80,0,1,0-160,0c0,35.34-8.26,62.38-13.81,71.94A16,16,0,0,0,48,200H88.81a40,40,0,0,0,78.38,0H208a16,16,0,0,0,13.8-24.06ZM128,216a24,24,0,0,1-22.62-16h45.24A24,24,0,0,1,128,216ZM48,184c7.7-13.24,16-43.92,16-80a64,64,0,1,1,128,0c0,36.05,8.28,66.73,16,80Z" fill="rgba(255,255,255,0.85)" /></svg>
                      <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#FF4D4D]" />
                    </div>
                  </div>

                  {/* Unified Status Card */}
                  <div className="rounded-2xl border border-white/[0.06] bg-[#191A2E] p-2.5">
                    {/* Header row */}
                    <div className="mb-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(186,241,77,0.18)' }}>
                          <svg viewBox="0 0 24 24" width="12" height="12">
                            <path d="M4,2 L12,12 L4,22 L4,16 L9,12 L4,8Z" fill="#BAF14D" />
                            <path d="M11,2 L19,12 L11,22 L11,16 L16,12 L11,8Z" fill="#BAF14D" />
                          </svg>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold leading-tight text-white">Shifter</p>
                          <p className="text-[7px] leading-tight text-white/75">Next: Pacesetter</p>
                        </div>
                      </div>
                      <div className="rounded-full border px-2 py-[2px]" style={{ borderColor: 'rgba(186,241,77,0.55)', backgroundColor: 'rgba(186,241,77,0.10)' }}>
                        <span className="text-[8px] font-bold text-lime">Share</span>
                      </div>
                    </div>

                    {/* Tier pip strip */}
                    <div className="mb-2 flex gap-[3px]">
                      <div className="h-[3px] flex-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full w-full rounded-full" style={{ backgroundColor: 'rgba(138,141,168,0.85)' }} />
                      </div>
                      <div className="h-[3px] flex-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full w-full rounded-full bg-[#2966E5]" />
                      </div>
                      <div className="h-[3px] flex-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full w-full rounded-full bg-lime" />
                      </div>
                      <div className="h-[3px] flex-1 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full w-[71%] rounded-full bg-[#EDB93C]" />
                      </div>
                      <div className="h-[3px] flex-1 rounded-full bg-white/10" />
                    </div>

                    {/* Ring + stats */}
                    <div className="flex items-center gap-2.5">
                      {/* Dual-arc ring */}
                      <div className="relative h-[88px] w-[88px] shrink-0">
                        <svg viewBox="0 0 100 100" className="h-[88px] w-[88px] -rotate-90">
                          {/* Outer track + arc (trips, blue) */}
                          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                          <circle cx="50" cy="50" r="44" fill="none" stroke="#2966E5" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${0.71 * 2 * Math.PI * 44} ${2 * Math.PI * 44}`} />
                          {/* Inner track + arc (rate, lime) */}
                          <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                          <circle cx="50" cy="50" r="32" fill="none" stroke="#BAF14D" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${0.38 * 2 * Math.PI * 32} ${2 * Math.PI * 32}`} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="font-display text-[18px] font-extrabold leading-none tracking-tight text-white">178</span>
                          <span className="mt-[2px] text-[7px] leading-tight text-white/75">of 250 trips</span>
                        </div>
                      </div>

                      {/* Stats column */}
                      <div className="flex flex-1 flex-col gap-2">
                        <div className="flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2966E5]" />
                          <div>
                            <p className="text-[7px] font-semibold uppercase tracking-wider text-white/75">Active Trips</p>
                            <p className="text-[11px] font-bold leading-tight text-white">178 / 250</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-1.5">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" />
                          <div>
                            <p className="text-[7px] font-semibold uppercase tracking-wider text-white/75">Shift Rate 60D</p>
                            <div className="flex items-center gap-1">
                              <p className="text-[11px] font-bold leading-tight text-white">38%</p>
                              <span className="flex items-center gap-[2px]">
                                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(107,232,154,0.18)' }}>
                                  <svg viewBox="0 0 24 24" width="6" height="6"><path d="M5 12l4 4 10-10" stroke="#6BE89A" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                </span>
                                <span className="text-[7px] font-bold tracking-wider" style={{ color: '#6BE89A' }}>ON PACE</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-2.5 border-t border-white/[0.08] pt-2 flex items-center justify-between">
                      <p className="flex items-baseline gap-0.5">
                        <span className="font-display text-[13px] font-extrabold text-white">420</span>
                        <span className="text-[9px] font-semibold text-white/85">XP</span>
                      </p>
                      <div className="flex items-center gap-1">
                        <svg viewBox="0 0 256 256" width="12" height="12">
                          <path d="M176.69,48.72a225,225,0,0,0-42.52-35,12,12,0,0,0-12.34,0,225,225,0,0,0-42.52,35C51,78.47,36,111.42,36,144a92,92,0,0,0,184,0C220,111.42,205,78.47,176.69,48.72Z" fill="#F77834" />
                        </svg>
                        <span className="text-[9px] font-bold text-white">14 day streak</span>
                      </div>
                    </div>
                  </div>

                  {/* Tracking Card */}
                  <div className="rounded-2xl bg-[#242538] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-lime" />
                      </span>
                      <span className="text-[9px] font-semibold text-white/85">Auto-tracking on</span>
                      <span className="text-[8px] text-white/75">ⓘ</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="flex flex-1 items-center justify-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.04] py-1">
                        <svg viewBox="0 0 24 24" width="8" height="8"><path d="M8 5v14l11-7z" fill="#fff" /></svg>
                        <span className="text-[8px] font-bold text-white">Start trip</span>
                      </div>
                      <div className="flex flex-1 items-center justify-center gap-1 rounded-full border border-white/[0.10] bg-white/[0.04] py-1">
                        <svg viewBox="0 0 24 24" width="8" height="8"><path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></svg>
                        <span className="text-[8px] font-bold text-white">Log past trip</span>
                      </div>
                    </div>
                  </div>

                  {/* Tab bar */}
                  <div className="mt-1 flex justify-around border-t border-white/[0.07] pt-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" stroke="#BAF14D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="text-[7px] font-semibold text-lime">Home</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M4 20V10m6 10V4m6 16v-7m4 7H2" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" /></svg>
                      <span className="text-[7px] text-white/75">Progress</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      <span className="text-[7px] text-white/75">Community</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinejoin="round" /></svg>
                      <span className="text-[7px] text-white/75">Rewards</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="text-[7px] text-white/75">Profile</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating leaderboard card */}
              <div className="absolute -bottom-6 -right-10 z-20 w-[220px] rounded-2xl border border-white/[0.07] bg-[#1E2038] p-3 shadow-[0_20px_48px_rgba(0,0,0,0.4)]">
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/70">Somerville &mdash; this month</p>
                <div className="flex flex-col gap-1">
                  {[
                    { name: 'Davis Square', rate: '34%', width: '34%' },
                    { name: 'Union Square', rate: '28%', width: '28%' },
                    { name: 'Porter Square', rate: '22%', width: '22%' },
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
