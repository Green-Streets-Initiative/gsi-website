import type { ComponentType, CSSProperties } from 'react'
import {
  Bike, Bus, Calendar, Flag, Footprints, GraduationCap, MapPin,
  Megaphone, Package, PartyPopper, Users, Wrench, Zap,
} from 'lucide-react'

/**
 * The one event-type icon map. `TypeMeta.icon` in src/lib/events.ts names a
 * Lucide component; every surface that renders event types (calendar cards,
 * event detail, town pages, the nearby snapshot) resolves it here so they
 * can't drift apart. Unknown names should fall back to Calendar.
 */
export const EVENT_TYPE_ICONS: Record<string, ComponentType<{ size?: number; style?: CSSProperties }>> = {
  Bike,
  Bus,
  Calendar,
  Flag,
  Footprints,
  GraduationCap,
  MapPin,
  Megaphone,
  Package,
  PartyPopper,
  Users,
  Wrench,
  Zap,
}
