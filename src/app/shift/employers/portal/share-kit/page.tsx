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
  Printer,
} from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { usePortal } from '../_lib/portal-context'
import { employerAdvisorUrl, employerNearbyUrl, locationAsOffice, onThisSite } from '@/lib/employer/office-links'
import { useEmployerLocations, locationTitle } from '../_lib/use-employer-locations'
import { formatDateShort } from '../_lib/portal-utils'
import { useObservances } from '../_lib/use-observances'
import { observanceMessage, upcomingObservances, longDay } from '@/lib/employer/observances'
import PortalPageHead from '../_components/PortalPageHead'
import JoinPolicyLine from '../_components/JoinPolicyLine'
import TabStrip, { tabPanelProps } from '../_components/TabStrip'
import PortalHeroPanel from '../_components/PortalHeroPanel'
import LivePagePreview from '@/components/employer/LivePagePreview'
import StoreBadges, { STORE_CREDIT_LINES } from '@/components/StoreBadges'
import { Card, CardHead } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import CodeChip from '@/components/employer/CodeChip'

/** The page's tabs (Keith 2026-10-05: tabs at the top, not stacked cards). */
type KitTab = 'join' | 'messages' | 'flyers' | 'pages' | 'days' | 'locations'

const KIT_TABS: KitTab[] = ['join', 'messages', 'flyers', 'pages', 'days', 'locations']

/** Old section anchors (#kit-blurb and friends) still land on the right tab. */
const LEGACY_HASH: Record<string, KitTab> = {
  'kit-blurb': 'messages',
  'kit-join': 'join',
  'kit-advisor': 'pages',
  'kit-nearby': 'pages',
  'kit-locations': 'locations',
  'kit-days': 'days',
  'kit-flyer': 'flyers',
}

function isKitTab(v: string | null | undefined): v is KitTab {
  return !!v && (KIT_TABS as string[]).includes(v)
}

