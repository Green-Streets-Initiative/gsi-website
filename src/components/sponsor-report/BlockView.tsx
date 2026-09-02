import type { Block, StatRow } from '@/content/sponsor-reports'

/**
 * Rendering for sponsor-report content blocks. Shared by the per-sponsor
 * reports and the public campaign wrap so both stay visually identical.
 */

export function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-3.5 last:border-b-0">
      <span className="text-white/90">{label}</span>
      <span className="whitespace-nowrap font-display text-[22px] font-extrabold tracking-tight text-[#BAF14D] tabular-nums">
        {value}
      </span>
    </div>
  )
}

export default function BlockView({ block }: { block: Block }) {
  if (block.kind === 'prose') {
    return (
      <>
        {block.paragraphs.map((p, i) => (
          <p key={i} className="mt-3 max-w-[64ch] text-white/90">
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
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] px-6">
            {block.rows.map((r) => (
              <Stat key={r.label} label={r.label} value={r.value} />
            ))}
          </div>
        )}
        {block.note && (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/75">{block.note}</p>
        )}
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
                    className={`border-b border-white/10 px-3 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-[#BAF14D] ${
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
                    <td
                      key={ci}
                      className={`border-b border-white/10 px-3 py-2.5 text-white/90 ${
                        ci === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
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
                    <td
                      key={ci}
                      className={`px-3 py-2.5 font-display font-bold text-white ${
                        ci === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {block.note && (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm text-white/75">{block.note}</p>
        )}
      </>
    )
  }

  if (block.kind === 'chart') {
    const max = Math.max(...block.bars.map((b) => b.value))
    return (
      <div className="mt-8">
        <h3 className="font-display text-[17px] font-bold tracking-tight text-white">
          {block.title}
        </h3>
        <div className="mt-5 flex h-[170px] items-end gap-2">
          {block.bars.map((b) => (
            <div key={b.label} className="flex h-full flex-1 flex-col justify-end gap-1.5">
              <span className="text-center font-display text-[11px] font-bold text-white tabular-nums">
                {b.value.toLocaleString()}
              </span>
              <div
                className={`rounded-t ${b.partial ? 'bg-[#2966E5]' : 'bg-[#BAF14D]'}`}
                style={{ height: `${(b.value / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {block.bars.map((b) => (
            <span key={b.label} className="flex-1 text-center text-[10.5px] text-white/80">
              {b.label}
            </span>
          ))}
        </div>
        {block.legend && (
          <p className="mt-3.5 text-sm text-white/80">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[#2966E5] align-baseline" />
            {block.legend}
          </p>
        )}
      </div>
    )
  }

  // list
  return (
    <>
      {block.intro && <p className="mt-3 max-w-[64ch] text-white/90">{block.intro}</p>}
      <ul className="mt-4 max-w-[64ch] list-disc space-y-2.5 pl-5 text-white/90 marker:text-[#BAF14D]">
        {block.items.map((it) => (
          <li key={it.title}>
            <strong className="font-semibold text-white">{it.title}</strong> {it.body}
          </li>
        ))}
      </ul>
      {block.outro?.map((p, i) => (
        <p key={i} className="mt-3 max-w-[64ch] text-white/90">
          {p}
        </p>
      ))}
    </>
  )
}


/** The rounded stat panel used for summary figures. */
export function StatPanel({ rows }: { rows: StatRow[] }) {
  if (rows.length === 0) return null
  return (
    <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.04] px-6">
      {rows.map((r) => (
        <Stat key={r.label} label={r.label} value={r.value} />
      ))}
    </div>
  )
}
