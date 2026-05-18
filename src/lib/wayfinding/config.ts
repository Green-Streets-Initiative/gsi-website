import { createClient } from '@supabase/supabase-js'
import { WayfindingEvent, WayfindingBusiness } from './types'
import { CARNAVAL_EVENT, CARNAVAL_RESTAURANTS } from './static-carnaval'
import { TASTE_EVENT, TASTE_BUSINESSES } from './static-tasteofsomerville'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function fetchEventConfig(slug: string): Promise<WayfindingEvent | null> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('wayfinding_events')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (!error && data) return data as WayfindingEvent
  } catch {
    // table may not exist yet
  }

  if (slug === 'carnaval') return CARNAVAL_EVENT
  if (slug === 'tasteofsomerville') return TASTE_EVENT
  return null
}

export async function fetchBusinesses(eventId: string): Promise<WayfindingBusiness[]> {
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('wayfinding_businesses')
      .select('*')
      .eq('event_id', eventId)
      .eq('show_on_map', true)

    if (!error && data && data.length > 0) return data as WayfindingBusiness[]
  } catch {
    // table may not exist yet
  }

  if (eventId === 'static-carnaval') return CARNAVAL_RESTAURANTS
  if (eventId === 'static-tasteofsomerville') return TASTE_BUSINESSES
  return []
}

export async function fetchTranslations(eventId: string, locale: string): Promise<Record<string, string>> {
  if (locale === 'en') return {}
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('wayfinding_translations')
      .select('key, value')
      .eq('event_id', eventId)
      .eq('locale', locale)

    if (!error && data) return Object.fromEntries(data.map(r => [r.key, r.value]))
  } catch {
    // table may not exist yet
  }
  return {}
}
