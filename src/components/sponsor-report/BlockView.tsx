import type { Block, StatRow } from '@/content/sponsor-reports'

/**
 * Rendering for sponsor-report content blocks. Shared by the per-sponsor
 * reports and the public campaign wrap so both stay visually identical.
 * Cream editorial: serif numerals, hairline rules, forest for emphasis.
 */

const PROSE = 'mt-3 max-w-[64ch] text-[1.0625rem] leading-[1.65] text-navy'
const NOTE = 'mt-4 max-w-[64ch] text-[14px] leading-relaxed text-ink-soft'

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-navy/10 py-3.5 last:border-b-0">
      <span className="text-[15px] text-navy">{label}</span>
      <span className="whitespace-nowrap font-serif text-[1.625rem] leading-none tabular-nums text-navy">{value}</span>
    </div>
  )
}

export default function BlockView({ block }: { block: Block }) {
  if (block.kind === 'prose') {
    return (
      <>
        {block.paragraphs.map((p, i) => (
          <p key={i} className={PROSE}>
            {p}
          </p>
        ))}
      </>
    )
  }

  if (block.kind === 'stats') {
    return (
      <>
        {block.rows.length > 0 && (
          <div className="mt-6 border-t border-navy/15">
            {block.rows.map((r) => (
              <Stat key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        )}
        {block.note && <p className={NOTE}>{block.note}</p>}
      </>
    )
  }

  if (block.kind === 'table') {
    return (
      <>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[440px] border-collapse tabular-nums">
            <thead>
              <tr>
                {block.head.map((h, i) => (
                  <th
                    key={h}
                    className={`border-b border-navy/20 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-forest ${
                      i === 0 ? 'text-left' : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={`border-b border-navy/10 px-3 py-2.5 text-[15px] text-navy ${ci === 0 ? 'text-left' : 'text-right'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {block.foot && (
              <tfoot>
                <tr>
                  {block.foot.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-2.5 text-[15px] font-semibold text-navy ${ci === 0 ? 'text-left' : 'text-right'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {block.note && <p className={NOTE}>{block.note}</p>}
      </>
    )
  }

  if (block.kind === 'chart') {
    const max = Math.max(...block.bars.map((b) => b.value))
    return (
      <div className="mt-8">
        <h3 className="font-serif text-[1.25rem] text-navy">{block.title}</h3>
        <div className="mt-5 flex h-[170px] items-end gap-2">
          {block.bars.map((b) => (
            <div key={b.label} className="flex h-full flex-1 flex-col justify-end gap-1.5">
              <span className="text-center text-[11px] font-semibold tabular-nums text-navy">{b.value.toLocaleString()}</span>
              <div className={`rounded-t-[3px] ${b.partial ? 'bg-teal' : 'bg-forest'}`} style={{ height: `${(b.value / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2 border-t border-navy/15 pt-2">
          {block.bars.map((b) => (
            <span key={b.label} className="flex-1 text-center text-[11px] text-ink-soft">
              {b.label}
            </span>
          ))}
        </div>
        {block.legend && (
          <p className="mt-3.5 text-[14px] text-ink-soft">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-teal align-baseline" aria-hidden />
            {block.legend}
          </p>
        )}
        {block.note && <p className={NOTE}>{block.note}</p>}
      </div>
    )
  }

  // list
  return (
    <>
      {block.intro && <p className={PROSE}>{block.intro}</p>}
      <ul className="mt-4 max-w-[64ch] list-disc space-y-3 pl-5 text-[1.0625rem] leading-[1.65] text-navy marker:text-forest">
        {block.items.map((it) => (
          <li key={it.title}>
            <strong className="font-semibold">{it.title}</strong> {it.body}
          </li>
        ))}
      </ul>
      {block.outro?.map((p, i) => (
        <p key={i} className={PROSE}>
          {p}
        </p>
      ))}
    </>
  )
}

/** The summary ledger shown before the first section. */
export function StatPanel({ rows }: { rows: StatRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="mt-8 border-t border-navy/15">
      {rows.map((r) => (
        <Stat key={r.label} label={r.label} value={r.value} />
      ))}
    </div>
  )
}
