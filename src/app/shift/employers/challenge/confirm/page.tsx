import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { TOKEN_LIFETIME_WORDS, verifyTeamChallengeToken } from '@/lib/employer/team-challenge-token'
import { lookupTeam } from '@/lib/employer/team-challenge-server'
import ConfirmTeam from './ConfirmTeam'
import HeldCard from './HeldCard'
import TeamReady from './TeamReady'

// Where the "confirm your email" link lands. Loading it changes nothing:
// the person clicks "Create our team" first (a mail scanner that opens
// every link must not create a team). A team this sign-up already made is
// shown straight away, and so is a hold (the person already manages a
// portal, or the company is already on Shift), so a refresh never offers
// the Create button again.

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your invite code — Green Streets Initiative',
  robots: { index: false, follow: false },
}

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const t = typeof params.t === 'string' ? params.t : ''
  const v = verifyTeamChallengeToken(t)

  let body: React.ReactNode
  if (!v.ok) {
    body = (
      <div className="rounded-[16px] border-2 border-navy/[0.12] bg-white p-6 sm:p-8">
        <h1 className="font-headline text-[1.75rem] font-extrabold leading-tight text-navy">
          {v.error === 'expired' ? 'This link has expired' : 'This link doesn’t work'}
        </h1>
        <p className="mt-3 text-[1.0625rem] leading-[1.65] text-ink-soft">
          {v.error === 'expired'
            ? `Links work for ${TOKEN_LIFETIME_WORDS}. Sign up again and we’ll send a new one.`
            : 'It may have been cut off when it was copied. Sign up again and we’ll send a new one.'}
        </p>
        <Link href="/shift/employers/challenge#sign-up" className="mt-6 inline-flex min-h-[48px] items-center rounded-full bg-navy px-7 text-[16px] font-bold text-white hover:opacity-90">
          Sign up again &rarr;
        </Link>
      </div>
    )
  } else {
    const found = await lookupTeam(createServerSupabaseClient(), v.signup)
    body =
      found.kind === 'mine' ? (
        <TeamReady team={found.team} signinSent={false} />
      ) : found.kind === 'existing_admin' ? (
        <HeldCard held={{ kind: 'existing_admin', company: found.company.name }} company={v.signup.company} email={v.signup.email} token={t} />
      ) : found.kind === 'company_exists' ? (
        <HeldCard held={{ kind: 'company_exists' }} company={v.signup.company} email={v.signup.email} token={t} />
      ) : (
        <ConfirmTeam token={t} company={v.signup.company} email={v.signup.email} />
      )
  }

  return (
    <div className="street">
      <Nav variant="light" street />
      <main className="min-h-[70vh] bg-cream px-4 pb-16 pt-[92px] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[880px]">{body}</div>
      </main>
      <Footer variant="light" />
    </div>
  )
}
