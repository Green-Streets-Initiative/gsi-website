// GA4 event helper. Unlike sendGAEvent from @next/third-parties, this
// bootstraps the dataLayer queue if the gtag script hasn't loaded yet —
// gtag.js replays queued entries on load, so events fired early still count.
export function gaEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer ?? []
  function gtag(..._args: unknown[]) {
    // gtag.js requires the Arguments object itself, not a plain array
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments)
  }
  gtag('event', name, params)
}
