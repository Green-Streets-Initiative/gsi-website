'use client'

import type { Mode } from '@/lib/types/commute'

type IconMode = Mode | 'drive' | 'carpool' | 'rideshare' | 'commuter_rail'

export default function ModeIcon({ mode, size = 28, className = '' }: { mode: IconMode; size?: number; className?: string }) {
  const base = `inline-block shrink-0 ${className}`
  switch (mode) {
    case 'drive':
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM80,160a12,12,0,1,1,12-12A12,12,0,0,1,80,160Zm96,0a12,12,0,1,1,12-12A12,12,0,0,1,176,160Z" />
        </svg>
      )
    case 'carpool':
      // Car with person — Phosphor CarProfile + person hint
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM80,160a12,12,0,1,1,12-12A12,12,0,0,1,80,160Zm96,0a12,12,0,1,1,12-12A12,12,0,0,1,176,160Z" />
          <circle cx="128" cy="96" r="10" />
          <circle cx="148" cy="96" r="10" />
        </svg>
      )
    case 'rideshare':
      // Phone/hail icon — simplified rideshare
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M240,112H229.2L201.42,49.5A16,16,0,0,0,186.8,40H69.2a16,16,0,0,0-14.62,9.5L26.8,112H16a8,8,0,0,0,0,16h8v80a16,16,0,0,0,16,16H64a16,16,0,0,0,16-16V192h96v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V128h8a8,8,0,0,0,0-16ZM69.2,56H186.8l24.89,56H44.31ZM80,160a12,12,0,1,1,12-12A12,12,0,0,1,80,160Zm96,0a12,12,0,1,1,12-12A12,12,0,0,1,176,160Z" />
          <circle cx="128" cy="96" r="10" />
        </svg>
      )
    case 'walk':
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M152,80a32,32,0,1,0-32-32A32,32,0,0,0,152,80Zm-8,24a8,8,0,0,0-8,8v40H104v-8a8,8,0,0,0-16,0v8H72a8,8,0,0,0,0,16H88v48a8,8,0,0,0,16,0V168h32v48a8,8,0,0,0,16,0V168h16a8,8,0,0,0,0-16H152V112A8,8,0,0,0,144,104Z" />
        </svg>
      )
    case 'bike':
    case 'ebike':
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M208,112a47.81,47.81,0,0,0-16.93,3.09L165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41l13.71,23.51L62.87,127.9A48,48,0,1,0,79,138.63l17.41-23.11,38.68,66.31A8,8,0,0,0,142,184a7.9,7.9,0,0,0,4-1.08,8,8,0,0,0,2.88-10.94l-38.15-65.42h57.55l11.06,19A48.09,48.09,0,1,0,208,112ZM80,160a32,32,0,1,1-7.34-20.42L55.08,161.84A8,8,0,0,0,61,175.16l17.58-22.26A31.84,31.84,0,0,1,80,160Zm128,32a32,32,0,0,1-21.64-55.64l14.91,25.62a8,8,0,0,0,13.82-8l-14.91-25.62A32,32,0,1,1,208,192Z" />
        </svg>
      )
    case 'transit':
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M184,32H72A32,32,0,0,0,40,64V208a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16V192h64v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V64A32,32,0,0,0,184,32ZM72,48H184a16,16,0,0,1,16,16v48H56V64A16,16,0,0,1,72,48ZM56,176V128H200v48Zm144,32H176V192h24Zm-120,0H56V192H80ZM92,160a12,12,0,1,1-12-12A12,12,0,0,1,92,160Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,188,160Z" />
        </svg>
      )
    case 'bus':
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M184,32H72A32,32,0,0,0,40,64V208a16,16,0,0,0,16,16H80a16,16,0,0,0,16-16V192h64v16a16,16,0,0,0,16,16h24a16,16,0,0,0,16-16V64A32,32,0,0,0,184,32ZM72,48H184a16,16,0,0,1,16,16v48H56V64A16,16,0,0,1,72,48ZM56,176V128H200v48Zm144,32H176V192h24Zm-120,0H56V192H80ZM92,160a12,12,0,1,1-12-12A12,12,0,0,1,92,160Zm96,0a12,12,0,1,1-12-12A12,12,0,0,1,188,160Z" />
        </svg>
      )
    case 'commuter_rail':
      // Train icon — Phosphor Train
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M200,48H56A24,24,0,0,0,32,72V200a24,24,0,0,0,24,24h8.11l-10.5,14A8,8,0,0,0,60,248H68a8,8,0,0,0,6.4-3.2L93.33,224h69.34l18.93,20.8A8,8,0,0,0,188,248h8a8,8,0,0,0,6.4-10L191.89,224H200a24,24,0,0,0,24-24V72A24,24,0,0,0,200,48ZM56,64H200a8,8,0,0,1,8,8v48H48V72A8,8,0,0,1,56,64Zm144,144H56a8,8,0,0,1-8-8V136H208v64A8,8,0,0,1,200,208ZM96,176a12,12,0,1,1-12-12A12,12,0,0,1,96,176Zm88,0a12,12,0,1,1-12-12A12,12,0,0,1,184,176Z" />
        </svg>
      )
    default:
      return (
        <svg className={base} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
          <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Z" />
        </svg>
      )
  }
}
