export default function ImpactTicker() {
  const items = [
    '4,200+ active trips this month',
    '12 Greater Boston neighborhoods',
    '$18,400 saved by commuters',
    '2.6 metric tons of CO₂ avoided',
    'Helping active commuters since 2006',
    'Walk/Ride Days — returning via Shift',
  ]

  const row = items.map((text, i) => (
    <div key={i} className="flex items-center gap-6 px-4">
      <span className="whitespace-nowrap font-display text-[13px] font-bold tracking-wide text-navy">
        {text}
      </span>
      <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-navy/30" />
    </div>
  ))

  return (
    <section className="overflow-hidden bg-lime py-3.5">
      <div className="ticker-track">
        {row}
        {row}
      </div>
    </section>
  )
}
