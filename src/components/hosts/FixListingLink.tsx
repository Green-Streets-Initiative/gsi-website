import Link from 'next/link'

/**
 * The calendar is built from groups' own public posts, so every host page and
 * event page carries a way to correct it. No account: the form goes to GSI.
 */
export default function FixListingLink({
  host,
  event,
}: {
  host?: { id: string; name: string }
  event?: { id: string; title: string }
}) {
  const q = new URLSearchParams()
  if (host) q.set('host', host.id)
  if (event) q.set('event', event.id)
  return (
    <p className="text-[14px] text-(--ev-ink-80)">
      {host ? `Run ${host.name}?` : 'Run this event?'} We build this from public posts.{' '}
      <Link href={`/events/fix?${q.toString()}`} className="font-semibold text-(--ev-accent) hover:underline">
        Fix something or ask us to remove it
      </Link>
      .
    </p>
  )
}
