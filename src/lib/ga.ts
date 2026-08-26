// GA4 event helper. An event pushed before the gtag config command is
// dropped (no destination registered yet), which happens for events fired
// on mount during a first page load — so wait for window.gtag, which the
// GA snippet defines in the same script that queues the config command.
export function gaEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  if (typeof w.gtag === 'function') {
    w.gtag('event', name, params)
    return
  }
  let tries = 0
  const timer = setInterval(() => {
    if (typeof w.gtag === 'function') {
      clearInterval(timer)
      w.gtag('event', name, params)
    } else if (++tries >= 50) {
      clearInterval(timer)
    }
  }, 200)
}
