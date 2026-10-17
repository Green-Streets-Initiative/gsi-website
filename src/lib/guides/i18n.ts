/**
 * Words on a guide page that aren't the guide itself: the page frame, our
 * tools (trip planner, station parking, closures) and the live offers. The
 * guide text comes translated from seo/drafts/guides/<lang>/ (answer-pages.md
 * §10); this file covers everything around it. Spanish house style: tú, "el
 * T", Línea Roja, tren de cercanías, autobús, Cerca de ti.
 */

export type GuideLocale = 'en' | 'es' | 'pt-BR' | 'zh-Hans'

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
  'planner.min': '{n} min',
  'planner.sep': ', ',
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
  'planner.min': '{n} min',
  'planner.sep': ', ',
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

const ptBR: Record<GuideKey, string> = {
  'nav.home': 'Início',
  'nav.guides': 'Guias',
  'nav.breadcrumb': 'Caminho de navegação',
  'meta.minRead': '{n} min de leitura',
  'meta.reviewed': 'Revisado em {date}',
  'meta.otherLanguage': 'Read in English',
  'meta.aiNote': 'Traduzido do inglês com a ajuda de inteligência artificial. Se algo não estiver claro, escreva para',
  'meta.aiNoteLink': 'info@gogreenstreets.org',
  'mode.cycling': 'De bicicleta',
  'mode.walking': 'A pé',
  'mode.transit': 'Transporte público',
  'mode.multimodal': 'Como se locomover',
  'tryIt.heading': 'Experimente',
  'tryIt.body':
    'O Shift encontra o jeito mais tranquilo de chegar aonde você vai, de bicicleta, a pé ou de transporte público, e dá crédito por cada viagem que você muda.',
  'tryIt.notReady': 'Ainda não quer o app?',
  'tryIt.nearbyLink': 'Planeje uma rota no mapa Perto de você',
  'tryIt.inBrowser': 'pelo navegador.',
  'related.heading': 'Guias relacionados',
  'browseAll': 'Ver todos os guias (em inglês)',
  'appStrip.howItWorks': 'Veja como o Shift funciona (em inglês)',

  'planner.from': 'De',
  'planner.fromPlaceholder': 'De onde você sai?',
  'planner.to': 'Para',
  'planner.toPlaceholder': 'Para onde você vai?',
  'planner.useMyLocation': 'Usar minha localização',
  'planner.finding': 'Encontrando você…',
  'planner.yourLocation': 'Sua localização',
  'planner.loading': 'Planejando sua viagem…',
  'planner.outside': 'Um desses endereços fica fora da área que o planejador cobre. Tente um endereço em Massachusetts.',
  'planner.error': 'Não conseguimos planejar essa viagem agora. Tente um endereço próximo ou planeje no',
  'planner.errorLink': 'mapa Perto de você',
  'planner.byTransit': 'De transporte público',
  'planner.min': '{n} min',
  'planner.sep': ', ',
  'planner.onLines': ' usando {lines}',
  'planner.then': ', depois ',
  'planner.walking': ', com {n} min a pé',
  'planner.noTransit': 'Não encontramos uma rota de transporte público para essa viagem.',
  'planner.byBike': 'De bicicleta',
  'planner.seeOnMap': 'Ver essa viagem no mapa, com chegadas ao vivo',
  'planner.changesHeading': 'Mudanças no serviço nessas linhas',
  'planner.changesEmpty': 'Não há interrupções planejadas nessas linhas nos próximos 30 dias.',
  'comfort.path': 'quase tudo por ciclovias longe dos carros',
  'comfort.protected': 'quase tudo por ciclovias protegidas',
  'comfort.bike_lane': 'quase tudo por ciclofaixas pintadas',
  'comfort.shared_road': 'quase tudo por ruas sem ciclofaixa',
  'comfort.mixed': 'uma mistura de ciclofaixas e ruas',

  'parking.label': 'De onde você sai de carro?',
  'parking.placeholder': 'Seu endereço ou sua cidade',
  'parking.loading': 'Procurando estacionamento nas estações…',
  'parking.outside': 'Esse endereço fica fora da área que cobrimos. Tente um em Massachusetts.',
  'parking.none':
    'Não há estacionamento da MBTA a 25 milhas desse endereço. Muitas empresas regionais de ônibus têm seus próprios estacionamentos; consulte a da sua região.',
  'parking.error': 'Não conseguimos carregar os estacionamentos agora. A MBTA tem a lista completa na',
  'parking.errorLink': 'página de estacionamento (em inglês)',
  'parking.away': 'a {miles} mi',
  'parking.spaces': '{n} vagas',
  'parking.fills': 'costuma lotar nos dias úteis',
  'parking.full': 'costuma ficar {pct}% cheio nos dias úteis',
  'parking.planFrom': 'Planeje a viagem a partir de {station}',
  'parking.note': 'Tarifas e vagas segundo a própria MBTA. Na maioria, o pagamento é pelo celular.',

  'closures.checking': 'Verificando mudanças no serviço da MBTA…',
  'closures.changesOn': 'Mudanças na',
  'closures.clearOn': 'Sem interrupções na',
  'closures.nowThrough': 'Agora, até {day}',
  'closures.now': 'Agora',
  'closures.range': 'De {first} a {last}',
  'closures.starts': 'Começa em {day}',
  'closures.shuttle': 'Ônibus de substituição no lugar dos trens',
  'closures.noBuses': 'Sem ônibus',
  'closures.noTrains': 'Sem trens',
  'closures.station': 'Estação fechada ou sem parada',
  'closures.details': 'Detalhes da MBTA (em inglês)',
  'closures.more': 'E mais {n} na',
  'closures.moreLink': 'página de alertas da MBTA (em inglês)',
  'closures.footnote': 'Ao vivo da MBTA: ônibus de substituição, suspensões e estações fechadas, agora e nos próximos 30 dias.',

  'offer.newroutes.heading': 'Acabou de se mudar? Desbloqueie {dollars} para se locomover.',
  'offer.newroutes.body':
    'Faça {trips} viagens a pé, de bicicleta ou de transporte público nos seus primeiros {days} dias no Shift e desbloqueie uma recompensa de {dollars}: um vale-presente de um comércio local ou um vale-presente digital que você escolhe. Inscreva-se até {deadline}.',
  'offer.newroutes.code': 'Depois de instalar o app, digite o código {code} para vincular sua recompensa.',
  'offer.newroutes.cta': 'Baixe o Shift',
  'offer.semester.heading': 'Está na faculdade? Desbloqueie {dollars} para ir às aulas.',
  'offer.semester.body':
    'Cadastre-se no Shift com o email da sua faculdade, faça {trips} viagens a pé, de bicicleta ou de transporte público em {days} dias e desbloqueie uma recompensa de {dollars}. Inscreva-se até {deadline}.',
  'offer.semester.cta': 'Veja como funciona (em inglês)',
}

