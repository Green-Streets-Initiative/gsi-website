import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import NotesStaticMap from '@/components/notes/NotesStaticMap'
import { NoteDetailBody } from '@/components/notes/NoteDetail'
import { fetchNoteDetail, noteKindLabel, notesPlural, notesT, noteWhere, shortDate, streetPath, type NoteGroup } from '@/lib/route-notes'
import { SITE_URL } from '@/lib/seo'

/**
 * gogreenstreets.org/notes/<id>: one route note, all its dates, and "Still
 * true?" (Shift 01763; sketch screen 5). OpenStreetMap notes link here for
 * the photo and later updates, so this page works whether or not the
 * route_notes switch is on. A note that has faded, or that two people
 * hid, gets the friendly not-found page beside this one.
 *
 * Kept out of search (one note is a thin page); the street page
 * (/streets/<town>/<street>) is the one meant to be found.
 */

type PageProps = { params: Promise<{ id: string }> }

export const revalidate = 300

const t = notesT('en')

function headline(g: NoteGroup): string {
  const kind = noteKindLabel(t, g.kind)
  return g.street ? `${kind} on ${g.street}` : kind
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const g = await fetchNoteDetail(id)
  if (!g) return { title: t('notes.gone'), robots: { index: false } }
  const title = g.town ? `${headline(g)}, ${g.town}` : headline(g)
  const words = g.words.find((w) => w.text)?.text
  const description = words
    ? `“${words}” ${notesPlural(t, 'notes.said_yes', Math.max(1, g.people), { date: shortDate(g.latest_at) })}`
    : notesPlural(t, 'notes.said_yes', Math.max(1, g.people), { date: shortDate(g.latest_at) })
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/notes/${g.id}` },
    robots: { index: false, follow: true },
    openGraph: { title, description, url: `${SITE_URL}/notes/${g.id}`, siteName: 'Green Streets Initiative', type: 'website' },
  }
}

export default async function NotePage({ params }: PageProps) {
  const { id } = await params
  const g = await fetchNoteDetail(id)
  if (!g) notFound()
  const mode = g.mode ?? 'bike'
  const street = g.street && g.town && mode === 'bike' ? { href: streetPath(g.town, g.street), name: g.street } : null

  return (
    <>
      <Nav variant="light" />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-16 pt-6 lg:px-8 lg:pt-10">
          <div className="mx-auto max-w-[680px]">
            <p className="text-[0.9375rem] text-ink-soft">
              {mode === 'walk' ? t('notes.box_title_walk') : t('notes.box_title')}
              {g.town ? <span> · {g.town}</span> : null}
            </p>
            <h1 className="mt-1.5 font-serif text-[clamp(2rem,4.6vw,3rem)] font-normal leading-[1.06] tracking-[-0.01em] text-navy">
              {headline(g)}
            </h1>
            <p className="mt-2 text-[1rem] text-navy">{noteWhere(t, { ...g, mode })}</p>

            <NotesStaticMap className="mt-5" groups={[g]} title={`${headline(g)}: where it is on the map`} />

            <div className="mt-5 rounded-[16px] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)]">
              <NoteDetailBody group={{ ...g, mode }} surface="web_note_page" refresh={false} />
            </div>

            {street && (
              <p className="mt-5 text-[0.9375rem]">
                <Link href={street.href} className="font-semibold text-forest underline-offset-4 hover:underline">
                  All notes on {street.name}
                </Link>
              </p>
            )}
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
