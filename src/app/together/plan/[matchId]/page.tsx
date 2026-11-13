import type { Metadata } from 'next'
import TogetherFrame, { togetherMetadata } from '@/components/together/TogetherFrame'
import { siteLocale } from '@/lib/site-locale'
import Plan from './Plan'

type Props = {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{ lang?: string | string[] }>
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  // Someone's own plan: never in search.
  return { ...togetherMetadata(await siteLocale((await searchParams).lang)), robots: { index: false, follow: false } }
}

/**
 * gogreenstreets.org/together/plan/<match id>: a first trip plan, where the
 * plan notice emails link (Shift notify-partner-matches). In the page's
 * language: ?lang= (the email sends it), else the browser's.
 */
export default async function Page({ params, searchParams }: Props) {
  const [{ matchId }, { lang }] = await Promise.all([params, searchParams])
  const locale = await siteLocale(lang)
  return (
    <TogetherFrame locale={locale}>
      <Plan matchId={matchId} locale={locale} />
    </TogetherFrame>
  )
}
