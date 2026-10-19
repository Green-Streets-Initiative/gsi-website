/**
 * A creator's video about a trail, embedded with credit. GSI does not make trail
 * reels; the people who do reach far more riders than we will, and the page's
 * job is to be the link they can put in a caption. Accepts a public Instagram
 * reel/post URL, a TikTok video URL, or a YouTube URL and renders the platform's
 * own embed player. Anything else renders nothing, so a bad URL cannot break the
 * page.
 */
type Embed = { src: string; vertical: boolean; platform: 'Instagram' | 'TikTok' | 'YouTube' }

export function parseVideoEmbed(url: string | null | undefined): Embed | null {
  if (!url) return null
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '')
  if (host === 'instagram.com') {
    const m = /^\/(reel|reels|p)\/([A-Za-z0-9_-]+)/.exec(u.pathname)
    if (m) return { src: `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/embed/`, vertical: true, platform: 'Instagram' }
  }
  if (host === 'tiktok.com') {
    const m = /\/video\/(\d+)/.exec(u.pathname)
    if (m) return { src: `https://www.tiktok.com/embed/v2/${m[1]}`, vertical: true, platform: 'TikTok' }
  }
  if (host === 'youtube.com' || host === 'youtu.be') {
    const id =
      host === 'youtu.be'
        ? u.pathname.slice(1).split('/')[0]
        : u.searchParams.get('v') ?? /^\/(?:shorts|embed)\/([A-Za-z0-9_-]+)/.exec(u.pathname)?.[1] ?? null
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return { src: `https://www.youtube-nocookie.com/embed/${id}`, vertical: u.pathname.startsWith('/shorts/'), platform: 'YouTube' }
    }
  }
  return null
}

export default function CreatorVideo({
  url,
  credit,
  creditUrl,
  trailName,
  className = '',
}: {
  url: string | null
  credit: string | null
  creditUrl: string | null
  trailName: string
  className?: string
}) {
  const embed = parseVideoEmbed(url)
  if (!embed) return null
  return (
    <figure className={`m-0 ${className}`}>
      <div
        className={`overflow-hidden rounded-[14px] border border-navy/10 bg-navy/5 ${embed.vertical ? 'aspect-[9/16] max-w-[320px]' : 'aspect-video w-full'}`}
      >
        <iframe
          src={embed.src}
          title={`${trailName}: video${credit ? ` by ${credit}` : ''}`}
          loading="lazy"
          allow="encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
      {/* Credit the creator by name and send people to their account: the
          embed is the platform's own player, and the follow is the thanks. No
          claim of permission unless the creator has given it. */}
      <figcaption className="mt-2 text-[0.875rem] leading-snug text-ink-muted">
        Video by{' '}
        {creditUrl ? (
          <a href={creditUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-forest underline underline-offset-4">
            {credit ?? embed.platform}
          </a>
        ) : (
          <span className="font-semibold text-navy">{credit ?? embed.platform}</span>
        )}
        {credit ? ` on ${embed.platform}` : ''}.{' '}
        {creditUrl ? (
          <>
            <a href={creditUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
              Follow them
            </a>{' '}
            for more rides like this, or{' '}
          </>
        ) : null}
        <a href={url ?? '#'} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
          {creditUrl ? `watch on ${embed.platform}` : `Watch on ${embed.platform}`}
        </a>
        .
      </figcaption>
    </figure>
  )
}
