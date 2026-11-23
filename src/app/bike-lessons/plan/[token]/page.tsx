import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HtmlLang from '@/components/HtmlLang'
import { siteLocale } from '@/lib/site-locale'
import LessonPlan from './LessonPlan'

/*
 * gogreenstreets.org/bike-lessons/plan/<key>: a free street lesson's plan
 * (Shift 01889, Keith 2026-11-23). Shift Together's first-ride plan, for a
 * learner and the instructor who said yes, with no Shift account: the
 * learner's key (from "Help plan your lesson" in the email that names the
 * instructor) answers the four questions; the instructor's key (from the
 * intro email and the notice when the learner answers) plans the route and
 * time. Persona: first-timer. Reached only from those emails; never indexed.
 */
export const metadata: Metadata = {
  title: 'Plan your bike lesson',
  robots: { index: false, follow: false },
}

type Props = {
  params: Promise<{ token: string }>
  searchParams: Promise<{ lang?: string | string[] }>
}

export default async function Page({ params, searchParams }: Props) {
  const [{ token }, { lang }] = await Promise.all([params, searchParams])
  const locale = await siteLocale(lang)
  return (
    <>
      <HtmlLang locale={locale} />
      <Nav variant="light" locale={locale} />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <LessonPlan token={token} locale={locale} />
      </main>
      <Footer variant="light" locale={locale} />
    </>
  )
}
