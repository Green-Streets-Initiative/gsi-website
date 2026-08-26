'use client'

import { useEffect, useState } from 'react'

/**
 * Volunteer Field Guide — unlisted, password-gated (see middleware.ts).
 * Structured as the volunteer's actual workflow: Setup, then each project
 * as steps shown one at a time. Every step carries the links it needs.
 * Update links here:
 */
const LINKS = {
  workbook:
    'https://docs.google.com/spreadsheets/d/1UFNJorgN1BH_S7RP5ahyCyCtO2A9WV3Uu-YVlCx-5qo/edit',
  dashboard: 'https://shift-school.vercel.app',
  program: 'https://www.gogreenstreets.org/shift/schools',
  streetview: 'https://www.google.com/maps',
  contact: 'info@gogreenstreets.org',
}

const NAVY = '#191A2E'

/* ── Types ── */
interface Chip {
  label: string
  href?: string
}
interface Step {
  key: string
  title: string
  need: Chip[]
  body: React.ReactNode
  done: string
}

/* ── Small pieces ── */
function NeedChips({ need }: { need: Chip[] }) {
  if (need.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="font-[family-name:var(--font-dm-mono)] text-[11px] uppercase tracking-[0.07em] text-[#6B7280]">
        You need
      </span>
      {need.map(c =>
        c.href ? (
          <a
            key={c.label}
            href={c.href}
            target="_blank"
            rel="noopener"
            className="rounded-full bg-[#DEE9FC] text-[#1D4FB0] px-3 py-1 text-[13px] font-semibold no-underline hover:bg-[#cfdffb]"
          >
            {c.label} ↗
          </a>
        ) : (
          <span
            key={c.label}
            className="rounded-full bg-[#EDEBE2] text-[#4A4D68] px-3 py-1 text-[13px] font-medium"
          >
            {c.label}
          </span>
        ),
      )}
    </div>
  )
}

function readDone(key: string): boolean {
  try {
    return localStorage.getItem('sfs-step-' + key) === '1'
  } catch {
    return false
  }
}
function writeDone(key: string, v: boolean) {
  try {
    if (v) localStorage.setItem('sfs-step-' + key, '1')
    else localStorage.removeItem('sfs-step-' + key)
  } catch {}
}

