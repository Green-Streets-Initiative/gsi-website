import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Shared seasonal leaderboard (Shift 01026): every employer on the public
// leaderboard that ran this season's challenge, ranked by the share of its
// team that took part, within size classes so small employers can win.
// Totals only. Private employers never appear.

export const revalidate = 600

type Row = {
  size_class: string
  class_order: number
  name: string
  slug: string | null
  logo_url: string | null
  members: number
  participants: number
  pct: number | null
}
type Board = {
  run: { id: string; label: string; title: string; slug: string; starts_on: string; ends_on: string }
  employers: Row[]
}

async function load(id: string): Promise<Board | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const sb = createServerSupabaseClient()
  const { data, error } = await sb.rpc('get_seasonal_leaderboard', { p_run_id: id })
  if (error || !data || 'error' in data) return null
  return data as Board
}

function day(s: string): string {
  return new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

export async function generateMetadata({ params }: { params: Promise<{ run: string }> }): Promise<Metadata> {
  const b = await load((await params).run)
  return {
    title: b ? `${b.run.title}, ${b.run.label}: workplace leaderboard` : 'Workplace leaderboard',
    description: b ? `Which workplaces had the most people take part in ${b.run.title}.` : undefined,
    robots: { index: false, follow: false },
  }
}

export default async function SeasonalBoardPage({ params }: { params: Promise<{ run: string }> }) {
  const b = await load((await params).run)
  if (!b) notFound()

  const classes = [...new Set(b.employers.map((e) => e.size_class))]

  // White sheet on the navy site shell, like the challenge rules page.
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="rounded-2xl bg-white p-6 shadow-lg sm:p-10">
        <p className="text-sm font-semibold text-emerald-700">Shift for Employers · {b.run.label}</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">{b.run.title}</h1>
        <p className="mt-1 text-[15px] text-gray-700">
          {day(b.run.starts_on)} to {day(b.run.ends_on)}. Workplaces are ranked by the share of their team who logged at
          least one trip that counts, and grouped by size so a small office can top its group.
        </p>

        {b.employers.length === 0 ? (
          <p className="mt-8 text-[15px] text-gray-700">
            No workplaces on the public leaderboard have joined this one yet.
          </p>
        ) : (
          classes.map((cls) => (
            <section key={cls} className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">Teams of {cls}</h2>
              <ol className="mt-3 grid gap-2">
                {b.employers
                  .filter((e) => e.size_class === cls)
                  .map((e, i) => (
                    <li key={`${cls}-${e.name}`} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3">
                      <span className="w-6 text-right text-[15px] font-bold tabular-nums text-gray-900">{i + 1}</span>
                      {e.logo_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.logo_url} alt="" className="h-8 w-8 rounded bg-white object-contain" />
                      )}
                      <span className="flex-1 text-[15px] font-semibold text-gray-900">{e.name}</span>
                      <span className="text-right text-[14px] tabular-nums text-gray-700">
                        <strong className="text-gray-900">{Math.round(e.pct ?? 0)}%</strong> took part
                      </span>
                    </li>
                  ))}
              </ol>
            </section>
          ))
        )}

        <p className="mt-10 text-[13px] text-gray-600">
          Only workplaces that chose to appear on public leaderboards are listed. Shift is a free app from Green Streets
          Initiative that records walks, bike rides and transit trips on its own.
        </p>
      </div>
    </main>
  )
}
