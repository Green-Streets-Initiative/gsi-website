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

export async function loadImageForPdf(
  url: string,
): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG'; width: number; height: number } | null> {
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()
    if (blob.type === 'image/svg+xml') return null
    const format = blob.type.includes('jpeg') ? 'JPEG' : 'PNG'
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject()
      reader.readAsDataURL(blob)
    })
    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.width, height: img.height })
      img.onerror = () => reject()
      img.src = dataUrl
    })
    return { dataUrl, format, width: dims.width, height: dims.height }
  } catch {
    return null
  }
}
