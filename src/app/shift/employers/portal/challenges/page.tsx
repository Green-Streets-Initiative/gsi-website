'use client'

import { useState, useCallback } from 'react'
import {
  Trophy,
  Plus,
  Calendar,
  Gift,
  BarChart3,
  Pencil,
  X,
  Check,
} from 'lucide-react'
import PortalPageHead from '../_components/PortalPageHead'
import { usePortal } from '../_lib/portal-context'
import { Card, CardHead } from '@/components/employer/Card'
import Badge from '@/components/employer/Badge'
import Button from '@/components/employer/Button'
import { supabase } from '@/lib/supabase'
import {
  PRIZE_METRIC_LABELS,
  PRIZE_METRIC_UNITS,
  EMPTY_PRIZE_FORM,
} from '../_lib/portal-constants'
import { formatDate } from '../_lib/portal-utils'
import type {
  Challenge,
  PrizeFormState,
  PrizeMetric,
  AwardMode,
  ChallengePrize,
  PrizeWinner,
} from '../_lib/portal-types'

function statusOf(c: Challenge): { label: string; tone: 'success' | 'info' | 'neutral' } {
  const now = new Date()
  const s = new Date(c.starts_at)
  const e = new Date(c.ends_at)
  if (now < s) return { label: 'Scheduled', tone: 'info' }
  if (now > e) return { label: 'Ended', tone: 'neutral' }
  return { label: 'Active', tone: 'success' }
}

