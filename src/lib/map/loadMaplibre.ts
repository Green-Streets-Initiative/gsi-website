// Lazy maplibre-gl singleton — keeps the (large) map library out of the
// initial bundle; every map component shares one in-flight import.
let maplibrePromise: Promise<typeof import('maplibre-gl')> | null = null

export function loadMaplibre() {
  if (!maplibrePromise) {
    maplibrePromise = import('maplibre-gl')
  }
  return maplibrePromise
}
