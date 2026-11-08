import { SectionHeading } from '@/components/org/Section'
import NewInfraRow from '@/components/new-infra/NewInfraRow'
import { comingWhen, type NewInfra } from '@/lib/new-infra'
import { todayKey } from '@/lib/organizers/ride-words'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'
import { rich } from '@/components/towns/rich'

/**
 * "New in {town}": bike lanes and paths that opened here in the last two
 * years (Shift 01577), newest first. What's coming is already the Get involved
 * list above, so it gets one line pointing there, not a second list.
 */
const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

export default function NewInTown({ info, townName, hasInvolved, locale = 'en' }: { info: NewInfra; townName: string; hasInvolved: boolean; locale?: SiteLocale }) {
  const t = translator(townsStrings, locale)
  const next = info.coming[0]
  const shown = info.opened.slice(0, 6)
  return (
    <div className="max-w-[720px]">
      <SectionHeading
        title={t('nit.title', { town: townName })}
        lede={t('nit.lede')}
      />
      <ul className="divide-y divide-navy/10 border-y border-navy/15">
        {shown.map((o) => (
          <li key={`${o.name}|${o.facility}`} className="py-3">
            <NewInfraRow o={o} onRoute={false} showTown={false} tone="town" locale={locale} />
          </li>
        ))}
      </ul>
      {info.opened.length > shown.length && (
        <p className="mt-3 text-[14px] text-ink-soft">{t('nit.more', { count: info.opened.length - shown.length })}</p>
      )}
      {next && (
        <p className="mt-4 text-[15px] text-ink-soft">
          {/* `what` is the stored hearing headline; it stays as stored. */}
          {rich(t('nit.coming', { what: next.what, when: lowerFirst(comingWhen(next, todayKey(), locale)) }), {
            b: (c) => <span className="font-semibold text-navy">{c}</span>,
          })}
          {hasInvolved && (
            <>
              {' '}
              <a href="#involved" className="font-semibold text-green-deep underline-offset-4 hover:underline">
                {t('nit.see')}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  )
}
