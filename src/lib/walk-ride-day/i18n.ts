/*
 * Strings for the Walk/Ride Day program page (/programs/walk-ride-days) in
 * Spanish and Brazilian Portuguese, drafts awaiting a native speaker's read
 * (content/translations/REVIEW.md). English is the source, copied from the
 * live page; every language carries every key (the type enforces it).
 *
 * Translation choices a reviewer should check:
 *  - "Walk/Ride Day" stays as the program's name, with an article (el / o),
 *    as the Shift app already writes it in both languages.
 *  - Prizes are won in a drawing (sorteo / sorteio), never "earned".
 *  - "Ride the T" became "the bus or the train": Lawrence and Lynn readers
 *    ride MeVa and commuter rail, not the subway.
 *  - Links to pages that exist only in English say so.
 */

import type { DraftLocale } from '@/lib/translated-pages'

const en = {
  meta_title: 'Walk/Ride Day — one Friday a month, Massachusetts moves together | Green Streets Initiative',
  meta_desc:
    'Walk, bike, or ride the T on Walk/Ride Day and the Shift app enters you in that month’s gift card drawing. Free, nothing to sign up for, since 2006.',
  eyebrow: 'Walk/Ride Day · since 2006',
  title_a: 'One Friday a month, Massachusetts ',
  title_b: 'moves together.',
  lede: 'Walk, bike, or ride the T on Walk/Ride Day. If you have the Shift app, every trip you take that day enters you in the month’s gift card drawing. Nothing to sign up for, and it’s free.',
  today_is: 'Today is Walk/Ride Day.',
  next_is: 'The next one is {date}.',
  moved: 'Moved off the last Friday for the holiday.',

  l_last_friday: 'Last Friday',
  l_of_every_month: 'of every month',
  l_today: 'today — Walk/Ride Day',
  l_next: 'next Walk/Ride Day',
  l_cards_each: 'gift cards in the drawing',
  l_cards_total: 'in gift cards, in the drawing',
  l_gift_cards: 'Gift cards',
  l_drawn: 'drawn the next morning',
  l_first: 'the first Walk/Ride Day',
  l_free: 'Free',
  l_nothing: 'nothing to sign up for',
  ledger_note: 'Open to anyone 18 or older in Massachusetts with the Shift app. Up to three trips a day count toward the drawing.',
  rules_link: 'Official rules',

  how_title: 'How it works',
  how_lede: 'Three steps, and Shift handles the last one.',
  s1_title: 'Get Shift',
  s1_body: 'Free on iOS and Android. Make an account once, and Shift counts your trips on its own.',
  s2_title: 'Make a trip on the day',
  s2_body: 'Walk to the store, bike to work, take the bus to class. One trip is enough; more trips are more chances.',
  s3_title: 'You’re in the drawing',
  s3_body: 'Each trip that day enters you automatically. Winners are drawn the next morning and claim their gift card in the app.',
  how_note:
    'Walks, bike rides, buses, trains, and ferries all count, and carpools do too. The app detects them; there is nothing to log. Standings for the day live in the app’s Community tab.',

  dates_title: 'The next few',
  dates_lede: 'Usually the last Friday of the month. When that lands on a holiday weekend, it moves a week earlier.',
  row_today: 'today',
  row_next: 'next',
  row_later: 'prizes announced closer to the day',
  link_challenges: 'Everything running now',
  link_events: 'Events that Friday',

  bring_title: 'Bring your people',
  bring_lede: 'Walk/Ride Day started as a workplace thing in 2006. It still works best in groups.',
  b1_title: 'Your workplace',
  b1_body: 'Shift for employers turns Walk/Ride Day into a team standings board, with your own prizes if you want them.',
  b1_link: 'Shift for employers',
  b2_title: 'Your school',
  b2_body: 'Classrooms and campuses count every walk to school. Shift for Schools runs it with parent volunteers.',
  b2_link: 'Shift for Schools',
  b3_title: 'Your town',
  b3_body: 'Every town has a page: what moved, who’s leading, and the events on the calendar that Friday.',
  b3_link: 'Find your town',

  see_you: 'See you {date}.',
  see_you_last: 'See you on the last Friday.',
  join_body: 'Get the app before then and your first Walk/Ride Day trip counts. If you already have it, you’re set.',
  get_app: 'Get the Shift app',
  contact_q: 'Questions, or want Walk/Ride Day at your workplace? Write to',
}

export type WalkRideDayKey = keyof typeof en
type Dict = Record<WalkRideDayKey, string>

