import type { Metadata } from 'next'
import { TranslatedGuidePage, translatedGuideMetadata } from '@/lib/guides/translated-guide-page'

// A guide in Chinese (Simplified). Shared with the other languages: lib/guides/translated-guide-page.tsx.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return translatedGuideMetadata((await params).slug, 'zh-Hans')
}

export default async function ChineseGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  return <TranslatedGuidePage slug={(await params).slug} locale="zh-Hans" />
}
