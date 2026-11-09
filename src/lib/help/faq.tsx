// The help page's questions and answers (gogreenstreets.org/help), kept here
// so the page and the Shift assistant read the same words (Keith 2026-10-30:
// the assistant couldn't see the FAQ). The words live in
// src/lib/site-strings/help.ts, in all four of the site's languages; edit
// answers there and both follow. The assistant reads the English.
import Link from 'next/link'
import { isValidElement, type ReactNode } from 'react'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { helpStrings } from '@/lib/site-strings/help'

const linkClass = 'underline hover:text-[#2966E5] transition-colors'

type HelpKey = keyof (typeof helpStrings)['en']

// Checked against the app (Update 21) and the live database 2026-10-30.
// Paths like "Profile > Settings > Trip tracking" follow the October 2026
// Settings redesign. Each section's id (the page's #anchor) and how many
// questions it has; the questions themselves are faq.<id>.<n>.q / .a.
const SECTIONS: [id: string, count: number][] = [
  ['getting-started', 5],
  ['trip-tracking', 9],
  ['getting-around', 3],
  ['points-rewards', 9],
  ['badges-streaks-tiers', 6],
  ['roams', 7],
  ['competitions', 4],
  ['for-rewards-partners', 5],
  ['for-schools', 6],
  ['privacy-data', 4],
  ['account-settings', 6],
]

const MARK = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g

/** An answer with [label](href) links or **bold** becomes a paragraph; plain text stays a string. */
function renderAnswer(text: string): ReactNode {
  if (!text.includes('**') && !/\]\(/.test(text)) return text
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(MARK)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = out.length
    if (m[3] != null) {
      out.push(<strong key={key}>{m[3]}</strong>)
    } else {
      const [, label, href] = m
      out.push(
        href.startsWith('/') && !href.endsWith('.html') ? (
          <Link key={key} href={href} className={linkClass}>{label}</Link>
        ) : (
          <a key={key} href={href} className={linkClass}>{label}</a>
        ),
      )
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return <p>{out}</p>
}

/** The help page's sections in one language. */
export function faqSectionsFor(locale: SiteLocale = 'en') {
  const t = translator(helpStrings, locale)
  return SECTIONS.map(([id, count]) => ({
    id,
    title: t(`faq.${id}.title` as HelpKey),
    items: Array.from({ length: count }, (_, i) => ({
      question: t(`faq.${id}.${i + 1}.q` as HelpKey),
      answer: renderAnswer(t(`faq.${id}.${i + 1}.a` as HelpKey)),
    })),
  }))
}

/** English, for the assistant (and the English page). */
export const faqSections = faqSectionsFor('en')

const SITE = 'https://www.gogreenstreets.org'

/** An answer as plain text, links written out, for the assistant. */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isValidElement(node)) return ''
  const props = node.props as { children?: ReactNode; href?: string }
  const inner = textOf(props.children)
  if (props.href) {
    const target = props.href.startsWith('mailto:') ? props.href.slice(7) : props.href.startsWith('/') ? SITE + props.href : props.href
    return inner.includes(target) ? inner : `${inner} (${target})`
  }
  if (node.type === 'li') return `\n- ${inner}`
  if (node.type === 'p') return `\n${inner}\n`
  return inner
}

const clean = (s: string) => s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{2,}/g, '\n').trim()

export const HELP_TOPICS = faqSections.map((s) => s.id)

/** One help topic, questions and answers as plain text. */
export function helpTopic(id: string): { topic: string; page: string; questions: { question: string; answer: string }[] } | null {
  const s = faqSections.find((x) => x.id === id)
  if (!s) return null
  return {
    topic: s.title,
    page: `${SITE}/help#${s.id}`,
    questions: s.items.map((it) => ({ question: it.question, answer: clean(textOf(it.answer)) })),
  }
}

/** Each topic and its questions, for the assistant's tool description. */
export function helpIndex(): string {
  return faqSections.map((s) => `${s.id}: ${s.items.map((it) => it.question).join(' ')}`).join('\n')
}
