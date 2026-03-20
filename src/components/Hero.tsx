'use client'

import { useState } from 'react'

export default function Hero() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) setSubmitted(true)
  }

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
              <span className="ml-1.5 text-xs font-medium uppercase tracking-[0.05em] text-white/40">
                by Green Streets Initiative
              </span>
            </div>

            <h1 className="mb-6 font-display text-[clamp(2.5rem,5vw,3.75rem)] font-extrabold leading-[1.08] tracking-tighter text-white">
              Every trip<br />counts<span className="text-lime">.</span>
            </h1>

            <p className="mb-9 max-w-[480px] text-lg leading-[1.65] text-white/65">
              Walk it. Bike it. Take the bus. Shift how you move and see the impact — on your health, your wallet, and your neighborhood.
            </p>

            {!submitted ? (
              <form
                onSubmit={handleSubmit}
                className="flex max-w-[420px] items-center overflow-hidden rounded-full border border-white/[0.12] bg-white/[0.07] pl-5 pr-1 transition-colors focus-within:border-lime"
              >
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-white placeholder-white/40 outline-none"
                />
                <button
                  type="submit"
                  className="my-1 shrink-0 rounded-full bg-lime px-5 py-2.5 text-sm font-bold text-navy transition-opacity hover:opacity-85"
                >
                  Notify me when live
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-lime/20 bg-lime/[0.08] px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 7l3.5 3.5L12 3.5" stroke="#191A2E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">You&apos;re on the list!</p>
                  <p className="text-xs text-white/50">We&apos;ll be in touch when Shift launches in your neighborhood.</p>
                </div>
              </div>
            )}

            <div className="mt-3 flex gap-6 text-[13px] text-white/50">
              <a href="/shift/employers" className="transition-colors hover:text-white/80">For employers &#8599;</a>
              <a href="/shift/schools" className="transition-colors hover:text-white/80">For schools &#8599;</a>
              <a href="/about" className="transition-colors hover:text-white/80">Our story &#8599;</a>
            </div>
          </div>

          {/* Right — phone mockup */}
          <div className="relative hidden items-end justify-center lg:flex" style={{ paddingBottom: '60px' }}>
            <div className="relative">
              {/* Phone frame */}
              <div className="relative z-10 w-[260px] rounded-[36px] border-2 border-white/[0.12] bg-[#242538] p-3.5 shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)]" style={{ animation: 'float 4s ease-in-out infinite' }}>
                <div className="mx-auto mb-3.5 h-2 w-[60px] rounded-full bg-black/50" />
                <div className="flex flex-col gap-2 rounded-3xl bg-[#191A2E] p-3.5">
                  <div className="mb-1 text-center">
                    <div className="inline-flex items-center justify-center gap-1.5">
                      <span className="font-display text-base font-bold text-lime">Shift</span>
                      <svg viewBox="0 0 36 28" width="16" height="9" className="mt-px shrink-0">
                        <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
                        <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
                      </svg>
                    </div>
                    <p className="text-[9px] text-white/45">by Green Streets Initiative</p>
                  </div>
                  <p className="text-xs font-semibold text-white">Good morning, Alex</p>
                  <div className="rounded-xl bg-[#242538] p-2.5">
                    <p className="mb-1 text-[9px] text-white/50">Your Shift Rate — this week</p>
                    <div className="flex items-center gap-2">
                      <div className="relative h-[38px] w-[38px] shrink-0">
                        <svg viewBox="0 0 36 36" className="h-[38px] w-[38px] -rotate-90">
                          <circle cx="18" cy="18" r="14" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                          <circle cx="18" cy="18" r="14" fill="none" stroke="#BAF14D" strokeWidth="3" strokeDasharray="59 29" strokeLinecap="round" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center font-display text-[9px] font-bold text-lime">67%</span>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-white">Mover</p>
                        <p className="text-[9px] text-white/45">&uarr; from 54% last week</p>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full w-[67%] rounded-full bg-lime" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {[
                      { icon: '🔥', val: '9', label: 'Day streak' },
                      { icon: '💰', val: '$48', label: 'Saved this month' },
                      { icon: '🌿', val: '12kg', label: 'CO₂ avoided' },
                    ].map((s) => (
                      <div key={s.label} className="flex-1 rounded-lg bg-[#242538] p-2">
                        <p className="text-[10px]">{s.icon}</p>
                        <p className="font-display text-[11px] font-bold text-lime">{s.val}</p>
                        <p className="text-[7px] text-white/45">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-[#242538] p-2.5">
                    <p className="mb-0.5 text-[9px] text-white/50">Davis Square — your neighborhood</p>
                    <div className="flex items-center justify-between">
                      <p className="font-display text-xs font-bold text-lime">#3 of 12</p>
                      <p className="text-[8px] text-white/45">neighborhoods</p>
                    </div>
                  </div>
                  <div className="mt-1 flex justify-around border-t border-white/[0.07] pt-2">
                    {['Home', 'Log', 'Community', 'Profile'].map((item) => (
                      <div key={item} className="text-center">
                        <div className={`mx-auto mb-0.5 h-1 w-1 rounded-full ${item === 'Home' ? 'bg-lime' : ''}`} />
                        <span className={`text-[7px] ${item === 'Home' ? 'text-lime' : 'text-white/40'}`}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating leaderboard card */}
              <div className="absolute -bottom-6 -right-10 z-20 w-[220px] rounded-2xl border border-white/[0.07] bg-[#1E2038] p-3 shadow-[0_20px_48px_rgba(0,0,0,0.4)]">
                <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-white/45">Somerville — this month</p>
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
