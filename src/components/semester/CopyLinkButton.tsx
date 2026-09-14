'use client'

import { useState } from 'react'

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked: the link is in the kit below */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-[44px] items-center rounded-full border border-navy/25 px-5 text-[15px] font-semibold text-navy transition-colors hover:bg-navy/[0.05]"
    >
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}
