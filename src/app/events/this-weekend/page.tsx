import { KindPage, kindMetadata } from '../_lib/kind-page'

// A kind page (calendar growth plan bet 4): see src/lib/event-kinds.ts.
export const revalidate = 1800

export function generateMetadata() {
  return kindMetadata('this-weekend')
}

export default function Page() {
  return <KindPage slug="this-weekend" />
}
