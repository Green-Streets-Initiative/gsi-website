import type { Metadata } from 'next'
import { TranslatedGuidePage, translatedGuideMetadata } from '@/lib/guides/translated-guide-page'

// A guide in Portuguese (Brazil). Shared with the other languages: lib/guides/translated-guide-page.tsx.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return translatedGuideMetadata((await params).slug, 'pt-BR')
}

export default async function PortugueseGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  return <TranslatedGuidePage slug={(await params).slug} locale="pt-BR" />
}
