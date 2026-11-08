'use client'

import { useId, useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import type { CarChoice } from '@/lib/types/commute'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

/**
 * "Adjust costs": collapsed by default so the plan never starts from an
 * invented number. Holds the three inputs that change the driving row:
 * the car (gas, hybrid, electric, or no car, which takes the rows that
 * need one off the plan), parking per day (prefilled from the employer's
 * benefit or 0, never a guess; hidden with no car) and days a week.
 */
export default function AdjustCosts({
  vehicle,
  onVehicle,
  parkingPerDay,
  onParkingPerDay,
  parkingHint,
  daysPerWeek,
  onDaysPerWeek,
  defaultOpen = false,
  parkingFree,
  locale = 'en',
}: {
  vehicle: CarChoice
  onVehicle: (v: CarChoice) => void
  parkingPerDay: number
  onParkingPerDay: (n: number) => void
  /** Where the parking figure came from ("From Acme's benefits: free parking"). */
  parkingHint?: string | null
  daysPerWeek: number
  onDaysPerWeek: (n: number) => void
  /** Start open ("Add a parking cost" on the plan sends people here). */
  defaultOpen?: boolean
  /** The parking is known to be free (the employer's benefits say so). Without it, the hint is read for "free". */
  parkingFree?: boolean
  locale?: SiteLocale
}) {
  const t = translator(advisorStrings, locale)
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  // $0 means "free" only when the employer's benefits say so; otherwise it
  // is a cost nobody entered, and the comparison says that instead.
  const parkingKnownFree = parkingPerDay === 0 && (parkingFree ?? /free/i.test(parkingHint ?? ''))

  return (
    <div className="rounded-xl border border-[rgba(25,26,46,0.09)] bg-[#FAFBF8]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-[0.875rem] font-semibold text-[#191A2E]"
      >
        <span className="shrink-0 whitespace-nowrap">{t('costs.title')}</span>
        <span className="flex min-w-0 items-center gap-2 text-right text-[0.9375rem] font-normal text-[#5A5C6E]">
          {!open && `${vehicleLabel(vehicle, locale)}${vehicle === 'none' ? '' : ` · ${t('costs.parking_seg', { value: parkingPerDay > 0 ? t('costs.per_day', { amount: `$${parkingPerDay}` }) : parkingKnownFree ? t('costs.free') : t('costs.not_counted') })}`} · ${t(daysPerWeek === 1 ? 'costs.days_week_one' : 'costs.days_week_other', { n: daysPerWeek })}`}
          <CaretDown size={16} weight="regular" className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </span>
      </button>
      {open && (
        <div id={id} className="space-y-5 border-t border-[rgba(25,26,46,0.09)] px-4 py-4">
          <div>
            <div id={`${id}-car`} className="mb-2 text-[0.8125rem] font-semibold uppercase tracking-wider text-[#5A5C6E]">{t('costs.your_car')}</div>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${id}-car`}>
              {(['gas', 'hybrid', 'ev', 'none'] as CarChoice[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={vehicle === v}
                  onClick={() => onVehicle(v)}
                  className={`min-h-[40px] rounded-full border-[1.5px] px-4 text-[0.9375rem] font-semibold transition-colors ${
                    vehicle === v ? 'border-[#2D6A4F] bg-[#2D6A4F] text-white' : 'border-[rgba(25,26,46,0.15)] bg-white text-[#191A2E] hover:border-[rgba(25,26,46,0.3)]'
                  }`}
                >
                  {vehicleLabel(v, locale)}
                </button>
              ))}
            </div>
          </div>

          {vehicle !== 'none' && <div>
            <label htmlFor={`${id}-parking`} className="mb-2 block text-[0.8125rem] font-semibold uppercase tracking-wider text-[#5A5C6E]">
              {t('costs.parking_per_day')}
            </label>
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-lg font-bold text-[#2D6A4F]">$</span>
              <input
                id={`${id}-parking`}
                type="number"
                inputMode="decimal"
                min={0}
                max={80}
                step={1}
                value={parkingPerDay}
                onChange={(e) => onParkingPerDay(Math.max(0, Math.min(80, parseFloat(e.target.value) || 0)))}
                className="w-[88px] rounded-[10px] border-[1.5px] border-[rgba(25,26,46,0.15)] bg-white px-3 py-2.5 text-center text-[1rem] font-bold text-[#191A2E] outline-none focus:border-[#2D6A4F] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
              />
              <span className="text-[0.9375rem] text-[#191A2E]">{t(parkingPerDay === 0 ? (parkingKnownFree ? 'costs.a_day_free' : 'costs.a_day_not_counted') : 'costs.a_day')}</span>
            </div>
            {parkingHint && <p className="mt-1.5 text-[0.875rem] leading-snug text-[#5A5C6E]">{parkingHint}</p>}
          </div>}

          <div>
            <label htmlFor={`${id}-days`} className="mb-2 block text-[0.8125rem] font-semibold uppercase tracking-wider text-[#5A5C6E]">
              {t('costs.days_label')}
            </label>
            <div className="flex items-center gap-3">
              <input
                id={`${id}-days`}
                type="range"
                min={1}
                max={7}
                step={1}
                value={daysPerWeek}
                aria-valuetext={t(daysPerWeek === 1 ? 'costs.days_week_one' : 'costs.days_week_other', { n: daysPerWeek })}
                onChange={(e) => onDaysPerWeek(parseInt(e.target.value, 10))}
                className="w-full max-w-[260px] cursor-pointer appearance-none rounded-full bg-[rgba(25,26,46,0.12)] outline-none focus-visible:ring-2 focus-visible:ring-[#2D6A4F] focus-visible:ring-offset-4 focus-visible:ring-offset-[#FAFBF8] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-[3px] [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[#2D6A4F] [&::-webkit-slider-thumb]:shadow-[0_0_0_1.5px_#2D6A4F]"
                style={{ height: '6px' }}
              />
              <span className="w-16 text-[0.9375rem] font-bold text-[#191A2E]">{t(daysPerWeek === 1 ? 'costs.days_one' : 'costs.days_other', { n: daysPerWeek })}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function vehicleLabel(v: CarChoice, locale: SiteLocale = 'en'): string {
  const t = translator(advisorStrings, locale)
  return t(v === 'none' ? 'costs.car_none' : v === 'ev' ? 'costs.car_ev' : v === 'hybrid' ? 'costs.car_hybrid' : 'costs.car_gas')
}
