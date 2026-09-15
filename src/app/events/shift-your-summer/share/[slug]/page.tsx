import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { PILL } from '@/components/org/Section'
import StoreButtons from '@/components/StoreButtons'
import CorporateShareKit from './CorporateShareKit'

export const dynamic = 'force-dynamic'

const IOS_URL = process.env.NEXT_PUBLIC_IOS_URL!
const ANDROID_URL = process.env.NEXT_PUBLIC_ANDROID_URL!

type GroupRow = {
  id: string
  name: string
  slug: string
  invite_code: string
  logo_url: string | null
  status: string
  access_ends_at: string | null
}

function sanitizeSlug(value: string): string | null {
  if (!/^[a-z0-9-]{1,80}$/.test(value)) return null
  return value
}

async function fetchGroup(slug: string): Promise<GroupRow | null> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('groups')
    .select('id, name, slug, invite_code, logo_url, status, access_ends_at')
    .eq('slug', slug)
    .in('status', ['active', 'cancelled'])
    .maybeSingle()

  if (!data) return null
  const row = data as GroupRow
  if (row.access_ends_at && new Date(row.access_ends_at) < new Date()) return null
  return row
}

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const clean = sanitizeSlug(slug)
  if (!clean) return { title: 'Shift Your Summer | Green Streets Initiative' }

  const group = await fetchGroup(clean)
  if (!group) return { title: 'Shift Your Summer | Green Streets Initiative' }

  const title = `Join ${group.name} for Shift Your Summer`
  const description = `${group.name} is participating in Shift Your Summer. Download the Shift app and join the team to walk, bike, and ride transit for prizes.`
  const pageUrl = `https://www.gogreenstreets.org/events/shift-your-summer/share/${clean}`

  return {
    title,
    description,
    other: {
      'apple-itunes-app': 'app-id=6761119037',
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: 'Green Streets Initiative',
      images: [{
        url: `https://www.gogreenstreets.org/api/og/share/employer/${clean}`,
        width: 1200,
        height: 630,
        alt: title,
      }],
      type: 'website',
    },
  }
}

