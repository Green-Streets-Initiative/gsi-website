import type { Metadata } from 'next'
import { TranslatedGuidePage, translatedGuideMetadata } from '@/lib/guides/translated-guide-page'

// A guide in Spanish. Shared with the other languages: lib/guides/translated-guide-page.tsx.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return translatedGuideMetadata((await params).slug, 'es')
}

export default async function SpanishGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  return <TranslatedGuidePage slug={(await params).slug} locale="es" />
}
