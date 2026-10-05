'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardBody, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import { centsToDollars, formatDateShort } from '../_lib/portal-utils'

type LedgerRow = {
  id: string
  kind: 'opening' | 'topup' | 'hold' | 'release' | 'spend' | 'refund' | 'adjust'
  balance_change_cents: number
  held_change_cents: number
  balance_after_cents: number
  held_after_cents: number
  note: string | null
  created_at: string
}

const KIND_LABEL: Record<LedgerRow['kind'], string> = {
  opening: 'Starting balance',
  topup: 'Added to your rewards balance',
  hold: 'Set aside for a live prize',
  release: 'Returned from a live prize',
  spend: 'Paid to a winner',
  refund: 'Unpicked gift card returned',
  adjust: 'Adjustment by Green Streets',
}

function signed(cents: number): string {
  if (cents === 0) return ''
  return `${cents > 0 ? '+' : '−'}${centsToDollars(Math.abs(cents))}`
}

/**
 * Every change to the rewards balance, newest first (reward_pool_ledger).
 * "Available after" is what the Billing tiles call "Available": the balance
 * minus what is set aside for live prizes, so the statement and the tiles
 * always agree (the row carries both, balance_after and held_after).
 */
export default function PoolStatement({ poolId }: { poolId: string }) {
  const [rows, setRows] = useState<LedgerRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase
      .from('reward_pool_ledger')
      .select('id, kind, balance_change_cents, held_change_cents, balance_after_cents, held_after_cents, note, created_at')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setFailed(true)
          setRows([])
          return
        }
        setRows((data ?? []) as LedgerRow[])
      })
    return () => {
      cancelled = true
    }
  }, [poolId])

  function exportCsv() {
    if (!rows) return
    const header = ['Date', 'What happened', 'Change', 'Available after', 'Set aside after', 'Note']
    const lines = rows.map((r) => [
      new Date(r.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' }),
      KIND_LABEL[r.kind],
      (r.balance_change_cents / 100).toFixed(2),
      ((r.balance_after_cents - r.held_after_cents) / 100).toFixed(2),
      (r.held_after_cents / 100).toFixed(2),
      r.note ?? '',
    ])
    const csv = [header, ...lines]
      .map((l) => l.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(','))
      .join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'rewards-balance-statement.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const visible = (rows ?? []).filter((r) => !(r.kind === 'opening' && r.balance_change_cents === 0))

  return (
    <Card>
      <CardHead
        title="Rewards balance statement"
        sub="Every top-up, set-aside and payout"
        action={
          visible.length > 0 ? (
            <Button variant="ghost" size="sm" icon={Download} onClick={exportCsv}>
              Export CSV
            </Button>
          ) : undefined
        }
      />
      <CardBody>
        {rows === null && <p className="text-[13.5px] text-ink-muted">Loading the statement...</p>}
        {failed && (
          <p className="text-[13.5px] text-ink-muted">Couldn&apos;t load the statement. Reload to try again.</p>
        )}
        {rows !== null && !failed && visible.length === 0 && (
          <p className="text-[13.5px] text-ink-muted">Nothing yet. Top-ups and prize payouts will show up here.</p>
        )}
        {visible.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead>
                <tr className="text-[12.5px] font-semibold text-ink-muted">
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">What happened</th>
                  <th className="pb-2 text-right font-semibold">Available after</th>
                  <th className="pb-2 text-right font-semibold">Set aside</th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 50).map((r) => (
                  <tr key={r.id} className="border-t border-line-2 align-top">
                    <td className="whitespace-nowrap py-2 text-ink-muted">{formatDateShort(r.created_at)}</td>
                    <td className="py-2 text-ink">
                      {KIND_LABEL[r.kind]}
                      {r.note && r.kind !== 'topup' && <div className="text-[12px] text-ink-muted">{r.note}</div>}
                    </td>
                    <td className="py-2 text-right">
                      <div className="font-semibold text-ink">{signed(r.balance_change_cents)}</div>
                      <div className="text-[12px] text-ink-muted">
                        {centsToDollars(r.balance_after_cents - r.held_after_cents)}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <div className="font-semibold text-ink">{signed(r.held_change_cents)}</div>
                      <div className="text-[12px] text-ink-muted">{centsToDollars(r.held_after_cents)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length > 50 && (
              <p className="mt-2 text-[12.5px] text-ink-muted">Showing the latest 50. Export for the full statement.</p>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
