export default function StoreButtons({
  iosUrl,
  androidUrl,
  className = '',
}: {
  iosUrl: string
  androidUrl: string
  className?: string
}) {
  return (
    <div className={`flex flex-wrap gap-3.5 ${className}`}>
      {/* App Store */}
      <a
        href={iosUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#2E3252] bg-[#0E0F1A] px-5 py-[11px] pl-4 transition-all hover:-translate-y-0.5 hover:border-[#BAF14D]"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="#fff" className="shrink-0">
          <path d="M16.36 1.43c.06 1-.33 1.96-1 2.66-.68.72-1.78 1.27-2.84 1.18-.08-.96.38-1.95 1-2.6.7-.74 1.9-1.28 2.84-1.24zM19.6 17.2c-.5 1.16-.74 1.68-1.39 2.7-.9 1.42-2.18 3.2-3.76 3.2-1.4.02-1.76-.92-3.66-.9-1.9.01-2.3.92-3.7.9-1.58-.01-2.79-1.6-3.7-3.02C.86 16.1.6 11.4 2.18 8.9c1.12-1.77 2.9-2.8 4.57-2.8 1.7 0 2.77.94 4.18.94 1.36 0 2.19-.94 4.16-.94 1.49 0 3.06.81 4.18 2.2-3.67 2-3.07 7.24-.06 8.9z" />
        </svg>
        <span className="flex flex-col font-display leading-[1.1]">
          <small className="text-[11px] font-medium tracking-[0.04em] text-white/75">Download on the</small>
          <b className="text-[15px] font-bold text-white">App Store</b>
        </span>
      </a>

      {/* Google Play */}
      <a
        href={androidUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 rounded-[14px] border-[1.5px] border-[#2E3252] bg-[#0E0F1A] px-5 py-[11px] pl-4 transition-all hover:-translate-y-0.5 hover:border-[#BAF14D]"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" className="shrink-0">
          <path fill="#BAF14D" d="M3.6 2.1 13 11.5l-2.6 2.6L3.6 2.1z" opacity=".9" />
          <path fill="#2966E5" d="M3.6 21.9 13 12.5l-2.6-2.6L3.6 21.9z" opacity=".9" />
          <path fill="#E8E8EE" d="M13 11.5l3.4-1.95 3.4 1.95-3.4 1.95L13 11.5z" />
          <path fill="#52B788" d="M16.4 9.55 13 11.5l-2.6-2.6 3-1.7 3 2.35z" opacity=".7" />
        </svg>
        <span className="flex flex-col font-display leading-[1.1]">
          <small className="text-[11px] font-medium tracking-[0.04em] text-white/75">Get it on</small>
          <b className="text-[15px] font-bold text-white">Google Play</b>
        </span>
      </a>
    </div>
  )
}
