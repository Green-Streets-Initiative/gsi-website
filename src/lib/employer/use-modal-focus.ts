// Moved to lib/a11y so every modal on the site shares one focus trap
// (the organizer console's Dialog uses it too, 2026-10-23).
export { useModalFocus, type ModalFocusOptions } from '@/lib/a11y/use-modal-focus'
