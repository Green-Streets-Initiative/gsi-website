/*
 * The key in a signed email link (Shift product item 19: /email/manage and
 * /email/confirm). New links carry it after "#" so it never reaches a server,
 * a Referer or a page-view tracker; older links carry it in the query. Either
 * way, read it once and clear it from the address bar.
 */
export function takeLinkKey(): URLSearchParams {
  const { hash, search, pathname } = window.location
  const fromHash = new URLSearchParams(hash.replace(/^#/, ''))
  const key = fromHash.get('id') ? fromHash : new URLSearchParams(search)
  if (hash || search) window.history.replaceState(null, '', pathname)
  return key
}
