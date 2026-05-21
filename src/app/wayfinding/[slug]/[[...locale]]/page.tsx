import { notFound } from 'next/navigation'
import { fetchEventConfig, fetchBusinesses, fetchDetourConfig } from '@/lib/wayfinding/config'
import { getLocaleFromParams } from '@/lib/wayfinding/i18n'
import { WayfindingClient } from './client'

export default async function WayfindingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; locale?: string[] }>
  searchParams: Promise<{ embed?: string }>
}) {
  const { slug, locale: localeParam } = await params
  const { embed } = await searchParams
  const event = await fetchEventConfig(slug)
  if (!event) notFound()

  const locale = getLocaleFromParams(localeParam)
  if (locale !== 'en' && !event.locales.includes(locale)) notFound()

  const businesses = await fetchBusinesses(event.id)
  const detours = fetchDetourConfig(slug)
  const isEmbed = embed === '1'

  return (
    <WayfindingClient
      event={event}
      businesses={businesses}
      detours={detours}
      locale={locale}
      isEmbed={isEmbed}
    />
  )
}
