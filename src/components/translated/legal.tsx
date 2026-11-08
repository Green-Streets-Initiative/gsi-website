import Link from 'next/link'

/* Typography for the translated legal pages, as on the English rules and
 * privacy pages. */

export const A = 'font-semibold text-forest underline-offset-4 hover:underline'

export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="mb-4 font-serif text-[1.75rem] font-normal leading-[1.1] text-navy">{title}</h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

export function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h3 className="mb-3 font-serif text-[1.375rem] leading-tight text-navy">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[1.0625rem] leading-[1.7] text-navy">{children}</p>
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-6 mb-2 font-serif text-[1.375rem] leading-tight text-navy">{children}</h3>
}

export function Mail() {
  return <a href="mailto:info@gogreenstreets.org" className={A}>info@gogreenstreets.org</a>
}

export function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 text-[1.0625rem] leading-[1.7] text-navy">{children}</ul>
}

export function Toc({ title, items }: { title: string; items: { id: string; title: string }[] }) {
  return (
    <nav aria-label={title} className="mb-10">
      <h2 className="mb-4 font-serif text-[1.375rem] leading-tight text-navy">{title}</h2>
      <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-[1.6]">
        {items.map(s => (
          <li key={s.id}>
            <a href={`#${s.id}`} className={A}>{s.title}</a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function ResultsLink({ href }: { href: string }) {
  return <Link href={href} className={A}>gogreenstreets.org{href}</Link>
}
