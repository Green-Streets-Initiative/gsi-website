import TranslatedWalkRideDayPage, { walkRideDayMetadata } from '@/components/translated/WalkRideDayPage'

// Draft: the Walk/Ride Day page in Portuguese, for a native speaker's review
// (content/translations/REVIEW.md). /preview is never indexed or linked.
export const revalidate = 3600
export const metadata = walkRideDayMetadata('pt-BR')

export default function Page() {
  return <TranslatedWalkRideDayPage locale="pt-BR" />
}
