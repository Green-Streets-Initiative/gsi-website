'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

const SEND_FAILED =
  "We couldn't send the link just now. Check your connection and try again, or email info@gogreenstreets.org."
const EXPIRED_NOTICE = 'That link expired or was already used. Enter your email for a new one.'

export default function EmployerLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user?.email) {
        router.replace('/shift/employers/portal/dashboard')
        return
      }
      // The portal sends people here with ?error=expired when a sign-in
      // link no longer works (used twice, or older than an hour).
      const params = new URLSearchParams(window.location.search)
      if (params.get('error') === 'expired') {
        setNotice(EXPIRED_NOTICE)
        window.history.replaceState({}, '', window.location.pathname)
      }
      setChecking(false)
    }
    checkSession()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/employer-magic-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          redirect_to: `${window.location.origin}/shift/employers/portal/dashboard`,
        }),
      })
      if (!res.ok) throw new Error(`employer-magic-link ${res.status}`)
      setNotice(null)
      setSent(true)
    } catch (err) {
      console.error('Magic link request failed:', err)
      setError(SEND_FAILED)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F1]" aria-busy="true">
        <div className="h-[280px] w-full max-w-[420px] animate-pulse rounded-[14px] bg-white/70" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F4F6F1] px-4 py-10 sm:px-6">
      <div className="w-full max-w-[420px]">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-1.5">
            <span
              className="text-[26px] font-extrabold tracking-[-0.01em] text-[#191A2E]"
              style={{ fontFamily: "'Bricolage Grotesque', var(--font-display), sans-serif" }}
            >
              Shift
            </span>
            <svg viewBox="0 0 36 28" width={24} height={24 * (28 / 36)} className="relative top-[1px]" aria-hidden>
              <path d="M0,1 L16,14 L0,27 L0,20 L10,14 L0,8Z" fill="#BAF14D" />
              <path d="M19,1 L35,14 L19,27 L19,20 L29,14 L19,8Z" fill="#2966E5" />
            </svg>
            <span className="text-[20px] font-normal text-[#4A4D68]">
              for Employers
            </span>
          </div>
          <p className="text-[13px] text-[#4A4D68]">
            by{' '}
            <span className="font-semibold text-[#2D6A4F]">Green Streets</span>{' '}
            Initiative
          </p>
        </div>

        {/* Card */}
        <div className="rounded-[14px] border border-[rgba(25,26,46,0.09)] bg-white p-6 shadow-[0_4px_16px_rgba(25,26,46,0.07)] sm:p-8">
          {sent ? (
            <div className="text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[#E7F0EA]">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h1 className="mb-2 text-[20px] font-bold tracking-[-0.01em] text-[#191A2E]">
                Check your inbox
              </h1>
              <p className="text-[14.5px] leading-[1.5] text-[#4A4D68]">
                We sent a login link to{' '}
                <strong className="font-semibold text-[#191A2E]">{email}</strong>.
              </p>
              <p className="mt-2 text-[13px] text-[#5B6075]">
                The link expires in 1 hour. Don&apos;t see it? Check your spam folder.
              </p>
              <button
                type="button"
                className="mt-5 text-[13px] font-semibold text-[#2D6A4F] hover:underline"
                onClick={() => setSent(false)}
              >
                Try a different email
              </button>
            </div>
          ) : (
            <>
              <h1 className="mb-1.5 text-center text-[20px] font-bold tracking-[-0.01em] text-[#191A2E]">
                Sign in to your portal
              </h1>
              <p className="mb-6 text-center text-[14px] text-[#4A4D68]">
                Enter your admin email and we&apos;ll send you a login link.
              </p>
              {notice && (
                <p
                  role="status"
                  className="mb-4 rounded-[10px] border border-[#E3C48C] bg-[#FBF4E6] px-3.5 py-2.5 text-[13.5px] leading-[1.45] text-[#191A2E]"
                >
                  {notice}
                </p>
              )}
              <form onSubmit={handleSubmit}>
                <label htmlFor="employer-login-email" className="mb-1.5 block text-[12.5px] font-semibold text-[#4A4D68]">
                  Email address
                </label>
                <input
                  id="employer-login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourcompany.com"
                  required
                  autoFocus
                  className="mb-4 w-full rounded-[10px] border border-[rgba(25,26,46,0.09)] bg-white px-3.5 py-3 text-[14.5px] text-[#191A2E] outline-none placeholder:text-[#5B6075] focus:border-[#2D6A4F]"
                />
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full rounded-[10px] bg-[#2D6A4F] px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#1F4D3A] disabled:opacity-40"
                >
                  {loading ? 'Sending…' : 'Send login link'}
                </button>
                {error && (
                  <p role="alert" className="mt-3 text-[13.5px] leading-[1.45] text-[#B3361F]">
                    {error}
                  </p>
                )}
              </form>
            </>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-6 text-center text-[13px] text-[#4A4D68]">
          Not an employer partner yet?{' '}
          <Link
            href="/shift/employers"
            className="font-semibold text-[#2D6A4F] hover:underline"
          >
            Learn more
          </Link>
        </div>
      </div>
    </div>
  )
}
