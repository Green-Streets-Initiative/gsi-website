import { redirect } from 'next/navigation'

/** Team lives in Settings now (Keith 2026-09-30); old links still land there. */
export default function TeamRedirect() {
  redirect('/shift/employers/portal/settings#team')
}
