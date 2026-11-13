import { createServerSupabaseClient } from '@/lib/supabase-server'

/** One of the organizer's open rides, as their page lists it. */
export interface OrganizerRide {
  code: string
  name: string
  activity: 'bike' | 'walk' | string | null
  meetup_name: string | null
  next: string
  start_time: string | null
}

/**
 * The person who organizes a ride, when their Shift profile is public
 * (get_ride_organizer_public, Shift 01752): first name and last initial,
 * photo, bio, since when, rides led, people who came, and their open rides.
 * Keyed by the ride's code, so no account id goes into a link.
 */
export interface RideOrganizer {
  public: true
  name: string
  first_name: string
  avatar_url: string | null
  bio: string | null
  since: string | null
  led: number
  came: number
  rides: OrganizerRide[]
}

/** Null when there's no page for them: a private profile, a bus, or the lookup failed. */
export async function rideOrganizer(code: string): Promise<RideOrganizer | null> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('get_ride_organizer_public', { p_code: code })
    if (error || !data || (data as { public?: boolean }).public !== true) return null
    return data as RideOrganizer
  } catch {
    return null
  }
}
