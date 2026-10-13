import type { Metadata } from 'next'
import { resolveSurveyToken } from '@/lib/employer/survey-server'
import SurveyForm from './SurveyForm'

export const metadata: Metadata = {
  title: 'Commute survey',
  description: 'A two-minute commute survey for your workplace, run by Shift.',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
}

export const dynamic = 'force-dynamic'

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="street flex min-h-screen items-center justify-center bg-cream px-6 text-navy" style={{ fontFamily: 'var(--font-gsi)' }}>
      <div className="max-w-[480px] text-center">
        <h1 className="font-headline text-[28px] font-extrabold leading-tight">{title}</h1>
        <p className="mt-3 text-[16px] leading-[1.5] text-ink-soft">{body}</p>
      </div>
    </main>
  )
}

/**
 * The survey a person opens from their personal link (or the open link /
 * QR). No sign-in: the link is the identity. Served fresh on every request
 * so a closed survey closes at once.
 */
export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const resolved = await resolveSurveyToken(token)
  if (resolved.kind === 'none') {
    return <Notice title="That link doesn't work" body="Check the link in your email, or ask the person who sent it for a new one." />
  }
  const { survey } = resolved
  if (!survey.enabled || survey.status === 'draft') {
    return <Notice title="This survey isn't open yet" body={`${survey.company} hasn't opened its commute survey. Try again once you get the email.`} />
  }
  if (survey.status === 'closed') {
    return <Notice title="This survey has closed" body={`${survey.company}'s commute survey is closed. Thank you if you answered.`} />
  }
  if (resolved.kind === 'recipient' && resolved.recipient.answered) {
    return <Notice title="You've already answered" body={`Thanks. ${survey.company} sees totals and who has answered.`} />
  }
  return (
    <SurveyForm
      token={token}
      survey={survey}
      recipient={resolved.kind === 'recipient' ? { name: resolved.recipient.name, department: resolved.recipient.department, location_id: resolved.recipient.location_id } : null}
    />
  )
}
