/**
 * Words on a guide page that aren't the guide itself: the page frame, our
 * tools (trip planner, station parking, closures) and the live offers. The
 * guide text comes translated from seo/drafts/guides/<lang>/ (answer-pages.md
 * §10); this file covers everything around it. Spanish house style: tú, "el
 * T", Línea Roja, tren de cercanías, autobús, Cerca de ti.
 */

export type GuideLocale = 'en' | 'es'

const en = {
  'nav.home': 'Home',
  'nav.guides': 'Guides',
  'nav.breadcrumb': 'Breadcrumb',
  'meta.minRead': '{n} min read',
  'meta.reviewed': 'Reviewed {date}',
  'meta.otherLanguage': 'Leer en español',
  'meta.aiNote': '',
  'meta.aiNoteLink': '',
  'mode.cycling': 'Biking',
  'mode.walking': 'Walking',
  'mode.transit': 'Transit',
  'mode.multimodal': 'Getting around',
  'tryIt.heading': 'Try it',
  'tryIt.body':
    "Shift finds the calmest way to wherever you're headed, by bike, on foot or on transit, and gives you credit for every trip you shift.",
  'tryIt.notReady': 'Not ready for the app?',
  'tryIt.nearbyLink': 'Plan a route on the Nearby page',
  'tryIt.inBrowser': 'in your browser.',
  'related.heading': 'Related guides',
  'browseAll': 'Browse all guides',
  'appStrip.howItWorks': 'See how Shift works',

  // Trip planner
  'planner.from': 'From',
  'planner.fromPlaceholder': 'Where are you starting?',
  'planner.to': 'To',
  'planner.toPlaceholder': 'Where are you going?',
  'planner.useMyLocation': 'Use my location',
  'planner.finding': 'Finding you…',
  'planner.yourLocation': 'Your location',
  'planner.loading': 'Planning your trip…',
  'planner.outside': 'One of those addresses is outside the area our planner covers. Try an address in Massachusetts.',
  'planner.error': "We couldn't plan that trip right now. Try a nearby street address, or plan it on the",
  'planner.errorLink': 'Nearby page',
  'planner.byTransit': 'By transit',
  'planner.onLines': ' on {lines}',
  'planner.then': ', then ',
  'planner.walking': ', with {n} min of walking',
  'planner.noTransit': 'No transit route found for this trip.',
  'planner.byBike': 'By bike',
  'planner.seeOnMap': 'See this trip on the map, with live arrivals',
  'planner.changesHeading': 'Service changes on these lines',
  'planner.changesEmpty': 'No closures are planned on these lines in the next 30 days.',
  'comfort.path': 'mostly on paths away from cars',
  'comfort.protected': 'mostly in protected bike lanes',
  'comfort.bike_lane': 'mostly in painted bike lanes',
  'comfort.shared_road': 'mostly on streets without bike lanes',
  'comfort.mixed': 'a mix of bike lanes and streets',

  // Station parking
  'parking.label': 'Where does your drive start?',
  'parking.placeholder': 'Your home address or town',
  'parking.loading': 'Finding station parking…',
  'parking.outside': 'That address is outside the area we cover. Try one in Massachusetts.',
  'parking.none':
    "There's no MBTA station parking within 25 miles of that address. Many regional bus systems run their own park-and-ride lots; check your local transit agency.",
  'parking.error': "We couldn't load station parking right now. The MBTA lists every lot on its",
  'parking.errorLink': 'parking page',
  'parking.away': '{miles} mi away',
  'parking.spaces': '{n} spaces',
  'parking.fills': 'usually fills up on weekdays',
  'parking.full': 'usually {pct}% full on weekdays',
  'parking.planFrom': 'Plan the ride in from {station}',
  'parking.note': "Rates and spaces are the MBTA's own listing. Most lots are paid by phone.",

  // Closures
  'closures.checking': 'Checking MBTA service changes…',
  'closures.changesOn': 'Changes on',
  'closures.clearOn': 'No closures on',
  'closures.nowThrough': 'Now through {day}',
  'closures.now': 'Happening now',
  'closures.range': '{first} to {last}',
  'closures.starts': 'Starts {day}',
  'closures.shuttle': 'Shuttle buses replace trains',
  'closures.noBuses': 'No buses',
  'closures.noTrains': 'No trains',
  'closures.station': 'Station closed or skipped',
  'closures.details': 'Details from the MBTA',
  'closures.more': 'And {n} more on the',
  'closures.moreLink': "MBTA's alerts page",
  'closures.footnote': 'Live from the MBTA: shuttles, suspensions and station closures, now and in the next 30 days.',

  // Offers
  'offer.newroutes.heading': 'Just moved? Unlock {dollars} for getting around.',
  'offer.newroutes.body':
    'Take {trips} walking, biking or transit trips in your first {days} days on Shift and unlock a {dollars} reward: a gift card at a local shop, or a digital gift card you choose. Sign up by {deadline}.',
  'offer.newroutes.code': 'After you install, enter the code {code} in the app so your reward is linked.',
  'offer.newroutes.cta': 'Get Shift',
  'offer.semester.heading': 'In college? Unlock {dollars} for getting to class.',
  'offer.semester.body':
    'Sign up for Shift with your school email, take {trips} walking, biking or transit trips in {days} days, and unlock a {dollars} reward. Sign up by {deadline}.',
  'offer.semester.cta': 'See how it works',
}

