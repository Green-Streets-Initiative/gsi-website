'use client'

import { useEffect } from 'react'
import { X } from '@phosphor-icons/react'

interface Props {
  src: string
  alt?: string
  onClose: () => void
}

export default function PhotoLightbox({ src, alt, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white/90 transition hover:bg-black/70"
      >
        <X size={20} weight="bold" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[95vw] rounded-lg object-contain"
      />
    </div>
  )
}
