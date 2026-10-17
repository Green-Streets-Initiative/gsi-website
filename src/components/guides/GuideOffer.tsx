import { createServerSupabaseClient } from '@/lib/supabase-server'
import { longDateET } from '@/lib/campaigns/format'

/*
 * A live offer placed inside a guide where it fits the reader (a mover reading
 * about getting around, a student reading about campus parking). Renders only
 * while the campaign is enabled and inside its sign-up window, with the reward,
 * trip count and deadline read from the campaign row, so the card can't
 * outlive or misstate the offer. Copy follows the approved campaign wording.
 */

type Row = {
  enabled: boolean
  signup_start: string
  signup_end: string
  trips_required: number
  window_days: number
  value_cents: number
}

async function load(kind: 'newroutes' | 'semester'): Promise<Row | null> {
  try {
    const supabase = createServerSupabaseClient()
    const cols = 'enabled, signup_start, signup_end, trips_required, window_days, value_cents'
    const { data } =
      kind === 'newroutes'
        ? await supabase.from('newroutes_config').select(cols).eq('id', true).maybeSingle()
        : await supabase.from('campaigns').select(cols).eq('code', 'SEMESTER').maybeSingle()
    const row = data as Row | null
    if (!row?.enabled) return null
    const now = Date.now()
    if (now < new Date(row.signup_start).getTime() || now > new Date(row.signup_end).getTime()) return null
    return row
  } catch {
    return null
  }
}

export default async function GuideOffer({ kind, slug }: { kind: 'newroutes' | 'semester'; slug: string }) {
  const row = await load(kind)
  if (!row) return null
  const dollars = `$${Math.round(row.value_cents / 100)}`
  const deadline = longDateET(row.signup_end)
  const utm = new URLSearchParams({ utm_source: 'guide', utm_medium: 'offer', utm_content: slug })

  if (kind === 'newroutes') {
    utm.set('utm_campaign', 'newroutes')
    return (
      <div className="my-8 rounded-[14px] border border-forest/30 bg-forest/5 p-5 sm:p-6">
        <p className="mb-1 text-[1.0625rem] font-semibold leading-snug text-navy">
          Just moved? Unlock {dollars} for getting around.
        </p>
        <p className="mb-3 text-[0.9375rem] leading-relaxed text-navy">
          Take {row.trips_required} walking, biking or transit trips in your first {row.window_days} days on Shift and
          unlock a {dollars} reward: a gift card at a local shop, or a digital gift card you choose. Sign up by{' '}
          {deadline}.
        </p>
        <p className="mb-4 text-[0.875rem] leading-relaxed text-ink-soft">
          After you install, enter the code <strong className="font-semibold text-navy">NEWROUTES</strong> in the app
          so your reward is linked.
        </p>
        <a
          href={`https://shift.gogreenstreets.org/go/newroutes?${utm}`}
          className="inline-block rounded-full bg-forest px-5 py-2.5 text-[0.9375rem] font-semibold text-white hover:opacity-90"
        >
          Get Shift
        </a>
      </div>
    )
  }

  utm.set('utm_campaign', 'semester')
  return (
    <div className="my-8 rounded-[14px] border border-forest/30 bg-forest/5 p-5 sm:p-6">
      <p className="mb-1 text-[1.0625rem] font-semibold leading-snug text-navy">
        In college? Unlock {dollars} for getting to class.
      </p>
      <p className="mb-4 text-[0.9375rem] leading-relaxed text-navy">
        Sign up for Shift with your school email, take {row.trips_required} walking, biking or transit trips in{' '}
        {row.window_days} days, and unlock a {dollars} reward. Sign up by {deadline}.
      </p>
      <a
        href={`/shift-your-semester?${utm}`}
        className="inline-block rounded-full bg-forest px-5 py-2.5 text-[0.9375rem] font-semibold text-white hover:opacity-90"
      >
        See how it works
      </a>
    </div>
  )
}
