import type { ComponentType } from 'react'
import {
  DiscordLogo, FacebookLogo, Globe, InstagramLogo, LinkSimple, LinktreeLogo, TiktokLogo, WhatsappLogo, XLogo, YoutubeLogo,
} from '@phosphor-icons/react/dist/ssr'
import { SOCIAL_LABEL } from '@/lib/social-links'

/**
 * Where to follow an organizer: their own channels (WhatsApp group, Partiful,
 * Instagram…) as buttons, so someone who finds a ride on the web stays in
 * touch with the organizer directly. Used on the ride page and the host page
 * alike. Order: the channels that bring the next ride to your phone first
 * (chats and invites), then social, then the website.
 */

type Icon = ComponentType<{ size?: number; weight?: 'regular' | 'bold' | 'fill'; 'aria-hidden'?: boolean }>

const ICON: Record<string, Icon> = {
  whatsapp: WhatsappLogo, instagram: InstagramLogo, facebook: FacebookLogo, discord: DiscordLogo,
  youtube: YoutubeLogo, tiktok: TiktokLogo, twitter: XLogo, x: XLogo, linktree: LinktreeLogo,
}

/** What each channel is for, in a few words, when it isn't obvious. */
const WHAT: Record<string, string> = {
  whatsapp: 'Group chat',
  partiful: 'Ride invites',
  discord: 'Group chat',
  meetup: 'Ride invites',
  strava: 'Club',
}

const ORDER = ['whatsapp', 'partiful', 'discord', 'meetup', 'instagram', 'strava', 'facebook', 'bluesky', 'x', 'twitter', 'tiktok', 'youtube', 'linktree', 'eventbrite']

export function channelList(links: Record<string, string>, website?: string | null): { key: string; label: string; what?: string; url: string; Icon: Icon }[] {
  const rows: { key: string; label: string; what?: string; url: string; Icon: Icon }[] = Object.entries(links)
    .filter(([, u]) => /^https:\/\/\S+$/i.test(u))
    .sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
    .map(([k, u]) => ({ key: k, label: SOCIAL_LABEL[k] ?? k[0].toUpperCase() + k.slice(1), what: WHAT[k], url: u, Icon: ICON[k] ?? LinkSimple }))
  if (website && /^https?:\/\/\S+$/i.test(website)) rows.push({ key: 'website', label: 'Website', url: website, Icon: Globe })
  return rows
}

export default function OrganizerChannels({ links, website, className = '' }: {
  links: Record<string, string>
  website?: string | null
  className?: string
}) {
  const rows = channelList(links, website)
  if (rows.length === 0) return null
  return (
    <ul className={`flex flex-wrap gap-2 ${className}`}>
      {rows.map(({ key, label, what, url, Icon }) => (
        <li key={key}>
          <a href={url} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-(--ev-line-strong) bg-(--ev-card) px-3.5 text-[15px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)">
            <Icon size={20} weight="regular" aria-hidden />
            {label}
            {what && <span className="text-[14px] font-medium text-(--ev-ink-75)">{what}</span>}
          </a>
        </li>
      ))}
    </ul>
  )
}
