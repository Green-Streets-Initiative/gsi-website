import type { Metadata } from 'next'
import TranslatedTownPage, { townMetadata } from '@/components/translated/TownPage'
import { TRANSLATED_TOWNS } from '@/lib/translated-pages'

// Draft: a town page in Portuguese for the five towns in the language plan
// (content/translations/REVIEW.md). Live numbers, same as the English page.
// /preview is never indexed or linked.
export const revalidate = 3600
export const dynamicParams = false

export function generateStaticParams() {
  return TRANSLATED_TOWNS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return townMetadata((await params).slug, 'pt-BR')
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  return <TranslatedTownPage slug={(await params).slug} locale="pt-BR" />
}