export default function ShareKitPage() {
  const { group, challenges, challengePrizes, benefitsForm, loading, isAdmin, isGsiAdmin } = usePortal()
  const { locations } = useEmployerLocations(group?.id)
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<KitTab>(() => {
    const q = searchParams.get('tab') ?? searchParams.get('section')
    return isKitTab(q) ? q : LEGACY_HASH[q ?? ''] ?? 'join'
  })
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const observances = useObservances()
  const upcomingDays = upcomingObservances(
    observances,
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
  ).slice(0, 3)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const joinUrl = group
    ? `https://shift.gogreenstreets.org/join/${group.invite_code}`
    : ''

  // A #hash deep link (old #kit-* anchors or a tab name) picks the tab. Read
  // after hydration, in a queued callback, so the server and client agree on
  // the first paint.
  useEffect(() => {
    const t = setTimeout(() => {
      const h = window.location.hash.replace(/^#/, '')
      if (!h) return
      const next = isKitTab(h) ? h : LEGACY_HASH[h]
      if (next) setTab(next)
    }, 0)
    return () => clearTimeout(t)
  }, [])

  function changeTab(next: KitTab) {
    setTab(next)
    history.replaceState(null, '', `#${next}`)
  }

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
        <span className="text-ink-tertiary">Loading...</span>
      </div>
    )
  }

  const now = new Date()
  const activeFlagship = challenges.find(
    (c) => c.is_flagship && new Date(c.starts_at) <= now && new Date(c.ends_at) >= now,
  )
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

  // Branded tools for the office. Both need the group's slug; Nearby also
  // needs the office address saved on the Commute Advisor page.
  const advisorUrl = group.slug ? employerAdvisorUrl(group.slug) : null
  const nearbyUrl = group.slug ? employerNearbyUrl(group.slug, benefitsForm) : null
  const nearbyPrintUrl = group.slug ? employerNearbyUrl(group.slug, benefitsForm, { print: true }) : null

  const advisorBlurb = advisorUrl
    ? `Planning your trip to the office? We set up a Commute Advisor page for ${group.name}. Enter where you're starting from and it lays out your walking, biking and transit options to our office.\n\n${advisorUrl}`
    : ''
  const nearbyBlurb = nearbyUrl
    ? `Here's a live transportation map for our office: the T stops and bus routes nearby with live arrivals, Bluebikes docks, bike lanes and paths, and how long it takes to get to places from here. Handy if you're new, or thinking about trying a different way in.\n\n${nearbyUrl}`
    : ''
  const mailtoFor = (subject: string, body: string) =>
    `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

  // Several locations: a row of links per location (item 7)
  const sites = group.slug && locations.length >= 1
    ? locations.map((l) => {
        const title = locationTitle(l)
        const advisor = employerAdvisorUrl(group.slug!, l.id)
        const nearby = employerNearbyUrl(group.slug!, locationAsOffice(l))
        const print = employerNearbyUrl(group.slug!, locationAsOffice(l), { print: true })
        const message = `For everyone at our ${title} location:\n\nPlan your commute (walking, biking and transit options to the office): ${advisor}\n\nGetting to this office (T stops and buses with live arrivals, Bluebikes docks, bike lanes and paths): ${nearby}`
        const address = l.address.replace(/,\s*(USA|United States)$/i, '')
        return { id: l.id, title, address, advisor, nearby, print, message }
      })
    : []

  // One note for the whole organization: everyone finds their own location
  // instead of the admin sending each office its own message (Keith 2026-09-30).
  const orgMessage =
    sites.length > 0 && advisorUrl
      ? [
          `Hi everyone — here are ${group.name}'s commute pages. Find your location below.`,
          '',
          `Plan your commute (walking, biking and transit options to the office, pick your location on the page): ${advisorUrl}`,
          '',
          ...sites.map((s) => `${s.title} (${s.address}): transit, bike routes and Bluebikes near this office ${s.nearby}`),
          '',
          `Join ${group.name} on Shift to track your trips and take part in company challenges: ${joinUrl}`,
          `Or enter code ${group.invite_code} in the app.`,
        ].join('\n')
      : ''

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
        title="Share kit"
        subtitle="The code, link and QR that get people in, and the pages and notes you can send them."
      />

      <div className="mx-auto max-w-[960px] min-[1200px]:max-w-[1120px]">
        <div className="space-y-6">
        {/* The one thing admins come here for: code, link and QR, on the sign. */}
        <PortalHeroPanel
          title="Get your team onto Shift"
          lede={`Share the code, the link or the QR. Whichever one an employee uses, they land in ${group.name}'s group with trip tracking on.`}
          actions={
            <>
              <Button variant="secondary" size="sm" icon={Copy} onClick={() => copy(blurb, 'blurb-top')}>
                {copiedField === 'blurb-top' ? 'Copied!' : 'Copy the team blurb'}
              </Button>
              <a href={mailto} className="contents">
                <Button variant="secondary" size="sm" icon={Mail}>
                  Send as email
                </Button>
              </a>
              <a
                href={`/shift/employers/flyer?group=${group.slug ?? group.invite_code}`}
                target="_blank"
                rel="noopener noreferrer"
                className="contents"
              >
                <Button variant="secondary" size="sm" icon={Printer}>
                  Printable flyer
                </Button>
              </a>
            </>
          }
          tile={
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_128px] sm:items-start">
              <div className="min-w-0">
                <div className="mb-2 text-[12.5px] font-semibold text-ink-muted">Your invite code</div>
                <div className="mb-3 flex flex-wrap items-center gap-2.5">
                  <CodeChip code={group.invite_code} />
                  <Button variant="secondary" size="sm" icon={Copy} onClick={() => copy(group.invite_code, 'code')}>
                    {copiedField === 'code' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <label className="mb-1.5 block text-[12.5px] font-semibold text-ink-muted">Join link</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={joinUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/40"
                  />
                  <Button variant="primary" size="sm" icon={LinkIcon} onClick={shareLink}>
                    {copiedField === 'link' ? 'Copied!' : 'Share'}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex h-[128px] w-[128px] items-center justify-center rounded-xl bg-white p-1.5 ring-1 ring-line">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="QR code" className="h-full w-full" />
                  ) : (
                    <span className="text-[13px] text-ink-tertiary">Generating...</span>
                  )}
                </div>
                <button type="button" onClick={downloadQr} className="mt-2 flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
                  <Download size={13} strokeWidth={2} />
                  Download QR
                </button>
              </div>
            </div>
          }
        />

        {/* Who the code lets in; the setting lives in Settings. */}
        <JoinPolicyLine policy={group.join_policy ?? 'open'} canManage={isAdmin || isGsiAdmin} groupId={group.id} />

        {/* Every section as a tab at the top, visible at every width. */}
        <TabStrip
          tabs={[
            { id: 'join', label: 'Join link & code' },
            { id: 'messages', label: 'Messages' },
            { id: 'flyers', label: 'Flyers' },
            ...(advisorUrl || group.slug ? [{ id: 'pages', label: 'Commute Advisor & Nearby' }] : []),
            ...(upcomingDays.length > 0 ? [{ id: 'days', label: 'Days coming up' }] : []),
            ...(sites.length > 0 ? [{ id: 'locations', label: 'Your locations' }] : []),
          ]}
          value={tab}
          onChange={changeTab}
          label="Share kit"
          prefix="kit"
        />

        {/* Join link & code */}
        <div {...tabPanelProps('kit', 'join')} hidden={tab !== 'join'} className="space-y-6 outline-none">
        {/* GSI can send the invitations instead (Employees page, Keith 2026-09-30). */}
        <Card pad className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-ink">Rather have us send the invites?</div>
            <p className="mt-0.5 text-[13px] leading-[1.5] text-ink-muted">
              Paste your list or upload a CSV on the Employees page and we email everyone for you, with one reminder a week later.
            </p>
          </div>
          <Link
            href="/shift/employers/portal/employees?invite=1"
            className="shrink-0 text-[13.5px] font-semibold text-accent hover:underline"
          >
            Paste a list
          </Link>
        </Card>

        {/* How employees join */}
        <Card id="kit-join">
          <CardHead
            title="How employees join"
            sub="Share these steps with employees who need help getting started"
          />
          <div className="px-6 py-5">
            <div className="mb-5 rounded-xl border border-accent/15 bg-accent-soft px-5 py-4">
              <p className="mb-2 text-[13.5px] font-semibold text-ink">
                Easiest way to join: share the deep link
              </p>
              <p className="mb-3 text-[13px] leading-[1.55] text-ink-muted">
                {`This link opens the Shift app and joins the employee to ${group.name} automatically. If they don't have the app yet, the page shows App Store and Google Play buttons and their invite code.`}
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

            <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-tertiary">
              Manual steps (if the link doesn&apos;t work)
            </p>
            <div className="mb-5 flex flex-col items-start gap-3 rounded-[10px] border border-line bg-surface-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[14px] font-semibold text-ink">Don&apos;t have the app yet?</p>
                <p className="text-[13px] text-ink-muted">Shift is free on iOS and Android.</p>
              </div>
              <StoreBadges height={36} layout="row" placement="employer_share_kit" />
            </div>
            <div className="mb-6 grid gap-5 sm:grid-cols-3">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white">
                  1
                </span>
                <p className="mb-1 text-[14px] font-semibold text-ink">Open Shift and go to Community</p>
                <p className="mb-3 text-[13px] text-ink-muted">
                  Community is in the tab bar at the bottom of the app
                </p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <span className="mb-4 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[14px] font-bold text-white">
                  2
                </span>
                <p className="mb-1 text-[14px] font-semibold text-ink">Tap Join a workplace</p>
                <p className="mb-3 text-[13px] text-ink-muted">
                  It asks for the code your employer gave you
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxSrc('/images/shift-app/shift-join-step1.png')}
                  className="group relative cursor-pointer rounded-lg transition-shadow hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/shift-app/shift-join-step1.png"
                    alt="Tap Join a workplace"
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
                <p className="mb-1 text-[14px] font-semibold text-ink">Enter your invite code</p>
                <p className="mb-3 text-[13px] text-ink-muted">
                  Type <strong className="font-headline font-extrabold tracking-[0.08em] text-ink">{group.invite_code}</strong> and tap Join
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxSrc('/images/shift-app/shift-join-step2.png')}
                  className="group relative cursor-pointer rounded-lg transition-shadow hover:shadow-md"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/shift-app/shift-join-step2.png"
                    alt="Enter your invite code"
                    className="w-[120px] rounded-lg shadow-sm ring-1 ring-line"
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-ink/0 transition-colors group-hover:bg-ink/15">
                    <ZoomIn size={20} className="text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                  </span>
                </button>
              </div>
            </div>
            <p className="mt-4 max-w-[70ch] text-[11px] leading-[1.5] text-ink-tertiary">{STORE_CREDIT_LINES}</p>
          </div>
        </Card>
        </div>

        {/* Messages */}
        <div {...tabPanelProps('kit', 'messages')} hidden={tab !== 'messages'} className="space-y-6 outline-none">
        {/* Slack / email blurb */}
        <Card id="kit-blurb">
          <CardHead
            title="Slack / email blurb"
            sub="Pre-written copy to introduce Shift. Paste into Slack, Teams, or email."
          />
          <div className="px-6 py-5">
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

        </div>

        {/* Commute Advisor & Nearby */}
        <div {...tabPanelProps('kit', 'pages')} hidden={tab !== 'pages'} className="space-y-6 outline-none">
        {/* Branded Commute Advisor */}
        {advisorUrl && (
          <Card id="kit-advisor">
            <CardHead
              title="Commute Advisor for your office"
              sub="A page with your logo that shows anyone their walking, biking and transit options to your office. Staff don't need the app to use it."
            />
            <div className="grid gap-5 px-6 py-5 md:grid-cols-[minmax(0,560px)_1fr]">
              <div>
                <LivePagePreview
                  src={onThisSite(advisorUrl)}
                  title={`Commute Advisor page for ${group.name}`}
                  fallback={<p className="text-center text-[13px] text-ink-muted">Preview unavailable. Open the page to see it.</p>}
                />
                <p className="mt-2.5 text-[13px] leading-[1.5] text-ink-muted">
                  What employees see: your logo, &ldquo;Find your best commute&rdquo;, and a location picker when you have more than one office. One link serves every location.
                </p>
              </div>
              <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={advisorUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/40"
                />
                <Button variant="ghost" size="sm" icon={Copy} onClick={() => copy(advisorUrl, 'advisor-link')}>
                  {copiedField === 'advisor-link' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
              <textarea
                readOnly
                value={advisorBlurb}
                rows={4}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full resize-none rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-[1.6] text-ink outline-none focus:border-accent/40"
              />
              <div className="flex flex-wrap gap-2.5">
                <Button variant="primary" size="sm" icon={Copy} onClick={() => copy(advisorBlurb, 'advisor-blurb')}>
                  {copiedField === 'advisor-blurb' ? 'Copied!' : 'Copy message'}
                </Button>
                <a href={mailtoFor(`Plan your commute to ${group.name}`, advisorBlurb)} className="contents">
                  <Button variant="secondary" size="sm" icon={Mail}>
                    Send as email
                  </Button>
                </a>
                <a href={onThisSite(advisorUrl)} target="_blank" rel="noopener noreferrer" className="contents">
                  <Button variant="ghost" size="sm" icon={ExternalLink}>
                    Open page
                  </Button>
                </a>
              </div>
              </div>
            </div>
          </Card>
        )}

        {/* Branded Nearby page */}
        {group.slug && (
          <Card id="kit-nearby">
            <CardHead
              title={sites.length > 0 ? `Nearby page for ${sites[0].title}` : 'Nearby page for your office'}
              sub="A live map of T stops, bus arrivals, Bluebikes docks and bike paths around your office, with your logo. Good for new hires, a welcome email or the break room."
            />
            {nearbyUrl ? (
              <div className="grid gap-5 px-6 py-5 md:grid-cols-[minmax(0,560px)_1fr]">
                <div>
                  <LivePagePreview
                    src={onThisSite(nearbyUrl)}
                    title={`Nearby page for ${group.name}`}
                    fallback={<p className="text-center text-[13px] text-ink-muted">Preview unavailable. Open the page to see it.</p>}
                  />
                  <p className="mt-2.5 text-[13px] leading-[1.5] text-ink-muted">
                    What employees see: a live transportation map for the office. T and bus arrivals, Bluebikes docks, bike lanes and paths, and travel times to nearby places, with your logo top right.
                  </p>
                </div>
                <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={nearbyUrl}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-accent/40"
                  />
                  <Button variant="ghost" size="sm" icon={Copy} onClick={() => copy(nearbyUrl, 'nearby-link')}>
                    {copiedField === 'nearby-link' ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
                <textarea
                  readOnly
                  value={nearbyBlurb}
                  rows={4}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full resize-none rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-[1.6] text-ink outline-none focus:border-accent/40"
                />
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="primary" size="sm" icon={Copy} onClick={() => copy(nearbyBlurb, 'nearby-blurb')}>
                    {copiedField === 'nearby-blurb' ? 'Copied!' : 'Copy message'}
                  </Button>
                  <a href={mailtoFor(`What's around the ${group.name} office`, nearbyBlurb)} className="contents">
                    <Button variant="secondary" size="sm" icon={Mail}>
                      Send as email
                    </Button>
                  </a>
                  <a href={onThisSite(nearbyUrl)} target="_blank" rel="noopener noreferrer" className="contents">
                    <Button variant="ghost" size="sm" icon={ExternalLink}>
                      Open page
                    </Button>
                  </a>
                  {nearbyPrintUrl && (
                    <a href={onThisSite(nearbyPrintUrl)} target="_blank" rel="noopener noreferrer" className="contents">
                      <Button variant="ghost" size="sm" icon={Printer}>
                        Printable version
                      </Button>
                    </a>
                  )}
                </div>
                </div>
              </div>
            ) : (
              <div className="px-6 py-5">
                <p className="mb-4 text-[14px] leading-[1.6] text-ink-muted">
                  Add your office as a location on the Commute Advisor page and your Nearby page appears here.
                </p>
                <Link href="/shift/employers/portal/advisor" className="contents">
                  <Button variant="secondary" size="sm">
                    Add a location
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        )}

        </div>

        {/* Your locations */}
        <div {...tabPanelProps('kit', 'locations')} hidden={tab !== 'locations'} className="space-y-6 outline-none">
        {sites.length > 0 && (
          <Card id="kit-locations">
            <CardHead
              title="Links for your locations"
              sub="One message for the whole organization, with a line per location so everyone finds theirs."
            />
            <div className="grid gap-3 px-6 py-5">
              <textarea
                readOnly
                value={orgMessage}
                rows={8}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full resize-none rounded-[10px] border border-line bg-surface-2 px-4 py-3 text-[13.5px] leading-[1.6] text-ink outline-none focus:border-accent/40"
              />
              <div className="flex flex-wrap gap-2.5">
                <Button variant="primary" size="sm" icon={Copy} onClick={() => copy(orgMessage, 'org-msg')}>
                  {copiedField === 'org-msg' ? 'Copied!' : 'Copy for the whole organization'}
                </Button>
                <a href={mailtoFor(`Commute pages for ${group.name}`, orgMessage)} className="contents">
                  <Button variant="secondary" size="sm" icon={Mail}>
                    Send as email
                  </Button>
                </a>
              </div>
              {sites.length > 1 && (
                <p className="mt-2 text-[13px] font-semibold text-ink">For one office</p>
              )}
              {sites.length > 1 && sites.map((s) => (
                <div key={s.id} className="grid gap-2.5 rounded-[10px] border border-line bg-surface-2 p-3.5">
                  <div>
                    <div className="text-[14px] font-semibold text-ink">{s.title}</div>
                    <div className="text-[13px] text-ink-muted">{s.address}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" size="sm" icon={Copy} onClick={() => copy(s.message, `site-msg-${s.id}`)}>
                      {copiedField === `site-msg-${s.id}` ? 'Copied!' : 'Copy message'}
                    </Button>
                    <a href={onThisSite(s.advisor)} target="_blank" rel="noopener noreferrer" className="contents">
                      <Button variant="secondary" size="sm" icon={ExternalLink}>
                        Commute Advisor
                      </Button>
                    </a>
                    {s.nearby && (
                      <a href={onThisSite(s.nearby)} target="_blank" rel="noopener noreferrer" className="contents">
                        <Button variant="secondary" size="sm" icon={ExternalLink}>
                          Nearby page
                        </Button>
                      </a>
                    )}
                    {s.print && (
                      <a href={onThisSite(s.print)} target="_blank" rel="noopener noreferrer" className="contents">
                        <Button variant="ghost" size="sm" icon={Printer}>
                          Printable
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        </div>

        {/* Days coming up (GSI observances) */}
        <div {...tabPanelProps('kit', 'days')} hidden={tab !== 'days'} className="space-y-6 outline-none">
        {upcomingDays.length > 0 && (
          <Card id="kit-days">
            <CardHead
              title="Days coming up"
              sub="Days worth marking with your team, each with a ready-to-send note that links the day's own site."
            />
            <div className="grid gap-3 px-6 py-5">
              {upcomingDays.map((o) => {
                const msg = observanceMessage(o)
                const field = `obs-${o.slug}-${o.on_date}`
                return (
                  <div key={field} className="grid gap-2.5 rounded-[10px] border border-line bg-surface-2 p-3.5">
                    <div>
                      <div className="text-[14px] font-semibold text-ink">{o.name}</div>
                      <div className="text-[12.5px] text-ink-muted">
                        {longDay(o.on_date)} ·{' '}
                        <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                          {o.source_name}
                        </a>
                      </div>
                    </div>
                    <textarea
                      readOnly
                      value={msg}
                      rows={4}
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full resize-none rounded-[10px] border border-line bg-surface px-4 py-3 text-[13.5px] leading-[1.6] text-ink outline-none focus:border-accent/40"
                    />
                    <div className="flex flex-wrap gap-2.5">
                      <Button variant="primary" size="sm" icon={Copy} onClick={() => copy(msg, field)}>
                        {copiedField === field ? 'Copied!' : 'Copy message'}
                      </Button>
                      <a href={mailtoFor(o.name, msg)} className="contents">
                        <Button variant="secondary" size="sm" icon={Mail}>
                          Send as email
                        </Button>
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        </div>

        {/* Flyers, shown as what they are */}
        <div {...tabPanelProps('kit', 'flyers')} hidden={tab !== 'flyers'} className="space-y-6 outline-none">
        <Card id="kit-flyer">
          <CardHead
            title="Flyers"
            sub="Print one for the office or the break room, or attach it to an email. When a challenge is running, the flyer is about the challenge."
          />
          <div className={`grid gap-5 px-6 py-5 ${activeFlagship ? 'sm:grid-cols-2' : 'sm:grid-cols-[minmax(0,420px)]'}`}>
            <div>
              <LivePagePreview
                src={`/shift/employers/flyer?group=${group.slug ?? group.invite_code}`}
                title="Printable flyer"
                pageWidth={816}
                pageHeight={1056}
                fallback={<p className="text-center text-[13px] text-ink-muted">Preview unavailable. Open the flyer to see it.</p>}
              />
              <p className="mt-2.5 text-[13px] font-semibold text-ink">Join {group.name} on Shift</p>
              <p className="text-[12.5px] text-ink-muted">Your logo, invite code and QR code, in the Green Streets look.</p>
            </div>
            {activeFlagship && (
              <div>
                <LivePagePreview
                  src={`https://www.gogreenstreets.org/events/shift-your-summer/flyer?group=${group.slug ?? group.invite_code}`}
                  title={`${activeFlagship.name} flyer`}
                  pageWidth={816}
                  pageHeight={1056}
                  fallback={<p className="text-center text-[13px] text-ink-muted">Preview unavailable. Open the flyer to see it.</p>}
                />
                <p className="mt-2.5 text-[13px] font-semibold text-ink">{activeFlagship.name} flyer</p>
                <p className="text-[12.5px] text-ink-muted">{group.name}&apos;s part in {activeFlagship.name}, for the weeks it runs.</p>
              </div>
            )}
          </div>
        </Card>
        </div>
        </div>
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
