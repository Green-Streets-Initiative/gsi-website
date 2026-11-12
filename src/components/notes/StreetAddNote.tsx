'use client'

import { useState } from 'react'
import { PencilSimpleLine } from '@phosphor-icons/react'
import { notesT, type LatLng } from '@/lib/route-notes'
import NoteSheet from './NoteSheet'
import { defaultTrack } from './NoteDetail'
import { useNotesSwitch } from './useNotesSwitch'

/**
 * "Add a note" on a street page (/streets/<town>/<street>). There is no
 * route here, so the pin starts on the street's newest note and the note
 * holds both ways. Shows only while the route_notes switch is on.
 */
export default function StreetAddNote({ spot }: { spot: LatLng }) {
  const on = useNotesSwitch()
  const [adding, setAdding] = useState(false)
  if (!on) return null
  return (
    <>
      <button
        type="button"
        onClick={() => {
          defaultTrack('note_add_tapped', { surface: 'web_street' })
          setAdding(true)
        }}
        aria-haspopup="dialog"
        className="inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-full bg-forest px-5 text-[0.9375rem] font-semibold text-white transition-colors hover:bg-[#1F4D3A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <PencilSimpleLine size={16} weight="bold" aria-hidden />
        {notesT('en')('notes.add')}
      </button>
      {adding && <NoteSheet onClose={() => setAdding(false)} surface="web_street" spot={spot} onAdded={() => {}} />}
    </>
  )
}
