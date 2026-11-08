import TranslatedRulesPage, { rulesMetadata } from '@/components/translated/WalkRideDayRules'

// Draft: the Walk/Ride Day official rules in Portuguese, an AI translation pending
// a native speaker's review (content/translations/REVIEW.md). The English
// rules stay the official text. /preview is never indexed or linked.
export const revalidate = 3600
export const metadata = rulesMetadata('pt-BR')

export default function Page() {
  return <TranslatedRulesPage locale="pt-BR" />
}