const es: Dict = {
  meta_title: 'Walk/Ride Day: un viernes al mes, Massachusetts se mueve unido | Green Streets Initiative',
  meta_desc:
    'Camina, ve en bici o toma el autobús o el tren en el Walk/Ride Day, y la app Shift te da una participación en el sorteo de tarjetas de regalo del mes. Gratis y sin inscribirte, desde 2006.',
  eyebrow: 'Walk/Ride Day · desde 2006',
  title_a: 'Un viernes al mes, Massachusetts ',
  title_b: 'se mueve unido.',
  lede: 'Camina, ve en bici o toma el autobús o el tren en el Walk/Ride Day. Si tienes la app Shift, cada viaje que hagas ese día te da una participación en el sorteo de tarjetas de regalo del mes. No tienes que inscribirte y es gratis.',
  today_is: 'Hoy es el Walk/Ride Day.',
  next_is: 'El próximo es el {date}.',
  moved: 'Este mes cambió de fecha por el feriado.',

  l_last_friday: 'Último viernes',
  l_of_every_month: 'de cada mes',
  l_today: 'hoy es el Walk/Ride Day',
  l_next: 'próximo Walk/Ride Day',
  l_cards_each: 'tarjetas de regalo en el sorteo',
  l_cards_total: 'en tarjetas de regalo, en el sorteo',
  l_gift_cards: 'Tarjetas de regalo',
  l_drawn: 'se sortean a la mañana siguiente',
  l_first: 'el primer Walk/Ride Day',
  l_free: 'Gratis',
  l_nothing: 'no tienes que inscribirte',
  ledger_note:
    'Para cualquier persona de 18 años o más que viva en Massachusetts y tenga la app Shift. Hasta tres viajes al día cuentan para el sorteo.',
  rules_link: 'Reglas oficiales',

  how_title: 'Cómo funciona',
  how_lede: 'Tres pasos, y del último se encarga Shift.',
  s1_title: 'Descarga Shift',
  s1_body: 'Gratis para iPhone y Android. Crea tu cuenta una sola vez y Shift reconoce tus viajes automáticamente.',
  s2_title: 'Haz un viaje ese día',
  s2_body: 'Camina a la tienda, ve en bici al trabajo, toma el autobús para ir a clase. Con un viaje basta; más viajes, más oportunidades.',
  s3_title: 'Ya estás en el sorteo',
  s3_body:
    'Cada viaje de ese día te da una participación, sin hacer nada más. Los ganadores se sortean a la mañana siguiente y reclaman su tarjeta de regalo en la app.',
  how_note:
    'Cuentan las caminatas, los paseos en bici, los autobuses, los trenes y los ferris, y también el auto compartido. La app los detecta; no tienes que anotar nada. La clasificación del día está en la pestaña Comunidad de la app.',

  dates_title: 'Las próximas fechas',
  dates_lede: 'Casi siempre es el último viernes del mes. Si cae en un fin de semana festivo, se adelanta una semana.',
  row_today: 'hoy',
  row_next: 'el próximo',
  row_later: 'los premios se anuncian más cerca de la fecha',
  link_challenges: 'Todo lo que hay ahora (en inglés)',
  link_events: 'Eventos de ese viernes (en inglés)',

  bring_title: 'Trae a tu gente',
  bring_lede: 'El Walk/Ride Day empezó en los lugares de trabajo en 2006. Sigue funcionando mejor en grupo.',
  b1_title: 'Tu trabajo',
  b1_body: 'Shift para empleadores convierte el Walk/Ride Day en una competencia por equipos, con premios propios si los quieren.',
  b1_link: 'Shift para empleadores (en inglés)',
  b2_title: 'Tu escuela',
  b2_body: 'Los salones y los campus cuentan cada caminata a la escuela. Shift para Escuelas lo organiza con madres y padres voluntarios.',
  b2_link: 'Shift para Escuelas (en inglés)',
  b3_title: 'Tu ciudad',
  b3_body: 'Cada ciudad tiene su página: cuánto se movió, quién va adelante y los eventos del calendario de ese viernes.',
  b3_link: 'Busca tu ciudad (en inglés)',

  see_you: 'Nos vemos el {date}.',
  see_you_last: 'Nos vemos el último viernes.',
  join_body: 'Descarga la app antes de esa fecha y tu primer viaje del Walk/Ride Day va a contar. Si ya la tienes, no tienes que hacer nada más.',
  get_app: 'Descarga la app Shift',
  contact_q: '¿Tienes preguntas, o quieres el Walk/Ride Day en tu trabajo? Escríbenos a',
}

