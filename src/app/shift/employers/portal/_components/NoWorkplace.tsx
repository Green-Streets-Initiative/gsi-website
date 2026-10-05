'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { Card } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import { usePortal } from '../_lib/portal-context'

/**
 * The signed-in email is on no workplace portal. Before this the person was
 * sent to the marketing page without a word (Keith 2026-09-30).
 */
export default function NoWorkplace() {
  const { sessionEmail, signOut } = usePortal()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <Card pad className="w-full max-w-[520px]">
        <h1 className="font-headline text-[22px] font-extrabold text-ink">
          This email isn&apos;t on a workplace portal yet.
        </h1>
        <p className="mt-2 text-[14px] leading-[1.55] text-ink-muted">
          You&apos;re signed in as{' '}
          <strong className="font-semibold text-ink">{sessionEmail ?? 'this address'}</strong>, and
          no employer has added it to their portal.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[14px] leading-[1.55] text-ink-muted">
          <li>
            If a colleague runs your workplace&apos;s portal, ask them to add this email on their
            Team page. Your access opens the moment they do.
          </li>
          <li>
            If your workplace uses a different email for you, sign out and sign in with that one.
          </li>
          <li>
            If your workplace isn&apos;t on Shift yet,{' '}
            <Link href="/shift/employers" className="font-semibold text-accent hover:underline">
              see how the employer program works
            </Link>{' '}
            or email{' '}
            <a href="mailto:info@gogreenstreets.org" className="font-semibold text-accent hover:underline">
              info@gogreenstreets.org
            </a>
            .
          </li>
        </ul>
        <div className="mt-6">
          <Button variant="primary" icon={LogOut} onClick={handleSignOut} disabled={signingOut}>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
