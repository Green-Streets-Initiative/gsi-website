'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiError, categoryLabel, lastDay, post, shortDay, type ChallengeView, type EntryView } from '../_lib/api'
import { Player } from '../_components/Video'
import { INPUT, LABEL, PRIMARY } from '../_components/EmailGate'

type Score = { message: number; idea: number; nudge: number; craft: number; rule_flag: boolean; note: string | null }
type JudgeEntry = EntryView & { score: Score | null }
type JudgeData = { judge: { name: string }; challenge: ChallengeView; can_score: boolean; entries: JudgeEntry[] }

const CRITERIA: { key: keyof Omit<Score, 'rule_flag' | 'note'>; label: string; hint: string }[] = [
  { key: 'message', label: 'Gets the point across', hint: 'Clear and true. You know what it’s saying.' },
  { key: 'idea', label: 'Fresh idea', hint: 'Something you haven’t seen before.' },
  { key: 'nudge', label: 'Makes you want to go', hint: 'Would it get someone to walk, bike or ride?' },
  { key: 'craft', label: 'Made well', hint: 'For what it set out to do, on any budget.' },
]

/**
 * A judge's page, opened from their private link (the key rides after "#").
 * One ad at a time: watch, score four things from 1 to 5, save and go to the
 * next one not yet scored.
 */
export default function JudgePanel() {
  const [key, setKey] = useState<string | null>(null)
  const [data, setData] = useState<JudgeData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [at, setAt] = useState(0)

  useEffect(() => {
    const k = new URLSearchParams(window.location.hash.slice(1)).get('k')
    setKey(k)
    if (!k) { setError('This page opens from your judging link. Ask GSI for it.'); return }
    post<JudgeData>({ action: 'judge_read', key: k })
      .then((d) => {
        setData(d)
        const first = d.entries.findIndex((e) => !e.score)
        setAt(first >= 0 ? first : 0)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again in a minute.'))
  }, [])

  const scored = useMemo(() => data?.entries.filter((e) => e.score).length ?? 0, [data])

  if (error) return <Shell><p className="text-[16px] text-navy">{error}</p></Shell>
  if (!data || !key) return <Shell><div className="h-40" /></Shell>

  const c = data.challenge
  const total = data.entries.length
  const entry = data.entries[at]

  return (
    <Shell>
      <p className="text-[16px] text-ink-soft">Judging as <span className="font-bold text-navy">{data.judge.name}</span></p>
      <h1 className="mt-1 font-headline text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-tight text-navy">{c.title}</h1>
      <p className="mt-2 text-[16px] text-navy">
        {data.can_score
          ? `Score every ad by ${shortDay(c.judging_close_at)}. You can come back and change a score until then. Entries close ${lastDay(c.entries_close_at)}, so more may arrive.`
          : 'Judging has closed. Thank you!'}
      </p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-[15px] font-bold text-navy">
          <span>{scored} of {total} scored</span>
          {total > 0 && <span className="text-ink-soft">Ad {at + 1} of {total}</span>}
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-navy/[0.1]" role="progressbar" aria-valuenow={scored} aria-valuemin={0} aria-valuemax={total}>
          <div className="h-full rounded-full bg-forest" style={{ width: `${total ? (scored / total) * 100 : 0}%` }} />
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-8 text-[16px] text-navy">No entries yet. They show here as they come in.</p>
      ) : (
        <ScoreCard
          key={entry.id}
          c={c}
          entry={entry}
          canScore={data.can_score}
          judgeKey={key}
          onSaved={(score) => {
            const entries = data.entries.map((e) => (e.id === entry.id ? { ...e, score } : e))
            setData({ ...data, entries })
            const next = entries.findIndex((e, i) => i > at && !e.score)
            const wrap = entries.findIndex((e) => !e.score)
            setAt(next >= 0 ? next : wrap >= 0 ? wrap : Math.min(at + 1, total - 1))
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onPrev={at > 0 ? () => setAt(at - 1) : undefined}
          onNext={at < total - 1 ? () => setAt(at + 1) : undefined}
        />
      )}
    </Shell>
  )
}

function ScoreCard({ c, entry, canScore, judgeKey, onSaved, onPrev, onNext }: {
  c: ChallengeView
  entry: JudgeEntry
  canScore: boolean
  judgeKey: string
  onSaved: (s: Score) => void
  onPrev?: () => void
  onNext?: () => void
}) {
  const [s, setS] = useState<Score>(entry.score ?? { message: 0, idea: 0, nudge: 0, craft: 0, rule_flag: false, note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const complete = CRITERIA.every((k) => s[k.key] >= 1)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await post({ action: 'judge_score', key: judgeKey, entry_id: entry.id, ...s })
      onSaved(s)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Couldn’t save that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="mt-8">
      <p className="font-headline text-[1.5rem] font-extrabold leading-tight text-navy">{entry.title}</p>
      <p className="mt-1 text-[15px] text-ink-soft">{entry.credit_name} · {categoryLabel(c, entry.category)}</p>
      <div className="mt-4"><Player entry={entry} /></div>
      <p className="mt-4 text-[16px] text-navy"><span className="font-bold">What it says: </span>{entry.says}</p>

      <div className="mt-6 space-y-5 rounded-[20px] bg-white p-5">
        {CRITERIA.map((k) => (
          <fieldset key={k.key} disabled={!canScore}>
            <legend className={LABEL}>{k.label}</legend>
            <p className="text-[14px] text-ink-soft">{k.hint}</p>
            <div className="mt-2 flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setS({ ...s, [k.key]: n })} aria-pressed={s[k.key] === n}
                  className={`h-12 w-12 rounded-[12px] border-2 text-[18px] font-bold ${s[k.key] === n ? 'border-forest bg-forest text-white' : 'border-navy/[0.16] bg-cream text-navy hover:border-navy/40'}`}>
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="flex cursor-pointer items-start gap-3 text-[15px] text-navy">
          <input type="checkbox" disabled={!canScore} checked={s.rule_flag} onChange={(e) => setS({ ...s, rule_flag: e.target.checked })} className="mt-1 h-5 w-5 accent-forest" />
          <span>It breaks a rule: knocks drivers or anyone else, shows unsafe or illegal riding or walking, uses music or footage it can&rsquo;t, or runs well past {c.max_seconds ?? 60} seconds. If half the judges say so, it can&rsquo;t place.</span>
        </label>
        <label className="block">
          <span className={LABEL}>Note <span className="font-normal text-ink-soft">(optional, only GSI sees it)</span></span>
          <textarea disabled={!canScore} value={s.note ?? ''} onChange={(e) => setS({ ...s, note: e.target.value })} maxLength={500} rows={2} className={INPUT} />
        </label>
      </div>

      {error && <p role="alert" className="mt-3 text-[15px] font-semibold text-ep-danger">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canScore && (
          <button type="submit" disabled={busy || !complete} className={PRIMARY}>
            {busy ? 'Saving…' : 'Save and next'}
          </button>
        )}
        {onPrev && <button type="button" onClick={onPrev} className="inline-flex min-h-[48px] items-center px-3 font-bold text-navy hover:underline">&larr; Previous</button>}
        {onNext && <button type="button" onClick={onNext} className="inline-flex min-h-[48px] items-center px-3 font-bold text-navy hover:underline">Skip &rarr;</button>}
      </div>
    </form>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto w-full max-w-[760px] px-6 pb-20 pt-[92px]">{children}</div>
}
