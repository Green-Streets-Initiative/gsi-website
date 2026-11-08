import type { Metadata } from 'next'
import TogetherFrame, { togetherMetadata } from '@/components/together/TogetherFrame'
import { siteLocale } from '@/lib/site-locale'
import SignUp from './SignUp'

type Props = { searchParams: Promise<{ lang?: string | string[] }> }

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  return togetherMetadata(await siteLocale((await searchParams).lang))
}

/** gogreenstreets.org/together in the page's language: ?lang= (the app sends it), else the browser's. */
export default async function Page({ searchParams }: Props) {
  const locale = await siteLocale((await searchParams).lang)
  return (
    <TogetherFrame locale={locale}>
      <SignUp locale={locale} />
    </TogetherFrame>
  )
}