const zhHans: Record<GuideKey, string> = {
  'nav.home': '首页',
  'nav.guides': '指南',
  'nav.breadcrumb': '导航路径',
  'meta.minRead': '阅读约 {n} 分钟',
  'meta.reviewed': '审核于 {date}',
  'meta.otherLanguage': 'Read in English',
  'meta.aiNote': '本文借助人工智能从英文翻译。如有不清楚的地方，请写信至',
  'meta.aiNoteLink': 'info@gogreenstreets.org',
  'mode.cycling': '骑行',
  'mode.walking': '步行',
  'mode.transit': '公共交通',
  'mode.multimodal': '出行方式',
  'tryIt.heading': '试一试',
  'tryIt.body': 'Shift 帮你找到去目的地最轻松的方式，无论骑行、步行还是乘坐公共交通，每次改变出行方式都会为你记上一笔。',
  'tryIt.notReady': '还不想下载应用？',
  'tryIt.nearbyLink': '在「您的周边」地图上规划路线',
  'tryIt.inBrowser': '，直接在浏览器中使用。',
  'related.heading': '相关指南',
  'browseAll': '浏览全部指南（英文）',
  'appStrip.howItWorks': '了解 Shift 如何运作（英文）',

  'planner.from': '出发地',
  'planner.fromPlaceholder': '你从哪里出发？',
  'planner.to': '目的地',
  'planner.toPlaceholder': '你要去哪里？',
  'planner.useMyLocation': '使用我的位置',
  'planner.finding': '正在定位…',
  'planner.yourLocation': '你的位置',
  'planner.loading': '正在规划行程…',
  'planner.outside': '其中一个地址不在规划工具覆盖的范围内。请换一个马萨诸塞州的地址试试。',
  'planner.error': '暂时无法规划这段行程。请换一个附近的街道地址，或者在',
  'planner.errorLink': '「您的周边」地图上规划',
  'planner.byTransit': '公共交通',
  'planner.min': '{n} 分钟',
  'planner.sep': '，',
  'planner.onLines': '，乘坐{lines}',
  'planner.then': '，再换乘',
  'planner.walking': '，其中步行 {n} 分钟',
  'planner.noTransit': '没有找到这段行程的公共交通路线。',
  'planner.byBike': '骑行',
  'planner.seeOnMap': '在地图上查看这段行程和实时到站信息',
  'planner.changesHeading': '这些线路的服务变动',
  'planner.changesEmpty': '未来 30 天内这些线路没有计划停运。',
  'comfort.path': '大部分走远离汽车的步道',
  'comfort.protected': '大部分走有隔离的自行车道',
  'comfort.bike_lane': '大部分走画线的自行车道',
  'comfort.shared_road': '大部分走没有自行车道的街道',
  'comfort.mixed': '自行车道和普通街道各有一部分',

  'parking.label': '你开车从哪里出发？',
  'parking.placeholder': '你的住址或所在城镇',
  'parking.loading': '正在查找车站停车场…',
  'parking.outside': '这个地址不在我们覆盖的范围内。请换一个马萨诸塞州的地址试试。',
  'parking.none': '这个地址 25 英里（40 公里）内没有 MBTA 车站停车场。很多地区公交公司有自己的停车换乘停车场，请咨询当地的公交机构。',
  'parking.error': '暂时无法加载车站停车场信息。MBTA 在它的',
  'parking.errorLink': '停车页面（英文）',
  'parking.away': '距离 {miles} 英里',
  'parking.spaces': '{n} 个车位',
  'parking.fills': '工作日通常会停满',
  'parking.full': '工作日通常有 {pct}% 的车位被占用',
  'parking.planFrom': '规划从 {station} 出发的行程',
  'parking.note': '收费和车位数来自 MBTA 的官方信息。大多数停车场用手机付费。',

  'closures.checking': '正在查询 MBTA 服务变动…',
  'closures.changesOn': '有变动：',
  'closures.clearOn': '没有停运：',
  'closures.nowThrough': '现在起至 {day}',
  'closures.now': '正在进行',
  'closures.range': '{first} 至 {last}',
  'closures.starts': '{day} 开始',
  'closures.shuttle': '由替代接驳巴士代替列车',
  'closures.noBuses': '公交车停运',
  'closures.noTrains': '列车停运',
  'closures.station': '车站关闭或列车不停靠',
  'closures.details': 'MBTA 详细信息（英文）',
  'closures.more': '另外还有 {n} 条，见',
  'closures.moreLink': 'MBTA 服务提醒页面（英文）',
  'closures.footnote': '来自 MBTA 的实时信息：替代接驳巴士、停运和车站关闭，包括现在和未来 30 天。',

  'offer.newroutes.heading': '刚搬家？出行就能解锁 {dollars}。',
  'offer.newroutes.body':
    '在 Shift 上的头 {days} 天里完成 {trips} 次步行、骑行或公共交通出行，即可解锁 {dollars} 奖励：本地商家礼品卡，或由你挑选的电子礼品卡。请在 {deadline} 前报名。',
  'offer.newroutes.code': '安装应用后，输入代码 {code}，奖励就会和你的账户关联。',
  'offer.newroutes.cta': '下载 Shift',
  'offer.semester.heading': '在读大学？上学出行就能解锁 {dollars}。',
  'offer.semester.body':
    '用学校邮箱注册 Shift，在 {days} 天内完成 {trips} 次步行、骑行或公共交通出行，即可解锁 {dollars} 奖励。请在 {deadline} 前报名。',
  'offer.semester.cta': '了解详情（英文）',
}