function Project({
  id,
  eyebrow,
  title,
  intro,
  steps,
}: {
  id: string
  eyebrow: string
  title: string
  intro: React.ReactNode
  steps: Step[]
}) {
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    const d: Record<string, boolean> = {}
    for (const s of steps) d[s.key] = readDone(s.key)
    setDone(d)
    // Open the first not-done step
    const first = steps.find(s => !d[s.key])
    setOpen(first ? first.key : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleDone(key: string) {
    const v = !done[key]
    writeDone(key, v)
    const next = { ...done, [key]: v }
    setDone(next)
    if (v) {
      const idx = steps.findIndex(s => s.key === key)
      const nextStep = steps.slice(idx + 1).find(s => !next[s.key])
      setOpen(nextStep ? nextStep.key : null)
    }
  }

  const doneCount = steps.filter(s => done[s.key]).length

  return (
    <section id={id} className="pt-12">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <span className="inline-block font-[family-name:var(--font-dm-mono)] text-[11.5px] font-medium uppercase tracking-[0.09em] bg-[#191A2E] text-[#BAF14D] px-2.5 py-1 rounded">
            {eyebrow}
          </span>
          <h2 className="font-[family-name:var(--font-bricolage)] text-[clamp(23px,4vw,28px)] font-extrabold tracking-tight text-[#191A2E] mt-3 mb-1">
            {title}
          </h2>
        </div>
        <span className="font-[family-name:var(--font-dm-mono)] text-[13px] text-[#6B7280]">
          {doneCount} / {steps.length} done
        </span>
      </div>
      <div className="text-[15.5px] text-[#374151] mb-4 max-w-[68ch]">{intro}</div>

      <div className="grid gap-2">
        {steps.map((s, i) => {
          const isOpen = open === s.key
          const isDone = !!done[s.key]
          return (
            <div
              key={s.key}
              className={`rounded-xl border bg-white overflow-hidden ${
                isOpen ? 'border-[#2966E5]' : 'border-[#E4E2D9]'
              }`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : s.key)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer"
                aria-expanded={isOpen}
              >
                <span
                  className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center font-[family-name:var(--font-dm-mono)] text-[13px] font-bold"
                  style={
                    isDone
                      ? { background: '#DCF3E6', color: '#1F6B45' }
                      : { background: NAVY, color: '#BAF14D' }
                  }
                >
                  {isDone ? '✓' : i + 1}
                </span>
                <span
                  className={`flex-1 text-[15.5px] font-semibold ${
                    isDone ? 'text-[#6B7280] line-through' : 'text-[#191A2E]'
                  }`}
                >
                  {s.title}
                </span>
                <span className="text-[#9CA3AF] text-sm">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pl-[3.75rem]">
                  <NeedChips need={s.need} />
                  <div className="text-[15px] text-[#374151] leading-relaxed [&_ul]:pl-5 [&_ul]:list-disc [&_li]:mt-1">
                    {s.body}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <p className="m-0 text-[13.5px] text-[#6B7280]">
                      <span className="font-semibold text-[#4A4D68]">Done when: </span>
                      {s.done}
                    </p>
                    <button
                      onClick={() => toggleDone(s.key)}
                      className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                        isDone
                          ? 'bg-[#EDEBE2] text-[#4A4D68]'
                          : 'bg-[#2966E5] text-white hover:bg-[#2159c7]'
                      }`}
                    >
                      {isDone ? 'Undo' : 'Mark done'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ── Step content ── */

const RUBRIC: [string, string, string, string][] = [
  ['Sidewalks', 'Sparse or broken', 'Most approach streets', 'Comprehensive'],
  ['Walkshed', 'Spread out / big barriers', 'Mixed', 'Dense grid, no highway or rail barrier'],
  ['PTO activity', 'No trace online', 'Exists but quiet', 'Visibly active'],
]

const PROJECT_1: Step[] = [
  {
    key: 'p1-read',
    title: 'Read the shortlist',
    need: [{ label: 'Shortlist sheet', href: LINKS.workbook }],
    body: (
      <p className="m-0">
        The sheet has 20 candidate schools with the public data already filled in:
        enrollment, Title I status, low-income percentage, and Safe Routes to School
        status, with the source for each row in its Comments cell. Read it through
        once so you know what&rsquo;s there.
      </p>
    ),
    done: 'You can say which 3–4 towns look strongest and why.',
  },
  {
    key: 'p1-verify',
    title: 'Verify the facts',
    need: [
      { label: 'Shortlist sheet', href: LINKS.workbook },
      { label: 'DESE profiles', href: 'https://profiles.doe.mass.edu' },
    ],
    body: (
      <ul className="m-0">
        <li>Spot-check the filled-in numbers against each school&rsquo;s DESE profile — the Comments cell names the source.</li>
        <li>Fix anything wrong, and resolve anything marked &ldquo;?&rdquo;.</li>
        <li>One known issue: Winter Hill (Somerville) is in temporary space after its building closed — confirm where students actually report before trusting its address.</li>
      </ul>
    ),
    done: 'No “?” left in the data columns.',
  },
  {
    key: 'p1-streets',
    title: 'Score sidewalks and walksheds',
    need: [
      { label: 'Shortlist sheet', href: LINKS.workbook },
      { label: 'Google Maps / Street View', href: LINKS.streetview },
    ],
    body: (
      <div>
        <p className="mt-0">
          For each school, look at 3–4 approach streets in Street View and fill the
          two blank score columns (0–2):
        </p>
        <div className="overflow-x-auto my-2 rounded-lg border border-[#E4E2D9]">
          <table className="w-full text-[13.5px] border-collapse">
            <thead>
              <tr>
                {['', '0', '1', '2'].map(h => (
                  <th
                    key={h}
                    className="text-left px-3 py-2 font-[family-name:var(--font-dm-mono)] text-[11px] uppercase tracking-wide text-[#6B7280] border-b border-[#E4E2D9]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RUBRIC.map(([name, a, b, c]) => (
                <tr key={name} className="odd:bg-[#FAF9F4]">
                  <td className="px-3 py-2 font-semibold text-[#191A2E]">{name}</td>
                  <td className="px-3 py-2">{a}</td>
                  <td className="px-3 py-2">{b}</td>
                  <td className="px-3 py-2">{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mb-0">
          The Total column adds itself. Anything a score can&rsquo;t capture goes in
          the notes columns.
        </p>
      </div>
    ),
    done: 'Every school has sidewalk and walkshed scores.',
  },
  {
    key: 'p1-pto',
    title: 'Check PTO activity',
    need: [{ label: 'Shortlist sheet', href: LINKS.workbook }],
    body: (
      <ul className="m-0">
        <li>Look for each school&rsquo;s PTO/PTA online: a website, Facebook page, recent event posts or fundraisers.</li>
        <li>Score it 0–2 using the same rubric row above, and note what you found.</li>
      </ul>
    ),
    done: 'Every school has a PTO score, and the totals give you a first ranking.',
  },
  {
    key: 'p1-contacts',
    title: 'Find contacts for the top 8',
    need: [{ label: 'Shortlist sheet', href: LINKS.workbook }],
    body: (
      <ul className="m-0">
        <li>For the 8 highest-scoring schools, find the principal&rsquo;s name and email (school website staff pages).</li>
        <li>Where you can, also find the PE or wellness teacher and a PTO contact.</li>
      </ul>
    ),
    done: 'The top 8 rows have at least a named principal with an email.',
  },
  {
    key: 'p1-rank',
    title: 'Finalize the ranking and write the top 5',
    need: [{ label: 'Shortlist sheet', href: LINKS.workbook }],
    body: (
      <ul className="m-0">
        <li>Adjust the ranking with your own judgment — the scores are a starting point, not a verdict.</li>
        <li>For the top 5, write one short paragraph each in the &ldquo;Why this school&rdquo; column.</li>
        <li>Email Keith that it&rsquo;s ready.</li>
      </ul>
    ),
    done: 'Keith has a ranked list he can start outreach from.',
  },
]

const PROJECT_2: Step[] = [
  {
    key: 'p2-training',
    title: 'Complete the Route Planning training',
    need: [{ label: 'Training link (arrives by email)' }],
    body: (
      <p className="m-0">
        Your training arrives by email as a personal link — no account needed.
        It&rsquo;s self-paced reading with short quizzes, and it&rsquo;s required
        before route fieldwork. If anything in it is unclear or looks out of date,
        tell Keith — you&rsquo;re its first real reader.
      </p>
    ),
    done: 'The portal shows your certification complete.',
  },
  {
    key: 'p2-assign',
    title: 'Get your route assignments',
    need: [{ label: 'Corridor links (arrive by email)' }],
    body: (
      <p className="m-0">
        Keith runs the route generator for the top schools from your shortlist. For
        each school it proposes about 5 walking/biking routes (&ldquo;corridors&rdquo;)
        to and from the school. You&rsquo;ll get an email per school with a personal
        link for each corridor — that link is where you&rsquo;ll record everything.
      </p>
    ),
    done: 'You have corridor links for 2–3 schools.',
  },
  {
    key: 'p2-desk',
    title: 'Review each route from your desk',
    need: [
      { label: 'Corridor links (email)' },
      { label: 'Google Maps / Street View', href: LINKS.streetview },
    ],
    body: (
      <ul className="m-0">
        <li>First ask: is this actually how families would walk to this school? Is there an obvious better route missing?</li>
        <li>Score each corridor 1–10 for walking and for biking from Street View — <strong>before</strong> looking at the system&rsquo;s scores. Note every case where you and the system disagree by more than 2 points.</li>
        <li>Each corridor also carries a recommendation — Walk &amp; Bike, Walk Only, Bike with Caution, or Bike Not Recommended. Flag any you&rsquo;d change.</li>
        <li>Watch especially for routes rated too kindly on busy multi-lane roads — that&rsquo;s the weakness we most suspect.</li>
      </ul>
    ),
    done: 'Every corridor has your own scores noted next to the system’s.',
  },
  {
    key: 'p2-walk',
    title: 'Walk one set of routes',
    need: [{ label: 'Corridor links (email, on your phone)' }],
    body: (
      <ul className="m-0">
        <li>Pick one school and walk its corridors at school-arrival time if you can (7:30–8:30am) — traffic then is the truth.</li>
        <li>Fill in the checklist through your corridor link as you go: sidewalks, crossings, traffic, bike conditions, photos.</li>
        <li>You&rsquo;re also testing the tool itself — if the form is awkward on a phone or anything fails, write it down.</li>
      </ul>
    ),
    done: 'One school’s corridors are submitted through the links.',
  },
  {
    key: 'p2-verdict',
    title: 'Send Keith your verdict',
    need: [],
    body: (
      <div>
        <p className="mt-0">One short email per school, four parts:</p>
        <ul>
          <li>Each route: keep, adjust, or reject — and why.</li>
          <li>Your scores vs the system&rsquo;s, and where they split.</li>
          <li>Anything broken or awkward in the tool.</li>
          <li>The bottom line: would you hand this map to a parent?</li>
        </ul>
      </div>
    ),
    done: 'Keith has a verdict for each school you reviewed.',
  },
]

/* ── Page ── */

export default function VolunteerGuidePage() {
  return (
    <main className="min-h-screen bg-[#F4F8EE] text-[#374151] text-[16px] leading-[1.6]">
      {/* Header */}
      <header className="px-6 pt-9 pb-8" style={{ background: NAVY }}>
        <div className="max-w-[720px] mx-auto">
          <div className="font-[family-name:var(--font-bricolage)] font-extrabold text-[24px] tracking-tight text-white">
            Shift<span className="text-[#BAF14D] tracking-[-0.12em]">&#8250;&#8250;</span>
            <span className="ml-2.5 text-[14px] font-medium text-white/75 tracking-normal">
              for Schools
            </span>
          </div>
          <h1 className="font-[family-name:var(--font-bricolage)] text-[clamp(26px,4.5vw,36px)] font-extrabold leading-[1.1] tracking-tight text-white mt-4 mb-2.5 text-balance">
            Volunteer Guide
          </h1>
          <p className="max-w-[58ch] text-[16px] text-white/85 m-0 leading-relaxed">
            We&rsquo;re signing our first school this fall. Your work decides which
            schools we approach, and whether our walking-route maps are good enough
            to hand to families. Research and data pulls are handled by Claude, our
            AI — your part is checking facts, local judgment, and finding the right
            people.
          </p>
          <p className="max-w-[58ch] text-[13.5px] text-white/60 mt-3 mb-0">
            New to the program? Read the{' '}
            <a href={LINKS.program} target="_blank" rel="noopener" className="text-[#BAF14D] underline underline-offset-2">
              public program page
            </a>{' '}
            first — it&rsquo;s the same page principals see.
          </p>
        </div>
      </header>
      <div className="h-[3px] bg-[#52B788]" />

      <div className="max-w-[720px] mx-auto px-6 pb-24">
        {/* ── Setup ── */}
        <section id="setup" className="pt-10">
          <span className="inline-block font-[family-name:var(--font-dm-mono)] text-[11.5px] font-medium uppercase tracking-[0.09em] bg-[#191A2E] text-[#BAF14D] px-2.5 py-1 rounded">
            Setup
          </span>
          <h2 className="font-[family-name:var(--font-bricolage)] text-[clamp(23px,4vw,28px)] font-extrabold tracking-tight text-[#191A2E] mt-3 mb-3">
            Your four things
          </h2>
          <div className="grid gap-2">
            {[
              {
                label: 'Shortlist sheet',
                desc: 'The working spreadsheet for Project 1. Keith grants you access.',
                href: LINKS.workbook,
                cta: 'Open sheet',
              },
              {
                label: 'Admin dashboard',
                desc: 'Where schools, volunteers, and routes are managed. Keith creates your login.',
                href: LINKS.dashboard,
                cta: 'Open dashboard',
              },
              {
                label: 'Training',
                desc: 'Arrives by email as a personal link. Needed before route fieldwork (Project 2).',
              },
              {
                label: 'Questions',
                desc: 'Keith Anderson — ask early, ask often.',
                href: `mailto:${LINKS.contact}`,
                cta: LINKS.contact,
              },
            ].map(row => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-4 bg-white border border-[#E4E2D9] rounded-xl px-4 py-3"
              >
                <div>
                  <div className="text-[15px] font-semibold text-[#191A2E]">{row.label}</div>
                  <div className="text-[13.5px] text-[#6B7280]">{row.desc}</div>
                </div>
                {row.href && (
                  <a
                    href={row.href}
                    target={row.href.startsWith('mailto') ? undefined : '_blank'}
                    rel="noopener"
                    className="shrink-0 rounded-lg bg-[#DEE9FC] text-[#1D4FB0] px-3.5 py-2 text-[13px] font-semibold no-underline hover:bg-[#cfdffb]"
                  >
                    {row.cta}
                  </a>
                )}
              </div>
            ))}
          </div>

          <div className="border-l-4 border-[#F59E0B] bg-[#FEF3C7] rounded-r-xl px-5 py-3.5 mt-4">
            <p className="m-0 text-[14.5px] leading-relaxed text-[#92400E]">
              <strong>The dashboard is our live system.</strong> Look at anything;
              change things only for Maple Street Elementary (Test), our sandbox
              school; and don&rsquo;t touch the &ldquo;Program Active&rdquo; toggle —
              it sends real emails to real people. When something confuses you,
              write it down and tell Keith. That feedback is part of the job.
            </p>
          </div>
        </section>

        {/* ── Project 1 ── */}
        <Project
          id="project-1"
          eyebrow="Project 1 · Weeks 1–2"
          title="Build the school shortlist"
          intro={
            <p className="m-0">
              Goal: a ranked list of schools, with the top 5 ready for Keith to
              approach — verified facts, named contacts, and a short case for each.
              Need more research at any point (a deeper look at one school, more
              candidates, fresher data)? Ask Keith — Claude turns that around in
              minutes.
            </p>
          }
          steps={PROJECT_1}
        />

        {/* ── Project 2 ── */}
        <Project
          id="project-2"
          eyebrow="Project 2 · Weeks 2–4"
          title="Check our route maps"
          intro={
            <p className="m-0">
              Goal: answer one question — would you hand our walking-route maps to a
              parent? You review the system&rsquo;s proposed routes on screen and on
              foot; your review also produces the finished maps we bring to the top
              schools.
            </p>
          }
          steps={PROJECT_2}
        />
      </div>

      <footer className="border-t border-[#E4E2D9] px-6 py-6 pb-14 text-center text-[13px] text-[#6B7280]">
        Shift for Schools · Green Streets Initiative ·{' '}
        <a href={`mailto:${LINKS.contact}`} className="text-[#2966E5]">
          {LINKS.contact}
        </a>
      </footer>
    </main>
  )
}
