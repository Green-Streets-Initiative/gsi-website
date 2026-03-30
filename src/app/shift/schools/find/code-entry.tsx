'use client'

export function CodeEntryRedirect() {
  return (
    <form
      action="/shift/schools/redirect"
      method="GET"
      className="mt-4 flex items-center justify-center gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        const form = e.currentTarget
        const code = (form.elements.namedItem('code') as HTMLInputElement)?.value?.trim()
        if (code) {
          window.location.href = `/shift/schools/${code.toUpperCase()}`
        }
      }}
    >
      <input
        name="code"
        type="text"
        placeholder="e.g., RODRI3"
        maxLength={8}
        className="w-36 rounded-lg border-2 border-white/20 bg-white/10 px-4 py-2.5 text-center font-display text-lg font-extrabold tracking-wider text-white uppercase placeholder:text-white/30 focus:border-[#BAF14D] focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-lg bg-[#2966E5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2966E5]/90"
      >
        Go
      </button>
    </form>
  )
}
