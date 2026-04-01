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
                  <div className="mb-1">
                    <div className="flex items-center gap-1">
                      <span className="font-display text-[11px] font-bold text-lime">Shift</span>
                      <svg viewBox="0 0 36 28" width="12" height="7" className="mt-px shrink-0">
                        <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
                        <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
                      </svg>
                      <span className="text-[7px] text-white/40">by Green Streets Initiative</span>
                    </div>
                  </div>

                  {/* Greeting */}
                  <p className="text-xs font-semibold text-white">Good morning, Sam</p>

                  {/* Tier card */}
                  <div className="rounded-xl bg-[#242538] p-2.5">
                    <div className="mb-1.5 flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" width="12" height="12">
                        <path d="M4,2 L12,12 L4,22 L4,16 L9,12 L4,8Z" fill="#BAF14D" />
                        <path d="M11,2 L19,12 L11,22 L11,16 L16,12 L11,8Z" fill="#BAF14D" />
                      </svg>
                      <span className="text-[10px] font-bold text-white">Shifter</span>
                    </div>
                    <div className="mb-1 flex items-center justify-between text-[7px] text-white/50">
                      <span>72 of 100 trips</span>
                      <span>needed for Pacesetter</span>
                    </div>
                    <div className="mb-1.5 h-1 rounded-full bg-white/10">
                      <div className="h-full w-[72%] rounded-full bg-[#2966E5]" />
                    </div>
                    <p className="text-[7px] text-white/40">38% vs. 20% Shift Rate required for Shifter &nbsp;&#10003; met</p>
                    <p className="mt-0.5 text-[7px] text-white/40">Earning 3 point(s) per active trip</p>
                  </div>

                  {/* Points balance */}
                  <div className="flex items-center gap-2 rounded-xl bg-[#242538] p-2.5">
                    <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0">
                      <circle cx="12" cy="12" r="11" fill="#BAF14D" />
                      <path d="M9,6 L17,12 L9,18Z" fill="#191A2E" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-[#BAF14D]">840 pts</p>
                      <p className="text-[7px] text-white/50">50 more pts to unlock a reward</p>
                    </div>
                    <svg viewBox="0 0 16 16" width="8" height="8" className="shrink-0">
                      <path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* Shift Rate ring */}
                  <div className="flex items-center gap-2.5 rounded-xl bg-[#242538] p-2.5">
                    <div className="relative h-[42px] w-[42px] shrink-0">
                      <svg viewBox="0 0 36 36" className="h-[42px] w-[42px] -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                        <circle cx="18" cy="18" r="14" fill="none" stroke="#EDB93C" strokeWidth="3" strokeDasharray="33 55" strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center font-display text-[10px] font-bold text-[#EDB93C]">38%</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-white">Shift Rate</p>
                      <p className="text-[8px] text-white/50">This week</p>
                    </div>
                    <svg viewBox="0 0 16 16" width="8" height="8" className="shrink-0">
                      <path d="M6 3l5 5-5 5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* Streak card */}
                  <div className="flex items-center gap-2 rounded-xl bg-[#242538] p-2.5">
                    <svg viewBox="0 0 24 24" width="16" height="16" className="shrink-0">
                      <path d="M12 23c-4.97 0-8-3.03-8-7 0-3.5 2.5-6.5 4-8 .5 2.5 2 4 2 4s1.5-3 1.5-5c3 2.5 4.5 5.5 4.5 9 0 3.97-3.03 7-4 7z" fill="#FF8C35" />
                      <path d="M12 23c-2.21 0-4-1.79-4-4 0-1.5 1-3.5 2-4.5.3 1 .8 1.8.8 1.8s.7-1.2.7-2.3c1.5 1.2 2.5 3 2.5 5 0 2.21-1.79 4-2 4z" fill="#EDB93C" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-[#BAF14D]">14 days</p>
                      <p className="text-[7px] text-white/50">Active streak</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-[11px] font-bold text-white">21</p>
                      <p className="text-[7px] text-white/50">Best</p>
                    </div>
                  </div>

                  {/* Tab bar */}
                  <div className="mt-1 flex justify-around border-t border-white/[0.07] pt-2">
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="#BAF14D"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" stroke="#BAF14D" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="text-[7px] text-lime">Home</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7 5.93M9 12H4m5 0a5 5 0 015-5m-5 5a5 5 0 005 5" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" /></svg>
                      <span className="text-[7px] text-white/40">Log</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" /></svg>
                      <span className="text-[7px] text-white/40">Community</span>
                    </div>
                    <div className="flex flex-col items-center gap-0.5">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      <span className="text-[7px] text-white/40">Profile</span>
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
