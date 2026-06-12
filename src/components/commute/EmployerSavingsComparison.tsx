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
      <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-7 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
        <div className="mb-4 text-[0.9375rem] font-bold text-[#191A2E]">
          Your estimated annual savings
        </div>
        <SavingsColumn data={withBenefits} label="With your benefits" />
      </div>
    )
  }

  // Premium tier: side-by-side
  return (
    <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-7 shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
      <div className="mb-4 text-[0.9375rem] font-bold text-[#191A2E]">
        Estimated annual savings
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <SavingsColumn data={withoutBenefits} label="Without your benefits" muted />
        <SavingsColumn data={withBenefits} label="With your benefits" />
      </div>
      {extraSavings > 0 && (
        <div className="mt-5 rounded-xl border border-[rgba(45,106,79,0.12)] bg-[#E7F0EA] px-5 py-4 text-center">
          <div className="text-[1.25rem] font-extrabold text-[#2D6A4F]">
            +{fmt(extraSavings)}/year
          </div>
          <div className="mt-1 text-[0.8125rem] text-[#5A5C6E]">
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
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A5C6E]">
        {label}
      </div>
      <div className={`mb-3 rounded-xl px-4 py-3 text-center ${
        muted
          ? 'border border-[rgba(25,26,46,0.06)] bg-[#FAFBF8]'
          : 'border border-[rgba(45,106,79,0.12)] bg-[#E7F0EA]'
      }`}>
        <div className={`text-[1.75rem] font-extrabold leading-none tracking-tighter ${
          muted ? 'text-[#8A8B9A]' : 'text-[#2D6A4F]'
        }`}>
          {fmt(data.net)}
        </div>
        <div className={`mt-1 text-[0.7rem] ${muted ? 'text-[#8A8B9A]' : 'text-[#2D6A4F]/60'}`}>
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
      <span className="text-[#5A5C6E]">{label}</span>
      <span className={positive ? 'font-semibold text-[#2D6A4F]' : 'font-semibold text-[#B3361F]'}>
        {value}
      </span>
    </div>
  )
}
