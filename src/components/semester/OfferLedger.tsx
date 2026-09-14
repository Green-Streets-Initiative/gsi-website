import { LANE, RouteSegment } from '@/components/home/RouteLine'
import { SEMESTER_CAP, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS } from '@/lib/semester/campaign'

/*
 * The offer in four numbers, in the home page's ledger idiom. Static: every
 * figure comes from src/lib/semester/campaign.ts so the pages cannot drift
 * from the app. Shared by the hub and every school page.
 */
const ROWS: { value: string; label: string }[] = [
  { value: SEMESTER_REWARD, label: 'reward, unlocked' },
  { value: String(SEMESTER_TRIPS), label: 'active trips' },
  { value: String(SEMESTER_WINDOW_DAYS), label: 'days to take them' },
  { value: `First ${SEMESTER_CAP}`, label: 'to finish' },
]

export default function OfferLedger() {
  return (
    <section className="relative overflow-x-clip bg-cream">
      <div className={`relative mx-auto grid max-w-[1120px] ${LANE} px-6 lg:px-8`}>
        <RouteSegment shape="straight" />
        <div className="hidden md:block" />
        <div className="border-y border-navy/15 py-7">
          <dl className="grid grid-cols-2 gap-x-10 gap-y-5 md:grid-cols-4">
            {ROWS.map((r) => (
              <div key={r.label}>
                <dd className="font-serif text-[2rem] leading-none tracking-[-0.01em] text-navy md:text-[2.5rem]">{r.value}</dd>
                <dt className="mt-1 text-[13px] leading-snug text-ink-soft">{r.label}</dt>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[12px] text-ink-soft">
            For verified students, faculty, and staff at any Massachusetts college or university. One campaign code per account.
          </p>
        </div>
      </div>
    </section>
  )
}
