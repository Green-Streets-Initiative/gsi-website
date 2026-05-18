import { Locale } from './types'

const strings = {
  en: {
    eyebrow_default: 'SomerStreets',
    getting_around: 'Getting around',
    get_me_home: 'Get me home',
    get_directions: 'Get directions to',
    chip_festival: 'Festival',
    chip_food: 'Food & drink',
    chip_bus: 'Bus',
    chip_train: 'Train',
    chip_bluebike: 'Bike',
    chip_bike_parking: 'Bike parking',
    bikes: 'bikes',
    docks_free: 'docks free',
    min: 'min',
    stop: 'stop',
    toward: 'toward',
    bike_corral: 'Bike corral',
    bike_rack: 'Bike rack',
    directions: 'Directions',
    closest: 'Closest',
    next_bus: 'Next bus',
    arrival_title: 'How are you getting here?',
    arrival_bike: 'Bike',
    arrival_bluebike: 'Bluebike',
    arrival_bus: 'Bus',
    arrival_walk: 'Walk',
    arrival_from: 'From',
    arrival_source_placeholder: 'Your location or address',
    departure_title: 'How are you getting home?',
    departure_destination: 'Destination',
    departure_destination_placeholder: 'Enter your address',
    departure_go: 'Go',
    banner_rain: 'Moved to {date} due to weather',
    banner_cancelled: 'is cancelled — visit local businesses any time',
    corridor_label: 'Festival corridor',
    attribution_default: 'Wayfinding by Green Streets Initiative',
    share: 'Share',
    close: 'Close',
    loading: 'Loading...',
    no_data: 'No data available',
    grant_location: 'Allow location access for distances',
    away: 'away',
    get_me_there: 'Get me there',
    get_me_there_title: 'How to get here',
    no_predictions: 'No upcoming departures',
    next_arrival: 'Next arrival',
    more_routes: 'More bus routes',
    fewer_routes: 'Fewer routes',
    bus_guide: 'How to ride the bus',
    bluebike_guide: 'How to use Bluebikes',
    ride_time: 'ride',
    spaces: 'spaces',
    board_at: 'Board at',
    cat_restaurant: 'Restaurant',
    cat_cafe: 'Cafe',
    cat_quick_bites: 'Quick Bites',
    cat_bar_grill: 'Bar & Grill',
  },
  es: {
    eyebrow_default: 'SomerStreets',
    getting_around: 'Cómo llegar',
    get_me_home: 'Llévame a casa',
    get_directions: 'Cómo llegar a',
    chip_festival: 'Festival',
    chip_food: 'Comida y bebida',
    chip_bus: 'Autobús',
    chip_train: 'Tren',
    chip_bluebike: 'Bicicleta',
    chip_bike_parking: 'Estacionamiento bici',
    bikes: 'bicis',
    docks_free: 'espacios libres',
    min: 'min',
    stop: 'parada',
    toward: 'hacia',
    bike_corral: 'Corral de bicis',
    bike_rack: 'Bicicletero',
    directions: 'Direcciones',
    closest: 'Más cercano',
    next_bus: 'Próximo autobús',
    arrival_title: '¿Cómo llegas?',
    arrival_bike: 'Bicicleta',
    arrival_bluebike: 'Bluebike',
    arrival_bus: 'Autobús',
    arrival_walk: 'A pie',
    arrival_from: 'Desde',
    arrival_source_placeholder: 'Tu ubicación o dirección',
    departure_title: '¿Cómo vuelves a casa?',
    departure_destination: 'Destino',
    departure_destination_placeholder: 'Ingresa tu dirección',
    departure_go: 'Ir',
    banner_rain: 'Se trasladó al {date} por el clima',
    banner_cancelled: 'está cancelado — visita los negocios locales',
    corridor_label: 'Corredor del festival',
    attribution_default: 'Orientación por Green Streets Initiative',
    share: 'Compartir',
    close: 'Cerrar',
    loading: 'Cargando...',
    no_data: 'No hay datos disponibles',
    grant_location: 'Permite acceso a ubicación para ver distancias',
    away: 'de distancia',
    get_me_there: 'Llévame allá',
    get_me_there_title: 'Cómo llegar',
    no_predictions: 'Sin próximas salidas',
    next_arrival: 'Próxima llegada',
    more_routes: 'Más rutas de autobús',
    fewer_routes: 'Menos rutas',
    bus_guide: 'Cómo tomar el autobús',
    bluebike_guide: 'Cómo usar Bluebikes',
    ride_time: 'viaje',
    spaces: 'espacios',
    board_at: 'Sube en',
    cat_restaurant: 'Restaurante',
    cat_cafe: 'Café',
    cat_quick_bites: 'Comida rápida',
    cat_bar_grill: 'Bar y parrilla',
  },
  pt: {
    eyebrow_default: 'SomerStreets',
    getting_around: 'Como chegar',
    get_me_home: 'Me leve para casa',
    get_directions: 'Como chegar a',
    chip_festival: 'Festival',
    chip_food: 'Comida e bebida',
    chip_bus: 'Ônibus',
    chip_train: 'Trem',
    chip_bluebike: 'Bicicleta',
    chip_bike_parking: 'Estacionamento bici',
    bikes: 'bicicletas',
    docks_free: 'vagas livres',
    min: 'min',
    stop: 'parada',
    toward: 'em direção a',
    bike_corral: 'Bicicletário',
    bike_rack: 'Paraciclo',
    directions: 'Direções',
    closest: 'Mais próximo',
    next_bus: 'Próximo ônibus',
    arrival_title: 'Como você vem?',
    arrival_bike: 'Bicicleta',
    arrival_bluebike: 'Bluebike',
    arrival_bus: 'Ônibus',
    arrival_walk: 'A pé',
    arrival_from: 'De',
    arrival_source_placeholder: 'Sua localização ou endereço',
    departure_title: 'Como você volta para casa?',
    departure_destination: 'Destino',
    departure_destination_placeholder: 'Digite seu endereço',
    departure_go: 'Ir',
    banner_rain: 'Transferido para {date} devido ao clima',
    banner_cancelled: 'está cancelado — visite os negócios locais',
    corridor_label: 'Corredor do festival',
    attribution_default: 'Orientação por Green Streets Initiative',
    share: 'Compartilhar',
    close: 'Fechar',
    loading: 'Carregando...',
    no_data: 'Dados não disponíveis',
    grant_location: 'Permita acesso à localização para ver distâncias',
    away: 'de distância',
    get_me_there: 'Me leve lá',
    get_me_there_title: 'Como chegar',
    no_predictions: 'Sem próximas partidas',
    next_arrival: 'Próxima chegada',
    more_routes: 'Mais linhas de ônibus',
    fewer_routes: 'Menos linhas',
    bus_guide: 'Como andar de ônibus',
    bluebike_guide: 'Como usar Bluebikes',
    ride_time: 'viagem',
    spaces: 'vagas',
    board_at: 'Embarque em',
    cat_restaurant: 'Restaurante',
    cat_cafe: 'Café',
    cat_quick_bites: 'Comida rápida',
    cat_bar_grill: 'Bar e churrasqueira',
  },
} as const