export type GuideKey = keyof typeof en

const es: Record<GuideKey, string> = {
  'nav.home': 'Inicio',
  'nav.guides': 'Guías',
  'nav.breadcrumb': 'Ruta de navegación',
  'meta.minRead': '{n} min de lectura',
  'meta.reviewed': 'Revisada en {date}',
  'meta.otherLanguage': 'Read in English',
  'meta.aiNote': 'Traducido del inglés con ayuda de inteligencia artificial. Si algo no está claro, escríbenos a',
  'meta.aiNoteLink': 'info@gogreenstreets.org',
  'mode.cycling': 'En bici',
  'mode.walking': 'A pie',
  'mode.transit': 'Transporte público',
  'mode.multimodal': 'Cómo moverte',
  'tryIt.heading': 'Pruébalo',
  'tryIt.body':
    'Shift encuentra la forma más tranquila de llegar a donde vas, en bici, a pie o en transporte público, y te da crédito por cada viaje que cambias.',
  'tryIt.notReady': '¿Todavía no quieres la app?',
  'tryIt.nearbyLink': 'Planea una ruta en el mapa Cerca de ti',
  'tryIt.inBrowser': 'desde tu navegador.',
  'related.heading': 'Guías relacionadas',
  'browseAll': 'Ver todas las guías (en inglés)',
  'appStrip.howItWorks': 'Mira cómo funciona Shift (en inglés)',

  'planner.from': 'Desde',
  'planner.fromPlaceholder': '¿Desde dónde sales?',
  'planner.to': 'Hasta',
  'planner.toPlaceholder': '¿A dónde vas?',
  'planner.useMyLocation': 'Usar mi ubicación',
  'planner.finding': 'Buscando tu ubicación…',
  'planner.yourLocation': 'Tu ubicación',
  'planner.loading': 'Planeando tu viaje…',
  'planner.outside': 'Una de esas direcciones está fuera del área que cubre el planificador. Prueba con una dirección en Massachusetts.',
  'planner.error': 'No pudimos planear ese viaje en este momento. Prueba con una dirección cercana, o planéalo en el',
  'planner.errorLink': 'mapa Cerca de ti',
  'planner.byTransit': 'En transporte público',
  'planner.onLines': ' en {lines}',
  'planner.then': ', luego ',
  'planner.walking': ', con {n} min a pie',
  'planner.noTransit': 'No encontramos una ruta en transporte público para este viaje.',
  'planner.byBike': 'En bici',
  'planner.seeOnMap': 'Ver este viaje en el mapa, con llegadas en vivo',
  'planner.changesHeading': 'Cambios de servicio en estas líneas',
  'planner.changesEmpty': 'No hay cierres planeados en estas líneas en los próximos 30 días.',
  'comfort.path': 'casi todo por senderos lejos de los autos',
  'comfort.protected': 'casi todo por carriles para bici protegidos',
  'comfort.bike_lane': 'casi todo por carriles para bici pintados',
  'comfort.shared_road': 'casi todo por calles sin carril para bici',
  'comfort.mixed': 'una mezcla de carriles para bici y calles',

  'parking.label': '¿Desde dónde sales en auto?',
  'parking.placeholder': 'Tu dirección o tu pueblo',
  'parking.loading': 'Buscando estacionamiento en las estaciones…',
  'parking.outside': 'Esa dirección está fuera del área que cubrimos. Prueba con una en Massachusetts.',
  'parking.none':
    'No hay estacionamiento de la MBTA a 25 millas de esa dirección. Muchas agencias regionales de autobuses tienen sus propios estacionamientos; consulta con la de tu zona.',
  'parking.error': 'No pudimos cargar el estacionamiento en este momento. La MBTA tiene la lista completa en su',
  'parking.errorLink': 'página de estacionamiento (en inglés)',
  'parking.away': 'a {miles} mi',
  'parking.spaces': '{n} espacios',
  'parking.fills': 'suele llenarse entre semana',
  'parking.full': 'suele estar al {pct}% entre semana',
  'parking.planFrom': 'Planea el viaje desde {station}',
  'parking.note': 'Las tarifas y los espacios son los que publica la MBTA. En la mayoría se paga por teléfono.',

  'closures.checking': 'Revisando cambios de servicio de la MBTA…',
  'closures.changesOn': 'Cambios en',
  'closures.clearOn': 'Sin cierres en',
  'closures.nowThrough': 'Ahora, hasta el {day}',
  'closures.now': 'Ahora',
  'closures.range': 'Del {first} al {last}',
  'closures.starts': 'Empieza el {day}',
  'closures.shuttle': 'Autobuses de reemplazo en lugar de trenes',
  'closures.noBuses': 'No hay autobuses',
  'closures.noTrains': 'No hay trenes',
  'closures.station': 'Estación cerrada o sin parada',
  'closures.details': 'Detalles de la MBTA (en inglés)',
  'closures.more': 'Y {n} más en la',
  'closures.moreLink': 'página de alertas de la MBTA (en inglés)',
  'closures.footnote': 'En vivo de la MBTA: autobuses de reemplazo, suspensiones y estaciones cerradas, ahora y en los próximos 30 días.',

  'offer.newroutes.heading': '¿Te acabas de mudar? Desbloquea {dollars} por moverte.',
  'offer.newroutes.body':
    'Haz {trips} viajes a pie, en bici o en transporte público en tus primeros {days} días con Shift y desbloquea una recompensa de {dollars}: una tarjeta de regalo de un comercio local o una tarjeta de regalo digital que tú eliges. Regístrate antes del {deadline}.',
  'offer.newroutes.code': 'Cuando instales la app, escribe el código {code} para que tu recompensa quede vinculada.',
  'offer.newroutes.cta': 'Descarga Shift',
  'offer.semester.heading': '¿Estás en la universidad? Desbloquea {dollars} por ir a clase.',
  'offer.semester.body':
    'Regístrate en Shift con el correo de tu universidad, haz {trips} viajes a pie, en bici o en transporte público en {days} días y desbloquea una recompensa de {dollars}. Regístrate antes del {deadline}.',
  'offer.semester.cta': 'Mira cómo funciona (en inglés)',
}

