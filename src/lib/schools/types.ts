/** Shared between the server query (queries.ts) and the client board. */
export const MIN_RANKED_SCHOOLS = 3

export interface SchoolStanding {
  group_id: string
  name: string
  logo_url: string | null
  /** Registry slug → /shift-your-semester/<slug>; null for a school without a page. */
  page_slug: string | null
  shift_rate: number
  active_trips: number
  member_count: number
  /** 1-based, ties share a rank. */
  rank: number
}
