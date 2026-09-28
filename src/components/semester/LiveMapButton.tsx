import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

/*
 * The call to action on a school page's campus map. The whole map is the
 * link; this is what tells people so. A solid forest button with a pulsing
 * live dot, compact so it reads as a button — the earlier full-width white
 * pill ("Live arrivals, every route · Open the … map →") read as a caption.
 * Rendered inside the map's <a>, so it's a span, and hover follows the map.
 */
export default function LiveMapButton() {
  return (
    <span className="inline-flex items-center gap-2.5 rounded-full bg-forest px-5 py-3 text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(25,26,46,0.25)] transition-colors group-hover:bg-green-deep">
      <span className="relative flex h-2.5 w-2.5 items-center justify-center" aria-hidden>
        <span className="absolute h-2.5 w-2.5 rounded-full bg-[#BAF14D] motion-safe:animate-live-pulse" />
      </span>
      Open the live map
      <ArrowRight size={16} weight="bold" aria-hidden className="transition-transform group-hover:translate-x-0.5" />
    </span>
  )
}
