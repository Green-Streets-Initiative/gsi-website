'use client'

import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Link from 'next/link'
import { useRef, useState } from 'react'

/* ── Role data ── */

const ROLES = [
  {
    name: 'Shift Ambassador',
    program: 'Shift App',
    programColor: 'bg-lime text-navy',
    description:
      'Help people in your community discover the Shift app and log their first trip.',
    timeAsk: '2–4 hours/month',
    session:
      'You meet people where they are \u2014 school pickup lines, community events, farmers markets, neighborhood meetings \u2014 and start a different kind of conversation. \u201cDid you know you\u2019re probably already walking enough to earn rewards?\u201d You help people download the app, see that their trips are already being tracked, and discover what their short trips add up to. The best moment is when someone realizes their quarter-mile walk to the coffee shop already counted.\n\nTraining included.',
  },
  {
    name: 'Story Collector',
    program: 'What Moves Us',
    programColor: 'bg-[#EDB93C] text-navy',
    description:
      'Help commuters share their stories at community events and farmers markets during active campaigns.',
    timeAsk: '2–4 hours per event, occasional',
    session:
      'You show up at a local event with your phone and a brief script. Inspire warm, short stories or audio snapshots about how people get around, how they got started, how it makes them feel. Then hand over the file \u2014 we do the rest.',
  },
  {
    name: 'Rewards Partner Scout',
    program: 'Shift App',
    programColor: 'bg-lime text-navy',
    description:
      'Help recruit local businesses to offer rewards for Shift app users in your neighborhood.',
    timeAsk: '2–3 hours/month',
    session:
      'You know the coffee shop owner, the bike shop, the bookstore on the corner. We need people who can walk in, explain why offering a small discount to active commuters is good for their business, and make an introduction. You don\u2019t close the deal \u2014 you open the door. We\u2019ll give you a one-pager and a simple script. You bring the relationships.',
  },
  {
    name: 'Neighborhood Lead',
    program: 'Shift App',
    programColor: 'bg-lime text-navy',
    description:
      'Be the face of Shift in your neighborhood \u2014 drive adoption, organize challenges, and climb the leaderboard.',
    timeAsk: '3–5 hours/month',
    session:
      'Every neighborhood on the Shift leaderboard needs someone behind it. You recruit neighbors to join, organize informal challenges (\u201cCan we beat Porter Square this month?\u201d), share results on local listservs and group chats, and keep the energy going. You\u2019re the reason your neighborhood shows up \u2014 and stays on the board.',
  },
  {
    name: 'School Coordinator',
    program: 'School Program',
    programColor: 'bg-[#2966E5] text-white',
    description:
      'Be the point person who brings the Shift school program to a school you\u2019re connected to.',
    timeAsk: 'Sufficient to get started: three one-hour check-ins',
    session:
      'You\u2019re a parent, neighbor, or community member with a connection to a target school. You introduce the program to the right stakeholders, make the connection to GSI, help smooth the launch. You don\u2019t run the program \u2014 you open the door and help it get started.\n\nTraining included.',
  },
  {
    name: 'Safe Route Mapper',
    program: 'School Program',
    programColor: 'bg-[#2966E5] text-white',
    description:
      'Scout and document safe walking and biking routes near target schools.',
    timeAsk: 'One Saturday morning per school',
    session:
      'You walk or ride the routes students would actually use, note conditions, flag anything that needs attention, and submit a simple report. GSI uses this to build route guides for families and teachers. Best done in pairs.',
  },
  {
    name: 'Walk/Bike Bus Guide',
    program: 'School Program',
    programColor: 'bg-[#2966E5] text-white',
    description:
      'Lead a regular group walk or bike ride to school for students and families.',
    timeAsk: '1–2 mornings per week during the school year',
    session:
      'You meet a group of students and parents at a neighborhood meeting point and walk or ride together to school. You\u2019re the guide — you know the route, you keep the group together, and you make it fun. Training provided.',
  },
  {
    name: 'Beta Tester',
    program: 'Shift App',
    programColor: 'bg-lime text-navy',
    description:
      'Get early access to Shift and help us find what needs fixing before we launch.',
    timeAsk: '1–2 hours/week during the beta period',
    session:
      'You use the app for your real commute, report bugs and friction points, and answer occasional follow-up questions from the team. You get early access and a founding badge when the app launches.',
  },
  {
    name: 'Content Contributor',
    program: 'GSI',
    programColor: 'bg-[#8A8DA8] text-white',
    description:
      'Share your own active commuting moments so GSI can show what real behavior change looks like.',
    timeAsk: 'As much or as little as you want',
    session:
      'When you have a good Shift moment — a great bike commute, a streak milestone, a Walk/Ride Day photo — you share it with GSI. We handle the posting. Optionally, join a small content working group that meets monthly to propose ideas and review upcoming posts.',
  },
  {
    name: 'Grant Researcher',
    program: 'GSI',
    programColor: 'bg-[#8A8DA8] text-white',
    description:
      'Help identify and summarize grant opportunities that fit GSI\u2019s mission.',
    timeAsk: '2–4 hours/month',
    session:
      'You scan grant databases and foundation websites, flag opportunities that fit GSI\u2019s work, and write a short summary of each (funder, amount, deadline, fit). GSI reviews and decides which to pursue. No grant writing required — just research and synthesis.',
  },
]

