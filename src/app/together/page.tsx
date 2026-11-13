import type { Metadata } from 'next'
import TogetherFrame, { togetherMetadata } from '@/components/together/TogetherFrame'
import { siteLocale } from '@/lib/site-locale'
import SignUp from './SignUp'

type Props = { searchParams: Promise<{ lang?: string | string[]; kind?: string | string[] }> }

/** ?kind=guide (the MassBike post, the guide emails): the signed-out page speaks to someone offering to go with a neighbor. */
const guideLink = (k: string | string[] | undefined) => (Array.isArray(k) ? k[0] : k) === 'guide'

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams
  return togetherMetadata(await siteLocale(sp.lang), guideLink(sp.kind) ? 'guide' : undefined)
}

/** gogreenstreets.org/together in the page's language: ?lang= (the app sends it), else the browser's. */
export default async function Page({ searchParams }: Props) {
  const sp = await searchParams
  const locale = await siteLocale(sp.lang)
  return (
    <TogetherFrame locale={locale} audience={guideLink(sp.kind) ? 'guide' : undefined}>
      <SignUp locale={locale} />
    </TogetherFrame>
  )
}
