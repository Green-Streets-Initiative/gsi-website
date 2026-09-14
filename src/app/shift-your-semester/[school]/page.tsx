import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SchoolPage from '../SchoolPage'
import { loadSchoolPage } from '../_lib/load'
import { getSchool, SCHOOLS } from '@/lib/semester/schools'
import { SEMESTER_CODE_LIVE, SEMESTER_REWARD, SEMESTER_TRIPS, SEMESTER_WINDOW_DAYS } from '@/lib/semester/campaign'

export const revalidate = 3600

export function generateStaticParams() {
  return SCHOOLS.map((s) => ({ school: s.slug }))
}

type Props = { params: Promise<{ school: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { school: slug } = await params
  const school = getSchool(slug)
  if (!school) return { title: 'Shift Your Semester | Green Streets Initiative' }
  // Per-school search titles: these pages rank on page one for what students
  // actually search ("bu cycle kitchen", "mit t pass"); the campaign template
  // is the fallback only.
  const title = school.seoTitle ?? `Shift Your Semester at ${school.name} | Green Streets Initiative`
  const description =
    school.seoDescription ??
    `Walk, bike, and ride the T at ${school.name}. Verify your school email on Shift, take ${SEMESTER_TRIPS} active trips in ${SEMESTER_WINDOW_DAYS} days, and unlock a ${SEMESTER_REWARD} reward.`
  const url = `https://www.gogreenstreets.org/shift-your-semester/${school.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: 'Green Streets Initiative' },
  }
}

export default async function SchoolRoute({ params }: Props) {
  const { school: slug } = await params
  const d = await loadSchoolPage(slug, { codeLive: SEMESTER_CODE_LIVE })
  if (!d) notFound()
  return <SchoolPage d={d} />
}
