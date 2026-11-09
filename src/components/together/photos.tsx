import Image from 'next/image'
import PhotoCredit from '@/components/PhotoCredit'
import { cx } from '@/components/organizers/ui'

/**
 * The real, credited photos on the Shift Together pages (enrich pass, Keith
 * 2026-11-09: "Fix the pictures"). All from Wikimedia Commons, checked by
 * looking; files in public/images/together, resized for the web.
 *
 * - concord: "Bicyclists boarding MBTA train in Concord" (2023-10-14),
 *   https://commons.wikimedia.org/wiki/File:Bicyclists_boarding_MBTA_train_in_Concord.jpg
 *   4300streetcar, CC BY 4.0. Also the share card (together-share.jpg, 1200x630 crop).
 * - gilman: "MBTA Gilman Square station Community Path entrance July 2025",
 *   https://commons.wikimedia.org/wiki/File:MBTA_Gilman_Square_station_Community_Path_entrance_July_2025.jpg
 *   4300streetcar, CC BY 4.0.
 * - river: "Charles River Bike Path near John Weeks Bridge 2" (2024-08-17),
 *   https://commons.wikimedia.org/wiki/File:Charles_River_Bike_Path_near_John_Weeks_Bridge_2.jpg
 *   4300streetcar, CC BY 4.0.
 * - parkRide: "Park and Ride lot, Framingham MA, 2025-11-19" (cropped to the parked cars),
 *   https://commons.wikimedia.org/wiki/File:Park_and_Ride_lot,_Framingham_MA,_2025-11-19.jpg
 *   Peter Cooper Jr., CC0.
 */
export type TogetherPhoto = { src: string; width: number; height: number; credit: string; url: string }

export const PHOTOS = {
  concord: {
    src: '/images/together/concord-bikes-on-the-train.jpg', width: 1400, height: 933,
    credit: '4300streetcar / Wikimedia Commons, CC BY 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:Bicyclists_boarding_MBTA_train_in_Concord.jpg',
  },
  gilman: {
    src: '/images/together/gilman-square-from-the-path.jpg', width: 1000, height: 667,
    credit: '4300streetcar / Wikimedia Commons, CC BY 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:MBTA_Gilman_Square_station_Community_Path_entrance_July_2025.jpg',
  },
  river: {
    src: '/images/together/charles-river-path.jpg', width: 1200, height: 800,
    credit: '4300streetcar / Wikimedia Commons, CC BY 4.0',
    url: 'https://commons.wikimedia.org/wiki/File:Charles_River_Bike_Path_near_John_Weeks_Bridge_2.jpg',
  },
  parkRide: {
    src: '/images/together/framingham-park-and-ride.jpg', width: 800, height: 487,
    credit: 'Peter Cooper Jr. / Wikimedia Commons, CC0',
    url: 'https://commons.wikimedia.org/wiki/File:Park_and_Ride_lot,_Framingham_MA,_2025-11-19.jpg',
  },
} satisfies Record<string, TogetherPhoto>

/** The share card for /together: the Concord photo cropped to 1200x630. */
export const SHARE_IMAGE = '/images/together/together-share.jpg'

/**
 * A photo in a fixed-height band (object-cover), with the place and credit
 * on a line below it: text never sits on the photo.
 */
export function PhotoBand({
  photo, alt, place, creditLabel, className, imgClassName, priority = false, sizes = '(min-width: 920px) 920px, 100vw',
}: {
  photo: TogetherPhoto
  alt: string
  /** Where it is, before the credit ("Concord station"). */
  place?: string
  /** "Photo: {who}" in the page's language, already filled. */
  creditLabel: string
  /** The band's height classes. */
  className: string
  imgClassName?: string
  priority?: boolean
  sizes?: string
}) {
  return (
    <figure className="m-0 grid grid-cols-1 gap-1.5">
      <div className={cx('relative w-full overflow-hidden rounded-2xl bg-(--ev-panel)', className)}>
        <Image src={photo.src} alt={alt} fill priority={priority} sizes={sizes} className={cx('object-cover', imgClassName)} />
      </div>
      <figcaption className="text-[13px] leading-snug text-(--ev-ink-75)">
        {place ? <span className="font-semibold text-(--ev-ink-80)">{place} · </span> : null}
        <PhotoCredit text={creditLabel} url={photo.url} />
      </figcaption>
    </figure>
  )
}
