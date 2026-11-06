import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SchoolPortalClient from './client'
import { getSchoolInfo } from './school-info'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>
}): Promise<Metadata> {
  const { code } = await params
  const info = await getSchoolInfo(code)
  if (!info) return { title: 'Shift for Schools' }

  const title = `${info.schoolName} — Shift for Schools`
  const description = `Classroom standings and safe walking and biking routes for ${info.schoolName} in ${info.city}.`
  return {
    title,
    description,
    // Portal URLs embed join codes — keep them out of search indexes.
    robots: { index: false },
    openGraph: {
      title,
      description,
      siteName: 'Green Streets Initiative',
      images: [{ url: '/og/shift-og.png', width: 1200, height: 630, alt: 'Shift for Schools by Green Streets Initiative' }],
      locale: 'en_US',
      type: 'website',
    },
  }
}

export default async function SchoolPortalPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const info = await getSchoolInfo(code)
  if (!info) return notFound()

  return <SchoolPortalClient {...info} />
}
