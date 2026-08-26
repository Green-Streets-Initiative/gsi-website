import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSchool, SCHOOLS } from '@/lib/semester/schools'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Shift Your Semester poster | Green Streets Initiative',
  robots: { index: false },
}

export function generateStaticParams() {
  return SCHOOLS.filter((s) => s.groupSlug).map((s) => ({ school: s.slug }))
}

type Props = { params: Promise<{ school: string }> }

export default async function SchoolPosterPage({ params }: Props) {
  const { school: slug } = await params
  const school = getSchool(slug)
  if (!school || !school.groupSlug) notFound()

  const supabase = createServerSupabaseClient()
  const { data: group } = await supabase
    .from('groups')
    .select('invite_code, status, access_ends_at')
    .eq('slug', school.groupSlug)
    .eq('status', 'active')
    .maybeSingle()
  if (!group) notFound()
  if (group.access_ends_at && new Date(group.access_ends_at) < new Date()) notFound()

  const joinUrl = `https://shift.gogreenstreets.org/join/${group.invite_code}`
  const qrSvg = await QRCode.toString(joinUrl, {
    type: 'svg',
    margin: 0,
    color: { dark: '#191A2E', light: '#ffffff' },
  })

  return (
    <main className="flyer-root min-h-screen bg-white text-[#191A2E]">
      <style>{`
        @page { size: letter; margin: 0.25in 0.5in; }
        @media print {
          .flyer-no-print { display: none !important; }
          .flyer-root { background: white !important; min-height: 0 !important; }
          body > :not(.flyer-root) { display: none !important; }
          [data-nextjs-toast], nextjs-portal { display: none !important; }
        }
        .flyer-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      `}</style>

      <div className="mx-auto max-w-[8.5in] px-8 py-6">
        <div className="flyer-no-print mb-6 flex items-center justify-between gap-4 rounded-2xl border border-[#191A2E]/10 bg-[#F4F8EE] px-5 py-3">
          <Link href={`/shift-your-semester/${school.slug}`} className="text-sm font-semibold text-[#191A2E]/70 hover:text-[#191A2E]">
            &larr; Back to the {school.shortName} page
          </Link>
          <PrintButton />
        </div>

        {/* Poster */}
        <div className="rounded-[24px] bg-[#191A2E] px-10 py-12 text-center text-white">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#BAF14D]">
            Shift Your Semester
          </p>
          <h1 className="mx-auto mb-4 max-w-[7in] font-display text-[44px] font-extrabold leading-[1.05] tracking-tighter">
            Walk. Bike. Ride the T.
            <br />
            Get $25 for it.
          </h1>
          <p className="mx-auto mb-8 max-w-[5.5in] text-[17px] leading-relaxed text-white/85">
            Join {school.name} on the free Shift app. Take 10 active trips in 30 days
            and pick a $25 reward — ~60 local merchants or national gift cards.
          </p>

          <div className="mx-auto mb-8 flex items-center justify-center gap-8">
            <div className="flex h-[180px] w-[180px] items-center justify-center rounded-2xl bg-white p-3">
              <div className="h-[156px] w-[156px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
            <div className="text-left">
              <p className="mb-1 text-sm font-bold uppercase tracking-widest text-white/75">
                Scan to join, or enter code
              </p>
              <p className="font-mono text-[40px] font-extrabold tracking-[0.18em] text-[#BAF14D]">
                {group.invite_code}
              </p>
              <p className="mt-1 text-sm text-white/75">in the Shift app &rarr; Community &rarr; Join</p>
            </div>
          </div>

          <p className="text-[13px] text-white/70">
            Free app · iOS &amp; Android · gogreenstreets.org/shift-your-semester/{school.slug}
          </p>
        </div>

        <p className="flyer-no-print mt-4 text-center text-sm text-[#191A2E]/60">
          Prints on one letter-size page. Post it in dorms, dining halls, and club spaces.
        </p>
      </div>
    </main>
  )
}