const DICTS: Record<GuideLocale, Record<GuideKey, string>> = { en, es, 'pt-BR': ptBR, 'zh-Hans': zhHans }

export function gt(locale: GuideLocale, key: GuideKey, repl?: Record<string, string | number>): string {
  let s = DICTS[locale][key] ?? en[key]
  if (repl) for (const [k, v] of Object.entries(repl)) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** BCP 47 tag for dates and numbers. */
export const DATE_LOCALE: Record<GuideLocale, string> = { en: 'en-US', es: 'es-US', 'pt-BR': 'pt-BR', 'zh-Hans': 'zh-CN' }

/** Every language a guide can be shown in, and the link to it, written in that language. */
export const GUIDE_LANGUAGES: { locale: GuideLocale; label: string }[] = [
  { locale: 'en', label: 'Read in English' },
  { locale: 'es', label: 'Leer en español' },
  { locale: 'pt-BR', label: 'Ler em português' },
  { locale: 'zh-Hans', label: '阅读中文版' },
]

/** Path prefix for a language's guide pages: '' for English, '/es', '/pt-BR'. */
export function localePrefix(locale: GuideLocale): string {
  return locale === 'en' ? '' : `/${locale}`
}

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
const SUBWAY_ZH: Record<string, string> = { Red: '红线', Orange: '橙线', Blue: '蓝线', Green: '绿线' }
const SUBWAY_PT: Record<string, string> = {
  Red: 'Vermelha',
  Orange: 'Laranja',
  Blue: 'Azul',
  Green: 'Verde',
  Mattapan: 'Mattapan',
}

/**
 * An MBTA line name as the reader's language says it. MBTA names arrive in
 * English ("Red Line", "Green Line B", "Framingham/Worcester Line", "Bus 67").
 * Spanish: Línea Roja, Línea Verde B, Autobús 67, Ferry de Hingham. Portuguese:
 * Linha Vermelha, Linha Verde B, Ônibus 67, Balsa de Hingham. Chinese: 红线, 绿线 B 支线,
 * 67 路公交车, Hingham 渡轮 (answer-pages.md §10).
 */
export function lineLabel(name: string, locale: GuideLocale): string {
  if (locale === 'en') return name
  if (locale === 'zh-Hans') {
    const subway = /^(Red|Orange|Blue|Green|Mattapan) Line(?: ([A-E]))?$/.exec(name)
    if (subway) return subway[1] === 'Mattapan' ? 'Mattapan 线' : `${SUBWAY_ZH[subway[1]]}${subway[2] ? ` ${subway[2]} 支线` : ''}`
    const bus = /^Bus (.+)$/.exec(name)
    if (bus) return `${bus[1]} 路公交车`
    const ferry = /^(.+) Ferry$/.exec(name)
    if (ferry) return `${ferry[1]} 渡轮`
    const line = /^(.+) Line$/.exec(name)
    if (line) return `${line[1]} 线`
    return name
  }
  if (locale === 'pt-BR') {
    const subway = /^(Red|Orange|Blue|Green|Mattapan) Line(?: ([A-E]))?$/.exec(name)
    if (subway) return `Linha ${SUBWAY_PT[subway[1]]}${subway[2] ? ` ${subway[2]}` : ''}`
    const bus = /^Bus (.+)$/.exec(name)
    if (bus) return `Ônibus ${bus[1]}`
    const ferry = /^(.+) Ferry$/.exec(name)
    if (ferry) return `Balsa de ${ferry[1]}`
    const line = /^(.+) Line$/.exec(name)
    if (line) return `Linha ${line[1]}`
    return name
  }
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