const ptBR: Dict = {
  meta_title: 'Walk/Ride Day: uma sexta-feira por mês, Massachusetts se movimenta junto | Green Streets Initiative',
  meta_desc:
    'Caminhe, pedale ou pegue o ônibus ou o trem no Walk/Ride Day, e o app Shift coloca você no sorteio de cartões-presente do mês. Grátis e sem inscrição, desde 2006.',
  eyebrow: 'Walk/Ride Day · desde 2006',
  title_a: 'Uma sexta-feira por mês, Massachusetts ',
  title_b: 'se movimenta junto.',
  lede: 'Caminhe, pedale ou pegue o ônibus ou o trem no Walk/Ride Day. Se você tem o app Shift, cada viagem que fizer nesse dia vale uma participação no sorteio de cartões-presente do mês. Não precisa se inscrever, e é grátis.',
  today_is: 'Hoje é o Walk/Ride Day.',
  next_is: 'O próximo é na {date}.',
  moved: 'Neste mês, a data mudou por causa do feriado.',

  l_last_friday: 'Última sexta',
  l_of_every_month: 'de cada mês',
  l_today: 'hoje é o Walk/Ride Day',
  l_next: 'próximo Walk/Ride Day',
  l_cards_each: 'cartões-presente no sorteio',
  l_cards_total: 'em cartões-presente, no sorteio',
  l_gift_cards: 'Cartões-presente',
  l_drawn: 'sorteados na manhã seguinte',
  l_first: 'o primeiro Walk/Ride Day',
  l_free: 'Grátis',
  l_nothing: 'não precisa se inscrever',
  ledger_note:
    'Para qualquer pessoa com 18 anos ou mais que mora em Massachusetts e tem o app Shift. Até três viagens por dia contam para o sorteio.',
  rules_link: 'Regulamento oficial',

  how_title: 'Como funciona',
  how_lede: 'Três passos, e o último fica por conta do Shift.',
  s1_title: 'Baixe o Shift',
  s1_body: 'Grátis para iPhone e Android. Crie sua conta uma vez só, e o Shift reconhece suas viagens automaticamente.',
  s2_title: 'Faça uma viagem no dia',
  s2_body: 'Vá a pé ao mercado, de bicicleta ao trabalho, de ônibus para a aula. Uma viagem já basta; mais viagens, mais chances.',
  s3_title: 'Você está no sorteio',
  s3_body:
    'Cada viagem nesse dia vale uma participação, sem você fazer mais nada. Os ganhadores são sorteados na manhã seguinte e resgatam o cartão-presente no app.',
  how_note:
    'Valem caminhadas, pedaladas, ônibus, trens e barcas, e carona também. O app detecta as viagens; você não precisa anotar nada. A classificação do dia fica na aba Comunidade do app.',

  dates_title: 'As próximas datas',
  dates_lede: 'Quase sempre é na última sexta-feira do mês. Quando cai num fim de semana com feriado, passa para uma semana antes.',
  row_today: 'hoje',
  row_next: 'o próximo',
  row_later: 'os prêmios são anunciados mais perto da data',
  link_challenges: 'Tudo o que está rolando agora (em inglês)',
  link_events: 'Eventos nessa sexta-feira (em inglês)',

  bring_title: 'Traga sua turma',
  bring_lede: 'O Walk/Ride Day começou nos locais de trabalho, em 2006. Ainda funciona melhor em grupo.',
  b1_title: 'Seu trabalho',
  b1_body: 'O Shift para empresas transforma o Walk/Ride Day numa disputa entre equipes, com prêmios próprios, se vocês quiserem.',
  b1_link: 'Shift para empresas (em inglês)',
  b2_title: 'Sua escola',
  b2_body: 'Turmas e campi contam cada caminhada até a escola. O Shift para Escolas funciona com pais e mães voluntários.',
  b2_link: 'Shift para Escolas (em inglês)',
  b3_title: 'Sua cidade',
  b3_body: 'Cada cidade tem sua página: quanto se movimentou, quem está na frente e os eventos daquela sexta-feira.',
  b3_link: 'Encontre sua cidade (em inglês)',

  see_you: 'Nos vemos na {date}.',
  see_you_last: 'Nos vemos na última sexta-feira.',
  join_body: 'Baixe o app antes dessa data e sua primeira viagem do Walk/Ride Day vai contar. Se você já tem o app, não precisa fazer mais nada.',
  get_app: 'Baixe o app Shift',
  contact_q: 'Tem dúvidas, ou quer o Walk/Ride Day no seu trabalho? Escreva para',
}

const DICTS: Record<DraftLocale | 'en', Dict> = { en, es, 'pt-BR': ptBR }

export function wt(locale: DraftLocale | 'en', key: WalkRideDayKey, repl?: Record<string, string>): string {
  let s = DICTS[locale][key] ?? en[key]
  if (repl) for (const [k, v] of Object.entries(repl)) s = s.replaceAll(`{${k}}`, v)
  return s
}
