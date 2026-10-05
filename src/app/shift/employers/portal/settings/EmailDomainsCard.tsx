'use client'

import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardHead, CardBody } from '@/components/employer/Card'
import Button from '@/components/employer/Button'
import { useToast } from '@/components/employer/Toast'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { usePortal } from '../_lib/portal-context'

const LAST_DOMAIN_MESSAGE =
  'This is the only work-email domain. Add another domain first, or change who can join to anyone with the invite code.'

const REASONS: Record<string, string> = {
  invalid_domain: "That doesn't look like an email domain (for example, yourcompany.com).",
  public_domain: "Public email services like Gmail can't prove someone works for you. Use your company's own domain.",
  forbidden: 'Only an admin on your team can change this.',
  last_work_email_domain: LAST_DOMAIN_MESSAGE,
}

/**
 * The email domains that prove someone works here. Employees verify an
 * address at one of them in the app when a prize is limited to staff.
 */
export default function EmailDomainsCard({ groupId, canManage }: { groupId: string; canManage: boolean }) {
  const toast = useToast()
  const confirm = useConfirm()
  // Who can join (the card below this one). With work-email-only joining,
  // the last domain can't go: every new joiner would be locked out (S2).
  const { group } = usePortal()
  const workEmailOnly = group?.id === groupId && group.join_policy === 'work_email'
  const [domains, setDomains] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('employer_email_domains')
      .select('domain')
      .eq('group_id', groupId)
      .order('domain')
      .then(({ data }) => setDomains((data ?? []).map((d: { domain: string }) => d.domain)))
  }, [groupId])

  async function save(next: string[]): Promise<boolean> {
    setSaving(true)
    setError('')
    const { data, error: rpcErr } = await supabase.rpc('set_employer_email_domains', {
      p_group_id: groupId,
      p_domains: next,
    })
    setSaving(false)
    if (rpcErr) {
      // The database refuses an empty list while joining is work-email-only.
      const msg = /last_work_email_domain/i.test(rpcErr.message ?? '') ? LAST_DOMAIN_MESSAGE : "We couldn't save that. Please try again."
      setError(msg)
      toast(msg, { type: 'error' })
      return false
    }
    if (!data?.ok) {
      const msg = REASONS[data?.reason] ?? "We couldn't save that. Please try again."
      setError(msg)
      toast(msg, { type: 'error' })
      return false
    }
    setDomains(data.domains as string[])
    return true
  }

  async function addDomain() {
    const d = draft.trim().toLowerCase().replace(/^@/, '')
    if (!d) return
    if (domains.includes(d)) {
      setError(`@${d} is already on the list.`)
      return
    }
    if (await save([...domains, d])) {
      setDraft('')
      toast(`@${d} added`, { type: 'success' })
    }
  }

  async function removeDomain(d: string) {
    if (workEmailOnly && domains.length === 1) {
      setError(LAST_DOMAIN_MESSAGE)
      toast(LAST_DOMAIN_MESSAGE, { type: 'error' })
      return
    }
    const ok = await confirm({
      title: `Remove @${d}?`,
      body: 'Employees with an address at this domain will no longer count as verified staff for prizes limited to employees.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    if (await save(domains.filter((x) => x !== d))) {
      toast(`@${d} removed`, { type: 'success' })
    }
  }

  return (
    <Card>
      <CardHead title="Company email domains" sub="How employees prove they work here" />
      <CardBody>
        <p className="mb-3 text-[13.5px] leading-[1.55] text-ink-muted">
          Add your company&apos;s email domain so employees can prove they work here when a prize is
          limited to staff. They confirm an address at one of these domains inside the Shift app. We email
          them a code; you never see the address unless they win and choose to share it.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {domains.length === 0 && <span className="text-[13px] text-ink-muted">None yet.</span>}
          {domains.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-semibold text-accent-ink"
            >
              @{d}
              {canManage && (
                <button
                  type="button"
                  className="rounded-full text-accent-ink/70 outline-none hover:text-ep-danger focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`Remove @${d}`}
                  disabled={saving}
                  onClick={() => void removeDomain(d)}
                >
                  <X size={13} strokeWidth={2} />
                </button>
              )}
            </span>
          ))}
        </div>
        {canManage ? (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault()
              void addDomain()
            }}
          >
            <label className="sr-only" htmlFor="email-domain-draft">
              Email domain
            </label>
            <input
              id="email-domain-draft"
              className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-tertiary focus:border-accent"
              placeholder="yourcompany.com"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value)
                setError('')
              }}
            />
            <Button type="submit" variant="secondary" icon={Plus} disabled={saving || !draft.trim()} className="sm:shrink-0">
              Add
            </Button>
          </form>
        ) : (
          <p className="text-[12.5px] text-ink-muted">Ask an admin to change this.</p>
        )}
        {error && <p className="mt-2 text-[12.5px] text-ep-danger">{error}</p>}
      </CardBody>
    </Card>
  )
}
