'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardBody, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import { HELP_TOPIC_TAXES, openPortalHelp } from '../_components/HelpDrawer'
import { centsToDollars, formatDateShort } from '../_lib/portal-utils'

export const WINNERS_STATEMENT_ID = 'winners-statement'

type StatementRow = {
  winner_id: string
  name: string
  email: string | null
  challenge: string
  reward: string
  value_cents: number
  kind: 'gift_card' | 'handed_out'
  date: string
  status: 'pending' | 'claimed' | 'delivered' | 'handed_out' | 'forfeited' | 'expired'
}

type Statement = {
  ok: boolean
  reason?: string
  year: number
  rows: StatementRow[]
  winners: number
  total_cents: number
}

const KIND_LABEL: Record<StatementRow['kind'], string> = {
  gift_card: 'Gift card',
  handed_out: 'Handed out by you',
}

const STATUS_LABEL: Record<StatementRow['status'], string> = {
  pending: 'Not claimed yet',
  claimed: 'Claimed, card on the way',
  delivered: 'Gift card delivered',
  handed_out: 'Handed out',
  forfeited: 'Forfeited (not claimed in time)',
  expired: 'Expired (card never picked)',
}

const NOT_PAID: StatementRow['status'][] = ['forfeited', 'expired']

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'employer'
  )
}

/**
 * Who received a reward from this employer's challenges in a given year,
 * for payroll (Keith 2026-09-30): rewards to employees are taxable pay, and
 * this is the statement the Help topic "Taxes on rewards" points to. Data comes
 * from get_employer_winners_statement (Shift 01043); forfeited and expired
 * rows are listed so the record is complete, but they are not in the totals.
 */
