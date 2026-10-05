'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X, ChevronDown, Mail, ExternalLink } from 'lucide-react'
import { MANAGER_ROLE_ENABLED } from '../_lib/portal-roles'

/** `body` as a list renders one paragraph each. */
type HelpItem = { title: string; body: string | string[] }

/** Help topics a page can open directly (see openPortalHelp). */
export const HELP_TOPIC_TAXES = 'Taxes on rewards'

const HELP_EVENT = 'portal:open-help'

/** Opens the Help drawer with one topic expanded. The Topbar owns the drawer. */
export function openPortalHelp(topic: string) {
  window.dispatchEvent(new CustomEvent(HELP_EVENT, { detail: { topic } }))
}

/** For the Topbar: call `onOpen(topic)` whenever a page asks for help. */
export function onPortalHelpRequest(onOpen: (topic: string) => void): () => void {
  const handler = (e: Event) => onOpen((e as CustomEvent<{ topic: string }>).detail?.topic ?? '')
  window.addEventListener(HELP_EVENT, handler)
  return () => window.removeEventListener(HELP_EVENT, handler)
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Home',
  setup: 'Setup',
  advisor: 'Commute Advisor',
  employees: 'Employees',
  'share-kit': 'Share kit',
  challenges: 'Challenges',
  impact: 'Impact',
  billing: 'Billing & rewards',
  settings: 'Settings',
}

const HELP_CONTENT: Record<string, HelpItem[]> = {
  dashboard: [
    {
      title: 'What the numbers on Home mean',
      body: 'Home shows the last 30 days of your team\'s commuting: total trips, active trips (anything but driving alone), miles and the share of driving avoided. They update on their own as employees log trips in the Shift app.',
    },
    {
      title: 'How the shift rate is worked out',
      body: 'Shift Rate is the share of your team\'s trips made by walking, biking, rolling or transit instead of driving. A higher Shift Rate means your team is choosing those options more often.',
    },
  ],
  setup: [
    {
      title: 'Working through setup',
      body: 'Setup walks you through the steps that get your program running: your company profile and logo, the Commute Advisor page, inviting employees and scheduling your first challenge. Each step links to where it is done.',
    },
    {
      title: 'Why finishing setup matters',
      body: 'A finished setup means employees see your branding, the Commute Advisor has something to say, and your first challenge is on the calendar. The banner at the top of every page shows what is left.',
    },
  ],
  advisor: [
    {
      title: 'Setting up your Commute Advisor page',
      body: 'The Commute Advisor is a page for your employees that shows what commute benefits and facilities your workplace offers. Fill in your office address, any transit or bike benefits, and facilities like bike parking or showers.',
    },
    {
      title: 'What employees see',
      body: 'Employees get commute options based on where your office is and the benefits you offer. The preview beside the form shows exactly how the page looks to them.',
    },
  ],
  'share-kit': [
    {
      title: 'What the Share kit is for',
      body: 'Everything on this page gets people into your workplace on Shift: a join link, an invite code to type into the app, a QR for posters and ready-to-send messages for email, Slack or a newsletter. To have us email a list of employees for you, use Invite on the Employees page.',
    },
    {
      title: 'Which one to use',
      body: 'Send the join link in email or chat, put the QR on a poster or a slide, and give the code to anyone who already has the app. They all lead to the same place.',
    },
  ],
  employees: [
    {
      title: 'How the invite code works',
      body: 'Employees join your workplace by entering your code in the Shift app or opening your join link. From then on their trips count toward your team\'s numbers and they can take part in your challenges.',
    },
    {
      title: 'Reading the leaderboard',
      body: 'The leaderboard ranks team members by their commuting over the period you pick. Switch between shift rate, active trips and miles, and change the time range to see a different period.',
    },
  ],
  challenges: [
    {
      title: 'Creating your first challenge',
      body: 'Challenges give your team a shared goal and something to win. Pick a ready-made template or start blank, set the dates, then add prizes. Each prize can reward a different thing, so you can recognise both consistency and volume.',
    },
    {
      title: 'How prize draws work',
      body: 'When a challenge ends, use "Draw winners". Top-performer prizes go to the people highest on the chosen measure. Drawing prizes pick at random from everyone who met the bar.',
    },
  ],
  impact: [
    {
      title: 'Reading your impact report',
      body: 'Impact gives you the fuller picture of your team\'s commuting: the headline numbers, how they trend week by week, and which ways of getting to work your team uses most.',
    },
    {
      title: 'Downloading a report',
      body: 'The download button makes a PDF of the period you are looking at. It is meant for leadership, HR and sustainability committees, so it says what the program has done in plain terms.',
    },
  ],
  billing: [
    {
      title: 'Your rewards balance',
      body: 'The rewards balance pays for challenge rewards. Top it up in preset amounts or enter your own; money is only taken from it when someone wins. The rewards balance comes with the Standard plan and above.',
    },
    {
      title: 'Your plan',
      body: 'Your plan decides what is included. Starter and Basic cover trip tracking and the Commute Advisor; Standard and above add challenges with rewards and the rewards balance. Invoices, your card, plan changes and cancellation are handled in Stripe from the "Manage in Stripe" card on this page.',
    },
    {
      title: HELP_TOPIC_TAXES,
      body: [
        'Rewards your employees receive through Shift count as taxable pay under IRS rules, whatever their size. A $25 gift card is treated the same way as a $25 bonus.',
        'Shift does not withhold tax or report rewards on your behalf. The reward is from you to your employee.',
        'The Winners statement on this page lists who received what in a year, with an Export CSV button for payroll. It is complete for the year in January.',
        'Rewards you hand out yourself (a fleece, a parking spot) follow the same rule when they have a cash value.',
        'Talk to your payroll team or tax adviser about how to report it. Green Streets Initiative is not a tax adviser and this is not tax advice.',
      ],
    },
  ],
  settings: [
    {
      title: 'Keeping your company details current',
      body: 'Your company name, contact and logo show up on the join page, the Commute Advisor and in the app. Keep them current so employees and the Green Streets team can reach you.',
    },
    {
      title: 'Your team: who can do what',
      body: [
        MANAGER_ROLE_ENABLED
          ? 'The Team section lists everyone who can open this portal, with one of three roles. Admins can do everything: challenges, inviting employees, settings, billing and the team. Managers can run challenges and prizes, invite employees and edit the Commute Advisor page, but can\'t change settings, billing or the team. Viewers can see everything and change nothing.'
          : 'The Team section lists everyone who can open this portal. Admins can do everything: challenges, inviting employees, settings, billing and the team. Viewers can see everything and change nothing.',
        'The account owner is the person who signed up for Shift. They are always an admin, and no one else on the team can remove them or change their role. To change the owner, email info@gogreenstreets.org.' +
          (MANAGER_ROLE_ENABLED ? ' The owner gets an email whenever someone is added, removed or given a different role.' : ''),
        'Admins add a colleague by email; they get a sign-in link the same way you did. A portal always keeps one admin, so the last admin cannot be changed to another role or removed until someone else is made an admin.',
      ],
    },
    {
      title: 'Notification preferences',
      body: 'Choose what we email you: a weekly summary of your team\'s commuting on Mondays, a note when someone new joins, and challenge milestones when your team hits a goal.',
    },
  ],
}

