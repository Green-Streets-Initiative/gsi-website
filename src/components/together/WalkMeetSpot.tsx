'use client'

import { useState } from 'react'
import { MapPin, Navigation } from 'lucide-react'
import PinMap from '@/components/together/PinMap'
import { PlacePick } from '@/app/together/plan/[matchId]/Steps'
import { Spinner } from '@/components/organizers/ui'
import { translator, type SiteLocale } from '@/lib/site-i18n'
import { planStrings } from '@/lib/site-strings/together-plan'
import { togetherMoreStrings } from '@/lib/site-strings/together-more'
import { myPlaces, track } from '@/lib/together'
import { directionsUrl, saveWalkSpot, type WalkSpot } from '@/lib/together-more'

/**
 * Where a walk pair meets (Shift 01612; the app's WalkMeetSpot). Once both
 * said yes, either one picks a public spot near home: the nearest stations
 * in one tap, or any place they search for. The other gets a notice; picking
 * again replaces it. The choices are found from the picker's own Home, which
 * stays in their account.
 */
export default function WalkMeetSpot({ matchId, name, spot, userId, locale, onSaved }: {
  matchId: string
  name: string
  spot: WalkSpot | null
  userId: string | null
  locale: SiteLocale
  onSaved: () => void
}) {
  const t = translator(togetherMoreStrings, locale)
  const [open, setOpen] = useState(false)
  const [home, setHome] = useState<{ lat: number; lng: number } | null | undefined>(undefined)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function openPicker() {
    setOpen(true)
    setFailed(false)
    track('together_walk_spot_opened', { had_spot: !!spot })
    if (home !== undefined || !userId) return
    const places = await myPlaces(userId).catch(() => [])
    const h = places.find((p) => p.label === 'Home' && p.lat != null)
    setHome(h ? { lat: Number(h.lat), lng: Number(h.lng) } : null)
  }

  async function pick(p: { lat: number; lng: number; label: string }) {
    setSaving(true)
    setFailed(false)
    const ok = await saveWalkSpot(matchId, p)
    setSaving(false)
    if (!ok) return setFailed(true)
    track('together_walk_spot_saved', { replaced: !!spot })
    setOpen(false)
    onSaved()
  }

  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl bg-(--ev-panel) p-4">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-(--ev-accent)" aria-hidden />
        <div className="min-w-0">
          <p className="text-[16px] font-bold">{spot ? t('wm.at', { place: spot.label }) : t('wm.q')}</p>
          <p className="text-[15px] text-(--ev-ink-80)">
            {spot ? (spot.mine ? t('wm.by_you', { name }) : t('wm.by_them', { name })) : t('wm.hint', { name })}
          </p>
        </div>
      </div>
      {spot && !open ? (
        <PinMap
          pins={[{ lat: spot.lat, lng: spot.lng, kind: 'spot', label: spot.label }]}
          title={t('wm.at', { place: spot.label })}
          boxClassName="aspect-[16/9] sm:aspect-[5/2]"
          width={560}
          height={260}
          maxZoom={16}
        />
      ) : null}
      {open ? (
        <>
          {home === undefined ? <Spinner /> : <PlacePick anchor={home} value={null} onPick={(p) => void pick(p)} t={translator(planStrings, locale)} />}
          {saving ? <Spinner /> : null}
          {failed ? <p role="alert" className="text-[15px] font-semibold text-(--ev-danger)">{t('pk.failed')}</p> : null}
          <button type="button" onClick={() => setOpen(false)} className="min-h-[44px] justify-self-start text-[15px] font-semibold underline">{t('wm.cancel')}</button>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {spot ? (
            <a
              href={directionsUrl(spot, 'walk')}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track('together_walk_spot_directions')}
              className="inline-flex min-h-[44px] items-center gap-2 text-[15px] font-semibold text-(--ev-accent) underline"
            >
              <Navigation className="h-4 w-4" aria-hidden /> {t('wm.directions')}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void openPicker()}
            className={spot
              ? 'min-h-[44px] text-[15px] font-semibold underline'
              : 'inline-flex min-h-[44px] items-center rounded-[10px] bg-(--ev-accent-fill) px-4 text-[15px] font-semibold text-(--ev-on-accent-fill)'}
          >
            {spot ? t('wm.change') : t('wm.pick')}
          </button>
        </div>
      )}
    </div>
  )
}
