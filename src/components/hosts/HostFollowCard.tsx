'use client'

import { useState } from 'react'
import posthog from 'posthog-js'
import { Calendar, Code, Copy } from 'lucide-react'

/**
 * Two ways to follow a host without an account: subscribe to their calendar
 * (new dates appear on their own), or put their upcoming list on a website.
 * For groups that live on Instagram, the embed is often their only calendar.
 */
export default function HostFollowCard({ hostId, hostName }: { hostId: string; hostName: string }) {
  const [copied, setCopied] = useState<'feed' | 'embed' | null>(null)
  // The public address, not window.location: the links must match on the
  // server and in the browser, and a feed is always followed from the live site.
  const origin = 'https://www.gogreenstreets.org'
  const path = `/events/organizers/${encodeURIComponent(hostId)}`
  const feedHttps = `${origin}${path}/calendar.ics`
  const feedWebcal = feedHttps.replace(/^https?:/, 'webcal:')
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedWebcal)}`
  const embed = `<iframe src="${origin}${path}/embed" title="${hostName.replace(/"/g, '')} upcoming rides and walks" width="100%" height="520" style="border:0"></iframe>`

  const copy = async (what: 'feed' | 'embed') => {
    try {
      await navigator.clipboard.writeText(what === 'feed' ? feedHttps : embed)
      setCopied(what)
      setTimeout(() => setCopied(null), 2400)
    } catch { /* clipboard blocked; the text stays selectable */ }
    posthog.capture('host_follow', { host: hostId, method: what === 'feed' ? 'copy_feed' : 'copy_embed' })
  }

  const btn = 'inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-(--ev-line-strong) px-4 text-[14px] font-semibold text-(--ev-ink) hover:bg-(--ev-panel)'

  return (
    <div className="rounded-2xl border border-(--ev-line-mid) bg-(--ev-card) p-5 shadow-(--ev-shadow) lg:sticky lg:top-24">
      <p className="text-[17px] font-bold text-(--ev-ink)">Never miss a ride</p>
      <p className="mt-1 text-[14px] text-(--ev-ink-80)">
        Add {hostName} to your calendar. New dates show up there on their own.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <a href={google} target="_blank" rel="noopener noreferrer" onClick={() => posthog.capture('host_follow', { host: hostId, method: 'google' })}
           className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] bg-(--ev-accent-fill) px-4 text-[14px] font-bold text-(--ev-on-accent-fill) hover:opacity-90">
          <Calendar size={16} /> Add to Google Calendar
        </a>
        <a href={feedWebcal} onClick={() => posthog.capture('host_follow', { host: hostId, method: 'webcal' })} className={`${btn} justify-center`}>
          <Calendar size={16} /> Apple or Outlook calendar
        </a>
        <button onClick={() => copy('feed')} className={`${btn} justify-center`}>
          <Copy size={16} /> {copied === 'feed' ? 'Calendar link copied' : 'Copy the calendar link'}
        </button>
      </div>

      <div className="mt-5 border-t border-(--ev-line) pt-4">
        <p className="text-[15px] font-bold text-(--ev-ink)">Run this group?</p>
        <p className="mt-1 text-[14px] text-(--ev-ink-80)">
          Put this list on your website. It stays current as you post.
        </p>
        <button onClick={() => copy('embed')} className={`${btn} mt-2`}>
          <Code size={16} /> {copied === 'embed' ? 'Code copied' : 'Copy the code for your site'}
        </button>
        <p className="mt-3 text-[14px] text-(--ev-ink-80)">
          Plan rides, take RSVPs and post updates in{' '}
          <a href="/organizers" className="font-semibold text-(--ev-accent) hover:underline">the organizer tools</a>.
        </p>
      </div>
    </div>
  )
}
