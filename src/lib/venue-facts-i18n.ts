/**
 * The venue parking pages' facts (src/lib/venues.ts and venue-facts.json) in
 * Spanish, Portuguese and Chinese, keyed by venue slug and the field's path in
 * the Venue (`garages.0.prices.1.label`). English stays in those two files and
 * is never changed here.
 *
 * Each entry carries the English it translates. localizeVenue() uses a
 * translation only while the English field still says exactly that, so when
 * the weekly venue-parking-prices routine changes a price or a line, that
 * field shows the new English until its translation is updated, never an old
 * price in another language. Garage, street, station, line, venue, team and
 * brand names stay in English, as do amounts, times, dates and heights.
 */
import type { SiteLocale } from '@/lib/site-i18n'
import type { Venue } from '@/lib/venues'

export type VenueText = { en: string; es: string; 'pt-BR': string; 'zh-Hans': string }

export const VENUE_TEXT: Record<string, Record<string, VenueText>> = {
  'td-garden': {
    'lede': {
      en: 'The North Station Garage is right under the arena.',
      es: 'El North Station Garage está justo debajo de la arena.',
      'pt-BR': 'O North Station Garage fica bem embaixo da arena.',
      'zh-Hans': 'North Station Garage 就在场馆正下方。',
    },
    'garages.0.address': {
      en: '121 Nashua St or 140 Causeway St',
      es: '121 Nashua St o 140 Causeway St',
      'pt-BR': '121 Nashua St ou 140 Causeway St',
      'zh-Hans': '121 Nashua St 或 140 Causeway St',
    },
    'garages.0.where': {
      en: 'Under the arena',
      es: 'Debajo de la arena',
      'pt-BR': 'Embaixo da arena',
      'zh-Hans': '场馆正下方',
    },
    'garages.0.book.label': {
      en: 'Buy parking on Ticketmaster',
      es: 'Compra el estacionamiento en Ticketmaster',
      'pt-BR': 'Compre o estacionamento no Ticketmaster',
      'zh-Hans': '在 Ticketmaster 购买停车位',
    },
    'garages.0.prices.0.label': {
      en: 'Bought ahead',
      es: 'Comprado con anticipación',
      'pt-BR': 'Comprado antes',
      'zh-Hans': '提前购买',
    },
    'garages.0.prices.1.label': {
      en: 'Game nights',
      es: 'Noches de partido',
      'pt-BR': 'Noites de jogo',
      'zh-Hans': '比赛夜',
    },
    'garages.0.prices.2.label': {
      en: 'Other events',
      es: 'Otros eventos',
      'pt-BR': 'Outros eventos',
      'zh-Hans': '其他活动',
    },
    'garages.0.facts.0': {
      en: 'Elevator to the arena',
      es: 'Ascensor a la arena',
      'pt-BR': 'Elevador até a arena',
      'zh-Hans': '有电梯直通场馆',
    },
    'garages.0.facts.1': {
      en: 'Good for 8 hours, then $5 an hour',
      es: 'Válido por 8 horas, luego $5 por hora',
      'pt-BR': 'Vale por 8 horas, depois $5 por hora',
      'zh-Hans': '可停 8 小时，之后每小时 $5',
    },
    'garages.0.facts.2': {
      en: 'Height limit 6′8″',
      es: 'Altura máxima 6′8″',
      'pt-BR': 'Altura máxima 6′8″',
      'zh-Hans': '限高 6′8″',
    },
    'garages.0.facts.3': {
      en: 'EV charging on levels 1 and 3',
      es: 'Carga de carros eléctricos en los niveles 1 y 3',
      'pt-BR': 'Recarga de carro elétrico nos andares 1 e 3',
      'zh-Hans': '1 层和 3 层有电动车充电',
    },
    'garages.1.book.label': {
      en: 'Compare prices',
      es: 'Compara precios',
      'pt-BR': 'Compare preços',
      'zh-Hans': '比较价格',
    },
    'garages.2.book.label': {
      en: 'Compare prices',
      es: 'Compara precios',
      'pt-BR': 'Compare preços',
      'zh-Hans': '比较价格',
    },
    'garages.3.book.label': {
      en: 'Compare prices',
      es: 'Compara precios',
      'pt-BR': 'Compare preços',
      'zh-Hans': '比较价格',
    },
    'garages.4.book.label': {
      en: 'Event rates',
      es: 'Tarifas para eventos',
      'pt-BR': 'Tarifas de eventos',
      'zh-Hans': '活动收费',
    },
    'priceNote': {
      en: 'Buying ahead holds you a space.',
      es: 'Si compras con anticipación, te guardan un lugar.',
      'pt-BR': 'Comprando antes, sua vaga fica garantida.',
      'zh-Hans': '提前购买可以保证有车位。',
    },
    'others.title': {
      en: 'A short walk away',
      es: 'A poca distancia a pie',
      'pt-BR': 'A uma curta caminhada',
      'zh-Hans': '步行不远',
    },
    'others.note': {
      en: 'Prices change by event. TD Garden sends people to SpotHero to compare the garages nearby.',
      es: 'Los precios cambian según el evento. TD Garden recomienda SpotHero para comparar los garajes cercanos.',
      'pt-BR': 'Os preços mudam conforme o evento. O TD Garden indica o SpotHero para comparar as garagens por perto.',
      'zh-Hans': '价格因活动而异。TD Garden 建议用 SpotHero 比较附近的停车楼。',
    },
    'compare.label': {
      en: 'Compare garages on SpotHero',
      es: 'Compara garajes en SpotHero',
      'pt-BR': 'Compare garagens no SpotHero',
      'zh-Hans': '在 SpotHero 比较停车楼',
    },
    'bikes.note': {
      en: 'North Station has bike racks outside.',
      es: 'North Station tiene estacionamientos para bicis afuera.',
      'pt-BR': 'A North Station tem paraciclos do lado de fora.',
      'zh-Hans': 'North Station 外面有自行车停放架。',
    },
    'rideshare': {
      en: 'Uber and Lyft pick up and drop off on Merrimac Street, 7 PM to 2 AM.',
      es: 'Uber y Lyft recogen y dejan pasajeros en Merrimac Street, de 7 p. m. a 2 a. m.',
      'pt-BR': 'Uber e Lyft embarcam e desembarcam na Merrimac Street, das 7 da noite às 2 da manhã.',
      'zh-Hans': '晚上 7 点到凌晨 2 点，Uber 和 Lyft 在 Merrimac Street 上下客。',
    },
    'transit.headline': {
      en: 'Or take the T: North Station is under the arena.',
      es: 'O toma el T: North Station está debajo de la arena.',
      'pt-BR': 'Ou pegue o T: a North Station fica embaixo da arena.',
      'zh-Hans': '或者坐 T：North Station 就在场馆下面。',
    },
    'transit.lines.1': {
      en: 'Green Line D and E',
      es: 'Green Line D y E',
      'pt-BR': 'Green Line D e E',
      'zh-Hans': 'Green Line D 和 E',
    },
    'transit.lines.2': {
      en: 'Commuter Rail north of Boston',
      es: 'Commuter Rail al norte de Boston',
      'pt-BR': 'Commuter Rail ao norte de Boston',
      'zh-Hans': '开往 Boston 以北的 Commuter Rail',
    },
    'transit.tips.0': {
      en: 'Commuter Rail from the south: get off at Back Bay and take the Orange Line to North Station.',
      es: 'Commuter Rail desde el sur: bájate en Back Bay y toma la Orange Line hasta North Station.',
      'pt-BR': 'Commuter Rail vindo do sul: desça em Back Bay e pegue a Orange Line até a North Station.',
      'zh-Hans': '从南边坐 Commuter Rail：在 Back Bay 下车，换乘 Orange Line 到 North Station。',
    },
    'transit.tips.1': {
      en: 'Red Line: change at Park Street to the Green Line, 3 stops.',
      es: 'Red Line: cambia en Park Street a la Green Line, 3 paradas.',
      'pt-BR': 'Red Line: faça baldeação em Park Street para a Green Line, 3 paradas.',
      'zh-Hans': 'Red Line：在 Park Street 换乘 Green Line，坐 3 站。',
    },
    'transit.tips.2': {
      en: 'Blue Line: change at Government Center to the Green Line, 2 stops.',
      es: 'Blue Line: cambia en Government Center a la Green Line, 2 paradas.',
      'pt-BR': 'Blue Line: faça baldeação em Government Center para a Green Line, 2 paradas.',
      'zh-Hans': 'Blue Line：在 Government Center 换乘 Green Line，坐 2 站。',
    },
  },
  'fenway-park': {
    'lede': {
      en: 'The Red Sox rate is at the Prudential Center Garage, a 15-minute walk, for night and weekend games.',
      es: 'La tarifa de los Red Sox es en el Prudential Center Garage, a 15 minutos a pie, para partidos de noche y de fin de semana.',
      'pt-BR': 'A tarifa dos Red Sox vale no Prudential Center Garage, a 15 minutos a pé, para jogos à noite e nos fins de semana.',
      'zh-Hans': 'Red Sox 优惠价在 Prudential Center Garage，步行 15 分钟，适用于夜场和周末比赛。',
    },
    'garages.0.address': {
      en: 'Enter from Boylston St, Huntington Ave, Dalton St, Exeter St or Belvidere St',
      es: 'Entrada por Boylston St, Huntington Ave, Dalton St, Exeter St o Belvidere St',
      'pt-BR': 'Entrada pela Boylston St, Huntington Ave, Dalton St, Exeter St ou Belvidere St',
      'zh-Hans': '入口在 Boylston St、Huntington Ave、Dalton St、Exeter St 或 Belvidere St',
    },
    'garages.0.where': {
      en: 'Red Sox discount garage · 15 min walk',
      es: 'Garaje con descuento de los Red Sox · 15 min a pie',
      'pt-BR': 'Garagem com desconto dos Red Sox · 15 min a pé',
      'zh-Hans': 'Red Sox 优惠停车楼 · 步行 15 分钟',
    },
    'garages.0.prices.0.label': {
      en: 'Night and weekend games',
      es: 'Partidos de noche y fin de semana',
      'pt-BR': 'Jogos à noite e nos fins de semana',
      'zh-Hans': '夜场和周末比赛',
    },
    'garages.0.facts.0': {
      en: 'Scan that day’s Red Sox ticket at the exit',
      es: 'Escanea tu boleto de los Red Sox de ese día a la salida',
      'pt-BR': 'Escaneie o ingresso dos Red Sox do dia na saída',
      'zh-Hans': '出场时扫描当天的 Red Sox 门票',
    },
    'garages.0.facts.1': {
      en: 'Enter after 2 PM weekdays, 7 AM weekends',
      es: 'Entrada después de las 2 p. m. entre semana y de las 7 a. m. los fines de semana',
      'pt-BR': 'Entrada depois das 2 da tarde nos dias úteis e das 7 da manhã nos fins de semana',
      'zh-Hans': '工作日下午 2 点后、周末早上 7 点后入场',
    },
    'garages.0.facts.2': {
      en: 'Not for concerts or postponed games',
      es: 'No vale para conciertos ni partidos aplazados',
      'pt-BR': 'Não vale para shows nem jogos adiados',
      'zh-Hans': '不适用于演唱会或延期比赛',
    },
    'garages.2.address': {
      en: '771 Beacon St, enter on David Ortiz Dr',
      es: '771 Beacon St, entrada por David Ortiz Dr',
      'pt-BR': '771 Beacon St, entrada pela David Ortiz Dr',
      'zh-Hans': '771 Beacon St，从 David Ortiz Dr 进入',
    },
    'garages.5.note': {
      en: 'Red Sox rate $12, night and weekend games',
      es: 'Tarifa Red Sox $12, partidos de noche y fin de semana',
      'pt-BR': 'Tarifa Red Sox $12, jogos à noite e nos fins de semana',
      'zh-Hans': 'Red Sox 优惠价 $12，夜场和周末比赛',
    },
    'others.title': {
      en: 'A short walk away',
      es: 'A poca distancia a pie',
      'pt-BR': 'A uma curta caminhada',
      'zh-Hans': '步行不远',
    },
    'others.note': {
      en: 'Prices change by game. Cash lots on game days often ask $50 to $65.',
      es: 'Los precios cambian según el partido. Los lotes que cobran en efectivo en días de partido suelen pedir de $50 a $65.',
      'pt-BR': 'Os preços mudam conforme o jogo. Os estacionamentos que cobram em dinheiro em dias de jogo costumam pedir de $50 a $65.',
      'zh-Hans': '价格因比赛而异。比赛日只收现金的停车场通常要价 $50 到 $65。',
    },
    'compare.label': {
      en: 'Compare garages on SpotHero',
      es: 'Compara garajes en SpotHero',
      'pt-BR': 'Compare garagens no SpotHero',
      'zh-Hans': '在 SpotHero 比较停车楼',
    },
    'bikes.note': {
      en: 'On game days there’s free bike valet at Gate D, Van Ness St at Jersey St. It closes 30 minutes after the game.',
      es: 'En días de partido hay estacionamiento vigilado de bicis gratis en la Gate D, Van Ness St con Jersey St. Cierra 30 minutos después del partido.',
      'pt-BR': 'Em dias de jogo há guarda-bikes grátis no Gate D, Van Ness St com Jersey St. Fecha 30 minutos depois do jogo.',
      'zh-Hans': '比赛日在 Gate D（Van Ness St 与 Jersey St 交口）有免费自行车代客停放，比赛结束 30 分钟后关闭。',
    },
    'rideshare': {
      en: 'Fenway has no set pick-up zone. Walk a few blocks from the park and the app shows where to meet your driver.',
      es: 'Fenway no tiene una zona fija para que te recojan. Camina unas cuadras desde el parque y la app te muestra dónde encontrar a tu conductor.',
      'pt-BR': 'O Fenway não tem um ponto fixo de embarque. Caminhe alguns quarteirões a partir do estádio e o app mostra onde encontrar seu motorista.',
      'zh-Hans': 'Fenway 没有固定的上车区。离开球场走几个街区，App 会告诉你在哪里与司机碰面。',
    },
    'priceNote': {
      en: 'These are the 2026 season rates.',
      es: 'Son las tarifas de la temporada 2026.',
      'pt-BR': 'Estas são as tarifas da temporada de 2026.',
      'zh-Hans': '以上为 2026 赛季价格。',
    },
    'transit.headline': {
      en: 'Or take the T: Kenmore station is a 5-minute walk.',
      es: 'O toma el T: la estación Kenmore está a 5 minutos a pie.',
      'pt-BR': 'Ou pegue o T: a estação Kenmore fica a 5 minutos a pé.',
      'zh-Hans': '或者坐 T：Kenmore 站步行 5 分钟。',
    },
    'transit.lines.0': {
      en: 'Green Line B, C and D',
      es: 'Green Line B, C y D',
      'pt-BR': 'Green Line B, C e D',
      'zh-Hans': 'Green Line B、C 和 D',
    },
    'transit.lines.1': {
      en: 'Commuter Rail at Lansdowne',
      es: 'Commuter Rail en Lansdowne',
      'pt-BR': 'Commuter Rail em Lansdowne',
      'zh-Hans': 'Lansdowne 站的 Commuter Rail',
    },
    'transit.tips.0': {
      en: 'Worcester Line Commuter Rail: Lansdowne is 3 minutes from the park.',
      es: 'Commuter Rail de la Worcester Line: Lansdowne está a 3 minutos del parque.',
      'pt-BR': 'Commuter Rail da Worcester Line: Lansdowne fica a 3 minutos do estádio.',
      'zh-Hans': 'Worcester Line 的 Commuter Rail：Lansdowne 站离球场 3 分钟。',
    },
    'transit.tips.1': {
      en: 'Green Line D: the Fenway stop is about 8 minutes on foot.',
      es: 'Green Line D: la parada Fenway está a unos 8 minutos a pie.',
      'pt-BR': 'Green Line D: a parada Fenway fica a uns 8 minutos a pé.',
      'zh-Hans': 'Green Line D：Fenway 站步行约 8 分钟。',
    },
    'transit.tips.2': {
      en: 'Red Line: change at Park Street to a B, C or D train to Kenmore.',
      es: 'Red Line: cambia en Park Street a un tren B, C o D hasta Kenmore.',
      'pt-BR': 'Red Line: faça baldeação em Park Street para um trem B, C ou D até Kenmore.',
      'zh-Hans': 'Red Line：在 Park Street 换乘 B、C 或 D 线列车到 Kenmore。',
    },
  },
  'gillette-stadium': {
    'lede': {
      en: 'The general lots are across Route 1, a 10 to 17 minute walk to the stadium.',
      es: 'Los lotes generales están al otro lado de la Route 1, a 10 a 17 minutos a pie del estadio.',
      'pt-BR': 'Os estacionamentos gerais ficam do outro lado da Route 1, a 10 a 17 minutos a pé do estádio.',
      'zh-Hans': '普通停车场在 Route 1 对面，步行 10 到 17 分钟到体育场。',
    },
    'garages.0.name': {
      en: 'Free lots across Route 1',
      es: 'Lotes gratis al otro lado de la Route 1',
      'pt-BR': 'Estacionamentos grátis do outro lado da Route 1',
      'zh-Hans': 'Route 1 对面的免费停车场',
    },
    'garages.0.where': {
      en: 'For every ticket holder · 10 to 17 min walk',
      es: 'Para todos con boleto · 10 a 17 min a pie',
      'pt-BR': 'Para todos com ingresso · 10 a 17 min a pé',
      'zh-Hans': '所有持票人可用 · 步行 10 到 17 分钟',
    },
    'garages.0.book.label': {
      en: 'Lot maps and rules',
      es: 'Mapas y reglas de los lotes',
      'pt-BR': 'Mapas e regras dos estacionamentos',
      'zh-Hans': '停车场地图和规则',
    },
    'garages.0.prices.0.label': {
      en: 'Patriots, concerts and Revolution',
      es: 'Patriots, conciertos y Revolution',
      'pt-BR': 'Patriots, shows e Revolution',
      'zh-Hans': 'Patriots、演唱会和 Revolution',
    },
    'garages.0.prices.0.amount': {
      en: 'Free',
      es: 'Gratis',
      'pt-BR': 'Grátis',
      'zh-Hans': '免费',
    },
    'garages.0.prices.1.label': {
      en: 'Visa card to wait 75 min after Patriots games',
      es: 'Tarjeta Visa por esperar 75 min después de los partidos de los Patriots',
      'pt-BR': 'Cartão Visa para esperar 75 min depois dos jogos dos Patriots',
      'zh-Hans': 'Patriots 比赛后等候 75 分钟可获 Visa 卡',
    },
    'garages.0.facts.0': {
      en: 'Open 4 hours before kickoff',
      es: 'Abren 4 horas antes del inicio',
      'pt-BR': 'Abrem 4 horas antes do início do jogo',
      'zh-Hans': '开球前 4 小时开放',
    },
    'garages.0.facts.1': {
      en: 'Close 2 hours after day games',
      es: 'Cierran 2 horas después de los partidos de día',
      'pt-BR': 'Fecham 2 horas depois dos jogos diurnos',
      'zh-Hans': '日场比赛后 2 小时关闭',
    },
    'garages.0.facts.2': {
      en: 'No re-entry',
      es: 'Sin reingreso',
      'pt-BR': 'Sem reentrada',
      'zh-Hans': '不可再次入场',
    },
    'garages.0.facts.3': {
      en: 'Tailgating OK, no open fires',
      es: 'Se permite el tailgating, sin fogatas',
      'pt-BR': 'Pode fazer tailgate, sem fogo aberto',
      'zh-Hans': '可以车尾野餐，禁止明火',
    },
    'garages.1.name': {
      en: 'Be Paid to Park: Lots 45 and 55B',
      es: 'Be Paid to Park: lotes 45 y 55B',
      'pt-BR': 'Be Paid to Park: estacionamentos 45 e 55B',
      'zh-Hans': 'Be Paid to Park：45 号和 55B 号停车场',
    },
    'garages.1.address': {
      en: 'Across Route 1',
      es: 'Al otro lado de la Route 1',
      'pt-BR': 'Do outro lado da Route 1',
      'zh-Hans': 'Route 1 对面',
    },
    'garages.1.note': {
      en: '$50 Visa card · leave 75 min after the game · full 30 min after kickoff',
      es: 'Tarjeta Visa de $50 · sales 75 min después del partido · se llena 30 min después del inicio',
      'pt-BR': 'Cartão Visa de $50 · saída 75 min depois do jogo · lota 30 min depois do início',
      'zh-Hans': '$50 Visa 卡 · 赛后 75 分钟离场 · 开球后 30 分钟停满',
    },
    'garages.2.name': {
      en: 'Stadium-side lots',
      es: 'Lotes junto al estadio',
      'pt-BR': 'Estacionamentos ao lado do estádio',
      'zh-Hans': '体育场旁停车场',
    },
    'garages.2.address': {
      en: 'Next to the stadium',
      es: 'Junto al estadio',
      'pt-BR': 'Ao lado do estádio',
      'zh-Hans': '紧邻体育场',
    },
    'garages.2.note': {
      en: 'Prepaid only · Patriots: sold out for 2026',
      es: 'Solo prepago · Patriots: agotado para 2026',
      'pt-BR': 'Só pré-pago · Patriots: esgotado em 2026',
      'zh-Hans': '仅限预付 · Patriots：2026 年已售罄',
    },
    'others.title': {
      en: 'Other lots',
      es: 'Otros lotes',
      'pt-BR': 'Outros estacionamentos',
      'zh-Hans': '其他停车场',
    },
    'others.note': {
      en: 'Closer to the stadium, or paid to wait.',
      es: 'Más cerca del estadio, o con pago por esperar.',
      'pt-BR': 'Mais perto do estádio, ou com pagamento para esperar.',
      'zh-Hans': '离体育场更近，或者等候可获报酬。',
    },
    'rideshare': {
      en: 'Uber and Lyft pick up in Lot 15 or 16, next to Bass Pro Shops at Patriot Place; the event guide says which. No drop-offs on Route 1.',
      es: 'Uber y Lyft recogen en el Lot 15 o 16, junto a Bass Pro Shops en Patriot Place; la guía del evento dice cuál. No se puede dejar pasajeros en la Route 1.',
      'pt-BR': 'Uber e Lyft embarcam no Lot 15 ou 16, ao lado da Bass Pro Shops em Patriot Place; o guia do evento diz qual. Não há desembarque na Route 1.',
      'zh-Hans': 'Uber 和 Lyft 在 Patriot Place 的 Bass Pro Shops 旁边的 Lot 15 或 16 接客，具体见活动指南。Route 1 上不能下客。',
    },
    'transit.headline': {
      en: 'Or take the train: the event train stops at the stadium.',
      es: 'O toma el tren: el tren del evento para en el estadio.',
      'pt-BR': 'Ou pegue o trem: o trem do evento para no estádio.',
      'zh-Hans': '或者坐火车：赛事列车停靠体育场。',
    },
    'transit.lines.0': {
      en: 'From South Station, Back Bay and Dedham',
      es: 'Desde South Station, Back Bay y Dedham',
      'pt-BR': 'Saindo de South Station, Back Bay e Dedham',
      'zh-Hans': '从 South Station、Back Bay 和 Dedham 出发',
    },
    'transit.lines.1': {
      en: 'From Providence on some dates',
      es: 'Desde Providence algunos días',
      'pt-BR': 'Saindo de Providence em algumas datas',
      'zh-Hans': '部分日期从 Providence 出发',
    },
    'transit.tips.0': {
      en: 'Trains get in about an hour before kickoff and leave 30 minutes after the game ends.',
      es: 'Los trenes llegan como una hora antes del inicio y salen 30 minutos después de que termina el partido.',
      'pt-BR': 'Os trens chegam cerca de uma hora antes do início e saem 30 minutos depois do fim do jogo.',
      'zh-Hans': '列车在开球前约一小时到达，比赛结束 30 分钟后发车。',
    },
    'transit.tips.1': {
      en: 'Regular Commuter Rail tickets and passes don’t work on event trains.',
      es: 'Los boletos y pases normales del Commuter Rail no sirven en los trenes de eventos.',
      'pt-BR': 'Passagens e passes comuns do Commuter Rail não valem nos trens de eventos.',
      'zh-Hans': '普通 Commuter Rail 车票和月票不能用于赛事列车。',
    },
    'transit.tips.2': {
      en: 'On weekdays the regular Franklin/Foxboro Line stops here too, but the last train can leave before the event ends.',
      es: 'Entre semana, la Franklin/Foxboro Line regular también para aquí, pero el último tren puede salir antes de que termine el evento.',
      'pt-BR': 'Nos dias úteis, a Franklin/Foxboro Line regular também para aqui, mas o último trem pode sair antes do fim do evento.',
      'zh-Hans': '工作日普通的 Franklin/Foxboro Line 也停靠这里，但末班车可能在活动结束前开走。',
    },
    'transit.eventTrains.fare': {
      en: '$20 round trip',
      es: '$20 ida y vuelta',
      'pt-BR': '$20 ida e volta',
      'zh-Hans': '往返 $20',
    },
    'transit.eventTrains.buy': {
      en: 'mTicket app only. Patriots tickets go on sale at 11 AM the Monday before the game.',
      es: 'Solo en la app mTicket. Los boletos para los partidos de los Patriots salen a la venta a las 11 a. m. del lunes antes del partido.',
      'pt-BR': 'Só pelo app mTicket. As passagens para jogos dos Patriots começam a ser vendidas às 11 da manhã da segunda-feira antes do jogo.',
      'zh-Hans': '仅限 mTicket App 购买。Patriots 比赛的车票在赛前周一上午 11 点开售。',
    },
    'transit.eventTrains.trips.0.times': {
      en: 'South Station 1:55 and 2:20 PM · Providence 1:50 PM',
      es: 'South Station 1:55 y 2:20 p. m. · Providence 1:50 p. m.',
      'pt-BR': 'South Station 1:55 e 2:20 PM · Providence 1:50 PM',
      'zh-Hans': 'South Station 下午 1:55 和 2:20 · Providence 下午 1:50',
    },
    'transit.eventTrains.trips.1.times': {
      en: 'South Station 1:55 and 2:20 PM · Providence 1:50 PM',
      es: 'South Station 1:55 y 2:20 p. m. · Providence 1:50 p. m.',
      'pt-BR': 'South Station 1:55 e 2:20 PM · Providence 1:50 PM',
      'zh-Hans': 'South Station 下午 1:55 和 2:20 · Providence 下午 1:50',
    },
    'transit.eventTrains.trips.2.times': {
      en: 'South Station 5:25 PM · Providence 5:20 PM',
      es: 'South Station 5:25 p. m. · Providence 5:20 p. m.',
      'pt-BR': 'South Station 5:25 PM · Providence 5:20 PM',
      'zh-Hans': 'South Station 下午 5:25 · Providence 下午 5:20',
    },
  },
  'white-stadium': {
    'lede': {
      en: 'There’s no fan parking at the stadium. Free shuttles run from Forest Hills, Ruggles and JFK/UMass.',
      es: 'No hay estacionamiento para aficionados en el estadio. Hay shuttles gratis desde Forest Hills, Ruggles y JFK/UMass.',
      'pt-BR': 'Não há estacionamento para torcedores no estádio. Ônibus gratuitos saem de Forest Hills, Ruggles e JFK/UMass.',
      'zh-Hans': '体育场没有球迷停车场。免费接驳车从 Forest Hills、Ruggles 和 JFK/UMass 发车。',
    },
    'priceSources.1.label': {
      en: 'the City’s agreement with the team',
      es: 'el acuerdo de la Ciudad con el equipo',
      'pt-BR': 'o acordo da Prefeitura com o time',
      'zh-Hans': '市政府与球队的协议',
    },
    'shuttles.stations.0.lines.1': {
      en: 'Needham, Franklin and Providence trains',
      es: 'Trenes de Needham, Franklin y Providence',
      'pt-BR': 'Trens de Needham, Franklin e Providence',
      'zh-Hans': 'Needham、Franklin 和 Providence 线列车',
    },
    'shuttles.stations.0.where': {
      en: 'On the Arborway side of the station',
      es: 'del lado de Arborway de la estación',
      'pt-BR': 'no lado da Arborway da estação',
      'zh-Hans': '车站的 Arborway 一侧',
    },
    'shuttles.stations.1.lines.1': {
      en: 'Needham, Franklin and Providence trains',
      es: 'Trenes de Needham, Franklin y Providence',
      'pt-BR': 'Trens de Needham, Franklin e Providence',
      'zh-Hans': 'Needham、Franklin 和 Providence 线列车',
    },
    'shuttles.stations.1.where': {
      en: 'On Columbus Ave, by the station entrance',
      es: 'en Columbus Ave, junto a la entrada de la estación',
      'pt-BR': 'na Columbus Ave, junto à entrada da estação',
      'zh-Hans': 'Columbus Ave 上，车站入口旁',
    },
    'shuttles.stations.2.lines.1': {
      en: 'Kingston, Greenbush and Fall River/New Bedford trains',
      es: 'Trenes de Kingston, Greenbush y Fall River/New Bedford',
      'pt-BR': 'Trens de Kingston, Greenbush e Fall River/New Bedford',
      'zh-Hans': 'Kingston、Greenbush 和 Fall River/New Bedford 线列车',
    },
    'shuttles.stations.2.where': {
      en: 'On Columbia Rd, by the station entrance',
      es: 'en Columbia Rd, junto a la entrada de la estación',
      'pt-BR': 'na Columbia Rd, junto à entrada da estação',
      'zh-Hans': 'Columbia Rd 上，车站入口旁',
    },
    'shuttles.satellite': {
      en: 'Lots outside Boston. Buy parking with your ticket and ride the free shuttle in.',
      es: 'Lotes fuera de Boston. Compra el estacionamiento con tu boleto y llega en el shuttle gratis.',
      'pt-BR': 'Estacionamentos fora de Boston. Compre a vaga junto com o ingresso e chegue no ônibus gratuito.',
      'zh-Hans': 'Boston 以外的停车场。购票时一起买停车位，再坐免费接驳车进场。',
    },
    'shuttles.source.label': {
      en: 'the City’s agreement with the team',
      es: 'el acuerdo de la Ciudad con el equipo',
      'pt-BR': 'o acordo da Prefeitura com o time',
      'zh-Hans': '市政府与球队的协议',
    },
    'bikes.parking.tiles.0.label': {
      en: 'Bike valet spaces on game days',
      es: 'Lugares en el estacionamiento vigilado de bicis en días de partido',
      'pt-BR': 'Vagas no guarda-bikes em dias de jogo',
      'zh-Hans': '比赛日自行车代客停放车位',
    },
    'bikes.parking.tiles.1.label': {
      en: 'Docks at a new Bluebikes station in the park',
      es: 'Puestos en una nueva estación de Bluebikes en el parque',
      'pt-BR': 'Vagas numa nova estação da Bluebikes no parque',
      'zh-Hans': '公园内新建 Bluebikes 站的车桩',
    },
    'bikes.parking.tiles.2.label': {
      en: 'Bike racks at the stadium',
      es: 'Estacionamientos para bicis en el estadio',
      'pt-BR': 'Paraciclos no estádio',
      'zh-Hans': '体育场的自行车停放架',
    },
    'bikes.parking.source.label': {
      en: 'the City’s agreement with the team',
      es: 'el acuerdo de la Ciudad con el equipo',
      'pt-BR': 'o acordo da Prefeitura com o time',
      'zh-Hans': '市政府与球队的协议',
    },
    'walk.from.0.lines': {
      en: 'Buses 22 and 29',
      es: 'Buses 22 y 29',
      'pt-BR': 'Ônibus 22 e 29',
      'zh-Hans': '22 路和 29 路巴士',
    },
    'walk.entrances': {
      en: 'Walk in from Walnut Ave at School St or Park Lane, or from Pierpont Rd at Circuit Drive.',
      es: 'Entra a pie por Walnut Ave con School St o Park Lane, o por Pierpont Rd con Circuit Drive.',
      'pt-BR': 'Entre a pé pela Walnut Ave com School St ou Park Lane, ou pela Pierpont Rd com Circuit Drive.',
      'zh-Hans': '步行可从 Walnut Ave 与 School St 或 Park Lane 交口进入，也可从 Pierpont Rd 与 Circuit Drive 交口进入。',
    },
    'rideshare': {
      en: 'On game days Uber and Lyft drop off and pick up at the Seaver Street lot. Free wheelchair-accessible carts run from there to the stadium.',
      es: 'En días de partido, Uber y Lyft dejan y recogen pasajeros en el lote de Seaver Street. Desde ahí salen carritos gratis accesibles en silla de ruedas hasta el estadio.',
      'pt-BR': 'Em dias de jogo, Uber e Lyft embarcam e desembarcam no estacionamento da Seaver Street. De lá, carrinhos gratuitos e acessíveis para cadeira de rodas levam até o estádio.',
      'zh-Hans': '比赛日 Uber 和 Lyft 在 Seaver Street 停车场上下客，从那里有免费的无障碍电瓶车送到体育场。',
    },
    'transit.headline': {
      en: 'Take the T to a free shuttle.',
      es: 'Toma el T hasta un shuttle gratis.',
      'pt-BR': 'Pegue o T até um ônibus gratuito.',
      'zh-Hans': '坐 T 换乘免费接驳车。',
    },
    'transit.tips.0': {
      en: 'Every shuttle is wheelchair accessible.',
      es: 'Todos los shuttles son accesibles en silla de ruedas.',
      'pt-BR': 'Todos os ônibus gratuitos são acessíveis para cadeira de rodas.',
      'zh-Hans': '所有接驳车均可供轮椅使用。',
    },
    'transit.tips.1': {
      en: 'Bus 16 from Forest Hills stops on Circuit Drive, an 8-minute walk from the stadium.',
      es: 'El bus 16 desde Forest Hills para en Circuit Drive, a 8 minutos a pie del estadio.',
      'pt-BR': 'O ônibus 16 saindo de Forest Hills para na Circuit Drive, a 8 minutos a pé do estádio.',
      'zh-Hans': '从 Forest Hills 出发的 16 路巴士停靠 Circuit Drive，步行 8 分钟到体育场。',
    },
    'notice.text': {
      en: 'Boston Legacy FC moves into White Stadium for the 2028 season. Their 2027 home games are at Centreville Bank Stadium in Pawtucket, RI.',
      es: 'Boston Legacy FC se muda a White Stadium para la temporada 2028. Sus partidos de local de 2027 son en Centreville Bank Stadium, en Pawtucket, RI.',
      'pt-BR': 'O Boston Legacy FC se muda para o White Stadium na temporada de 2028. Os jogos em casa de 2027 são no Centreville Bank Stadium, em Pawtucket, RI.',
      'zh-Hans': 'Boston Legacy FC 将从 2028 赛季起入驻 White Stadium。2027 年的主场比赛在 Pawtucket, RI 的 Centreville Bank Stadium 举行。',
    },
    'noParking.title': {
      en: 'No fan parking at White Stadium',
      es: 'Sin estacionamiento para aficionados en White Stadium',
      'pt-BR': 'Sem estacionamento para torcedores no White Stadium',
      'zh-Hans': 'White Stadium 没有球迷停车场',
    },
    'noParking.tiles.0.label': {
      en: 'Fan parking at the stadium',
      es: 'Estacionamiento para aficionados en el estadio',
      'pt-BR': 'Estacionamento para torcedores no estádio',
      'zh-Hans': '体育场球迷停车位',
    },
    'noParking.tiles.0.amount': {
      en: 'None',
      es: 'Ninguno',
      'pt-BR': 'Nenhum',
      'zh-Hans': '无',
    },
    'noParking.tiles.1.label': {
      en: 'Shuttles from three T stations',
      es: 'Shuttles desde tres estaciones del T',
      'pt-BR': 'Ônibus gratuitos de três estações do T',
      'zh-Hans': '从三个 T 站发车的接驳车',
    },
    'noParking.tiles.1.amount': {
      en: 'Free',
      es: 'Gratis',
      'pt-BR': 'Grátis',
      'zh-Hans': '免费',
    },
    'noParking.tiles.2.label': {
      en: 'Longest wait for a shuttle',
      es: 'Espera máxima por un shuttle',
      'pt-BR': 'Espera máxima pelo ônibus gratuito',
      'zh-Hans': '接驳车最长等候时间',
    },
    'noParking.tiles.2.amount': {
      en: '10 min',
      es: '10 min',
      'pt-BR': '10 min',
      'zh-Hans': '10 分钟',
    },
    'noParking.chips.0': {
      en: 'Choose shuttle, T, bike or walking when you buy tickets',
      es: 'Elige shuttle, T, bici o a pie al comprar tus boletos',
      'pt-BR': 'Escolha ônibus gratuito, T, bike ou a pé ao comprar o ingresso',
      'zh-Hans': '购票时选择接驳车、T、骑车或步行',
    },
    'noParking.chips.1': {
      en: 'Satellite lots: buy parking with your ticket',
      es: 'Lotes satélite: compra el estacionamiento con tu boleto',
      'pt-BR': 'Estacionamentos de apoio: compre a vaga com o ingresso',
      'zh-Hans': '外围停车场：购票时一起买停车位',
    },
    'noParking.chips.2': {
      en: 'Nearby streets kept for residents on game days',
      es: 'Calles cercanas reservadas para residentes en días de partido',
      'pt-BR': 'Ruas próximas reservadas para moradores em dias de jogo',
      'zh-Hans': '比赛日附近街道仅供居民停车',
    },
    'noParking.pending.0': {
      en: 'Shuttle hours',
      es: 'Horario de los shuttles',
      'pt-BR': 'Horário dos ônibus gratuitos',
      'zh-Hans': '接驳车运营时间',
    },
    'noParking.pending.1': {
      en: 'Which satellite lots',
      es: 'Qué lotes satélite',
      'pt-BR': 'Quais estacionamentos de apoio',
      'zh-Hans': '哪些外围停车场',
    },
    'noParking.pending.2': {
      en: 'Which streets are for residents only',
      es: 'Qué calles son solo para residentes',
      'pt-BR': 'Quais ruas são só para moradores',
      'zh-Hans': '哪些街道仅限居民',
    },
  },
  'logan-airport': {
    'lede': {
      en: 'The Central Parking Garage connects to every terminal. The Economy Garage costs less, with a free shuttle in.',
      es: 'El Central Parking Garage conecta con todas las terminales. El Economy Garage cuesta menos y tiene un shuttle gratis a las terminales.',
      'pt-BR': 'O Central Parking Garage tem acesso a todos os terminais. O Economy Garage custa menos e tem ônibus gratuito até os terminais.',
      'zh-Hans': 'Central Parking Garage 连通所有航站楼。Economy Garage 更便宜，有免费接驳车到航站楼。',
    },
    'seo.title': {
      en: 'Logan Airport parking: garages, daily rates and the T | Green Streets Initiative',
      es: 'Estacionamiento en Logan Airport: garajes, tarifas diarias y el T | Green Streets Initiative',
      'pt-BR': 'Estacionamento no Logan Airport: garagens, diárias e o T | Green Streets Initiative',
      'zh-Hans': 'Logan Airport 停车：停车楼、每日价格和 T | Green Streets Initiative',
    },
    'seo.description': {
      en: 'Where to park at Logan: the Central, Terminal B and Economy garages with Massport’s rates, plus the free Silver Line, the Blue Line and Logan Express buses.',
      es: 'Dónde estacionar en Logan: los garajes Central, Terminal B y Economy con las tarifas de Massport, además de la Silver Line gratis, la Blue Line y los buses Logan Express.',
      'pt-BR': 'Onde estacionar no Logan: as garagens Central, Terminal B e Economy com as tarifas da Massport, além da Silver Line grátis, da Blue Line e dos ônibus Logan Express.',
      'zh-Hans': '在 Logan 哪里停车：Central、Terminal B 和 Economy 停车楼及 Massport 价格，另有免费的 Silver Line、Blue Line 和 Logan Express 巴士。',
    },
    'garages.0.where': {
      en: 'Walkways to Terminals A, B, C and E',
      es: 'Pasarelas a las terminales A, B, C y E',
      'pt-BR': 'Passarelas para os terminais A, B, C e E',
      'zh-Hans': '有步道通往 A、B、C、E 航站楼',
    },
    'garages.0.book.label': {
      en: 'Reserve on massport.com',
      es: 'Reserva en massport.com',
      'pt-BR': 'Reserve em massport.com',
      'zh-Hans': '在 massport.com 预订',
    },
    'garages.0.prices.0.label': {
      en: 'First hour',
      es: 'Primera hora',
      'pt-BR': 'Primeira hora',
      'zh-Hans': '第一小时',
    },
    'garages.0.prices.1.label': {
      en: 'Up to 24 hours',
      es: 'Hasta 24 horas',
      'pt-BR': 'Até 24 horas',
      'zh-Hans': '24 小时内',
    },
    'garages.0.prices.2.label': {
      en: 'A day, booked ahead',
      es: 'Por día, con reserva',
      'pt-BR': 'Por dia, com reserva',
      'zh-Hans': '提前预订，每天',
    },
    'garages.0.facts.0': {
      en: 'Each extra day $46, or $23 under 6 hours',
      es: 'Cada día extra $46, o $23 por menos de 6 horas',
      'pt-BR': 'Cada dia a mais $46, ou $23 abaixo de 6 horas',
      'zh-Hans': '每多一天 $46，不足 6 小时 $23',
    },
    'garages.0.facts.1': {
      en: 'Walkways on Level 4',
      es: 'Pasarelas en el nivel 4',
      'pt-BR': 'Passarelas no andar 4',
      'zh-Hans': '步道在 4 层',
    },
    'garages.0.facts.2': {
      en: 'Height limit 9′6″',
      es: 'Altura máxima 9′6″',
      'pt-BR': 'Altura máxima 9′6″',
      'zh-Hans': '限高 9′6″',
    },
    'garages.1.address': {
      en: 'For Terminal B flights',
      es: 'Para vuelos de la Terminal B',
      'pt-BR': 'Para voos do Terminal B',
      'zh-Hans': '适用于 B 航站楼航班',
    },
    'garages.1.access': {
      en: 'At the terminal',
      es: 'En la terminal',
      'pt-BR': 'No terminal',
      'zh-Hans': '就在航站楼',
    },
    'garages.1.note': {
      en: 'Same rates · height limit 6′6″',
      es: 'Mismas tarifas · altura máxima 6′6″',
      'pt-BR': 'Mesmas tarifas · altura máxima 6′6″',
      'zh-Hans': '价格相同 · 限高 6′6″',
    },
    'garages.2.address': {
      en: 'About 2 miles from the terminals',
      es: 'A unas 2 millas de las terminales',
      'pt-BR': 'A cerca de 2 milhas dos terminais',
      'zh-Hans': '距航站楼约 2 英里',
    },
    'garages.2.access': {
      en: 'Free shuttle',
      es: 'Shuttle gratis',
      'pt-BR': 'Ônibus gratuito',
      'zh-Hans': '免费接驳车',
    },
    'garages.2.note': {
      en: '$37 a day · first hour $10 · height limit 8′2″',
      es: '$37 por día · primera hora $10 · altura máxima 8′2″',
      'pt-BR': '$37 por dia · primeira hora $10 · altura máxima 8′2″',
      'zh-Hans': '每天 $37 · 第一小时 $10 · 限高 8′2″',
    },
    'priceSources.1.label': {
      en: 'Economy rates',
      es: 'Tarifas de Economy',
      'pt-BR': 'Tarifas do Economy',
      'zh-Hans': 'Economy 价格',
    },
    'others.title': {
      en: 'The other garages',
      es: 'Los otros garajes',
      'pt-BR': 'As outras garagens',
      'zh-Hans': '其他停车楼',
    },
    'others.note': {
      en: 'Terminal B charges the same as Central. Economy is about $9 a day less.',
      es: 'Terminal B cobra lo mismo que Central. Economy cuesta unos $9 menos por día.',
      'pt-BR': 'O Terminal B cobra o mesmo que o Central. O Economy sai cerca de $9 a menos por dia.',
      'zh-Hans': 'Terminal B 与 Central 收费相同。Economy 每天便宜约 $9。',
    },
    'compare.label': {
      en: 'See which garages have space',
      es: 'Mira qué garajes tienen lugar',
      'pt-BR': 'Veja quais garagens têm vaga',
      'zh-Hans': '查看哪些停车楼有空位',
    },
    'bikes.note': {
      en: 'Both docks are by Airport station, minutes from the free Massport shuttle to every terminal.',
      es: 'Las dos estaciones están junto a la estación Airport, a minutos del shuttle gratis de Massport a todas las terminales.',
      'pt-BR': 'As duas estações ficam perto da estação Airport, a poucos minutos do ônibus gratuito da Massport para todos os terminais.',
      'zh-Hans': '两个站点都在 Airport 站旁边，几分钟就能到前往各航站楼的免费 Massport 接驳车。',
    },
    'rideshare': {
      en: 'Uber and Lyft pick up and drop off in the Central Parking Garage for Terminals A, C and E, and on Level 2 of the Terminal B Garage for Terminal B. Follow the signs; the app shows where to meet your driver.',
      es: 'Uber y Lyft recogen y dejan pasajeros en el Central Parking Garage para las terminales A, C y E, y en el nivel 2 del Terminal B Garage para la terminal B. Sigue las señales; la app te muestra dónde encontrar a tu conductor.',
      'pt-BR': 'Uber e Lyft embarcam e desembarcam passageiros no Central Parking Garage para os terminais A, C e E, e no nível 2 do Terminal B Garage para o terminal B. Siga as placas; o app mostra onde encontrar seu motorista.',
      'zh-Hans': 'Uber 和 Lyft 在 Central Parking Garage 为 A、C、E 航站楼接送乘客，B 航站楼则在 Terminal B Garage 的 2 层。跟着指示牌走，App 会告诉你在哪里与司机碰面。',
    },
    'airport.buses.title': {
      en: 'Logan Express buses',
      es: 'Buses Logan Express',
      'pt-BR': 'Ônibus Logan Express',
      'zh-Hans': 'Logan Express 巴士',
    },
    'airport.buses.note': {
      en: 'Buses to every terminal. Kids ride free with a family member who has a ticket.',
      es: 'Buses a todas las terminales. Los niños viajan gratis con un familiar que tenga boleto.',
      'pt-BR': 'Ônibus para todos os terminais. Crianças viajam grátis com um familiar que tenha passagem.',
      'zh-Hans': '巴士直达各航站楼。儿童由持票家人陪同可免费乘车。',
    },
    'airport.buses.routes.0.where': {
      en: 'Copley Place, Dartmouth St, and 800 Boylston St',
      es: 'Copley Place, Dartmouth St y 800 Boylston St',
      'pt-BR': 'Copley Place, Dartmouth St e 800 Boylston St',
      'zh-Hans': 'Copley Place、Dartmouth St 和 800 Boylston St',
    },
    'airport.buses.routes.0.fare': {
      en: '$3 to the airport, free back',
      es: '$3 al aeropuerto, gratis de regreso',
      'pt-BR': '$3 até o aeroporto, volta grátis',
      'zh-Hans': '去机场 $3，回程免费',
    },
    'airport.buses.routes.1.where': {
      en: 'Quincy Adams T garage',
      es: 'Garaje del T en Quincy Adams',
      'pt-BR': 'Garagem do T em Quincy Adams',
      'zh-Hans': 'Quincy Adams T 站停车楼',
    },
    'airport.buses.routes.1.fare': {
      en: '$9 each way online · park $7 a day',
      es: '$9 por trayecto en línea · estacionar $7 por día',
      'pt-BR': '$9 por trecho online · estacionar $7 por dia',
      'zh-Hans': '网上购票单程 $9 · 停车每天 $7',
    },
    'airport.buses.routes.2.fare': {
      en: '$9 each way online · park $7 a day',
      es: '$9 por trayecto en línea · estacionar $7 por día',
      'pt-BR': '$9 por trecho online · estacionar $7 por dia',
      'zh-Hans': '网上购票单程 $9 · 停车每天 $7',
    },
    'airport.buses.routes.3.where': {
      en: 'Burr St, off the Mass Pike',
      es: 'Burr St, saliendo de la Mass Pike',
      'pt-BR': 'Burr St, saindo da Mass Pike',
      'zh-Hans': 'Burr St，Mass Pike 出口附近',
    },
    'airport.buses.routes.3.fare': {
      en: '$9 each way online · park $7 a day',
      es: '$9 por trayecto en línea · estacionar $7 por día',
      'pt-BR': '$9 por trecho online · estacionar $7 por dia',
      'zh-Hans': '网上购票单程 $9 · 停车每天 $7',
    },
    'airport.buses.routes.4.fare': {
      en: '$9 each way online · park $7 a day',
      es: '$9 por trayecto en línea · estacionar $7 por día',
      'pt-BR': '$9 por trecho online · estacionar $7 por dia',
      'zh-Hans': '网上购票单程 $9 · 停车每天 $7',
    },
    'priceNote': {
      en: 'Booked-ahead spaces are limited.',
      es: 'Los lugares con reserva son limitados.',
      'pt-BR': 'As vagas com reserva são limitadas.',
      'zh-Hans': '可预订车位有限。',
    },
    'transit.headline': {
      en: 'Or take the T: the Silver Line and the Blue Line both reach every terminal.',
      es: 'O toma el T: la Silver Line y la Blue Line llegan a todas las terminales.',
      'pt-BR': 'Ou pegue o T: a Silver Line e a Blue Line chegam a todos os terminais.',
      'zh-Hans': '或者坐 T：Silver Line 和 Blue Line 都能到达各航站楼。',
    },
    'transit.lines.0': {
      en: 'Silver Line SL1 from South Station',
      es: 'Silver Line SL1 desde South Station',
      'pt-BR': 'Silver Line SL1 saindo de South Station',
      'zh-Hans': '从 South Station 出发的 Silver Line SL1',
    },
    'transit.lines.1': {
      en: 'Blue Line to Airport',
      es: 'Blue Line hasta Airport',
      'pt-BR': 'Blue Line até Airport',
      'zh-Hans': 'Blue Line 到 Airport 站',
    },
    'transit.lines.2': {
      en: 'Free Massport shuttle',
      es: 'Shuttle gratis de Massport',
      'pt-BR': 'Ônibus gratuito da Massport',
      'zh-Hans': '免费 Massport 接驳车',
    },
    'transit.lines.3': {
      en: 'Ferry',
      es: 'Ferry',
      'pt-BR': 'Barca',
      'zh-Hans': '渡轮',
    },
    'transit.tips.0': {
      en: 'Silver Line SL1 stops at every terminal and runs to South Station, on the Red Line and Commuter Rail. Rides from the airport are always free.',
      es: 'La Silver Line SL1 para en todas las terminales y llega a South Station, en la Red Line y el Commuter Rail. Los viajes desde el aeropuerto siempre son gratis.',
      'pt-BR': 'A Silver Line SL1 para em todos os terminais e vai até South Station, na Red Line e no Commuter Rail. As viagens saindo do aeroporto são sempre grátis.',
      'zh-Hans': 'Silver Line SL1 停靠各航站楼，开往 South Station，可换乘 Red Line 和 Commuter Rail。从机场出发始终免费。',
    },
    'transit.tips.1': {
      en: 'Going to the airport, the change from the Red Line to the SL1 at South Station is free.',
      es: 'Para ir al aeropuerto, el cambio de la Red Line a la SL1 en South Station es gratis.',
      'pt-BR': 'Indo para o aeroporto, a baldeação da Red Line para a SL1 em South Station é grátis.',
      'zh-Hans': '去机场时，在 South Station 从 Red Line 换乘 SL1 免费。',
    },
    'transit.tips.2': {
      en: 'Blue Line: get off at Airport and take the free Massport shuttle to your terminal.',
      es: 'Blue Line: bájate en Airport y toma el shuttle gratis de Massport a tu terminal.',
      'pt-BR': 'Blue Line: desça em Airport e pegue o ônibus gratuito da Massport até o seu terminal.',
      'zh-Hans': 'Blue Line：在 Airport 站下车，换乘免费 Massport 接驳车到你的航站楼。',
    },
    'transit.tips.3': {
      en: 'Boats run from the airport ferry dock to Long Wharf, Lovejoy Wharf by North Station, Hingham and Hull, with more trips in summer.',
      es: 'Hay barcos desde el muelle de ferris del aeropuerto a Long Wharf, Lovejoy Wharf junto a North Station, Hingham y Hull, con más viajes en verano.',
      'pt-BR': 'Há barcos do terminal de barcas do aeroporto para Long Wharf, Lovejoy Wharf perto da North Station, Hingham e Hull, com mais viagens no verão.',
      'zh-Hans': '渡轮从机场码头开往 Long Wharf、North Station 旁的 Lovejoy Wharf、Hingham 和 Hull，夏季班次更多。',
    },
  },
}

/** The venue in the page's language, field by field; English (and any field whose English changed) as is. */
export function localizeVenue(v: Venue, locale: SiteLocale): Venue {
  const text = VENUE_TEXT[v.slug]
  if (locale === 'en' || !text) return v
  const out = structuredClone(v)
  for (const [path, tr] of Object.entries(text)) {
    const keys = path.split('.')
    let at: unknown = out
    for (const k of keys.slice(0, -1)) at = at && typeof at === 'object' ? (at as Record<string, unknown>)[k] : undefined
    if (!at || typeof at !== 'object') continue
    const last = keys[keys.length - 1]
    const box = at as Record<string, unknown>
    if (box[last] === tr.en) box[last] = tr[locale]
  }
  return out
}