export default function ChallengesPage() {
  const {
    group,
    challenge,
    setChallenge,
    challengePrizes,
    setChallengePrizes,
    prizeWinnersMap,
    setPrizeWinnersMap,
    rewardPool,
    tierAtLeast,
    refreshPool,
  } = usePortal()

  const [builderOpen, setBuilderOpen] = useState(false)
  const [form, setForm] = useState({
    name: '',
    starts_at: '',
    ends_at: '',
    prize_description: '',
    public_leaderboard: false,
  })
  const [prizeForms, setPrizeForms] = useState<PrizeFormState[]>([])
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [drawingPrizeId, setDrawingPrizeId] = useState<string | null>(null)

  const set = (k: string, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }))
  const canSave = form.name.trim() && form.starts_at && form.ends_at

  const openEditor = () => {
    if (challenge) {
      setForm({
        name: challenge.name,
        starts_at: challenge.starts_at.split('T')[0],
        ends_at: challenge.ends_at.split('T')[0],
        prize_description: challenge.prize_description || '',
        public_leaderboard: challenge.public_leaderboard,
      })
      setPrizeForms(
        challengePrizes.map((p) => ({
          id: p.id,
          name: p.name,
          award_mode: p.award_mode,
          metric: p.metric,
          min_threshold:
            p.min_threshold != null ? String(p.min_threshold) : '50',
          winner_count: String(p.winner_count),
          funded_from_pool: p.funded_from_pool,
          amount_dollars: p.amount_cents
            ? String(p.amount_cents / 100)
            : '25',
          prize_description: p.prize_description || '',
          auto_draw: p.auto_draw,
        })),
      )
      setEditMode(true)
    } else {
      setForm({
        name: '',
        starts_at: '',
        ends_at: '',
        prize_description: '',
        public_leaderboard: false,
      })
      setPrizeForms([])
      setEditMode(false)
    }
    setBuilderOpen(true)
  }

  const addPrize = () =>
    setPrizeForms((prev) => [...prev, { ...EMPTY_PRIZE_FORM }])

  const updatePrize = (idx: number, patch: Partial<PrizeFormState>) =>
    setPrizeForms((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    )

  const removePrize = (idx: number) =>
    setPrizeForms((prev) => prev.filter((_, i) => i !== idx))

  const save = useCallback(async () => {
    if (!group || !canSave) return
    setSaving(true)
    try {
      const payload = {
        group_id: group.id,
        name: form.name.trim(),
        metric: 'pct_non_car',
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at + 'T23:59:59').toISOString(),
        is_public: false,
        event_type: 'employer',
        prize_description: form.prize_description.trim() || null,
      }

      let competitionId: string | null = null

      if (challenge && editMode) {
        await supabase
          .from('competitions')
          .update(payload)
          .eq('id', challenge.id)
        setChallenge({
          ...challenge,
          name: payload.name,
          starts_at: payload.starts_at,
          ends_at: payload.ends_at,
          prize_description: payload.prize_description,
        })
        competitionId = challenge.id
      } else {
        const { data } = await supabase
          .from('competitions')
          .insert(payload)
          .select('id, name, metric, starts_at, ends_at, prize_description')
          .single()
        if (data) {
          setChallenge({ ...data, public_leaderboard: false })
          competitionId = data.id
        }
      }

      // Save prizes
      if (competitionId && tierAtLeast('premium') && prizeForms.length > 0) {
        for (let i = 0; i < prizeForms.length; i++) {
          const pf = prizeForms[i]
          const prizePayload = {
            competition_id: competitionId,
            group_id: group.id,
            name: pf.name.trim(),
            award_mode: pf.award_mode,
            metric: pf.metric,
            min_threshold:
              pf.award_mode === 'drawing' && pf.min_threshold
                ? parseFloat(pf.min_threshold)
                : null,
            winner_count: parseInt(pf.winner_count, 10) || 1,
            funded_from_pool: pf.funded_from_pool,
            amount_cents:
              pf.funded_from_pool && pf.amount_dollars
                ? Math.round(parseFloat(pf.amount_dollars) * 100)
                : null,
            prize_description: !pf.funded_from_pool
              ? pf.prize_description.trim() || null
              : null,
            auto_draw: pf.auto_draw,
            display_order: i,
          }
          if (pf.id) {
            await supabase
              .from('employer_challenge_prizes')
              .update(prizePayload)
              .eq('id', pf.id)
          } else {
            const { data } = await supabase
              .from('employer_challenge_prizes')
              .insert(prizePayload)
              .select('id')
              .single()
            if (data) prizeForms[i] = { ...pf, id: data.id }
          }
        }
        // Delete removed prizes
        const formIds = new Set(
          prizeForms.filter((f) => f.id).map((f) => f.id),
        )
        for (const existing of challengePrizes) {
          if (!formIds.has(existing.id)) {
            await supabase
              .from('employer_challenge_prizes')
              .delete()
              .eq('id', existing.id)
          }
        }
        // Refresh
        const { data: refreshed } = await supabase
          .from('employer_challenge_prizes')
          .select('*')
          .eq('competition_id', competitionId)
          .order('display_order')
        if (refreshed) setChallengePrizes(refreshed as ChallengePrize[])
      }

      // Public leaderboard
      const wasPublic = group.public_leaderboard ?? false
      const wantsPublic = form.public_leaderboard
      if (wantsPublic !== wasPublic) {
        await supabase
          .from('groups')
          .update({ public_leaderboard: wantsPublic })
          .eq('id', group.id)
        const now = new Date().toISOString()
        const { data: flagship } = await supabase
          .from('competitions')
          .select('id, matchup_group_ids')
          .eq('is_public', true)
          .is('group_id', null)
          .gte('ends_at', now)
          .order('starts_at', { ascending: true })
          .limit(1)
          .single()
        if (flagship) {
          const currentIds: string[] = flagship.matchup_group_ids ?? []
          let newIds: string[]
          if (wantsPublic && !currentIds.includes(group.id)) {
            newIds = [...currentIds, group.id]
          } else if (!wantsPublic) {
            newIds = currentIds.filter((id) => id !== group.id)
          } else {
            newIds = currentIds
          }
          if (newIds !== currentIds) {
            await supabase
              .from('competitions')
              .update({ matchup_group_ids: newIds })
              .eq('id', flagship.id)
          }
        }
      }

      setBuilderOpen(false)
    } finally {
      setSaving(false)
    }
  }, [
    group,
    canSave,
    form,
    challenge,
    editMode,
    prizeForms,
    challengePrizes,
    tierAtLeast,
    setChallenge,
    setChallengePrizes,
  ])

  async function drawPrize(prizeId: string) {
    setDrawingPrizeId(prizeId)
    const { error } = await supabase.rpc('draw_employer_challenge_prizes', {
      p_prize_id: prizeId,
    })
    if (error) {
      console.error('Draw failed:', error.message)
      setDrawingPrizeId(null)
      return
    }
    const { data: updated } = await supabase
      .from('employer_challenge_prizes')
      .select('*')
      .eq('id', prizeId)
      .single()
    if (updated) {
      setChallengePrizes(
        challengePrizes.map((p) =>
          p.id === prizeId ? (updated as ChallengePrize) : p,
        ),
      )
    }
    const { data: winners } = await supabase
      .from('employer_prize_winners')
      .select('*')
      .eq('prize_id', prizeId)
    if (winners) {
      setPrizeWinnersMap({
        ...prizeWinnersMap,
        [prizeId]: winners as PrizeWinner[],
      })
    }
    if (rewardPool) await refreshPool()
    setDrawingPrizeId(null)
  }

  const st = challenge ? statusOf(challenge) : null

  return (
    <div className="grid gap-6">
      <PortalPageHead
        title="Challenges"
        subtitle="Create friendly competitions to drive participation"
        actions={
          !builderOpen && (
            <Button variant="primary" icon={Plus} onClick={openEditor}>
              {challenge ? 'Edit challenge' : 'Create a challenge'}
            </Button>
          )
        }
      />

      {/* Existing challenge */}
      {challenge && !builderOpen && (
        <Card pad>
          <div className="flex flex-wrap items-start justify-between gap-3.5">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2.5">
                <strong className="text-[16px]">{challenge.name}</strong>
                {st && (
                  <Badge tone={st.tone} dot={false}>
                    {st.label}
                  </Badge>
                )}
                {challenge.public_leaderboard && (
                  <Badge tone="info" dot={false}>
                    Public board
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3.5 text-[13px] text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} strokeWidth={1.75} />
                  {formatDate(challenge.starts_at)} →{' '}
                  {formatDate(challenge.ends_at)}
                </span>
                <span className="flex items-center gap-1.5">
                  <Gift size={14} strokeWidth={1.75} />
                  {challengePrizes.length}{' '}
                  {challengePrizes.length === 1 ? 'prize' : 'prizes'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Pencil}
                onClick={openEditor}
              >
                Edit
              </Button>
            </div>
          </div>

          {/* Prize list */}
          {challengePrizes.length > 0 && (
            <div className="mt-5 grid gap-3 border-t border-line-2 pt-5">
              {challengePrizes.map((p) => {
                const winners = prizeWinnersMap[p.id] || []
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent-soft text-accent">
                        <Gift size={16} strokeWidth={1.75} />
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold">
                          {p.name}
                        </div>
                        <div className="text-[12.5px] text-ink-faint">
                          {p.award_mode === 'drawing'
                            ? 'Random drawing'
                            : 'Top performers'}{' '}
                          · {p.winner_count}{' '}
                          {p.winner_count === 1 ? 'winner' : 'winners'} ·{' '}
                          {p.funded_from_pool
                            ? 'Funded from pool'
                            : 'Self-fulfilled'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.draw_status === 'pending' && st?.label === 'Ended' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => drawPrize(p.id)}
                          disabled={drawingPrizeId === p.id}
                        >
                          {drawingPrizeId === p.id ? 'Drawing...' : 'Draw winners'}
                        </Button>
                      )}
                      {p.draw_status !== 'pending' && (
                        <Badge tone="success" dot={false}>
                          {winners.length} drawn
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* Empty state */}
      {!challenge && !builderOpen && (
        <Card pad className="py-16 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Trophy size={28} strokeWidth={1.75} />
          </div>
          <div className="mb-1.5 text-[16px] font-bold">
            No challenges yet
          </div>
          <p className="mx-auto mb-5 max-w-[40ch] text-[14px] text-ink-muted">
            Kick off a friendly competition to drive sign-ups and active trips.
            Set a date range and add optional prizes.
          </p>
          <Button variant="primary" icon={Plus} onClick={openEditor}>
            Create a challenge
          </Button>
        </Card>
      )}

      {/* Builder */}
      {builderOpen && (
        <Card>
          <CardHead
            title={editMode ? 'Edit challenge' : 'Your challenge'}
            sub="Set it up now — you can edit any time before it starts"
          />
          <div className="grid gap-5 px-6 py-5">
            {/* Name */}
            <div>
              <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                Challenge name <span className="text-ep-danger">*</span>
              </label>
              <input
                className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                placeholder="e.g. Summer Active Commute Challenge 2026"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                  Start date <span className="text-ep-danger">*</span>
                </label>
                <input
                  type="date"
                  className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                  value={form.starts_at}
                  onChange={(e) => set('starts_at', e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
                  End date <span className="text-ep-danger">*</span>
                </label>
                <input
                  type="date"
                  className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
                  value={form.ends_at}
                  onChange={(e) => set('ends_at', e.target.value)}
                />
              </div>
            </div>

            {/* Prizes */}
            {tierAtLeast('premium') && (
              <div>
                <div className="mb-2.5 text-[12.5px] font-semibold text-ink-muted">
                  Prizes{' '}
                  <span className="font-normal text-ink-faint">· optional</span>
                </div>
                <div className="grid gap-3">
                  {prizeForms.map((p, idx) => (
                    <PrizeEditor
                      key={idx}
                      prize={p}
                      onChange={(patch) => updatePrize(idx, patch)}
                      onRemove={() => removePrize(idx)}
                    />
                  ))}
                  <button
                    className="flex items-center gap-2 self-start rounded-[10px] border border-dashed border-line px-4 py-2.5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
                    onClick={addPrize}
                  >
                    <Plus size={16} strokeWidth={1.75} />
                    Add prize
                  </button>
                </div>
              </div>
            )}

            {/* Public leaderboard */}
            <div
              className="flex cursor-pointer items-start gap-3"
              onClick={() =>
                set('public_leaderboard', !form.public_leaderboard)
              }
            >
              <div
                className={`mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-2 transition-colors ${
                  form.public_leaderboard
                    ? 'border-accent bg-accent text-white'
                    : 'border-line'
                }`}
              >
                {form.public_leaderboard && (
                  <Check size={13} strokeWidth={2.5} />
                )}
              </div>
              <div>
                <div className="text-[14px] font-semibold">
                  Include our company in the Shift Your Summer public
                  leaderboard
                </div>
                <div className="mt-1 text-[13px] text-ink-muted">
                  Your company appears on the Corporate Challenge tab alongside
                  other employers. Individual employee data is never shown
                  publicly — only your aggregate Shift Rate and trip count.
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-line-2 px-6 py-4">
            <span className="text-[13px] text-ink-faint">
              {prizeForms.length}{' '}
              {prizeForms.length === 1 ? 'prize' : 'prizes'} ·{' '}
              {form.public_leaderboard
                ? 'Listed publicly'
                : 'Private to your team'}
            </span>
            <div className="flex gap-2.5">
              <Button
                variant="ghost"
                onClick={() => setBuilderOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                icon={Trophy}
                disabled={!canSave || saving}
                onClick={save}
              >
                {saving
                  ? 'Saving...'
                  : editMode
                    ? 'Save changes'
                    : 'Create challenge'}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function PrizeEditor({
  prize: p,
  onChange,
  onRemove,
}: {
  prize: PrizeFormState
  onChange: (patch: Partial<PrizeFormState>) => void
  onRemove: () => void
}) {
  const [open, setOpen] = useState(!p.id)

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-accent-soft text-accent">
            <Gift size={16} strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-[14px] font-semibold">
              {p.name || 'Untitled prize'}
            </div>
            <div className="text-[12.5px] text-ink-faint">
              {p.award_mode === 'drawing' ? 'Random drawing' : 'Top performers'}{' '}
              · {p.winner_count} {Number(p.winner_count) === 1 ? 'winner' : 'winners'} ·{' '}
              {p.funded_from_pool ? 'Funded from pool' : 'Self-fulfilled'}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setOpen(true)}>
            Edit
          </Button>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-faint hover:text-ep-danger"
            onClick={onRemove}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-accent bg-surface-2 p-[18px]">
      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
            Prize name
          </label>
          <input
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
            placeholder="e.g. Gift Card Drawing"
            value={p.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>

        <div>
          <div className="mb-2 text-[12.5px] font-semibold text-ink-muted">
            How are winners selected?
          </div>
          <div className="flex gap-2">
            {(['drawing', 'merit'] as AwardMode[]).map((mode) => (
              <button
                key={mode}
                className={`rounded-[10px] border px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  p.award_mode === mode
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line text-ink-muted hover:border-accent'
                }`}
                onClick={() => onChange({ award_mode: mode })}
              >
                {mode === 'drawing' ? 'Random drawing' : 'Top performers (merit)'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3.5">
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
              Metric
            </label>
            <select
              className="w-full rounded-[10px] border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              value={p.metric}
              onChange={(e) =>
                onChange({ metric: e.target.value as PrizeMetric })
              }
            >
              {Object.entries(PRIZE_METRIC_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
              Winners
            </label>
            <input
              type="number"
              min="1"
              className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
              value={p.winner_count}
              onChange={(e) => onChange({ winner_count: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
              Min {PRIZE_METRIC_LABELS[p.metric] ?? 'Shift Rate'}
            </label>
            <div className="flex items-center rounded-[10px] border border-line bg-surface">
              <input
                type="number"
                min="0"
                className="w-full border-0 bg-transparent px-3 py-2.5 text-[14px] text-ink outline-none"
                value={p.min_threshold}
                onChange={(e) =>
                  onChange({ min_threshold: e.target.value })
                }
              />
              <span className="pr-3 text-[14px] text-ink-faint">
                {PRIZE_METRIC_UNITS[p.metric] ?? '%'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[12.5px] font-semibold text-ink-muted">
            Fulfillment
          </div>
          <div className="flex gap-2">
            {(['pool', 'self'] as const).map((mode) => (
              <button
                key={mode}
                className={`rounded-[10px] border px-4 py-2.5 text-[13px] font-semibold transition-colors ${
                  (mode === 'pool') === p.funded_from_pool
                    ? 'border-accent bg-accent-soft text-accent-ink'
                    : 'border-line text-ink-muted hover:border-accent'
                }`}
                onClick={() =>
                  onChange({ funded_from_pool: mode === 'pool' })
                }
              >
                {mode === 'pool' ? 'Fund from pool' : 'Self-fulfilled'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">
            Prize description
          </label>
          <input
            className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none focus:border-accent"
            placeholder="e.g. Branded water bottle, gift card, etc."
            value={p.prize_description}
            onChange={(e) =>
              onChange({ prize_description: e.target.value })
            }
          />
        </div>

        <div
          className="flex cursor-pointer items-center gap-2.5"
          onClick={() => onChange({ auto_draw: !p.auto_draw })}
        >
          <div
            className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-2 transition-colors ${
              p.auto_draw
                ? 'border-accent bg-accent text-white'
                : 'border-line'
            }`}
          >
            {p.auto_draw && <Check size={13} strokeWidth={2.5} />}
          </div>
          <span className="text-[14px]">
            Automatically select winners when challenge ends
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-line-2 pt-3.5">
          <button
            className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-ep-danger hover:bg-ep-danger/10"
            onClick={onRemove}
          >
            <X size={15} strokeWidth={1.75} />
            Remove
          </button>
          <Button
            variant="primary"
            size="sm"
            icon={Check}
            onClick={() => setOpen(false)}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  )
}
