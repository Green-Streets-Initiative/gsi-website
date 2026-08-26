'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function VolunteerGuideLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const res = await fetch('/api/volunteer-guide/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/volunteer/guide')
    } else {
      setError('That password didn’t match — check with Keith and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F8EE] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-[family-name:var(--font-bricolage)] text-2xl font-extrabold text-[#191A2E]">
            Shift
          </span>
          <span className="ml-2 text-sm text-[#6B7280]">for Schools</span>
          <h1 className="mt-2 text-lg font-semibold text-[#191A2E]">
            Volunteer Field Guide
          </h1>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm text-[#374151] mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-white border border-[#191A2E]/15 text-[#191A2E] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#2966E5] focus:border-transparent"
              placeholder="From your welcome email"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-lg bg-[#2966E5] text-white font-semibold hover:bg-[#2966E5]/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Opening...' : 'Open the guide'}
          </button>
        </form>
      </div>
    </div>
  )
}
