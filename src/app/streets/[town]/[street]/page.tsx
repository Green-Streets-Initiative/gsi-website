import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ThumbsUp, WarningCircle } from '@phosphor-icons/react/dist/ssr'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import NotesStaticMap from '@/components/notes/NotesStaticMap'
import StreetAddNote from '@/components/notes/StreetAddNote'
import {
  compassKey, fetchStreetNotes, listNoteStreets, noteKindLabel, notesT, readNotesSwitch, shortDate, slugPart, streetPath,
  type NoteGroup,
} from '@/lib/route-notes'
import type { NotesKey } from '@/lib/site-strings/notes'
import { SITE_URL } from '@/lib/seo'

/**
 * gogreenstreets.org/streets/<town>/<street>: every route note on one street,
 * newest first, by the direction it was left in (Shift 01763; the sketch's
 * "On the website, and findable"). One page per street that has notes, so
 * a search for "Comm Ave bike lane" can land here. In the sitemap from
 * list_note_streets while the route_notes switch is on; kept out of search
 * and without "Add a note" while it's off.
 */

type PageProps = { params: Promise<{ town: string; street: string }> }

export const revalidate = 600

const t = notesT('en')

/** The street's own spelling, from its slug (list_note_streets, newest first). */
const findStreet = cache(async (townSlug: string, streetSlug: string) => {
  const all = await listNoteStreets()
  return all.find((s) => slugPart(s.town) === townSlug && slugPart(s.street) === streetSlug) ?? null
})

const loadNotes = cache(async (town: string, street: string) => fetchStreetNotes(town, street))

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { town: townSlug, street: streetSlug } = await params
  const [found, on] = await Promise.all([findStreet(townSlug, streetSlug), readNotesSwitch()])
  if (!found) return { title: 'Street not found', robots: { index: false } }
  const title = `Biking ${found.street} in ${found.town}`
  const description = `Notes from people who bike ${found.street} in ${found.town}, newest first: where the bike lane is blocked or ends, hard turns, and the nice stretches.`
  const url = `${SITE_URL}${streetPath(found.town, found.street)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: on ? undefined : { index: false, follow: true },
    openGraph: { title, description, url, siteName: 'Green Streets Initiative', type: 'website' },
  }
}

/** "Heading east" for a direction, "Both ways" for notes that hold for both. */
function directionOf(g: NoteGroup): string {
  if (g.both_ways || g.heading == null) return t('notes.both_ways')
  const dir = t(`notes.dir_${compassKey(g.heading)}` as NotesKey)
  return `Heading ${dir}`
}

export default async function StreetPage({ params }: PageProps) {
  const { town: townSlug, street: streetSlug } = await params
  const found = await findStreet(townSlug, streetSlug)
  if (!found) notFound()
  const groups = await loadNotes(found.town, found.street)
  if (groups.length === 0) notFound()

  // One section per direction, in the order its newest note came in.
  const sections = new Map<string, NoteGroup[]>()
  for (const g of groups) {
    const k = directionOf(g)
    sections.set(k, [...(sections.get(k) ?? []), g])
  }

  return (
    <>
      <Nav variant="light" />
      <main style={{ paddingTop: '60px' }} className="bg-cream">
        <section className="px-6 pb-16 pt-6 lg:px-8 lg:pt-10">
          <div className="mx-auto max-w-[760px]">
            <p className="text-[0.9375rem] text-ink-soft">{found.town}</p>
            <h1 className="mt-1.5 font-serif text-[clamp(2.25rem,5vw,3.5rem)] font-normal leading-[1.04] tracking-[-0.01em] text-navy">
              Biking {found.street} in {found.town}
            </h1>
            <p className="mt-3 max-w-[56ch] text-[1.0625rem] leading-relaxed text-navy">
              Notes from people who bike it, newest first. Add yours here or in the Shift app.
            </p>

            <NotesStaticMap className="mt-6" groups={groups} title={`Notes on ${found.street}, ${found.town}`} />

            {[...sections.entries()].map(([heading, list]) => (
              <section key={heading} className="mt-8" aria-labelledby={`dir-${slugPart(heading)}`}>
                <h2 id={`dir-${slugPart(heading)}`} className="font-serif text-[clamp(1.5rem,3vw,1.875rem)] font-normal leading-[1.15] text-navy">
                  {heading}
                </h2>
                <ul className="mt-3 list-none space-y-3 p-0">
                  {list.map((g) => {
                    const good = g.kind === 'nice_here'
                    const quote = g.words.find((w) => w.text)?.text
                    const meta = [
                      `${Math.max(1, g.people)} ${Math.max(1, g.people) === 1 ? 'person' : 'people'}`,
                      g.still > 0 ? `${g.still} said still true` : null,
                      `latest ${shortDate(g.latest_at)}`,
                    ].filter(Boolean).join(' · ')
                    return (
                      <li key={g.id}>
                        <Link
                          href={`/notes/${g.id}`}
                          className="flex gap-3 rounded-[14px] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] transition-shadow hover:shadow-[0_2px_8px_rgba(25,26,46,0.10),0_0_0_1px_rgba(45,106,79,0.35)]"
                        >
                          {good ? (
                            <ThumbsUp size={20} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-forest" />
                          ) : (
                            <WarningCircle size={20} weight="fill" aria-hidden className="mt-0.5 shrink-0 text-[#B7791F]" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block text-[1rem] font-semibold leading-snug text-navy">{noteKindLabel(t, g.kind)}</span>
                            {quote && <span className="mt-1 block text-[0.9375rem] leading-snug text-navy">&ldquo;{quote}&rdquo;</span>}
                            <span className="mt-1 block text-[0.875rem] text-ink-soft">{meta}</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}

            <div className="mt-8">
              <StreetAddNote spot={{ lat: groups[0].lat, lng: groups[0].lng }} />
            </div>
          </div>
        </section>
      </main>
      <Footer variant="light" />
    </>
  )
}
