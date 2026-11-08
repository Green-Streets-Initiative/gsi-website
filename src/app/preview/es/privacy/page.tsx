import TranslatedPrivacyPage, { privacyMetadata } from '@/components/translated/PrivacyPolicy'

// Draft: the privacy policy in Spanish, an AI translation pending a native
// speaker's review (content/translations/REVIEW.md). The English policy stays
// the official text. /preview is never indexed or linked.
export const metadata = privacyMetadata('es')

export default function Page() {
  return <TranslatedPrivacyPage locale="es" />
}
