'use client'

import { RefreshCw } from 'lucide-react'
import { Card } from '@/components/employer/Card'
import Button from '@/components/employer/Button'

/**
 * Shown in place of the portal when the first load failed outright. Before
 * this the page sat on "Loading..." forever (Keith 2026-09-30).
 */
export default function PortalLoadError({
  message,
  onRetry,
}: {
  message?: string | null
  onRetry: () => void
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <Card pad className="w-full max-w-[480px] text-center">
        <h1 className="font-headline text-[22px] font-extrabold text-ink">We couldn&apos;t load your portal.</h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-muted">
          {message ?? 'Something went wrong on the way in. It is usually a blip: try again in a moment.'}
        </p>
        <div className="mt-5">
          <Button variant="primary" icon={RefreshCw} onClick={onRetry}>
            Try again
          </Button>
        </div>
        <p className="mt-5 text-[13px] text-ink-muted">
          Still stuck? Email{' '}
          <a href="mailto:info@gogreenstreets.org" className="font-semibold text-accent hover:underline">
            info@gogreenstreets.org
          </a>{' '}
          and we&apos;ll sort it out.
        </p>
      </Card>
    </div>
  )
}
