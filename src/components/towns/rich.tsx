import { Fragment, type ReactNode } from 'react'

/**
 * Renders a translated sentence that carries markup (site-strings/towns.ts):
 * `<b>…</b>` and `<em>…</em>` become the element the caller styles, and a
 * `{name}` slot left over after t() takes a node (a link, a list of links).
 * Keeps each sentence one string per language instead of glued fragments.
 * No hooks, so server and client components can both use it.
 */
export function rich(
  text: string,
  {
    b = (c) => <b>{c}</b>,
    em = (c) => <em>{c}</em>,
    nodes = {},
  }: {
    b?: (children: ReactNode) => ReactNode
    em?: (children: ReactNode) => ReactNode
    nodes?: Record<string, ReactNode>
  } = {},
): ReactNode {
  const slots = (s: string, base: number): ReactNode[] =>
    s.split(/(\{\w+\})/).map((part, i) => {
      const m = part.match(/^\{(\w+)\}$/)
      return <Fragment key={base + i}>{m && m[1] in nodes ? nodes[m[1]] : part}</Fragment>
    })
  const out: ReactNode[] = []
  const re = /<(b|em)>([\s\S]*?)<\/\1>/g
  let last = 0
  let k = 0
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push(...slots(text.slice(last, m.index), (k += 100)))
    const inner = slots(m[2], (k += 100))
    out.push(<Fragment key={(k += 100)}>{m[1] === 'b' ? b(inner) : em(inner)}</Fragment>)
    last = m.index + m[0].length
  }
  out.push(...slots(text.slice(last), (k += 100)))
  return out
}