function getRouteKey(pathname: string): string {
  const after = pathname.split('/shift/employers/portal/')[1] ?? ''
  const segment = after.split('/')[0] || 'dashboard'
  return segment in HELP_CONTENT ? segment : 'dashboard'
}

export default function HelpDrawer({ onClose, topic }: { onClose: () => void; topic?: string | null }) {
  const pathname = usePathname()
  const routeKey = getRouteKey(pathname)
  const items = HELP_CONTENT[routeKey] || HELP_CONTENT.dashboard
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/30 transition-opacity" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Help"
        className="fixed right-0 top-0 z-50 flex h-full w-full flex-col overflow-y-auto bg-surface shadow-lg sm:w-[440px]"
        style={{ animation: 'slide-in-right 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-5 sm:px-6">
          <div>
            <div className="text-[16px] font-bold text-ink">Help</div>
            <div className="text-[12.5px] text-ink-muted">{PAGE_TITLES[routeKey] ?? 'Home'}</div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close help"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        {/* Help items */}
        <div className="flex-1 space-y-1 px-3 py-4 sm:px-4">
          {items.map((item) => (
            <AccordionItem key={item.title} title={item.title} body={item.body} defaultOpen={item.title === topic} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-line p-4 sm:p-5">
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

function AccordionItem({ title, body, defaultOpen = false }: { title: string; body: string | string[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-[10px] transition-colors hover:bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
      >
        <span className="text-[13.5px] font-semibold text-ink">{title}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-ink-tertiary transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="grid gap-2 px-3 pb-3">
          {(Array.isArray(body) ? body : [body]).map((para) => (
            <p key={para} className="text-[13px] leading-relaxed text-ink-muted">
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
