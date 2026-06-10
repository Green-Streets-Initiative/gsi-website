'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, ChevronDown, Mail, ExternalLink } from 'lucide-react'

type HelpItem = { title: string; body: string }

const HELP_CONTENT: Record<string, HelpItem[]> = {
  dashboard: [
    {
      title: 'Understanding your dashboard metrics',
      body: 'Your dashboard shows a 30-day snapshot of your team\'s commute activity. The stat tiles show total trips, active (non-car) trips, miles shifted, and CO₂ avoided. These update automatically as employees log trips in the Shift app.',
    },
    {
      title: 'How the shift rate is calculated',
      body: 'Shift rate is the percentage of your team\'s trips that were made by walking, biking, or transit instead of driving alone. A higher shift rate means your team is choosing active transportation more often.',
    },
  ],
  setup: [
    {
      title: 'Complete your setup checklist',
      body: 'The setup checklist walks you through the key steps to get your employer program running: upload your logo, invite employees with your code, set up your Commute Advisor page, and launch your first challenge.',
    },
    {
      title: 'Why finishing setup matters',
      body: 'Completing all setup steps unlocks the full value of Shift for your team. Employees get a polished experience with your branding, and you get richer data on how your commute benefits are performing.',
    },
  ],
  advisor: [
    {
      title: 'Setting up your Commute Advisor page',
      body: 'The Commute Advisor is a public page that shows employees what commute benefits and facilities your workplace offers. Fill in your workplace address, transit subsidy details, and available facilities like bike parking or showers.',
    },
    {
      title: 'What employees see',
      body: 'Employees see a personalized commute recommendation based on your workplace location and the benefits you offer. The preview panel on the right shows exactly how the page looks to them.',
    },
  ],
  employees: [
    {
      title: 'How invite codes work',
      body: 'Share your unique invite code with employees so they can join your Shift group in the app. Once they enter the code, their trips start counting toward your team\'s metrics and they become eligible for challenges and rewards.',
    },
    {
      title: 'Understanding the leaderboard',
      body: 'The employee leaderboard ranks team members by their commute activity. You can switch between different metrics like shift rate, active trips, or miles. Use the time range selector to view different periods.',
    },
  ],
  challenges: [
    {
      title: 'Creating your first challenge',
      body: 'Challenges motivate your team by setting goals and offering prizes. Give it a name, set start and end dates, then add prizes. Each prize can use a different metric, so you can reward both consistency and volume.',
    },
    {
      title: 'How prize drawing works',
      body: 'When a challenge ends, you draw winners from the "Draw winners" button. Merit prizes go to the top performers on the chosen metric. Drawing prizes randomly select from all eligible participants who met the threshold.',
    },
  ],
  impact: [
    {
      title: 'Reading your impact report',
      body: 'The impact page gives you a detailed view of your team\'s environmental and health impact. The stat grid shows key metrics, and the mode breakdown shows which types of active transportation your team uses most.',
    },
    {
      title: 'Downloading reports',
      body: 'Click the download button to generate a PDF impact report. This is great for sharing with leadership, HR teams, or sustainability committees to showcase the value of your commute program.',
    },
  ],
  billing: [
    {
      title: 'Managing your rewards pool',
      body: 'Your rewards pool is the balance available for challenge prizes and employee rewards. Top up your pool using the preset amounts or enter a custom amount. Funds are drawn from the pool when prizes are fulfilled.',
    },
    {
      title: 'Understanding your plan',
      body: 'Your subscription tier determines which features are available. Starter includes basic tracking, Standard adds challenges, and Premium unlocks the full rewards pool and advanced analytics.',
    },
  ],
  settings: [
    {
      title: 'Updating company info',
      body: 'Keep your company details current so employees and the GSI team can reach you. Click the edit button to update your company name, admin contact, phone, or website.',
    },
    {
      title: 'Notification preferences',
      body: 'Control what notifications you receive. Weekly impact summaries give you a Monday digest, new employee alerts tell you when someone joins, and challenge milestones notify you when your team hits goals.',
    },
  ],
}

function getRouteKey(pathname: string): string {
  const segment = pathname.split('/').pop() || 'dashboard'
  return segment in HELP_CONTENT ? segment : 'dashboard'
}

export default function HelpDrawer({ onClose }: { onClose: () => void }) {
  const pathname = usePathname()
  const routeKey = getRouteKey(pathname)
  const items = HELP_CONTENT[routeKey] || HELP_CONTENT.dashboard

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/30 transition-opacity" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-[440px] flex-col overflow-y-auto bg-surface shadow-lg"
        style={{ animation: 'slide-in-right 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <div>
            <div className="text-[16px] font-bold text-ink">Help Center</div>
            <div className="text-[12.5px] text-ink-faint">
              {routeKey.charAt(0).toUpperCase() + routeKey.slice(1)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Help items */}
        <div className="flex-1 space-y-1 px-4 py-4">
          {items.map((item) => (
            <AccordionItem key={item.title} title={item.title} body={item.body} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-line p-5">
          <div className="rounded-[12px] bg-accent-softer p-4">
            <div className="mb-1 text-[13.5px] font-semibold text-ink">Need more help?</div>
            <p className="mb-3 text-[13px] leading-relaxed text-ink-muted">
              Our team is here to help you get the most out of Shift for Employers.
            </p>
            <div className="flex flex-col gap-2">
              <a
                href="mailto:info@gogreenstreets.org"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent hover:underline"
              >
                <Mail size={14} strokeWidth={1.75} />
                info@gogreenstreets.org
              </a>
              <a
                href="/contact"
                target="_blank"
                className="inline-flex items-center gap-2 text-[13px] font-semibold text-accent hover:underline"
              >
                <ExternalLink size={14} strokeWidth={1.75} />
                Visit our contact page
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function AccordionItem({ title, body }: { title: string; body: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-[10px] transition-colors hover:bg-surface-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-3 text-left"
      >
        <span className="text-[13.5px] font-semibold text-ink">{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <p className="text-[13px] leading-relaxed text-ink-muted">{body}</p>
        </div>
      )}
    </div>
  )
}