export default function WinnersStatement({ groupId, company }: { groupId: string; company: string }) {
  const thisYear = new Date().getFullYear()
  const years = [thisYear, thisYear - 1, thisYear - 2]
  const [year, setYear] = useState(thisYear)
  // The result remembers which year it is for, so switching years shows
  // "Loading" by comparison instead of resetting state inside the effect.
  const [result, setResult] = useState<{ year: number; statement: Statement | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('get_employer_winners_statement', { p_group_id: groupId, p_year: year })
      .then(({ data, error }) => {
        if (cancelled) return
        const s = data as Statement | null
        // Before migration 01043 lands the function does not exist: show the
        // year as empty rather than as an error.
        const notThereYet = !!error && /PGRST202|PGRST205|42P01|42883|does not exist|schema cache/i.test(`${error.code} ${error.message}`)
        if (notThereYet) {
          setResult({ year, statement: { ok: true, year, rows: [], winners: 0, total_cents: 0 } as Statement })
          return
        }
        setResult({ year, statement: error || !s || !s.ok ? null : s })
      })
    return () => {
      cancelled = true
    }
  }, [groupId, year])

  const loaded = result !== null && result.year === year
  const statement = loaded ? result.statement : null
  const failed = loaded && result.statement === null
  const rows = statement?.rows ?? []

  function exportCsv() {
    if (!statement) return
    const header = ['Name', 'Email', 'Challenge', 'Reward', 'Value (USD)', 'Kind', 'Date', 'Status', 'Counted in total']
    const lines = rows.map((r) => [
      r.name,
      r.email ?? '',
      r.challenge,
      r.reward,
      (r.value_cents / 100).toFixed(2),
      KIND_LABEL[r.kind],
      new Date(r.date).toLocaleDateString('en-US', { timeZone: 'America/New_York' }),
      STATUS_LABEL[r.status] ?? r.status,
      NOT_PAID.includes(r.status) ? 'No' : 'Yes',
    ])
    const totals = [
      'Total',
      '',
      '',
      `${statement.winners} winner${statement.winners === 1 ? '' : 's'}`,
      (statement.total_cents / 100).toFixed(2),
      '',
      '',
      '',
      '',
    ]
    const csv = [header, ...lines, totals].map((l) => l.map(csvCell).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${fileSlug(company)}-rewards-statement-${statement.year}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const yearSelect = (
    <select
      aria-label="Statement year"
      className="rounded-[10px] border border-line bg-surface px-3 py-[7px] text-[13px] font-semibold text-ink outline-none focus:border-accent"
      value={year}
      onChange={(e) => setYear(Number(e.target.value))}
    >
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  )

  return (
    <Card id={WINNERS_STATEMENT_ID}>
      <CardHead
        title="Winners statement"
        sub="Who received a reward, for payroll"
        action={
          <div className="flex items-center gap-2">
            {yearSelect}
            {rows.length > 0 && (
              <Button variant="ghost" size="sm" icon={Download} onClick={exportCsv}>
                Export CSV
              </Button>
            )}
          </div>
        }
      />
      <CardBody>
        {!statement && !failed && <p className="text-[13.5px] text-ink-muted">Loading the statement...</p>}
        {failed && (
          <p className="text-[13.5px] text-ink-muted">
            Couldn&apos;t load the statement. Reload to try again, or write to info@gogreenstreets.org.
          </p>
        )}
        {statement && rows.length === 0 && (
          <p className="text-[13.5px] text-ink-muted">No rewards were paid out in {statement.year}.</p>
        )}
        {statement && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="text-[12.5px] font-semibold text-ink-muted">
                  <th className="pb-2 font-semibold">Name</th>
                  <th className="pb-2 font-semibold">Email</th>
                  <th className="pb-2 font-semibold">Challenge</th>
                  <th className="pb-2 font-semibold">Reward</th>
                  <th className="pb-2 text-right font-semibold">Value</th>
                  <th className="pb-2 font-semibold">Kind</th>
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const notPaid = NOT_PAID.includes(r.status)
                  return (
                    <tr key={r.winner_id} className={`border-t border-line-2 align-top ${notPaid ? 'text-ink-muted' : 'text-ink'}`}>
                      <td className="py-2 pr-3 font-semibold">{r.name}</td>
                      <td className="py-2 pr-3">{r.email || <span className="text-ink-muted">Not shared</span>}</td>
                      <td className="py-2 pr-3">{r.challenge}</td>
                      <td className="py-2 pr-3">{r.reward}</td>
                      <td className={`whitespace-nowrap py-2 pr-3 text-right ${notPaid ? 'line-through' : 'font-semibold'}`}>
                        {centsToDollars(r.value_cents)}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3">{KIND_LABEL[r.kind]}</td>
                      <td className="whitespace-nowrap py-2 pr-3">{formatDateShort(r.date)}</td>
                      <td className="py-2">{STATUS_LABEL[r.status] ?? r.status}</td>
                    </tr>
                  )
                })}
                <tr className="border-t-2 border-line font-semibold text-ink">
                  <td className="py-2.5 pr-3" colSpan={3}>
                    Total for {statement.year}
                  </td>
                  <td className="py-2.5 pr-3">
                    {statement.winners} winner{statement.winners === 1 ? '' : 's'}
                  </td>
                  <td className="whitespace-nowrap py-2.5 pr-3 text-right">{centsToDollars(statement.total_cents)}</td>
                  <td colSpan={3} />
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-muted">
              Dates are Eastern time. Forfeited and expired rewards are listed for the record but not counted in the
              total. Values are the face value of the gift card; rewards you hand out yourself show $0 here, so add
              their cash value in payroll.
            </p>
          </div>
        )}
        <p className="mt-4 border-t border-line-2 pt-3 text-[12.5px] leading-[1.5] text-ink-muted">
          Rewards count as taxable pay for the people who receive them.{' '}
          <button
            type="button"
            onClick={() => openPortalHelp(HELP_TOPIC_TAXES)}
            className="font-semibold text-accent hover:underline"
          >
            How taxes on rewards work
          </button>
        </p>
      </CardBody>
    </Card>
  )
}
