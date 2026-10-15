'use client'

import { useEffect, useState } from 'react'
import { Card, CardBody, CardHead } from '@/components/employer/Card'
import Toggle from '@/components/employer/Toggle'
import { useConfirm } from '@/components/employer/ConfirmDialog'
import { useToast } from '@/components/employer/Toast'
import { supabase } from '@/lib/supabase'

/**
 * The public page's on/off switch, bound to groups.commute_advisor_enabled
 * (get_advisor_group_by_slug serves enabled groups only, so "off" means the
 * link shows the page is off).
 *
 * Write path, as of 2026-10-05: the portal updates `groups` directly, and
 * the row guard (Shift 01082) lets a portal admin or manager change only
 * name, admin_name, admin_phone, website_url, logo_url, employer_benefits,
 * onboarding. commute_advisor_enabled is not on that list and no RPC sets
 * it, so the switch works for GSI staff (the guard does not limit them) and
 * sits disabled with a note for everyone else until the main session adds
 * the column to the guard's list or an RPC for it. Flip `canWrite` below to
 * `canEdit` once that lands.
 */
export default function AdvisorVisibilityCard({
  groupId,
  canEdit,
  isGsiAdmin,
}: {
  groupId: string
  /** Admins and managers (the page's canEditAdvisor gate). */
  canEdit: boolean
  isGsiAdmin: boolean
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  // The column may be missing from a read on a database that predates it; a
  // page with nothing to show is better than one that fails to load.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('groups')
      .select('commute_advisor_enabled')
      .eq('id', groupId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return
        setEnabled(!!(data as { commute_advisor_enabled?: boolean } | null)?.commute_advisor_enabled)
      })
    return () => {
      cancelled = true
    }
  }, [groupId])

  // Shift 01202 (was held 01131): the row guard lets portal admins flip the switch.
  const canWrite = canEdit

  async function change(next: boolean) {
    if (!canWrite || saving || enabled === null) return
    if (!next) {
      const ok = await confirm({
        title: 'Turn the public page off?',
        body: 'Employees who open the link will see that the page is off. Your settings stay as they are, and you can turn it back on any time.',
        confirmLabel: 'Turn off',
        tone: 'danger',
      })
      if (!ok) return
    }
    setSaving(true)
    const before = enabled
    setEnabled(next)
    const { error } = await supabase.from('groups').update({ commute_advisor_enabled: next }).eq('id', groupId)
    setSaving(false)
    if (error) {
      setEnabled(before)
      toast(
        /42501|permission denied|row-level security|can't change/i.test(`${error.code} ${error.message}`)
          ? "This switch can't be changed from the portal yet. Green Streets can turn the page on or off for you."
          : "That didn't save. Check your connection and try again.",
        { type: 'error' },
      )
      return
    }
    toast(next ? 'Your public page is on.' : 'Your public page is off.', { type: 'success' })
  }

  const label = enabled === null ? 'Public advisor page' : enabled ? 'Public advisor page is on' : 'Public advisor page is off'

  return (
    <Card>
      <CardHead title="Public page" sub="Whether the link works for employees" />
      <CardBody>
        <div className={canWrite && enabled !== null ? '' : 'opacity-60'}>
          <Toggle
            on={!!enabled}
            onChange={change}
            title={label}
            desc={
              enabled === null
                ? 'Checking...'
                : enabled
                  ? 'Anyone with the link sees your page.'
                  : 'The link shows that the page is off.'
            }
          />
        </div>
        {!canWrite && (
          <p className="mt-3 text-[12.5px] leading-[1.5] text-ink-tertiary">
            {canEdit
              ? "Switching this from the portal isn't wired up yet. Green Streets can turn the page on or off for you."
              : 'An admin or manager on your team can ask Green Streets to turn the page on or off.'}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
