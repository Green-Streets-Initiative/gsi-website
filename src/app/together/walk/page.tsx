import type { Metadata } from 'next'
import TogetherFrame, { togetherMetadata } from '@/components/together/TogetherFrame'
import { siteLocale } from '@/lib/site-locale'
import Walk from './Walk'

type Props = { searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return togetherMetadata(await siteLocale((await searchParams).lang))
}

/** gogreenstreets.org/together/walk (walking together, the app's partner-walk screen) in the page's language: ?lang=, else the browser's. */
export default async function Page({ searchParams }: Props) {
  const locale = await siteLocale((await searchParams).lang)
  return (
    <TogetherFrame locale={locale}>
      <Walk locale={locale} />
    </TogetherFrame>
  )
}
