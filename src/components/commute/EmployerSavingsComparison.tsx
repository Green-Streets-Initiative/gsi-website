'use client'

interface SavingsData {
  net: number
  fuelSavings: number
  maintSavings: number
  parkingSavings: number
  transitCost: number
  isRideshare: boolean
  rideshareSavings: number
  fuelLabel: string
  transitLabel: string
  isActive: boolean
}

interface EmployerSavingsComparisonProps {
  withoutBenefits: SavingsData
  withBenefits: SavingsData
  companyName: string
  showComparison: boolean // false for basic tier — show only "with benefits"
}

const fmt = (n: number) =>
  n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`

export default function EmployerSavingsComparison({
  withoutBenefits,
  withBenefits,
  companyName,
  showComparison,
}: EmployerSavingsComparisonProps) {
  const extraSavings = withBenefits.net - withoutBenefits.net

  if (!showComparison) {
    // Basic tier: single column
    return (
      <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
        <div className="mb-4 font-display text-[0.9375rem] font-bold text-white">
          Your estimated annual savings
        </div>
        <SavingsColumn data={withBenefits} label="With your benefits" />
      </div>
    )
  }

  // Premium tier: side-by-side
  return (
    <div className="rounded-2xl border border-white/[0.12] bg-[#242538] p-7">
      <div className="mb-4 font-display text-[0.9375rem] font-bold text-white">
        Estimated annual savings
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SavingsColumn data={withoutBenefits} label="Without your benefits" muted />
        <SavingsColumn data={withBenefits} label="With your benefits" />
      </div>
      {extraSavings > 0 && (
        <div className="mt-5 rounded-xl border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)] px-5 py-4 text-center">
          <div className="font-display text-[1.25rem] font-extrabold text-[#BAF14D]">
            +{fmt(extraSavings)}/year
          </div>
          <div className="mt-1 text-[0.8125rem] text-white/60">
            {companyName} benefits save you an extra {fmt(extraSavings)} per year
          </div>
        </div>
      )}
    </div>
  )
}

function SavingsColumn({ data, label, muted }: { data: SavingsData; label: string; muted?: boolean }) {
  return (
    <div className={muted ? 'opacity-50' : ''}>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">
        {label}
      </div>
      <div className={`mb-3 rounded-xl px-4 py-3 text-center ${
        muted
          ? 'border border-white/[0.07] bg-white/[0.03]'
          : 'border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.08)]'
      }`}>
        <div className={`font-display text-[1.75rem] font-extrabold leading-none tracking-tighter ${
          muted ? 'text-white/60' : 'text-[#BAF14D]'
        }`}>
          {fmt(data.net)}
        </div>
        <div className={`mt-1 text-[0.7rem] ${muted ? 'text-white/50' : 'text-[rgba(186,241,77,0.5)]'}`}>
          per year
        </div>
      </div>
      <div className="space-y-1.5">
        {data.isRideshare ? (
          <Row label="Rideshare savings" value={`+${fmt(data.rideshareSavings)}`} positive />
        ) : (
          <>
            <Row label={data.fuelLabel} value={`+${fmt(data.fuelSavings)}`} positive />
            <Row label="Maintenance" value={`+${fmt(data.maintSavings)}`} positive />
            {data.parkingSavings > 0 && (
              <Row label="Parking" value={`+${fmt(data.parkingSavings)}`} positive />
            )}
          </>
        )}
        {!data.isActive && data.transitCost > 0 && (
          <Row label={data.transitLabel} value={`-${fmt(data.transitCost)}`} />
        )}
      </div>
    </div>
  )
}

function Row({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <div className="flex justify-between text-[0.8125rem]">
      <span className="text-white/60">{label}</span>
      <span className={positive ? 'font-semibold text-[#BAF14D]' : 'font-semibold text-[#FF6B6B]'}>
        {value}
      </span>
    </div>
  )
}
