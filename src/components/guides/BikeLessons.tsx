import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { eventPath } from '@/lib/events-url'
import type { GuideLocale } from '@/lib/guides/i18n'

/*
 * "Bike lessons coming up" in the two bike-confidence guides (Keith,
 * 2026-10-19: someone who's nervous should see there are actually lessons
 * coming up). Live from the events calendar through get_bike_lessons
 * (Shift migration 01218), which spots learn-to-ride classes by title. The
 * website has no location, so it lists the soonest anywhere. With none
 * posted it says so, points to the Shift app's "tell me when one is posted",
 * and lists easy-pace group rides open to beginners.
 */

type Instructor = {
  id: string
  name: string
  url: string
  kind: string
  details: Record<string, string>
  price: Record<string, string> | null
  season: Record<string, string> | null
  phone: string | null
}

type Ev = {
  id: string
  title: string
  event_date: string
  event_time: string | null
  location_name: string | null
  organizer_name: string | null
}

const T = {
  heading: ['Bike lessons coming up', 'Próximas clases de bicicleta', 'Próximas aulas de bicicleta', '即将开课的自行车课'],
  intro: [
    'Classes for adults that teach the basics and how to ride on the street. Many are free.',
    'Clases para adultos que enseñan lo básico y cómo andar por la calle. Muchas son gratis.',
    'Aulas para adultos que ensinam o básico e como pedalar na rua. Muitas são gratuitas.',
    '面向成人的课程，教授基础知识和如何在街上骑车。很多是免费的。',
  ],
  none: [
    'No group classes are posted right now. City classes mostly run spring through fall.',
    'Ahora mismo no hay clases en grupo publicadas. Las clases municipales se dan sobre todo de primavera a otoño.',
    'No momento não há aulas em grupo publicadas. As aulas municipais acontecem principalmente da primavera ao outono.',
    '目前没有已发布的小班课。市政课程大多在春季到秋季开设。',
  ],
  app: [
    'In the Shift app, tap "Tell me when one is posted" under bike lessons and you\'ll hear when one near you is.',
    'En la app Shift, toca "Avísame cuando publiquen una" en las clases de bicicleta y te avisaremos cuando haya una cerca de ti.',
    'No app Shift, toque em "Me avise quando publicarem uma" nas aulas de bicicleta e você saberá quando houver uma perto de você.',
    '在 Shift 应用的自行车课部分点击"有课程发布时通知我"，你附近有课程时就会收到通知。',
  ],
  easy: ['Easy-pace group rides', 'Paseos en grupo a ritmo tranquilo', 'Passeios em grupo em ritmo tranquilo', '慢速骑行团'],
  easyIntro: [
    'A gentler next step: group rides open to beginners, coming up soon.',
    'Un siguiente paso más suave: paseos en grupo abiertos a principiantes, muy pronto.',
    'Um próximo passo mais leve: passeios em grupo abertos a iniciantes, em breve.',
    '更轻松的下一步：欢迎新手参加的骑行团活动，即将举行。',
  ],
  all: ['See all events', 'Ver todos los eventos', 'Ver todos os eventos', '查看全部活动'],
  anyTime: ['Lessons you can book any time', 'Clases que puedes reservar cuando quieras', 'Aulas que você pode agendar quando quiser', '随时可预约的课程'],
  seasonal: ['Classes that run in season', 'Clases por temporada', 'Aulas que acontecem na temporada', '季节性课程'],
  adaptive: ['Adaptive cycling', 'Ciclismo adaptado', 'Ciclismo adaptado', '无障碍骑行'],
}
const IDX: Record<GuideLocale, number> = { en: 0, es: 1, 'pt-BR': 2, 'zh-Hans': 3 }
const LANG: Record<GuideLocale, string> = { en: 'en-US', es: 'es-US', 'pt-BR': 'pt-BR', 'zh-Hans': 'zh-CN' }

function when(e: Ev, L: GuideLocale): string {
  const [y, m, d] = e.event_date.split('-').map(Number)
  const [hh, mm] = (e.event_time ?? '').split(':').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d, Number.isFinite(hh) ? hh : 12, Number.isFinite(mm) ? mm : 0))
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }
  if (e.event_time) {
    opts.hour = 'numeric'
    if (mm) opts.minute = '2-digit'
  }
  return date.toLocaleString(LANG[L], opts)
}

