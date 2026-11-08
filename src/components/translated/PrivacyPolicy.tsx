import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import HtmlLang from '@/components/HtmlLang'
import Footer from '@/components/Footer'
import { HTML_LANG, type DraftLocale } from '@/lib/translated-pages'
import { LegalDraftBanner } from './TranslationNotes'
import { A } from './legal'
import PrivacyEs from './privacy-es'
import PrivacyPtBR from './privacy-pt-BR'

/*
 * The privacy policy (/privacy) in Spanish or Portuguese: an AI translation
 * of the November 2026 English text, section for section, pending a native
 * speaker's review. The English policy stays the official text (the banner
 * says so). When src/app/privacy/page.tsx changes, privacy-es.tsx and
 * privacy-pt-BR.tsx change in the same edit, and "Last updated" moves with it.
 */

const COPY = {
  es: {
    title: 'Política de privacidad',
    eyebrow: 'Legal',
    updated: 'Shift de Green Streets Initiative · Última actualización: noviembre de 2026',
    contact: 'Contacto:',
    meta: { title: 'Política de privacidad – Green Streets Initiative', description: 'Cómo Shift de Green Streets Initiative recoge, usa, guarda y protege su información personal.' },
  },
  'pt-BR': {
    title: 'Política de Privacidade',
    eyebrow: 'Jurídico',
    updated: 'Shift da Green Streets Initiative · Última atualização: novembro de 2026',
    contact: 'Contato:',
    meta: { title: 'Política de Privacidade – Green Streets Initiative', description: 'Como o Shift da Green Streets Initiative coleta, usa, armazena e protege suas informações pessoais.' },
  },
} as const

export function privacyMetadata(locale: DraftLocale): Metadata {
  return { ...COPY[locale].meta }
}

export default function TranslatedPrivacyPage({ locale }: { locale: DraftLocale }) {
  const c = COPY[locale]
  return (
    <>
      <Nav variant="light" locale={locale} />
      <HtmlLang locale={locale} />
      <main lang={HTML_LANG[locale]} className="bg-cream pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 py-8 lg:py-10">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.14em] text-forest">{c.eyebrow}</p>
          <h1 className="font-serif text-[clamp(2.25rem,6vw,4.25rem)] font-normal leading-[1.02] tracking-[-0.01em] text-navy">
            {c.title}
          </h1>
          <p className="mt-4 text-[15px] text-ink-soft">{c.updated}</p>
          <p className="mt-1 text-[15px] text-ink-soft">
            {c.contact} <a href="mailto:info@gogreenstreets.org" className={A}>info@gogreenstreets.org</a>
          </p>
          <LegalDraftBanner locale={locale} page="privacy" />
          <hr className="my-10 border-navy/10" />
          <div className="privacy-content space-y-10">{locale === 'es' ? <PrivacyEs /> : <PrivacyPtBR />}</div>
        </article>
      </main>
      <Footer variant="light" />
    </>
  )
}
