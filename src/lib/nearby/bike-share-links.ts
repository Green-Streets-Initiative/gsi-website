/**
 * Vendor links for the /nearby detail cards — where "open the app" should
 * actually take someone, per system/org. Mirrored in the Shift app
 * (lib/gbfs.ts + lib/nearby/borrow-rent.ts) — keep the two in sync.
 */

export interface VendorLinks {
  /** Official smart link: opens the vendor app when installed, their site
   *  otherwise. Absent = no supported one-tap link. */
  appUrl?: string
  /** Vendor website — the fallback action when there's no appUrl. */
  siteUrl: string
}

export const BIKE_SHARE_SYSTEM_LINKS: Record<string, VendorLinks> = {
  bluebikes: {
    // Official GBFS rental_uris smart link (identical for every station):
    // opens the Bluebikes app when installed, 302s to bluebikes.com when not.
    appUrl: 'https://bos.lft.to/lastmile_qr_scan',
    siteUrl: 'https://bluebikes.com',
  },
  valleybike: {
    // No appUrl yet — the key-gated Drop Mobility feed may carry
    // rental_uris; upgrade if it does.
    siteUrl: 'https://www.valleybike.org',
  },
}

/** CargoB has no universal links (no AASA on ridecargob.com, checked
 *  2026-08-26), so on phones the store page is the closest thing to one-tap:
 *  an installed app shows "Open" there, and it doubles as the download path.
 *  Desktop keeps the website. */
const CARGOB_STORE = {
  ios: 'https://apps.apple.com/us/app/cargob/id6478480272',
  android: 'https://play.google.com/store/apps/details?id=com.cargob.android',
}

export function cargobVendorLink(siteUrl: string): { url: string; target: 'app_store' | 'site' } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/iPad|iPhone|iPod/.test(ua)) return { url: CARGOB_STORE.ios, target: 'app_store' }
  if (/Android/.test(ua)) return { url: CARGOB_STORE.android, target: 'app_store' }
  return { url: siteUrl, target: 'site' }
}
