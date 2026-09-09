import { NextRequest, NextResponse } from 'next/server'
import { requireGuideSession } from '@/lib/volunteer-guide-auth'

/** 401 unless the guide cookie is valid. */
export async function guard(req: NextRequest): Promise<NextResponse | null> {
  if (await requireGuideSession(req)) return null
  return NextResponse.json({ error: 'Sign in to the volunteer guide first.' }, { status: 401 })
}

export function cleanReviewer(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim().replace(/\s+/g, ' ')
  if (t.length < 1 || t.length > 80) return null
  return t
}

export function cleanScore(v: unknown, min: number, max: number): number | null | undefined {
  if (v === null || v === '') return null
  if (v === undefined) return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isInteger(n) || n < min || n > max) return undefined
  return n
}

export function cleanText(v: unknown, max = 4000): string | null | undefined {
  if (v === null) return null
  if (v === undefined) return undefined
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t.length === 0 ? null : t.slice(0, max)
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}
