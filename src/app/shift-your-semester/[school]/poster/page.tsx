import type { Metadata } from 'next'
import Link from 'next/link'
import QRCode from 'qrcode'
import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getSchool, SCHOOLS } from '@/lib/semester/schools'
import {
  SEMESTER_CODE, SEMESTER_CODE_LIVE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS,
} from '@/lib/semester/campaign'
import PrintButton from '@/app/events/shift-your-summer/flyer/PrintButton'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Shift Your Semester poster | Green Streets Initiative',
  robots: { index: false },
}

export function generateStaticParams() {
  return SCHOOLS.map((s) => ({ school: s.slug }))
}

type Props = { params: Promise<{ school: string }> }

/**
 * One letter-size poster per school. Code live: the QR is the smart link
 * and the copy says "scan twice" — the first scan (no app) lands on the
 * campaign page with store buttons, the second (app installed) opens the app
 * and prompts the school-email check. The poster prints SEMESTER as the
 * fallback — never two codes on one sheet. Pre-launch: the group join link
 * and invite code, as before.
 */
export default async function SchoolPosterPage({ params }: Props) {
  const { school: slug } = await params
  const school = getSchool(slug)
  if (!school) notFound()

  let code = SEMESTER_CODE
  // Code live: the smart link. First scan (no app) → the campaign page with store
  // buttons; second scan (app installed) → opens the app and prompts the
  // school-email check. Pre-launch: the group join link.
  let qrTarget = `https://shift.gogreenstreets.org/go/semester?utm_source=poster&utm_medium=print&utm_campaign=semester&utm_content=${school.slug}`
  let codeCaption = 'Enter in the Shift app after you install'

  if (!SEMESTER_CODE_LIVE) {
    if (!school.groupSlug) notFound()
    const supabase = createServerSupabaseClient()
    const { data: group } = await supabase
      .from('groups')
      .select('invite_code, status, access_ends_at')
      .eq('slug', school.groupSlug)
      .eq('status', 'active')
      .maybeSingle()
    if (!group) notFound()
    if (group.access_ends_at && new Date(group.access_ends_at) < new Date()) notFound()
    code = group.invite_code
    qrTarget = `https://shift.gogreenstreets.org/join/${group.invite_code}`
    codeCaption = 'in the Shift app → Community → Join'
  }

  const qrSvg = await QRCode.toString(qrTarget, { type: 'svg', margin: 0, color: { dark: '#191A2E', light: '#ffffff' } })

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

        <div className="rounded-[24px] bg-[#191A2E] px-10 py-12 text-center text-white">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-[#BAF14D]">Shift Your Semester</p>
          <h1 className="mx-auto mb-4 max-w-[7in] font-display text-[44px] font-extrabold leading-[1.05] tracking-tighter">
            Walk. Bike. Ride the T.
            <br />
            Get {SEMESTER_REWARD} for it.
          </h1>
          <p className="mx-auto mb-8 max-w-[5.5in] text-[17px] leading-relaxed text-white/85">
            {school.name} students, faculty, and staff: take {SEMESTER_TRIPS} walking, biking, or transit trips in{' '}
            {SEMESTER_WINDOW_DAYS} days on Shift and unlock a {SEMESTER_REWARD} reward — a local shop or a gift card, your choice.
          </p>

          <div className="mx-auto mb-8 flex items-center justify-center gap-8">
            <div className="flex h-[180px] w-[180px] items-center justify-center rounded-2xl bg-white p-3">
              <div className="h-[156px] w-[156px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            </div>
            <div className="max-w-[3.6in] text-left">
              {SEMESTER_CODE_LIVE ? (
                <ol className="mb-3 list-decimal space-y-1 pl-5 text-[15px] leading-snug text-white/85">
                  <li>Scan once to download Shift and sign up.</li>
                  <li>Scan again to join Shift Your Semester.</li>
                  <li>Verify your school email when the app asks.</li>
                </ol>
              ) : (
                <p className="mb-1 text-sm font-bold uppercase tracking-widest text-white/75">Scan to join, or enter code</p>
              )}
              {SEMESTER_CODE_LIVE && <p className="text-sm text-white/75">No QR handy? Enter this code in the app:</p>}
              <p className="font-mono text-[34px] font-extrabold tracking-[0.18em] text-[#BAF14D]">{code}</p>
              {!SEMESTER_CODE_LIVE && <p className="mt-1 text-sm text-white/75">{codeCaption}</p>}
            </div>
          </div>

          <p className="text-[13px] text-white/75">
            Free app · iOS &amp; Android · gogreenstreets.org/semester/{school.slug}
          </p>
        </div>

        <p className="flyer-no-print mt-4 text-center text-sm text-[#191A2E]/60">
          Prints on one letter-size page. Post it in dorms, dining halls, and club spaces.
        </p>
      </div>
    </main>
  )
}
