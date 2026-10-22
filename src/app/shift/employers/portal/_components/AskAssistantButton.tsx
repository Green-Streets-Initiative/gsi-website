'use client'

// The page's own way into the assistant, in the same place on every page: the
// header's actions, a secondary button with the assistant's icon and a verb
// that fits the page (Keith 2026-10-22: it should be easy just to ask for
// something anywhere on the platform). Nothing renders where the assistant
// is off for this workplace.

import { MessageSquareText } from 'lucide-react'
import Button from '@/components/employer/Button'
import { usePortal } from '../_lib/portal-context'
import { assistantAvailable, openAssistant } from './AssistantPanel'

export default function AskAssistantButton({ label, prompt }: { label: string; prompt: string }) {
  const { group, isGsiAdmin } = usePortal()
  if (!group || !assistantAvailable(group, isGsiAdmin)) return null
  return (
    <Button variant="secondary" icon={MessageSquareText} onClick={() => openAssistant(prompt)}>
      {label}
    </Button>
  )
}
