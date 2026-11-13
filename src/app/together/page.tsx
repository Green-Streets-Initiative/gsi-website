import type { Metadata } from 'next'
import TogetherFrame, { togetherMetadata } from '@/components/together/TogetherFrame'
import type { ShellAudience } from '@/components/together/TogetherShell'
import { siteLocale } from '@/lib/site-locale'
import SignUp from './SignUp'

type Props = { searchParams: Promise<{ lang?: string | string[]; kind?: string | string[] }> }

/** ?kind=guide or ?kind=newcomer (the MassBike post, the Shift emails): the signed-out page speaks to that person. */
function audienceFrom(k: string | string[] | undefined): ShellAudience | undefined {
  const v = Array.isArray(k) ? k[0] : k
  return v === 'guide' || v === 'newcomer' ? v : undefined
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams
  return togetherMetadata(await siteLocale(sp.lang), audienceFrom(sp.kind))
}

/** gogreenstreets.org/together in the page's language: ?lang= (the app sends it), else the browser's. */
export default async function Page({ searchParams }: Props) {
  const sp = await searchParams
  const locale = await siteLocale(sp.lang)
  return (
    <TogetherFrame locale={locale} audience={audienceFrom(sp.kind)}>
      <SignUp locale={locale} />
    </TogetherFrame>
  )
}
