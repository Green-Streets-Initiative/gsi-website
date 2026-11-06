/**
 * Vendor links for the /nearby detail cards. Bike-share systems' app and site
 * links now come with each station (bike_share_systems in the Shift database,
 * see bike-share-systems.ts); what's left here is for vendors outside GBFS.
 */

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
