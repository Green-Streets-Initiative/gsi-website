import { redirect, notFound } from 'next/navigation'
import { loadWrdMonths } from '../_lib/results'

// The latest Walk/Ride Day that has a drawing, else the latest that has ended.
export const revalidate = 300

export default async function WalkRideDayLatestResults() {
  const months = await loadWrdMonths()
  const latest = months.find(m => m.drawn) ?? months[0]
  if (!latest) notFound()
  redirect(`/events/walk-ride-day/results/${latest.month}`)
}
