import Link from 'next/link'
import type { SiteLocale } from '@/lib/site-i18n'
import { eventsT } from '@/lib/events-i18n'

/**
 * The calendar is built from groups' own public posts, so every host page and
 * event page carries a way to correct it. No account: the form goes to GSI.
 */
export default function FixListingLink({
  host,
  event,
  locale = 'en',
}: {
  host?: { id: string; name: string }
  event?: { id: string; title: string }
  /** A translated event page passes its language; host pages stay English. */
  locale?: SiteLocale
}) {
  const t = eventsT(locale)
  const q = new URLSearchParams()
  if (host) q.set('host', host.id)
  if (event) q.set('event', event.id)
  return (
    <p className="text-[14px] text-(--ev-ink-80)">
      {host ? `Run ${host.name}?` : t('fix.run_event')} {t('fix.built_from')}{' '}
      <Link href={`/events/fix?${q.toString()}`} className="font-semibold text-(--ev-accent) hover:underline">
        {t('fix.link')}
      </Link>
      {t('detail.sentence_end')}
    </p>
  )
}