async function load(): Promise<{ lessons: Ev[]; rides: Ev[]; instructors: Instructor[]; slugs: Map<string, string | null> } | null> {
  try {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase.rpc('get_bike_lessons')
    if (error || !data) return null
    const lessons = (data.lessons ?? []) as Ev[]
    const rides = (data.easy_rides ?? []) as Ev[]
    const instructors = (data.instructors ?? []) as Instructor[]
    const ids = [...lessons, ...rides].map((e) => e.id)
    const slugs = new Map<string, string | null>()
    if (ids.length) {
      const { data: rows } = await supabase.from('content_items').select('id, slug').in('id', ids)
      for (const r of (rows ?? []) as { id: string; slug: string | null }[]) slugs.set(r.id, r.slug)
    }
    return { lessons, rides, instructors, slugs }
  } catch {
    return null
  }
}

export default async function BikeLessons({ locale: L = 'en' }: { locale?: GuideLocale }) {
  const d = await load()
  if (!d) return null
  const t = (k: keyof typeof T) => T[k][IDX[L]]
  const row = (e: Ev) => (
    <li key={e.id}>
      <Link
        href={eventPath({ id: e.id, slug: d.slugs.get(e.id) ?? null })}
        className="block rounded-[10px] border border-navy/10 bg-white px-4 py-3 hover:border-forest/40"
      >
        <span className="block text-[1rem] font-semibold leading-snug text-navy">{e.title}</span>
        <span className="block text-[0.9375rem] leading-snug text-navy/80">
          {[when(e, L), e.location_name].filter(Boolean).join(' · ')}
        </span>
        {e.organizer_name && <span className="block text-[0.875rem] text-navy/75">{e.organizer_name}</span>}
      </Link>
    </li>
  )
  return (
    <div className="my-8 rounded-[14px] border border-forest/30 bg-forest/5 p-5 sm:p-6">
      <h2 className="mb-2 font-serif text-[1.25rem] leading-tight text-navy">{t('heading')}</h2>
      {d.lessons.length > 0 ? (
        <>
          <p className="mb-4 text-[1rem] leading-relaxed text-navy">{t('intro')}</p>
          <ul className="space-y-2">{d.lessons.slice(0, 4).map(row)}</ul>
        </>
      ) : (
        <>
          <p className="mb-2 text-[1rem] leading-relaxed text-navy">{t('none')}</p>
          <p className="mb-4 text-[1rem] leading-relaxed text-navy">{t('app')}</p>
          {d.rides.length > 0 && (
            <>
              <h3 className="mb-1 text-[1rem] font-semibold text-navy">{t('easy')}</h3>
              <p className="mb-3 text-[0.9375rem] leading-relaxed text-navy">{t('easyIntro')}</p>
              <ul className="space-y-2">{d.rides.map(row)}</ul>
            </>
          )}
        </>
      )}
      {(['seasonal', 'anyTime', 'adaptive'] as const).map((group) => {
        const list = d.instructors.filter((x) =>
          group === 'seasonal' ? x.kind === 'seasonal' : group === 'adaptive' ? x.kind === 'adaptive' : x.kind === 'school' || x.kind === 'referral',
        )
        if (!list.length) return null
        const lang = L === 'en' ? 'en' : L
        return (
          <div key={group}>
            <h3 className="mt-6 mb-3 text-[1rem] font-semibold text-navy">{t(group)}</h3>
            <ul className="space-y-2">
              {list.map((x) => {
                const price = x.price?.[lang] ?? x.price?.en
                const season = x.season?.[lang] ?? x.season?.en
                const meta = [price, season].filter(Boolean).join(' · ')
                return (
                  <li key={x.id}>
                    <a
                      href={x.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-[10px] border border-navy/10 bg-white px-4 py-3 hover:border-forest/40"
                    >
                      <span className="block text-[1rem] font-semibold leading-snug text-navy">{x.name}</span>
                      <span className="block text-[0.9375rem] leading-snug text-navy/80">{x.details[lang] ?? x.details.en}</span>
                      {meta && <span className="mt-1 block text-[0.9375rem] font-semibold leading-snug text-navy">{meta}</span>}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      <Link href="/events" className="mt-4 inline-block text-[0.9375rem] font-semibold text-forest underline underline-offset-4 hover:opacity-80">
        {t('all')}
      </Link>
    </div>
  )
}
