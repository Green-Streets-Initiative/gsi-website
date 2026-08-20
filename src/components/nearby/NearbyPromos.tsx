'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { NearbyPromo } from '@/lib/nearby/alerts'

/**
 * Active contextual promos for the /nearby tree. NearbySnapshot fetches them
 * from /api/nearby/promo and provides them here; the alert-detail blocks read
 * them through `useNearbyPromos()` and match one to their alert, rather than
 * threading a `promos` prop through the whole component tree.
 */
const NearbyPromosContext = createContext<NearbyPromo[]>([])

export function NearbyPromosProvider({ promos, children }: { promos: NearbyPromo[]; children: ReactNode }) {
  return <NearbyPromosContext.Provider value={promos}>{children}</NearbyPromosContext.Provider>
}

export function useNearbyPromos(): NearbyPromo[] {
  return useContext(NearbyPromosContext)
}
