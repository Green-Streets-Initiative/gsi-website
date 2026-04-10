'use client'

import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import AddressAutocomplete from '@/components/AddressAutocomplete'

type PlaceData = { placeId: string; lat: number; lng: number }

interface SavedDemo {
  company: string
  url: string
  date: string
}

const STORAGE_KEY = 'gsi-demo-generator-recent'

export default function DemoGeneratorPage() {
  const [company, setCompany] = useState('')
  const [domain, setDomain] = useState('')
  const [address, setAddress] = useState('')
  const [placeData, setPlaceData] = useState<PlaceData | null>(null)
  const [notes, setNotes] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [recentDemos, setRecentDemos] = useState<SavedDemo[]>([])

  // Load recent demos from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setRecentDemos(JSON.parse(saved))
    } catch { /* ignore */ }
  }, [])

  // Preview Clearbit logo when domain changes
  const handleDomainBlur = () => {
    if (!domain) { setLogoUrl(null); setLogoError(false); return }
    const cleaned = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim()
    // Try Google's high-res favicon service (no API key needed, always works)
    const url = `https://www.google.com/s2/favicons?domain=${cleaned}&sz=128`
    setLogoUrl(url)
    setLogoError(false)
    const img = new window.Image()
    img.onload = () => setLogoError(false)
    img.onerror = () => setLogoError(true)
    img.src = url
  }

  const handleGenerate = () => {
    if (!company || !domain || !placeData) return

    const params = new URLSearchParams({
      company,
      address,
      lat: String(placeData.lat),
      lng: String(placeData.lng),
    })
    if (logoUrl && !logoError) params.set('logo', logoUrl)

    const url = `https://www.gogreenstreets.org/commute-advisor/demo?${params}`
    setGeneratedUrl(url)
    setCopied(false)

    // Save to recent
    const demo: SavedDemo = { company, url, date: new Date().toISOString() }
    const updated = [demo, ...recentDemos].slice(0, 20)
    setRecentDemos(updated)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
  }

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClearAll = () => {
    setRecentDemos([])
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }

  return (
    <>
      <Nav />
      <main className="bg-[#191A2E]" style={{ paddingTop: '60px' }}>
        <div className="mx-auto max-w-[600px] px-8 pb-20 pt-12">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Internal tool</div>
          <h1 className="mb-2 font-display text-[1.75rem] font-extrabold tracking-tight text-white">Demo Generator</h1>
          <p className="mb-8 text-[0.9375rem] text-white/50">
            Create personalized Commute Advisor demo URLs for sales outreach.
          </p>

          <div className="rounded-[20px] border border-white/[0.12] bg-[#242538] p-8">
            {/* Company name */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Company name *</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                placeholder="Liberty Mutual"
                className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
            </div>

            {/* Domain */}
            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Company domain *</label>
              <input type="text" value={domain} onChange={e => setDomain(e.target.value)} onBlur={handleDomainBlur}
                placeholder="libertymutual.com (just the domain, no https://)"
                className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
              {/* Logo preview */}
              {logoUrl && (
                <div className="mt-3 flex items-center gap-3">
                  {logoError ? (
                    <span className="text-[0.8rem] text-white/40">No logo found for this domain</span>
                  ) : (
                    <>
                      <img src={logoUrl} alt="Company logo" className="h-8 w-auto rounded bg-white p-1" onError={() => setLogoError(true)} />
                      <span className="text-[0.8rem] text-white/50">Company logo</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Office address */}
            <div className="mb-5">
              <AddressAutocomplete value={address}
                onChange={(val) => { setAddress(val); if (!val) setPlaceData(null) }}
                onPlaceSelected={setPlaceData}
                label="Office address *" variant="dark" placeholder="157 Berkeley St, Boston, MA" />
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="For your own reference — not included in the URL"
                rows={2}
                className="w-full rounded-[10px] border-[1.5px] border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm text-white placeholder-white/30 transition-colors focus:border-[#BAF14D] focus:outline-none" />
            </div>

            {/* Generate button */}
            <button onClick={handleGenerate}
              disabled={!company || !domain || !placeData}
              className="w-full rounded-xl bg-[#BAF14D] py-3 text-[0.9375rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90 disabled:opacity-30">
              Generate demo URL
            </button>

            {/* Generated URL */}
            {generatedUrl && (
              <div className="mt-5 rounded-xl border border-[rgba(186,241,77,0.2)] bg-[rgba(186,241,77,0.06)] p-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#BAF14D]/60">Demo URL</div>
                <div className="mb-3 break-all rounded-lg bg-[#191A2E] px-3 py-2 text-[0.75rem] text-white/70">
                  {generatedUrl}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleCopy(generatedUrl)}
                    className="rounded-lg bg-[#BAF14D] px-4 py-2 text-[0.8125rem] font-bold text-[#191A2E] transition-opacity hover:opacity-90">
                    {copied ? 'Copied!' : 'Copy URL'}
                  </button>
                  <a href={generatedUrl} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg border border-white/[0.12] px-4 py-2 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-white/[0.05]">
                    Preview
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Recent demos */}
          {recentDemos.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Recent demos</div>
                <button onClick={handleClearAll} className="text-[0.75rem] text-white/30 hover:text-white/50">Clear all</button>
              </div>
              <div className="space-y-2">
                {recentDemos.map((demo, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-[#242538] px-4 py-3">
                    <div>
                      <div className="text-[0.875rem] font-semibold text-white">{demo.company}</div>
                      <div className="text-[0.75rem] text-white/30">
                        {new Date(demo.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <button onClick={() => handleCopy(demo.url)}
                      className="rounded-lg border border-white/[0.12] px-3 py-1.5 text-[0.75rem] font-semibold text-white/60 transition-colors hover:border-white/[0.2] hover:text-white">
                      Copy
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
