import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { fetchChallenge, fullDay, withPreview } from '../_lib/api'

/**
 * Official rules for a creative challenge, written from the challenge's own
 * row (dates, prizes, length, categories), so a new challenge needs no new
 * rules page. Borrowed from the Walk/Ride Day rules (eligibility, publicity,
 * results list, privacy, liability), changed where a judged contest differs
 * from a drawing: judging, the People's Choice vote and the license to share
 * the work.
 */
export const dynamic = 'force-dynamic'

type Params = Promise<{ slug: string }>
type Search = Promise<{ preview?: string | string[] }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params
  return { title: `Official rules | ${slug.replace(/-/g, ' ')} | Green Streets Initiative`, robots: { index: false, follow: true } }
}

const ET = 'America/New_York'
const at = (iso: string) => `${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ET })} Eastern Time on ${fullDay(iso)}`

export default async function Page({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { slug } = await params
  const raw = (await searchParams).preview
  const preview = typeof raw === 'string' ? raw.slice(0, 64) : ''
  const data = await fetchChallenge(slug, preview).catch(() => null)
  if (!data) notFound()
  const c = data.challenge
  const entriesEnd = new Date(new Date(c.entries_close_at).getTime() - 60_000).toISOString()
  const votingEnd = new Date(new Date(c.voting_close_at).getTime() - 60_000).toISOString()
  const cats = c.categories.map((k) => k.label.toLowerCase())
  const catList = cats.length > 1 ? `${cats.slice(0, -1).join(', ')} or ${cats[cats.length - 1]}` : cats[0]

  return (
    <div className="street">
      <Nav variant="light" street />
      <main className="bg-cream pt-[60px]">
        <article className="mx-auto max-w-[720px] px-6 pb-20 pt-8 lg:pt-10">
          <Link href={withPreview(`/challenges/${c.slug}`, preview)} className="inline-flex min-h-[44px] items-center text-[15px] font-bold text-forest underline-offset-4 hover:underline">
            &larr; {c.title}
          </Link>
          <h1 className="mt-4 font-headline text-[clamp(2.25rem,5vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.01em] text-navy">
            Official rules
          </h1>
          <p className="mt-3 text-[16px] text-ink-soft">{c.title}, a creative challenge from Green Streets Initiative</p>

          <S n={1} title="The contest and who runs it">
            <P>{c.title} is a contest judged on skill, run by Green Streets Initiative, Inc., a 501(c)(3) nonprofit in Somerville, Massachusetts (&ldquo;GSI&rdquo;). It is not a drawing, and chance plays no part in who wins. No purchase or payment is needed to enter, vote or win.</P>
            <P>{c.title} is not sponsored, endorsed or run by the NFL, any league or team, or YouTube, Vimeo or TikTok.</P>
          </S>

          <S n={2} title="Who can enter">
            <P>Anyone 18 or older who lives in Massachusetts. GSI&rsquo;s employees and directors, the judges, and their immediate families can&rsquo;t win. Teams can enter together; one person enters for the team, must be eligible, and receives any prize for it.</P>
            <P>A winner confirms their age and that they live in Massachusetts before a prize is sent. A winner who can&rsquo;t forfeits the prize, and it goes to the next entry by the judging in section 6.</P>
          </S>

          <S n={3} title="Dates">
            <Ul items={[
              `Entries open at ${at(c.opens_at)} and close at ${at(entriesEnd)}.`,
              `Judges score entries until ${fullDay(c.judging_close_at)}, then name up to ${c.finalist_count} finalists.`,
              `People's Choice voting runs from ${fullDay(c.judging_close_at)} until ${at(votingEnd)}.`,
              `Winners are announced on or about ${fullDay(c.results_at)}.`,
            ]} />
          </S>

          <S n={4} title="How to enter">
            <Ul items={[
              `Make an ad of ${c.min_seconds ?? 30} to ${c.max_seconds ?? 60} seconds that promotes ${catList} in Massachusetts.`,
              'Post it publicly, or as unlisted, on YouTube, Vimeo or TikTok, and keep it up until the winners are announced.',
              `Enter its link on the challenge page with your email, name and town. Up to ${c.max_entries_per_person} entries per person, each a different ad.`,
              'Your ad must be your own (or your team’s) original work. You must have the rights to everything in it, including music, footage and images, and everyone who can be recognized in it must have agreed to be in it.',
              'Keep it positive and safe. Ads that knock drivers or any group of people, show unsafe or illegal walking, biking or driving, or include nudity, hate or graphic violence can’t win.',
              'Ads may use AI tools, as long as the result is your own work and you have the rights to it.',
            ]} />
            <P>Every entry goes through an automatic check before it shows in the public gallery. You can take your entry out while entries are open.</P>
          </S>

          <S n={5} title="Your ad, and what GSI may do with it">
            <P>You keep the copyright in your ad. By entering, you give GSI a free, worldwide, non-exclusive and permanent license to show, share and publish it; to shorten it, caption it, subtitle it or translate it; and to run it as an advertisement, on any platform, to promote walking, biking, transit and GSI&rsquo;s programs. GSI credits you by the name you enter where it practically can.</P>
            <P>Winners are asked for the original video file so GSI can run the ad well. GSI may also share any entry in its gallery and on social media, with credit.</P>
          </S>

          <S n={6} title="Judging and People’s Choice">
            <P>Judges chosen by GSI score each entry from 1 to 5 on four things: how well it gets its point across, how fresh the idea is, how much it makes you want to walk, bike or ride, and how well it&rsquo;s made for what it set out to do. An entry&rsquo;s score is the average of its judges&rsquo; totals. If half or more of the judges who scored it say it breaks a rule in section 4, it can&rsquo;t place.</P>
            <P>The finalists are the best-scoring entry in each category ({catList}), then the next best scores, up to {c.finalist_count}. Ties go to the entry received first.</P>
            <P>People&rsquo;s Choice is decided by public vote among the finalists. Each person votes once, by confirming an email address, and can change their vote until voting closes. GSI may void votes from fake or throwaway addresses or cast by automated means, and may disqualify an entry that benefits from them.</P>
          </S>

          <S n={7} title="Prizes">
            <ul className="mt-3 divide-y-2 divide-navy/[0.08] border-y-2 border-navy/[0.14]">
              {c.prizes.map((p) => (
                <li key={p.key} className="flex items-baseline justify-between gap-4 py-3 text-[16px] text-navy">
                  <span>{p.label}{p.key === 'grand' ? ': the best judges’ score' : p.category ? ': the best judges’ score in that category' : p.key === 'peoples_choice' ? ': the most votes' : ''}</span>
                  <span className="font-bold">{p.amount}</span>
                </li>
              ))}
            </ul>
            <P>Prizes are digital gift cards, sent by email through GSI&rsquo;s gift card partner, Tremendous, where the winner picks from the cards offered. Total value: {c.total_prizes}.</P>
            <P>Prizes are given in the order listed. Each entry can win one prize: when the entry that would win a prize has already won one, the prize goes to the next entry that qualifies. A prize with no qualifying entry (for example, People&rsquo;s Choice when no finalist without a prize received a vote) is not given. Prizes have no cash value and can&rsquo;t be transferred; GSI may substitute a prize of equal or greater value.</P>
          </S>

          <S n={8} title="Winners and results">
            <P>Winners are told by email at the address they entered with, and have 14 days to confirm their eligibility; a winner who doesn&rsquo;t forfeits the prize, and it goes to the next entry by the judging in section 6. GSI posts the finalists and winners on the challenge page, with each ad&rsquo;s title and the name it was entered under, and emails everyone who entered when the results are in.</P>
            <P>Winners may be asked to take part in publicity, such as a post or a short interview. Accepting a prize allows GSI to use the winner&rsquo;s name, town and ad to promote the contest and its programs, except where the law forbids it. Winners are responsible for any taxes on a prize.</P>
          </S>

          <S n={9} title="General conditions">
            <P>By entering or voting, you agree to these rules. GSI&rsquo;s decisions on eligibility, judging and votes are final. GSI may disqualify anyone who breaks these rules or tampers with entering, judging or voting, and may change, pause or cancel the contest if it can&rsquo;t run as planned; if it is cancelled, GSI may award prizes from the entries received by then.</P>
            <P>Nothing here asks anyone to film or travel in a way that is unsafe. You are responsible for your own safety, for obeying traffic laws while making your ad, and for getting any permission a location needs.</P>
          </S>

          <S n={10} title="Privacy">
            <P>GSI uses your email, name and town to run the contest and send prizes, as the <Link href="/privacy" className="font-bold text-forest underline underline-offset-4">GSI Privacy Policy</Link> describes. Only your entry&rsquo;s credit name, title and video are public. GSI doesn&rsquo;t sell personal information and shares a winner&rsquo;s name and email only with the gift card partner, to send the prize. You get GSI&rsquo;s newsletter only if you tick the box for it.</P>
          </S>

          <S n={11} title="Liability and disputes">
            <P>By entering, you release GSI, its directors, officers, employees, volunteers and judges from liability for loss or harm arising from the contest or a prize, and you agree that you, not GSI, are responsible for any claim that your ad uses someone else&rsquo;s work or likeness without permission. GSI isn&rsquo;t responsible for entries or votes lost to technical problems beyond its reasonable control, including a video platform being unavailable.</P>
            <P>These rules are governed by Massachusetts law. Any dispute is resolved in the state or federal courts in Massachusetts.</P>
          </S>

          <S n={12} title="Questions">
            <P>Email <a href="mailto:info@gogreenstreets.org" className="font-bold text-forest underline underline-offset-4">info@gogreenstreets.org</a>. Green Streets Initiative, Inc., Somerville, Massachusetts.</P>
          </S>
        </article>
      </main>
      <Footer variant="light" street />
    </div>
  )
}

function S({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-headline text-[1.375rem] font-extrabold leading-tight text-navy">{n}. {title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[16px] leading-[1.65] text-navy">{children}</p>
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((t, i) => (
        <li key={i} className="flex gap-3 text-[16px] leading-[1.65] text-navy">
          <span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-forest" />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}
