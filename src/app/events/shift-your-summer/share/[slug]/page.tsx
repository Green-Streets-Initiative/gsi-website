import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
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
  const pageUrl = `https://gogreenstreets.org/events/shift-your-summer/share/${clean}`

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
        url: `https://gogreenstreets.org/api/og/share/employer/${clean}`,
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
  const sharePageUrl = `https://gogreenstreets.org/events/shift-your-summer/share/${clean}`

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
      <Nav />
      <main className="bg-[#191A2E] text-white" style={{ paddingTop: '60px' }}>
        <section className="px-8 py-16 md:py-20">
          <div className="mx-auto max-w-[680px]">
            <Link
              href="/events/shift-your-summer"
              className="mb-8 inline-flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
            >
              &larr; Back to Shift Your Summer
            </Link>

            {/* Company header */}
            <div className="mb-6 flex items-center gap-4">
              {group.logo_url && (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={group.logo_url}
                    alt={group.name}
                    className="max-h-[48px] max-w-[48px] object-contain"
                  />
                </div>
              )}
              <div>
                <h1 className="font-display text-[clamp(1.75rem,4vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                  Join {group.name}
                  {' '}for Shift&nbsp;Your&nbsp;Summer
                </h1>
              </div>
            </div>

            <p className="mb-10 text-[1.0625rem] leading-[1.65] text-white/85">
              Walk, bike, and take transit this summer — and compete for prizes from brands like Segway, Quad Lock, and Kryptonite. Join your team in the Shift app to get started.
            </p>

            {/* Primary CTA — deep link */}
            <a
              href={joinUrl}
              className="mb-8 inline-flex w-full items-center justify-center rounded-full bg-[#BAF14D] px-8 py-4 text-center text-lg font-extrabold text-[#191A2E] transition-opacity hover:opacity-85 sm:w-auto"
            >
              Join {group.name}&rsquo;s team
            </a>

            {/* How to join */}
            <div className="mb-10 rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-6">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/75">
                How to join
              </p>
              <ol className="space-y-4 text-[0.9375rem] leading-[1.5] text-white/85">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold text-[#191A2E]">1</span>
                  <span>Download the Shift app on <a href={IOS_URL} className="font-semibold text-white underline underline-offset-2" target="_blank" rel="noopener noreferrer">iOS</a> or <a href={ANDROID_URL} className="font-semibold text-white underline underline-offset-2" target="_blank" rel="noopener noreferrer">Android</a>.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold text-[#191A2E]">2</span>
                  <span>Create your account.</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#BAF14D] text-sm font-extrabold text-[#191A2E]">3</span>
                  <span>Enter code <strong className="font-mono tracking-wider text-[#BAF14D]">{group.invite_code}</strong> to join {group.name}&rsquo;s team.</span>
                </li>
              </ol>
              <p className="mt-4 text-sm text-white/75">
                Already have the app? <a href={joinUrl} className="font-semibold text-[#BAF14D] hover:opacity-85">Tap here to join directly.</a>
              </p>
            </div>

            {/* QR code + invite code */}
            <div className="mb-10 grid gap-6 sm:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center">
                <div className="flex h-[140px] w-[140px] items-center justify-center rounded-2xl bg-white p-2">
                  <div
                    className="h-[120px] w-[120px]"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                </div>
                <p className="mt-2 text-center text-xs font-bold uppercase tracking-widest text-white/75">
                  Scan to join
                </p>
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-sm leading-[1.6] text-white/85">
                  Scan the QR code with your phone to join {group.name}&rsquo;s team. If you already have Shift, it opens the join screen automatically. If not, you&rsquo;ll see download links.
                </p>
              </div>
            </div>

            {/* Share kit */}
            <div className="mb-10 rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-6">
              <p className="mb-4 text-xs font-bold uppercase tracking-widest text-white/75">
                Share with your team
              </p>
              <CorporateShareKit
                shareUrl={sharePageUrl}
                blurb={blurb}
                emailSubject={emailSubject}
                emailBody={emailBody}
                inviteCode={group.invite_code}
              />
            </div>

            {/* Flyer link */}
            <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] p-6">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-white/75">
                Print or post the flyer
              </p>
              <p className="mb-4 text-sm leading-[1.6] text-white/85">
                A branded one-page flyer with your team code. Print it for the office, post it on a bulletin board, or attach it to an email.
              </p>
              <Link
                href={`/events/shift-your-summer/flyer?group=${clean}`}
                className="inline-flex items-center gap-2 rounded-full bg-[#BAF14D] px-5 py-2.5 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
              >
                Open the printable flyer &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
