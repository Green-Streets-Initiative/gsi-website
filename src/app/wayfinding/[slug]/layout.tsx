import type { Metadata } from 'next'
import { fetchEventConfig } from '@/lib/wayfinding/config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const event = await fetchEventConfig(slug)
  if (!event) return { title: 'Event Not Found' }

  const displayDate = event.is_rain_date && event.date_rain ? event.date_rain : event.date_primary
  return {
    title: `${event.name} — Getting around`,
    description: `Wayfinding for ${event.name}. ${event.organizer_name ? `Presented by ${event.organizer_name}.` : ''} ${displayDate}`,
    openGraph: {
      title: `${event.name} — Getting around`,
      description: `Find your way to ${event.name} by bike, bus, or foot.`,
    },
  }
}

export default async function WayfindingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const event = await fetchEventConfig(slug)
  const accentColor = event?.accent_color ?? '#D81B60'

  return (
    <div
      className="h-dvh w-full flex flex-col overflow-hidden bg-white"
      style={{ '--accent': accentColor, '--accent-light': `${accentColor}20` } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
