/**
 * Category colors for the two surfaces the events tree renders on. The
 * registries in events.ts / ride-style.ts carry `color` (tuned for navy,
 * unchanged) and `ink` (a darker companion that reads on white and cream).
 * Pure functions, no React, so the calendar dots and the cards share them.
 */
import type { TypeMeta } from './events'
import { RIDE_STYLE_COLOR, RIDE_STYLE_INK, type RideStyle } from './ride-style'

export type EventsTone = 'dark' | 'light'

export function typeInk(meta: TypeMeta, tone: EventsTone): string {
  return tone === 'light' ? meta.ink : meta.color
}

export function tagInk(tm: { color: string; bg: string; ink: string; inkBg: string }, tone: EventsTone): { color: string; bg: string } {
  return tone === 'light' ? { color: tm.ink, bg: tm.inkBg } : { color: tm.color, bg: tm.bg }
}

export function rideStyleInk(level: RideStyle, tone: EventsTone): string {
  return tone === 'light' ? RIDE_STYLE_INK[level] : RIDE_STYLE_COLOR[level]
}

/**
 * Alpha suffixes appended to a 6-digit hex ink: the icon tile behind a type
 * glyph, the flyer thumbnail frame, and the Spotlight card's fill and line.
 * Dark keeps the suffixes the components always used.
 */
export const TINT: Record<EventsTone, { tile: string; thumb: string; spotBg: string; spotLine: string }> = {
  dark: { tile: '29', thumb: '14', spotBg: '12', spotLine: '55' },
  light: { tile: '1F', thumb: '14', spotBg: '0F', spotLine: '40' },
}
