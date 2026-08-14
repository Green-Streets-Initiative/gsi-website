/**
 * Streamed instantly while the print page's server render gathers data —
 * a cold neighborhood fans out to the MBTA, Google, GBFS, and the bike
 * sources and can take 15–20 s. Without this, the visitor stares at a
 * blank tab wondering if the click worked. Light theme to match the
 * sheet it becomes.
 */
export default function PrintLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-[#191A2E]">
      <div className="max-w-[440px] text-center">
        <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-[#4A7729]">
          Green Streets Initiative
        </div>
        <h1 className="mt-1 font-display text-[1.5rem] font-extrabold tracking-tight">
          Building your one-pager…
        </h1>
        <div
          className="mx-auto mt-5 h-9 w-9 animate-spin rounded-full border-[3px] border-[#191A2E]/15 border-t-[#4A7729]"
          aria-hidden="true"
        />
        <p className="mt-5 text-[0.9rem] leading-relaxed text-[#191A2E]/80">
          Gathering train and bus schedules, bike routes, Bluebikes docks, and travel times for this neighborhood.
        </p>
        <p className="mt-2 text-[0.8rem] leading-snug text-[#191A2E]/60">
          The first visit for a neighborhood takes up to 20 seconds — after that it&apos;s quick.
        </p>
      </div>
    </main>
  )
}
