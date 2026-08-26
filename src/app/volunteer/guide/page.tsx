'use client'

import { useEffect, useRef } from 'react'

/**
 * Volunteer Field Guide — unlisted, password-gated (see middleware.ts).
 * The volunteer's canonical onboarding + project reference for the Fall
 * founding-school pilot. Content source of truth for internal editing:
 * Shift repo docs/schools-fall-pilot/.
 */

const NAVY = '#191A2E'

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block font-[family-name:var(--font-dm-mono)] text-[11.5px] font-medium uppercase tracking-[0.09em] bg-[#191A2E] text-[#BAF14D] px-2.5 py-1 rounded">
      {children}
    </span>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-[family-name:var(--font-bricolage)] text-[clamp(24px,4vw,30px)] font-extrabold tracking-tight text-[#191A2E] mt-3 mb-1.5 text-balance">
      {children}
    </h2>
  )
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[18.5px] font-bold text-[#191A2E] mt-7 mb-2">{children}</h3>
}

function Card({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E4E2D9] rounded-xl p-5">
      <h4 className="m-0 mb-1.5 text-[12px] font-medium uppercase tracking-[0.07em] text-[#6B7280] font-[family-name:var(--font-dm-mono)]">
        {label}
      </h4>
      <div className="text-[15px] leading-relaxed text-[#374151]">{children}</div>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-[#52B788] bg-[#EEF4E5] rounded-r-xl px-5 py-3.5 my-4">
      <div className="text-[15.5px] leading-relaxed text-[#374151]">{children}</div>
    </div>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-[#F59E0B] bg-[#FEF3C7] rounded-r-xl px-5 py-3.5 my-4">
      <div className="text-[15.5px] leading-relaxed text-[#92400E] [&_strong]:text-[#92400E]">
        {children}
      </div>
    </div>
  )
}

const CHECKLIST = [
  { key: 'read-guide', label: <>Read this guide end to end (you&rsquo;re doing it)</> },
  {
    key: 'walk-funnel',
    label: (
      <>
        Walk the public funnel a principal would see: the{' '}
        <a href="/shift/schools" target="_blank" rel="noopener" className="text-[#2966E5] underline underline-offset-2">program page</a>,
        the materials on it, and{' '}
        <a href="/shift/schools/find" target="_blank" rel="noopener" className="text-[#2966E5] underline underline-offset-2">Find Your School</a>{' '}
        through to a school&rsquo;s parent portal
      </>
    ),
  },
  {
    key: 'review-shortlist',
    label: <>Open the shortlist workbook Keith shares and read Claude&rsquo;s first-pass rows and the Scoring Guide tab</>,
  },
  {
    key: 'dashboard-login',
    label: <>Once your login exists: tour the dashboard&rsquo;s Schools section using Maple Street Elementary (Test)</>,
  },
  {
    key: 'training',
    label: <>Complete the Route Planning training track from your emailed link &mdash; and note anything unclear or out of date in it</>,
  },
  { key: 'notes-doc', label: <>Start your running notes doc for bugs, confusion, and ideas</> },
]

export default function VolunteerGuidePage() {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = listRef.current
    if (!root) return
    const boxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    boxes.forEach(box => {
      const key = 'sfs-guide-' + box.dataset.key
      try {
        if (localStorage.getItem(key) === '1') {
          box.checked = true
          box.closest('label')?.classList.add('opacity-55', 'line-through')
        }
      } catch {}
      box.addEventListener('change', () => {
        box.closest('label')?.classList.toggle('opacity-55', box.checked)
        box.closest('label')?.classList.toggle('line-through', box.checked)
        try {
          if (box.checked) localStorage.setItem(key, '1')
          else localStorage.removeItem(key)
        } catch {}
      })
    })
  }, [])

  return (
    <main className="min-h-screen bg-[#F4F8EE] text-[#374151] text-[16.5px] leading-[1.65]">
      {/* ── Masthead ── */}
      <header className="px-6 pt-11 pb-10" style={{ background: NAVY }}>
        <div className="max-w-[760px] mx-auto">
          <div className="font-[family-name:var(--font-bricolage)] font-extrabold text-[28px] tracking-tight text-white">
            Shift<span className="text-[#BAF14D] tracking-[-0.12em]">&#8250;&#8250;</span>
            <span className="ml-2.5 text-[15px] font-medium text-white/75 tracking-normal">for Schools</span>
          </div>
          <h1 className="font-[family-name:var(--font-bricolage)] text-[clamp(30px,5.5vw,44px)] font-extrabold leading-[1.08] tracking-tight text-white mt-5 mb-3 text-balance">
            Volunteer Field Guide
          </h1>
          <p className="max-w-[56ch] text-[17px] text-white/80 m-0">
            Your home base for the fall pilot: what you&rsquo;re here to do, how the
            program works, and your two projects.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="font-[family-name:var(--font-dm-mono)] text-[11.5px] tracking-[0.04em] px-3 py-1.5 rounded-full bg-[#BAF14D] text-[#191A2E] font-semibold">
              GOAL: SIGN OUR FOUNDING SCHOOL
            </span>
            <span className="font-[family-name:var(--font-dm-mono)] text-[11.5px] tracking-[0.04em] px-3 py-1.5 rounded-full bg-white/10 text-white/90">
              INNER-METRO BOSTON
            </span>
            <span className="font-[family-name:var(--font-dm-mono)] text-[11.5px] tracking-[0.04em] px-3 py-1.5 rounded-full bg-white/10 text-white/90">
              UPDATED AUG 2026
            </span>
          </div>
        </div>
      </header>
      <div className="h-[3px] bg-[#52B788]" />

      {/* ── Section nav ── */}
      <nav className="sticky top-0 z-10 bg-[#F4F8EE] border-b border-[#E4E2D9]" aria-label="Sections">
        <div className="max-w-[760px] mx-auto flex gap-1 overflow-x-auto px-4">
          {[
            ['#role', 'Your Role'],
            ['#program', 'The Program'],
            ['#rules', 'Ground Rules'],
            ['#week-one', 'Week One'],
            ['#shortlist', 'Project 1 · Shortlist'],
            ['#routes', 'Project 2 · Routes'],
            ['#reference', 'Reference'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="font-[family-name:var(--font-dm-mono)] text-[12px] tracking-[0.03em] whitespace-nowrap text-[#6B7280] no-underline px-2.5 py-3 hover:text-[#2966E5]"
            >
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="max-w-[760px] mx-auto px-6 pb-24">

        {/* ═══════ YOUR ROLE ═══════ */}
        <section id="role" className="pt-11">
          <Eyebrow>Your Role</Eyebrow>
          <H2>What you&rsquo;re here to do</H2>
          <p className="text-[18px]">
            Green Streets Initiative is signing its <strong className="text-[#191A2E] font-semibold">founding
            school</strong> this fall — the first school to run Shift for Schools, our free classroom
            program that celebrates kids walking, biking, and rolling to school. The platform is
            built. What stands between here and a signed school is focused human work, and that
            work is yours.
          </p>
          <p>
            <strong className="text-[#191A2E] font-semibold">You own two things:</strong> deciding{' '}
            <em>which schools we approach</em>, and proving{' '}
            <em>our safe-routes maps are good enough to hand to families</em>. Both feed directly
            into the pitch — Keith works his contacts and sends outreach against your shortlist,
            and the top pitch schools get a finished route map before we ever walk in the door.
          </p>

          <div className="grid sm:grid-cols-2 gap-3.5 my-4">
            <Card label="Project 1 · Weeks 1–2">
              <strong className="text-[#191A2E]">The school shortlist.</strong> Turn Claude&rsquo;s
              first-pass research into a ranked list of ~15 schools, with the top 5
              pitch-ready: verified data, named contacts, and a &ldquo;why this school&rdquo;
              paragraph.
            </Card>
            <Card label="Project 2 · Weeks 2–4">
              <strong className="text-[#191A2E]">The route-tool review.</strong> Judge our
              AI-assisted route maps against your own assessment, on screen and on foot, and
              answer one question: would you hand this map to a parent?
            </Card>
          </div>

          <Callout>
            <strong className="text-[#191A2E]">How the work is shaped:</strong> you work with
            Keith — and with Claude, our AI, which handles research and analysis grunt work in
            minutes. Data pulls, school deep-dives, re-scores, drafts: ask, don&rsquo;t grind.
            Your time goes where AI can&rsquo;t: verifying facts, local knowledge, judgment
            calls from Street View and sidewalks, and finding the humans — principals, PE
            leads, PTO presidents.
          </Callout>
        </section>

        {/* ═══════ THE PROGRAM ═══════ */}
        <section id="program" className="pt-11">
          <Eyebrow>The Program</Eyebrow>
          <H2>Shift for Schools in 60 seconds</H2>
          <p>
            Each morning the teacher asks for a show of hands — who walked, biked, rolled, took
            the bus, carpooled, got driven — and writes the counts on a paper wall chart. On
            Friday the teacher photographs the chart. Our system reads the photo, updates
            classroom, grade, and school standings, and emails families a weekly update.
          </p>

          <div className="grid sm:grid-cols-2 gap-3.5 my-4">
            <Card label="Free">
              Free for every participating school. Provided by Green Streets Initiative, a
              Massachusetts nonprofit.
            </Card>
            <Card label="K–8">
              Built for elementary and middle grades. High school programming is in
              development.
            </Card>
            <Card label="Under 5 minutes a week">
              A show of hands and one Friday photo. The teacher&rsquo;s time is the
              program&rsquo;s most protected resource — every promise we make guards it.
            </Card>
            <Card label="Private by design">
              No student accounts, no student devices, no data on kids — students never touch
              a screen. Fully COPPA-compliant.
            </Card>
            <Card label="Always positive">
              We celebrate walking, biking, and rolling. We never position against driving —
              the message is what kids gain, not what anyone gives up.
            </Card>
            <Card label="Grounded in research">
              Our Everett study surveyed 7,300 students: 51% already walk to school. The
              program turns that daily trip into school spirit.
            </Card>
          </div>

          <H3>The people, in plain names</H3>
          <div className="grid sm:grid-cols-2 gap-3.5 my-4">
            <Card label="School Coordinator">
              The school&rsquo;s point person — a teacher, PE lead, or engaged parent. Our main
              relationship at the school.
            </Card>
            <Card label="Route Volunteer">
              Maps and field-checks safe walking and biking routes. This is the certification
              you&rsquo;ll earn.
            </Card>
            <Card label="Parent Volunteer">
              Helps with Walk/Bike Buses and family engagement.
            </Card>
            <Card label="Student Ambassador">
              Older students earning service hours — always screen-free, like everything
              student-facing.
            </Card>
          </div>
        </section>

        {/* ═══════ GROUND RULES ═══════ */}
        <section id="rules" className="pt-11">
          <Eyebrow>Ground Rules</Eyebrow>
          <H2>The dashboard is live. Treat it that way.</H2>
          <p>
            Keith will set up your admin login. The dashboard talks directly to the{' '}
            <strong className="text-[#191A2E] font-semibold">production database</strong> — the
            same one the public website and the mobile app read from.
          </p>
          <Warn>
            <strong>Three rules, no exceptions:</strong>
            <ul className="pl-5 my-1.5 list-disc space-y-1">
              <li>
                Look at anything, freely. Create or edit things only for{' '}
                <strong>Maple Street Elementary (Test)</strong> — our designated sandbox school
                — unless Keith says otherwise.
              </li>
              <li>
                Don&rsquo;t flip switches you didn&rsquo;t create. The &ldquo;Program
                Active&rdquo; toggle and admin-only controls trigger real automated emails to
                real people.
              </li>
              <li>
                When something looks broken, confusing, or embarrassing —{' '}
                <strong>write it down</strong>. &ldquo;This confused me&rdquo; is exactly the
                feedback a first-time School Coordinator experience needs.
              </li>
            </ul>
          </Warn>
          <p>
            Your training arrives by email as a personal link — no account needed for that part.
            It&rsquo;s self-paced reading with short quizzes. Complete the Route Planning track
            before corridor fieldwork (it&rsquo;s required), and note anything unclear as you go.
          </p>
        </section>

        {/* ═══════ WEEK ONE ═══════ */}
        <section id="week-one" className="pt-11">
          <Eyebrow>Week One</Eyebrow>
          <H2>Your first week</H2>
          <p>Check things off as you go — this list remembers your progress on this device.</p>
          <div ref={listRef} className="grid gap-2 my-4">
            {CHECKLIST.map(item => (
              <label
                key={item.key}
                className="flex gap-3 items-start bg-white border border-[#E4E2D9] rounded-xl px-4 py-3 cursor-pointer transition-opacity focus-within:outline-2 focus-within:outline-[#2966E5]"
              >
                <input
                  type="checkbox"
                  data-key={item.key}
                  className="w-[18px] h-[18px] mt-[3px] accent-[#2966E5] shrink-0 cursor-pointer"
                />
                <span className="text-[15.5px]">{item.label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* ═══════ PROJECT 1 ═══════ */}
        <section id="shortlist" className="pt-11">
          <Eyebrow>Project 1 · Weeks 1–2</Eyebrow>
          <H2>The school shortlist</H2>
          <p className="text-[18px]">
            <strong className="text-[#191A2E] font-semibold">Deliverable:</strong> a ranked list
            of ~15 K–8 schools in inner-metro communities, top 5 pitch-ready with named contacts
            and a &ldquo;why this school&rdquo; paragraph. The shared workbook is the artifact —
            and it arrives with Claude&rsquo;s first-pass research already in it.
          </p>

          <H3>The division of labor</H3>
          <div className="grid sm:grid-cols-2 gap-3.5 my-4">
            <Card label="Already done (Claude)">
              Candidate schools across Somerville, Cambridge, Everett, Chelsea, Revere, Malden,
              Medford, and Boston neighborhoods — with enrollment, Title I status,
              economically-disadvantaged percentages, Environmental Justice flags, and Safe
              Routes to School partner status pulled from public sources, plus preliminary
              scores where the data supports one.
            </Card>
            <Card label="Yours (judgment & people)">
              Verify anything marked &ldquo;?&rdquo; · make the Street View calls on sidewalks
              and walksheds · gauge PTO activity · add what only local knowledge knows · find
              the named contacts (principal, PE/wellness lead, PTO president) · finalize the
              ranking and write the top-5 paragraphs.
            </Card>
          </div>

          <Callout>
            <strong className="text-[#191A2E]">When you need more:</strong> a deeper dive on one
            school, fresher data, a re-scored list, ten more candidates in a town we
            under-covered — that&rsquo;s minutes of Claude time, not hours of yours. Route
            requests through Keith and treat research as on tap.
          </Callout>

          <H3>What makes a good target — two axes, both required</H3>
          <div className="grid sm:grid-cols-2 gap-3.5 my-4">
            <Card label="Under-served signal">
              <ul className="pl-5 m-0 list-disc space-y-1">
                <li>Title I school</li>
                <li>High &ldquo;economically disadvantaged&rdquo; percentage</li>
                <li>In a Massachusetts Environmental Justice area</li>
              </ul>
            </Card>
            <Card label="Infrastructure viability">
              <ul className="pl-5 m-0 list-disc space-y-1">
                <li>Neighborhood school with a walkable enrollment zone</li>
                <li>Sidewalks on most approach streets</li>
                <li>No highway or rail yard cutting off the catchment</li>
                <li>Bonus: bike lanes nearby</li>
              </ul>
            </Card>
          </div>

          <H3>Scoring</H3>
          <p>
            Six criteria, each 0–2, defined on the workbook&rsquo;s Scoring Guide tab along with
            where to check each one. The total computes itself; the comments column is for what
            numbers can&rsquo;t capture.
          </p>

          <Callout>
            <strong className="text-[#191A2E]">What happens with your list:</strong> Keith works
            warm contacts against it; the top 5 get direct outreach; and the top 2–3 get a real
            safe-routes map generated <em>before</em> the pitch — which is where your second
            project comes in.
          </Callout>
        </section>

        {/* ═══════ PROJECT 2 ═══════ */}
        <section id="routes" className="pt-11">
          <Eyebrow>Project 2 · Weeks 2–4</Eyebrow>
          <H2>The route-tool review</H2>
          <p className="text-[18px]">
            <strong className="text-[#191A2E] font-semibold">The question you&rsquo;re
            answering:</strong> would we confidently hand these routes to families? You&rsquo;ve
            done this kind of assessment work before — that judgment is exactly what we need
            pointed at our pipeline. Side benefit: your review produces real route maps for the
            top pitch schools.
          </p>

          <H3>How the pipeline works</H3>
          <div className="my-4">
            {[
              ['1', 'System', 'Keith initiates an assessment → the system pulls state crash data, road inventory, and OpenStreetMap, and generates ~5 candidate corridors in the school’s walkshed.', false],
              ['2', 'AI', 'Street View images along each corridor are scored 1–10 for walking and biking, with a recommended mode per corridor.', false],
              ['3', 'Keith', 'Reviews corridors on the map (the Routes tab of a school’s page).', false],
              ['4', 'You', 'Walk assigned corridors with the SRTS-aligned checklist — sidewalks, crosswalks, traffic, bike infrastructure, surroundings — and submit scores and photos through your personal link.', true],
              ['5', 'Keith', 'Approves and publishes.', false],
              ['6', 'Families', 'See the routes on their school’s portal page, with Google Maps links and a printable PDF.', false],
            ].map(([n, who, text, isYou]) => (
              <div key={n as string} className="grid grid-cols-[44px_1fr] gap-3.5 py-3.5 border-b border-dashed border-[#E4E2D9] last:border-0">
                <div
                  className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-[family-name:var(--font-dm-mono)] font-bold text-[15px]"
                  style={isYou ? { background: '#BAF14D', color: NAVY } : { background: NAVY, color: '#BAF14D' }}
                >
                  {n as string}
                </div>
                <div>
                  <span className="font-[family-name:var(--font-dm-mono)] text-[11px] tracking-[0.06em] uppercase text-[#2966E5]">
                    {who as string}
                  </span>
                  <p className="m-0 mt-0.5 text-[15.5px]">{text as string}</p>
                </div>
              </div>
            ))}
          </div>

          <H3>The mode categories you&rsquo;ll be judging</H3>
          <div className="grid gap-2 my-3.5">
            {[
              ['Walk & Bike', 'good for both, most ages', 'bg-[#DCF3E6] text-[#1F6B45]'],
              ['Walk Only', 'fine on foot; biking not advised', 'bg-[#DEE9FC] text-[#1D4FB0]'],
              ['Bike with Caution', 'confident riders / with an adult', 'bg-[#FBEDCB] text-[#8A5A0B]'],
              ['Bike Not Recommended', 'walking route only', 'bg-[#F9DCDA] text-[#A3322B]'],
            ].map(([label, desc, cls]) => (
              <div key={label as string} className="flex gap-2.5 items-baseline text-[15px]">
                <b className={`font-[family-name:var(--font-dm-mono)] text-[12px] px-2.5 py-0.5 rounded-full whitespace-nowrap font-bold ${cls}`}>
                  {label as string}
                </b>
                {desc as string}
              </div>
            ))}
          </div>

          <H3>Desk pass — before walking anything</H3>
          <ul className="pl-5 list-disc space-y-1.5">
            <li>
              For each generated corridor: is this how families would <em>actually</em> walk to
              this school? Is there an obvious better corridor the generator missed?
            </li>
            <li>
              Score every corridor yourself from Street View <strong className="text-[#191A2E]">before</strong>{' '}
              looking at the AI&rsquo;s scores — same 1–10 scale, same mode categories. Record
              both. Flag every disagreement over 2 points and any mode-category difference.
            </li>
            <li>
              Probe the AI&rsquo;s blind spots deliberately: school-arrival traffic (Street View
              is usually shot midday), crossing guards, construction newer than the imagery, and
              winter conditions — snow storage narrows sidewalks.
            </li>
          </ul>

          <H3>Field pass — walk at least one full corridor set</H3>
          <ul className="pl-5 list-disc space-y-1.5">
            <li>Walk at school-arrival time if you can (7:30–8:30am).</li>
            <li>
              Fill the official checklist through your personal link — you&rsquo;re
              simultaneously testing the volunteer experience end to end: the link, the form on
              a phone, photo upload, submission confirmation.
            </li>
            <li>
              Note every place your on-the-ground judgment differs from both the AI score and
              your own desk score.
            </li>
          </ul>

          <Warn>
            <strong>The #1 thing we suspect is miscalibrated:</strong> the AI&rsquo;s scoring
            currently assumes dense, Somerville-style streets — sidewalks everywhere, 20 mph.
            For schools in Revere or outer Boston neighborhoods, watch for over-optimistic walk
            scores on big arterial roads.
          </Warn>

          <H3>Deliverable</H3>
          <p>
            A short memo per school (do 2–3 from the shortlist top 5): corridor-by-corridor
            verdicts — agree, adjust, or reject, with why — your score-vs-AI table, any
            volunteer-experience bugs, and the bottom line:{' '}
            <strong className="text-[#191A2E] font-semibold">&ldquo;would I hand this map to a
            parent?&rdquo;</strong> Plus your completed in-tool submissions themselves.
          </p>
        </section>

        {/* ═══════ REFERENCE ═══════ */}
        <section id="reference" className="pt-11">
          <Eyebrow>Reference</Eyebrow>
          <H2>Links &amp; contacts</H2>
          <div className="grid sm:grid-cols-2 gap-3.5 my-4">
            <Card label="Public pages">
              <ul className="pl-5 m-0 list-disc space-y-1">
                <li>
                  <a href="/shift/schools" target="_blank" rel="noopener" className="text-[#2966E5] underline underline-offset-2">
                    Program page + materials
                  </a>
                </li>
                <li>
                  <a href="/shift/schools/find" target="_blank" rel="noopener" className="text-[#2966E5] underline underline-offset-2">
                    Find Your School
                  </a>
                </li>
                <li>
                  <a href="/get-involved" target="_blank" rel="noopener" className="text-[#2966E5] underline underline-offset-2">
                    Volunteer roles
                  </a>
                </li>
              </ul>
            </Card>
            <Card label="Working docs">
              <ul className="pl-5 m-0 list-disc space-y-1">
                <li>Shortlist workbook — Keith shares it, pre-filled</li>
                <li>Your running notes doc — you create it</li>
                <li>Training — arrives as an email link</li>
              </ul>
            </Card>
          </div>
          <Card label="Questions">
            Keith Anderson ·{' '}
            <a href="mailto:info@gogreenstreets.org" className="text-[#2966E5] underline underline-offset-2">
              info@gogreenstreets.org
            </a>{' '}
            — when in doubt, ask early. Nothing here is precious except the production data.
          </Card>
        </section>
      </div>

      <footer className="border-t border-[#E4E2D9] px-6 py-7 pb-16 text-center text-[13px] text-[#6B7280]">
        Shift for Schools · Green Streets Initiative · gogreenstreets.org
      </footer>
    </main>
  )
}