export type TranslationKey = keyof typeof strings.en

export function t(locale: Locale, key: TranslationKey, replacements?: Record<string, string>): string {
  let value: string = strings[locale]?.[key] ?? strings.en[key] ?? key
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      value = value.replace(`{${k}}`, v)
    }
  }
  return value
}

const categoryKeyMap: Record<string, TranslationKey> = {
  'Restaurant': 'cat_restaurant',
  'Cafe': 'cat_cafe',
  'Quick Bites': 'cat_quick_bites',
  'Bar & Grill': 'cat_bar_grill',
}

export function tCategory(locale: Locale, category: string): string {
  const key = categoryKeyMap[category]
  return key ? t(locale, key) : category
}

export function getLocaleFromParams(params: string[] | undefined): Locale {
  const raw = params?.[0]
  if (raw === 'es' || raw === 'pt') return raw
  return 'en'
}

export function detectLocaleFromHeaders(acceptLanguage: string | null, supported: Locale[]): Locale {
  if (!acceptLanguage) return 'en'
  const preferred = acceptLanguage
    .split(',')
    .map(part => {
      const [lang, q] = part.trim().split(';q=')
      return { lang: lang.trim().split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 }
    })
    .sort((a, b) => b.q - a.q)

  for (const { lang } of preferred) {
    if (supported.includes(lang as Locale)) return lang as Locale
  }
  return 'en'
}
