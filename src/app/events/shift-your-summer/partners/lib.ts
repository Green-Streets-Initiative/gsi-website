export type RoamMode = 'walk' | 'bike' | 'transit' | 'multi'

export function taglineFromDescription(description: string): string {
  const trimmed = description.trim()
  const dot = trimmed.indexOf('. ')
  if (dot === -1) return trimmed
  return trimmed.slice(0, dot + 1)
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

export function modeLabel(mode: string): string {
  switch (mode) {
    case 'walk':
      return 'Walk'
    case 'bike':
      return 'Bike'
    case 'transit':
      return 'Transit'
    case 'multi':
      return 'Multi-modal'
    default:
      return mode
  }
}

export function modeColor(mode: string): string {
  switch (mode) {
    case 'bike':
      return '#BAF14D'
    case 'walk':
      return '#52B788'
    case 'transit':
    case 'multi':
    default:
      return '#2966E5'
  }
}

export function eventBadgeText(
  eventDates: string | null,
  eventStart: string | null,
  eventEnd: string | null
): string | null {
  if (eventDates) return eventDates
  if (!eventStart || !eventEnd) return null
  const fmt = (iso: string) => {
    const d = new Date(iso + 'T00:00:00Z')
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
  const year = new Date(eventEnd + 'T00:00:00Z').getUTCFullYear()
  return `Limited time · ${fmt(eventStart)} – ${fmt(eventEnd)}, ${year}`
}
