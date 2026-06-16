'use client'

import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import {
  Copy,
  Link as LinkIcon,
  Mail,
  Download,
  ExternalLink,
  ZoomIn,
  X,
} from 'lucide-react'
import { usePortal } from '../_lib/portal-context'
import { formatDateShort } from '../_lib/portal-utils'
import PortalPageHead from '../_components/PortalPageHead'
import { Card, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import CodeChip from '@/components/employer/CodeChip'

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL!
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL!

export default function ShareKitPage() {
  const { group, challenges, challengePrizes, loading } = usePortal()
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const joinUrl = group
    ? `https://shift.gogreenstreets.org/join/${group.invite_code}`
    : ''

  useEffect(() => {
    if (!group) return
    QRCode.toDataURL(
      `https://shift.gogreenstreets.org/join/${group.invite_code}`,
      { margin: 1, width: 200, color: { dark: '#191A2E', light: '#ffffff' } },
    ).then(setQrDataUrl)
  }, [group?.invite_code])

  if (loading || !group) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-ink-faint">Loading...</span>
      </div>
    )
  }

  const now = new Date()
  const activeChallenge = challenges.find(
    (c) => new Date(c.starts_at) <= now && new Date(c.ends_at) >= now,
  )
  const upcomingChallenge = !activeChallenge
    ? challenges.find((c) => new Date(c.starts_at) > now)
    : null
  const featuredChallenge = activeChallenge ?? upcomingChallenge ?? null

  const activePrizes = featuredChallenge
    ? challengePrizes.filter((p) => p.competition_id === featuredChallenge.id)
    : []

  const blurb = featuredChallenge
    ? `Hey team! We've partnered with Green Streets Initiative to encourage active commuting through the Shift app. ${
        activeChallenge
          ? `Our "${activeChallenge.name}" challenge is live now through ${formatDateShort(activeChallenge.ends_at)}.`
          : `Our "${featuredChallenge.name}" challenge kicks off ${formatDateShort(featuredChallenge.starts_at)}.`
      }${activePrizes.length > 0 ? ` There are prizes up for grabs!` : ''} Download the Shift app and join ${group.name} to track your walks, bike rides, and transit trips. Every active trip counts!\n\nJoin here: ${joinUrl}\nOr enter code: ${group.invite_code}`
    : `Hey team! We've partnered with Green Streets Initiative to encourage active commuting through the Shift app. Download Shift, join ${group.name}, and start tracking your walks, bike rides, and transit trips.\n\nJoin here: ${joinUrl}\nOr enter code: ${group.invite_code}`

  const emailSubject = featuredChallenge
    ? `Join ${group.name} for ${featuredChallenge.name}`
    : `Join ${group.name} on Shift`
  const mailto = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(blurb)}`

  function copy(text: string, field: string) {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField((c) => (c === field ? null : c)), 2000)
  }

  async function shareLink() {
    const shareData = {
      title: `Join ${group!.name} on Shift`,
      text: `Join ${group!.name} on Shift and start tracking your team's active commutes.`,
      url: joinUrl,
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
      }
    }
    copy(joinUrl, 'link')
  }

  function downloadQr() {
    if (!qrDataUrl) return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = `${group!.slug ?? group!.name.toLowerCase().replace(/\s+/g, '-')}-shift-qr.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <>
      <PortalPageHead
        title="Share Kit"
        subtitle="Everything your team needs to join Shift"
      />

      <div className="mx-auto max-w-[960px] space-y-6">
        {/* Invite code + QR */}
        <div className="grid items-start gap-5 sm:grid-cols-[1fr_280px]">
          {/* Left — invite code */}
          <Card pad>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              Your invite code
            </div>
            <div className="mb-4">
              <CodeChip code={group.invite_code} />
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={Copy}
                onClick={() => copy(group.invite_code, 'code')}
              >
                {copiedField === 'code' ? 'Copied!' : 'Copy code'}
              </Button>
              <Button variant="primary" size="sm" icon={LinkIcon} onClick={shareLink}>
                {copiedField === 'link' ? 'Copied!' : 'Share join link'}
              </Button>
            </div>

            <label className="mb-1.5 block text-[12px] font-semibold text-ink-muted">
              Deep link
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={joinUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="flex-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/40"
              />
              <Button
                variant="ghost"
                size="sm"
                icon={Copy}
                onClick={() => copy(joinUrl, 'deeplink')}
              >
                {copiedField === 'deeplink' ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </Card>

          {/* Right — QR code */}
          <Card pad>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
              QR code
            </div>
            <div className="flex flex-col items-center">
              <div className="mb-3 flex h-[160px] w-[160px] items-center justify-center rounded-xl bg-white p-2 shadow-sm ring-1 ring-line">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="QR code" className="h-full w-full" />
                ) : (
                  <span className="text-[13px] text-ink-faint">Generating...</span>
                )}
              </div>
              <p className="mb-3 text-center text-[13px] text-ink-muted">
                Scan to join {group.name}
              </p>
              <Button variant="secondary" size="sm" icon={Download} onClick={downloadQr}>
                Download QR
              </Button>
            </div>
          </Card>
        </div>

        {/* Slack / email blurb */}
        <Card>
          <CardHead
            title="Slack / email blurb"
            sub="Pre-written copy to introduce Shift. Paste into Slack, Teams, or email."
          />
          <div className="px-6 pb-6">
            <textarea
              readOnly
              value={blurb}
              rows={6}
              onFocus={(e) => e.currentTarget.select()}
              className="mb-4 w-full resize-none rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-[1.6] text-ink outline-none focus:border-accent/40"
            />
            <div className="flex flex-wrap gap-2.5">
              <Button
                variant="primary"
                size="sm"
                icon={Copy}
                onClick={() => copy(blurb, 'blurb')}
              >
                {copiedField === 'blurb' ? 'Copied!' : 'Copy blurb'}
              </Button>
              <a href={mailto} className="contents">
                <Button variant="secondary" size="sm" icon={Mail}>
                  Send as email
                </Button>
              </a>
            </div>
          </div>
        </Card>

        {/* How employees join */}
        <Card>
          <CardHead
            title="How employees join"
            sub="Share these steps with employees who need help getting started"
          />
          <div className="px-6 pb-6">
            <div className="mb-5 rounded-xl border border-accent/15 bg-accent-soft px-5 py-4">
              <p className="mb-2 text-[13.5px] font-semibold text-ink">
                Easiest way to join: share the deep link
              </p>
              <p className="mb-3 text-[13px] leading-[1.55] text-ink-muted">
                This link opens the Shift app and joins the employee to {group.name} automatically. If they don&apos;t have the app yet, they&apos;ll see download links first.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={joinUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-[10px] border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/40"
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={Copy}
                  onClick={() => copy(joinUrl, 'steps-link')}
                >
                  {copiedField === 'steps-link' ? 'Copied!' : 'Copy link'}
                </Button>
              </div>
            </div>

            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Manual steps (if the link doesn&apos;t work)
            </p>
            <div className="mb-6 grid gap-5 sm:grid-cols-3">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white">
                  1
                </span>
                <p className="mb-1 text-[14px] font-semibold text-ink">Download the Shift app</p>
                <p className="mb-3 text-[13px] text-ink-muted">
                  Available on iOS and Android
                </p>
                <div className="flex gap-2">
                  <a
                    href={IOS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-semibold text-white no-underline transition-opacity hover:opacity-85"
                  >
                    App Store
                  </a>
                  <a
                    href={ANDROID_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-ink px-3 py-1.5 text-[11px] font-semibold text-white no-underline transition-opacity hover:opacity-85"
                  >
                    Google Play
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white">
                  2
                </span>
                <p className="mb-1 text-[14px] font-semibold text-ink">
                  Tap + on the Groups tab
                </p>
                <p className="mb-3 text-[13px] text-ink-muted">
                  Open the Groups tab, then tap the + button
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxSrc('/images/shift-app/shift-join-step1.png')}
                  className="group relative cursor-pointer rounded-lg transition-shadow hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/shift-app/shift-join-step1.png"
                    alt="Tap + on the Groups tab"
                    className="w-[120px] rounded-lg shadow-sm ring-1 ring-line"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink/0 transition-colors group-hover:bg-ink/15">
                    <ZoomIn size={20} className="text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white">
                  3
                </span>
                <p className="mb-1 text-[14px] font-semibold text-ink">
                  Enter your team code
                </p>
                <p className="mb-3 text-[13px] text-ink-muted">
                  Type <strong className="font-mono tracking-wider text-ink">{group.invite_code}</strong> and tap Join
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxSrc('/images/shift-app/shift-join-step2.png')}
                  className="group relative cursor-pointer rounded-lg transition-shadow hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/shift-app/shift-join-step2.png"
                    alt="Enter team code"
                    className="w-[120px] rounded-lg shadow-sm ring-1 ring-line"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink/0 transition-colors group-hover:bg-ink/15">
                    <ZoomIn size={20} className="text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              </div>
            </div>

          </div>
        </Card>

        {/* Printable flyer */}
        <Card pad>
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-accent">
            Printable flyer
          </div>
          <p className="mb-4 text-[14px] leading-[1.6] text-ink-muted">
            A branded one-page flyer with your invite code and QR code. Print it for the office, post it on a bulletin board, or attach to an email.
          </p>
          <a
            href={`/shift/employers/flyer?group=${group.slug ?? group.invite_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="contents"
          >
            <Button variant="primary" icon={ExternalLink}>
              Open printable flyer
            </Button>
          </a>
        </Card>
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="relative mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute -right-3 -top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-colors hover:bg-surface-2"
            >
              <X size={16} className="text-ink" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxSrc}
              alt="Step detail"
              className="max-h-[80vh] max-w-[360px] rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  )
}