export default async function CorporateSharePage({ params }: Props) {
  const { slug } = await params
  const clean = sanitizeSlug(slug)
  if (!clean) notFound()

  const group = await fetchGroup(clean)
  if (!group) notFound()

  const joinUrl = `https://shift.gogreenstreets.org/join/${group.invite_code}`
  const sharePageUrl = `https://www.gogreenstreets.org/events/shift-your-summer/share/${clean}`

  const blurb = `Join ${group.name} for Shift Your Summer — an 8-week challenge (June 15 – Aug 15) where every walk, bike ride, and transit trip is an entry to win prizes from Segway, Quad Lock, Kryptonite, and more. Tap the link to join: ${joinUrl}`

  const emailSubject = `Join ${group.name} for Shift Your Summer`
  const emailBody = blurb

  const qrSvg = await QRCode.toString(joinUrl, {
    type: 'svg',
    margin: 0,
    color: { dark: '#191A2E', light: '#ffffff' },
  })

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream text-navy" style={{ paddingTop: '60px' }}>
        <section className="px-6 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-[680px]">
            <Link
              href="/events/shift-your-summer"
              className="mb-8 inline-flex items-center gap-1.5 text-[15px] font-semibold text-forest underline-offset-4 hover:underline"
            >
              &larr; Back to Shift Your Summer
            </Link>

            {/* Company header */}
            <div className="mb-6">
              {group.logo_url && (
                <div className="mb-5 inline-flex h-20 items-center rounded-2xl border border-navy/10 bg-white px-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={group.logo_url}
                    alt={group.name}
                    className="h-[56px] w-auto max-w-[260px] object-contain"
                  />
                </div>
              )}
              <h1 className="font-serif text-[clamp(2.5rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
                Join {group.name}
                {' '}for Shift&nbsp;Your&nbsp;Summer
              </h1>
            </div>

            <p className="mb-8 text-[1.0625rem] leading-[1.7] text-ink-soft">
              Walk, bike, and take transit this summer — and compete for prizes from brands like Segway, Quad Lock, and Kryptonite. Join your team in the Shift app to get started.
            </p>

            {/* App store buttons */}
            <StoreButtons iosUrl={IOS_URL} androidUrl={ANDROID_URL} tone="light" className="mb-10" />

            {/* Path 1 — Deep link (recommended) */}
            <div className="mb-6 rounded-[14px] border border-forest/40 bg-white p-6">
              <span className="mb-2 inline-block rounded-full bg-forest/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-forest">
                Recommended
              </span>
              <h2 className="mb-2 font-serif text-[1.375rem] leading-tight text-navy">
                Tap to join automatically
              </h2>
              <p className="mb-5 text-[15px] leading-relaxed text-ink-soft">
                Already have the Shift app? This link opens it and joins you to {group.name}&rsquo;s team automatically. Don&rsquo;t have it yet? You&rsquo;ll see download links for{' '}
                <a href={IOS_URL} className="font-semibold text-forest underline underline-offset-4" target="_blank" rel="noopener noreferrer">iOS</a>
                {' '}and{' '}
                <a href={ANDROID_URL} className="font-semibold text-forest underline underline-offset-4" target="_blank" rel="noopener noreferrer">Android</a>
                {' '}— install the app, create an account, and you&rsquo;ll land on the join screen with {group.name}&rsquo;s code already filled in.
              </p>
              <a
                href={joinUrl}
                className={`${PILL} w-full sm:w-auto`}
              >
                Join {group.name}&rsquo;s team &rarr;
              </a>
            </div>

            {/* Path 2 — Manual code entry (fallback) */}
            <div className="mb-10 rounded-[14px] border border-navy/10 bg-white p-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                Or enter the code manually
              </p>
              <p className="mb-5 text-[15px] leading-relaxed text-ink-soft">
                If the link above doesn&rsquo;t open the app, you can join by entering your team&rsquo;s invite code directly in the Shift app.
              </p>

              {/* Invite code */}
              <div className="mb-6 flex flex-wrap items-center gap-3 rounded-[12px] border border-navy/10 bg-cream px-5 py-4">
                <span className="text-[15px] font-medium text-ink-soft">Your team code:</span>
                <span className="font-mono text-2xl font-extrabold tracking-[0.2em] text-forest">
                  {group.invite_code}
                </span>
              </div>

              {/* App screenshots showing where to enter the code */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/shift-app/shift-join-sequence.png"
                alt="How to enter your team code in the Shift app: tap the + button on the Groups tab, then enter your invite code and tap Join."
                className="mx-auto max-w-[340px] rounded-xl"
              />
            </div>

            {/* QR code + invite code */}
            <div className="mb-10 grid gap-6 sm:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center">
                <div className="flex h-[140px] w-[140px] items-center justify-center rounded-2xl border border-navy/10 bg-white p-2">
                  <div
                    className="h-[120px] w-[120px]"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                </div>
                <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                  Scan to join
                </p>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  Scan the QR code with your phone to join {group.name}&rsquo;s team. If you already have Shift, it opens the join screen automatically. If not, you&rsquo;ll see download links.
                </p>
              </div>
            </div>

            {/* Share kit */}
            <div className="mb-10 rounded-[14px] border border-navy/10 bg-white p-6">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                Share with your team
              </p>
              <CorporateShareKit
                shareUrl={sharePageUrl}
                blurb={blurb}
                emailSubject={emailSubject}
                emailBody={emailBody}
                inviteCode={group.invite_code}
                tone="light"
              />
            </div>

            {/* Flyer link */}
            <div className="rounded-[14px] border border-navy/10 bg-white p-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-forest">
                Print or post the flyer
              </p>
              <p className="mb-4 text-[15px] leading-relaxed text-ink-soft">
                A branded one-page flyer with your team code. Print it for the office, post it on a bulletin board, or attach it to an email.
              </p>
              <Link
                href={`/events/shift-your-summer/flyer?group=${clean}`}
                className={PILL}
              >
                Open the printable flyer &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
