import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Open modals, newest last. Only the top one handles Tab and Escape, so a
// confirm opened from a drawer doesn't also close the drawer.
const stack: object[] = []

export type ModalFocusOptions = {
  /** False while closed, for components that stay mounted. Default true. */
  open?: boolean
  /** Escape calls this. Leave it out when the component handles Escape itself. */
  onClose?: () => void
  /** Where focus lands on open. Falls back to the first focusable element. */
  initialFocus?: () => HTMLElement | null | undefined
}

/**
 * Focus handling for a modal panel (portal review A11Y-6): focus moves in,
 * Tab stays inside, Escape closes, and focus returns to whatever opened it.
 * Ported from EmployeeDrawer / InviteDialog.
 */
export function useModalFocus(
  panelRef: RefObject<HTMLElement | null>,
  { open = true, onClose, initialFocus }: ModalFocusOptions = {},
) {
  const onCloseRef = useRef(onClose)
  const initialFocusRef = useRef(initialFocus)
  useEffect(() => {
    onCloseRef.current = onClose
    initialFocusRef.current = initialFocus
  })

  useEffect(() => {
    if (!open) return
    const token = {}
    stack.push(token)
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const items = () =>
      Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.closest('[hidden]'),
      )
    ;(initialFocusRef.current?.() ?? items()[0] ?? panelRef.current)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (e.key === 'Escape' && onCloseRef.current) {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      const panel = panelRef.current
      if (e.key !== 'Tab' || !panel) return
      const list = items()
      if (list.length === 0) {
        e.preventDefault()
        return
      }
      const first = list[0]
      const last = list[list.length - 1]
      const current = document.activeElement
      if (!panel.contains(current)) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && current === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const i = stack.indexOf(token)
      if (i !== -1) stack.splice(i, 1)
      if (opener?.isConnected) opener.focus()
    }
  }, [open, panelRef])
}