const CLUSTERS = [
  { label: 'In your community', start: 0, end: 4 },
  { label: 'For schools', start: 4, end: 7 },
  { label: 'Behind the scenes', start: 7, end: 10 },
]

/* ── Page component ── */

export default function GetInvolvedPage() {
  const formRef = useRef<HTMLDivElement>(null)
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [about, setAbout] = useState('')
  const [referral, setReferral] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  function handleRoleClick(roleName: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      next.add(roleName)
      return next
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function toggleRole(roleName: string) {
    setSelectedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleName)) {
        next.delete(roleName)
      } else {
        next.add(roleName)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    if (selectedRoles.size === 0) {
      setError('Please select at least one role.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/volunteer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          roles: Array.from(selectedRoles),
          about: about.trim() || undefined,
          referral: referral.trim() || undefined,
          website: honeypot || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong — please try again.')
        setSubmitting(false)
        return
      }

      setSubmitted(true)
    } catch {
      setError('Something went wrong — please try again or email us at info@gogreenstreets.org')
      setSubmitting(false)
    }
  }

  const firstName = name.trim().split(' ')[0]

  return (
    <>
      <Nav />
      <main className="bg-navy pt-[60px]">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-[1120px] px-8 py-20 sm:py-28">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-lime">
            Get involved
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Move Massachusetts with us.
          </h1>
          <p className="mt-5 max-w-[640px] text-base leading-relaxed text-white">
            Green Streets Initiative runs on community energy. Whether you have two hours a
            month or two days a week, there&apos;s a role that fits — and real work that
            needs doing.
          </p>
        </section>

        {/* ── Role cards ── */}
        <section className="mx-auto max-w-[1120px] px-8 pb-20">
          {CLUSTERS.map((cluster) => (
            <div key={cluster.label} className="mb-14">
              <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-white/50">
                {cluster.label}
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {ROLES.slice(cluster.start, cluster.end).map((role) => (
                  <div
                    key={role.name}
                    className="flex flex-col rounded-xl bg-[#242538] p-6"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className="font-display text-lg font-bold text-white">
                        {role.name}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold ${role.programColor}`}
                      >
                        {role.program}
                      </span>
                    </div>
                    <p className="text-[0.9375rem] leading-relaxed text-white">
                      {role.description}
                    </p>
                    <p className="mt-3 text-sm text-white/50">
                      <ClockIcon /> {role.timeAsk}
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">
                      {role.session}
                    </p>
                    <button
                      onClick={() => handleRoleClick(role.name)}
                      className="mt-auto pt-5 text-left text-sm font-semibold text-lime transition-opacity hover:opacity-80"
                    >
                      I&apos;m interested &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* ── Volunteer intake form ── */}
        <section
          ref={formRef}
          className="border-t border-white/[0.07] bg-navy"
        >
          <div className="mx-auto max-w-[640px] px-8 py-20">
            {submitted ? (
              <div className="animate-in text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-lime">
                  <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                    <path stroke="#191A2E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="font-display text-2xl font-bold text-white">
                  Thanks{firstName ? `, ${firstName}` : ''}.
                </h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-white">
                  We&apos;ll be in touch within a week. In the meantime, download the
                  Shift app and take your first active trip.
                </p>
                <Link
                  href="/shift"
                  className="mt-6 inline-block rounded-full bg-lime px-6 py-2.5 text-sm font-semibold text-navy transition-opacity hover:opacity-85"
                >
                  Download the app &rarr;
                </Link>
              </div>
            ) : (
              <>
                <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Tell us you&apos;re interested
                </h2>
                <p className="mt-3 text-[0.9375rem] leading-relaxed text-white">
                  Fill out the short form below and we&apos;ll be in touch within a week with
                  next steps.
                </p>

                <form onSubmit={handleSubmit} className="mt-10 space-y-6">
                  {/* Honeypot */}
                  <div className="absolute -left-[9999px]" aria-hidden="true">
                    <input
                      type="text"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-white">
                      Your name <span className="text-lime">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      className="form-input w-full"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-white">
                      Email address <span className="text-lime">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      className="form-input w-full"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  {/* Roles */}
                  <fieldset>
                    <legend className="mb-1.5 text-sm font-medium text-white">
                      Which roles interest you? <span className="text-lime">*</span>
                    </legend>
                    <p className="mb-3 text-xs text-white/50">
                      Select all that apply. We&apos;ll follow up based on your selections.
                    </p>
                    <div className="space-y-2.5">
                      {ROLES.map((role) => (
                        <label
                          key={role.name}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/[0.08] px-4 py-3 transition-colors hover:border-white/20"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRoles.has(role.name)}
                            onChange={() => toggleRole(role.name)}
                            className="h-4 w-4 shrink-0 rounded border-white/30 bg-white/10 text-lime accent-[#BAF14D]"
                          />
                          <span className="text-sm text-white">{role.name}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* About */}
                  <div>
                    <label htmlFor="about" className="mb-1.5 block text-sm font-medium text-white">
                      A little about you
                    </label>
                    <textarea
                      id="about"
                      rows={3}
                      className="form-input w-full"
                      placeholder="Anything that would help us match you to the right role — your neighborhood, your connection to GSI, your commute situation, skills you'd like to use."
                      value={about}
                      onChange={(e) => setAbout(e.target.value)}
                    />
                  </div>

                  {/* Referral */}
                  <div>
                    <label htmlFor="referral" className="mb-1.5 block text-sm font-medium text-white">
                      How did you hear about volunteering with GSI?
                    </label>
                    <input
                      id="referral"
                      type="text"
                      className="form-input w-full"
                      value={referral}
                      onChange={(e) => setReferral(e.target.value)}
                    />
                  </div>

                  {/* Error */}
                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}

                  {/* Submit */}
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rounded-full bg-lime px-8 py-3 text-sm font-semibold text-navy transition-opacity hover:opacity-85 disabled:opacity-50 sm:w-auto"
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                          </svg>
                          Sending…
                        </span>
                      ) : (
                        'Send my interest'
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </section>

        {/* ── Closing strip ── */}
        <section className="border-t border-white/[0.07] bg-[#242538]">
          <div className="mx-auto max-w-[640px] px-8 py-16 text-center">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Not ready to commit? Start with the app.
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-white">
              The best way to understand what GSI does is to try it yourself. Download
              the Shift app and take your first active trip.
            </p>
            <Link
              href="/shift"
              className="mt-6 inline-block rounded-full bg-lime px-6 py-2.5 text-sm font-semibold text-navy transition-opacity hover:opacity-85"
            >
              Download the app &rarr;
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

/* ── Inline clock icon ── */

function ClockIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 256 256"
      fill="currentColor"
      className="-mt-0.5 mr-1 inline-block"
    >
      <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm64-88a8,8,0,0,1-8,8H128a8,8,0,0,1-8-8V72a8,8,0,0,1,16,0v48h48A8,8,0,0,1,192,128Z" />
    </svg>
  )
}
