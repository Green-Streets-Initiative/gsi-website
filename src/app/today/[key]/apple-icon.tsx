/**
 * Home Screen icon for GSI Today (Keith's phone): the GSI chevrons on navy.
 * Next.js links it from the page as apple-touch-icon. Same picture for any
 * key; it shows no data.
 */
import { ImageResponse } from 'next/og'

export const runtime = 'nodejs'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#191A2E' }}>
        <svg width="112" height="87" viewBox="0 0 36 28">
          <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
          <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
        </svg>
      </div>
    ),
    size,
  )
}
