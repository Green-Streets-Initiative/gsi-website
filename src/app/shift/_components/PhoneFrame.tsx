import Image from 'next/image'

export default function PhoneFrame({
  src,
  alt,
  width = 640,
  height = 1387,
  priority = false,
  glow,
  className = '',
}: {
  src: string
  alt: string
  width?: number
  height?: number
  priority?: boolean
  glow?: boolean
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      {glow && (
        <div className="pointer-events-none absolute -inset-[10%] z-[-1] rounded-full bg-[radial-gradient(circle,rgba(186,241,77,0.28),transparent_70%)] blur-2xl" />
      )}
      <div
        className="overflow-hidden rounded-[42px] p-[10px] shadow-[0_40px_80px_-28px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
        style={{ background: 'linear-gradient(160deg, #2A2D4A, #0E0F1A)' }}
      >
        <div className="relative overflow-hidden rounded-[33px] bg-[#0c0d18]">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-[12px] z-10 h-[26px] w-[90px] -translate-x-1/2 rounded-full bg-black" />
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            className="block w-full"
          />
        </div>
      </div>
    </div>
  )
}
