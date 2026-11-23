'use client'

import { useEffect, useState } from 'react'
import { toneClass } from '@/components/events/EventsTone'
import { Card, Notice, Spinner, cx } from '@/components/organizers/ui'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { planStrings } from '@/lib/site-strings/together-plan'
import { LESSON_KEY, openLessonPlan, openWithLessonKey } from '@/lib/together-plan'
import Plan from '@/app/together/plan/[matchId]/Plan'
import '@/components/events/events-tone.css'

/** Opens the lesson's plan with the key from the email, then shows Shift Together's plan page for it. */
export default function LessonPlan({ token, locale }: { token: string; locale: SiteLocale }) {
  const t = translator(planStrings, locale)
  const valid = LESSON_KEY.test(token)
  const [id, setId] = useState<string | null | undefined>(valid ? undefined : null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!valid) return
    let live = true
    openWithLessonKey(token)
    openLessonPlan(token)
      .then((r) => { if (live) setId(r?.id ?? null) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [token, valid])

  return (
    <div className={cx('min-h-[70dvh] bg-(--ev-bg) text-(--ev-ink)', toneClass('light'))}>
      <div className="mx-auto w-full max-w-[920px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        {failed ? (
          <Notice tone="off">{t('plan.load_failed')}</Notice>
        ) : id === undefined ? (
          <Spinner label={t('plan.opening')} />
        ) : id === null ? (
          <Card className="mx-auto max-w-lg">
            <h1 className="font-display text-[24px] font-extrabold">{t('lesson.not_open')}</h1>
          </Card>
        ) : (
          <Plan matchId={id} locale={locale} lessonKey={token} />
        )}
      </div>
    </div>
  )
}
