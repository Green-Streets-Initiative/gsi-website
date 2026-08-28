'use client'

interface BlockDef {
  i: number
  name: string | null
  mid: { lat: number; lng: number }
}

interface BlockCheck {
  block_index: number
  verdict: 'fine' | 'soso' | 'rough'
}

interface Props {
  blocks: BlockDef[]
  visitedBlocks: Set<number>
  blockChecks: BlockCheck[]
  onTap: (blockIndex: number) => void
}

const VERDICT_COLORS: Record<string, string> = {
  fine: 'bg-[#52B788] text-white',
  soso: 'bg-[#D97706] text-white',
  rough: 'bg-[#DC2626] text-white',
}

export default function BlockStrip({ blocks, visitedBlocks, blockChecks, onTap }: Props) {
  if (blocks.length === 0) return null

  const checksByBlock = new Map<number, string>()
  for (const c of blockChecks) {
    if (!checksByBlock.has(c.block_index)) {
      checksByBlock.set(c.block_index, c.verdict)
    }
  }

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-medium text-[#6B7280]">Blocks</p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {blocks.map((b) => {
          const verdict = checksByBlock.get(b.i)
          const walked = visitedBlocks.has(b.i)
          let className =
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold transition cursor-pointer '
          if (verdict) {
            className += VERDICT_COLORS[verdict]
          } else if (walked) {
            className += 'border-2 border-[#52B788] bg-white text-[#52B788]'
          } else {
            className += 'bg-gray-100 text-[#9CA3AF]'
          }
          return (
            <button
              key={b.i}
              onClick={() => onTap(b.i)}
              title={b.name ?? `Block ${b.i + 1}`}
              className={className}
            >
              {b.i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}