const DICTS: Record<GuideLocale, Record<GuideKey, string>> = { en, es }

export function gt(locale: GuideLocale, key: GuideKey, repl?: Record<string, string | number>): string {
  let s = DICTS[locale][key] ?? en[key]
  if (repl) for (const [k, v] of Object.entries(repl)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** BCP 47 tag for dates and numbers. */
export const DATE_LOCALE: Record<GuideLocale, string> = { en: 'en-US', es: 'es-US' }

/** "Sat, Oct 31" / "sáb, 31 oct" in Boston time. */
export function guideDay(iso: string, locale: GuideLocale): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

/** "December 15" / "15 de diciembre", as the campaign pages say it. */
export function guideLongDate(iso: string, locale: GuideLocale): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale], {
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

const SUBWAY_ES: Record<string, string> = {
  Red: 'Roja',
  Orange: 'Naranja',
  Blue: 'Azul',
  Green: 'Verde',
  Mattapan: 'Mattapan',
}

/**
 * An MBTA line name as the reader's language says it. MBTA names arrive in
 * English ("Red Line", "Green Line B", "Framingham/Worcester Line", "Bus 67").
 * Spanish follows the house style: Línea Roja, Línea Verde B, Autobús 67, Ferry de Hingham.
 */
export function lineLabel(name: string, locale: GuideLocale): string {
  if (locale === 'en') return name
  const subway = /^(Red|Orange|Blue|Green|Mattapan) Line(?: ([A-E]))?$/.exec(name)
  if (subway) return `Línea ${SUBWAY_ES[subway[1]]}${subway[2] ? ` ${subway[2]}` : ''}`
  const bus = /^Bus (.+)$/.exec(name)
  if (bus) return `Autobús ${bus[1]}`
  const ferry = /^(.+) Ferry$/.exec(name)
  if (ferry) return `Ferry de ${ferry[1]}`
  const line = /^(.+) Line$/.exec(name)
  if (line) return `Línea ${line[1]}`
  return name
}
