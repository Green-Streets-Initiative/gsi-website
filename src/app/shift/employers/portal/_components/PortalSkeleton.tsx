'use client'

/**
 * Placeholder blocks in the shape of a portal page, shown while the first
 * load runs (in place of the word "Loading..."). `full` draws the whole
 * frame (sidebar and topbar too) for the moment before the shell mounts.
 */
export function PortalContentSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading your portal">
      <div className="h-7 w-48 rounded-md bg-ink/[0.08]" />
      <div className="mt-2 h-4 w-72 max-w-full rounded bg-ink/[0.06]" />
      <div className="mt-6 h-[150px] rounded-[20px] bg-ink/[0.08]" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[92px] rounded-[14px] border border-line bg-surface p-4">
            <div className="h-3 w-20 rounded bg-ink/[0.08]" />
            <div className="mt-3 h-6 w-16 rounded bg-ink/[0.08]" />
          </div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-[260px] rounded-[14px] border border-line bg-surface" />
        <div className="h-[260px] rounded-[14px] border border-line bg-surface" />
      </div>
    </div>
  )
}

export function PortalShellSkeleton() {
  return (
    <div className="grid min-h-dvh bg-canvas min-[980px]:grid-cols-[256px_1fr]" aria-busy="true">
      <div className="hidden min-[980px]:block" style={{ backgroundColor: '#1F4D3A' }} />
      <div className="flex min-h-0 flex-col">
        <div className="h-16 border-b border-line bg-surface" />
        <div className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 sm:py-6">
          <PortalContentSkeleton />
        </div>
      </div>
    </div>
  )
}
