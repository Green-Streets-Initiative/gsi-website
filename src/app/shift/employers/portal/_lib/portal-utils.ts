import { MODE_LABEL, TIER_ORDER } from './portal-constants'
import type { Group, ImpactPreset } from './portal-types'

export function prettyMode(mode: string): string {
  return MODE_LABEL[mode] ?? mode
}

export function centsToDollars(cents: number | null | undefined): string {
  if (cents == null) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

// For contract/access dates stored as midnight UTC — rendering those in ET
// shows the previous day (a June 3 start reads "June 2"). Format in UTC so
// the calendar date matches what's on the invoice.
export function formatDateUTC(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  })
}

export function hasAccess(g: Group): boolean {
  if (g.status !== 'active' && g.status !== 'cancelled') return false
  if (!g.access_ends_at) return true
  return new Date(g.access_ends_at) > new Date()
}

export function isTierAtLeast(
  group: Group | null,
  required: 'starter' | 'basic' | 'standard' | 'premium',
): boolean {
  if (!group) return false
  return (TIER_ORDER[group.tier] ?? 0) >= TIER_ORDER[required]
}

export function resolveImpactWindow(
  preset: ImpactPreset,
  customStart: string,
  customEnd: string,
): { start: Date; end: Date; label: string } | null {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const quarterStartMonth = Math.floor(month / 3) * 3

  switch (preset) {
    case 'last_30': {
      const start = new Date(now.getTime() - 30 * 86400000)
      return { start, end: now, label: 'Last 30 days' }
    }
    case 'this_month': {
      const start = new Date(year, month, 1)
      return {
        start,
        end: now,
        label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }
    }
    case 'last_month': {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      return {
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      }
    }
    case 'this_quarter': {
      const start = new Date(year, quarterStartMonth, 1)
      const q = Math.floor(quarterStartMonth / 3) + 1
      return { start, end: now, label: `Q${q} ${year}` }
    }
    case 'last_quarter': {
      const prevQuarterStartMonth = quarterStartMonth - 3
      const base = new Date(year, prevQuarterStartMonth, 1)
      const end = new Date(year, quarterStartMonth, 1)
      const q = Math.floor(base.getMonth() / 3) + 1
      return { start: base, end, label: `Q${q} ${base.getFullYear()}` }
    }
    case 'ytd': {
      const start = new Date(year, 0, 1)
      return { start, end: now, label: `${year} year-to-date` }
    }
    case 'custom': {
      if (!customStart || !customEnd) return null
      const start = new Date(customStart + 'T00:00:00')
      const end = new Date(customEnd + 'T23:59:59')
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null
      return {
        start,
        end,
        label: `${start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} – ${end.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`,
      }
    }
  }
}

// ── Challenge dates are Eastern days ────────────────────────────────────
// A challenge "Oct 6 – Nov 2" runs from midnight Eastern on Oct 6 to
// 11:59:59 pm Eastern on Nov 2, matching how trips are counted (by Eastern
// calendar day) and how every other Shift competition ends (23:59 ET).

function etOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return (asUtc - utcMs) / 60000
}

/** 'YYYY-MM-DD' (an Eastern date) + wall time → ISO instant. */
function etWallToIso(date: string, h: number, m: number, s: number): string {
  const [y, mo, d] = date.split('-').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, m, s)
  const offset = etOffsetMinutes(guess)
  return new Date(guess - offset * 60000).toISOString()
}

export const etStartOfDayIso = (date: string) => etWallToIso(date, 0, 0, 0)
export const etEndOfDayIso = (date: string) => etWallToIso(date, 23, 59, 59)

/** ISO instant → the Eastern calendar date, 'YYYY-MM-DD', for date inputs. */
export function etDateInput(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso))
}
