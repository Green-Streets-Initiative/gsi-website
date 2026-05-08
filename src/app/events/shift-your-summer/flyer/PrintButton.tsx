'use client'

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="whitespace-nowrap rounded-full bg-[#BAF14D] px-5 py-2 text-sm font-bold text-[#191A2E] transition-opacity hover:opacity-85"
    >
      Print or save as PDF
    </button>
  )
}
