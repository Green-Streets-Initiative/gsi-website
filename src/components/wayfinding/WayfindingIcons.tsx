interface IconProps {
  size?: number
  className?: string
}

export function MapPinIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M128,16a88.1,88.1,0,0,0-88,88c0,75.3,80,132.17,83.41,134.55a8,8,0,0,0,9.18,0C136,236.17,216,179.3,216,104A88.1,88.1,0,0,0,128,16Zm0,56a32,32,0,1,1-32,32A32,32,0,0,1,128,72Z" />
    </svg>
  )
}

export function ForkKnifeIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M72,88V40a8,8,0,0,1,16,0V88a8,8,0,0,1-16,0Zm48-48a8,8,0,0,0-8,8V88a8,8,0,0,0,16,0V48A8,8,0,0,0,120,40Zm40,0a8,8,0,0,0-8,8V88a8,8,0,0,0,16,0V48A8,8,0,0,0,160,40Zm56,72a8,8,0,0,1-8,8H192v96a8,8,0,0,1-16,0V120H136a8,8,0,0,1-8-8,56.06,56.06,0,0,1,56-56h16A56.06,56.06,0,0,1,216,112ZM96,120a8,8,0,0,1-8,8H56A56.06,56.06,0,0,1,0,72,8,8,0,0,1,8,64H40V40a8,8,0,0,1,16,0V64H88a8,8,0,0,1,8,8,56.06,56.06,0,0,1-56,56H72v96a8,8,0,0,1-16,0V120Z" />
    </svg>
  )
}

export function BusIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M184,28H72A36,36,0,0,0,36,64V208a20,20,0,0,0,20,20H84a20,20,0,0,0,20-20V192h48v16a20,20,0,0,0,20,20h28a20,20,0,0,0,20-20V64A36,36,0,0,0,184,28ZM60,168V112H196v56ZM72,52H184a12,12,0,0,1,12,12V88H60V64A12,12,0,0,1,72,52Zm8,152H60V192H80Zm96,0V192h20v12Zm-68-64a16,16,0,1,1-16-16A16,16,0,0,1,108,140Zm72,0a16,16,0,1,1-16-16A16,16,0,0,1,180,140Z" />
    </svg>
  )
}

export function BicycleIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M208,112a47.81,47.81,0,0,0-16.93,3.09L165.93,72H192a8,8,0,0,1,8,8,8,8,0,0,0,16,0,24,24,0,0,0-24-24H152a8,8,0,0,0-6.91,12l11.65,20H99.26L82.91,60A8,8,0,0,0,76,56H48a8,8,0,0,0,0,16H71.41l13.71,23.51L62.87,127.9A48,48,0,1,0,79,138.63l17.41-23.11,38.68,66.31A8,8,0,0,0,142,184a7.9,7.9,0,0,0,4-1.08,8,8,0,0,0,2.88-10.94l-38.15-65.42h57.55l11.06,19A48.09,48.09,0,1,0,208,112ZM80,160a32,32,0,1,1-7.34-20.42L55.08,161.84A8,8,0,0,0,61,175.16l17.58-22.26A31.84,31.84,0,0,1,80,160Zm128,32a32,32,0,0,1-21.64-55.64l14.91,25.62a8,8,0,0,0,13.82-8l-14.91-25.62A32,32,0,1,1,208,192Z" />
    </svg>
  )
}

export function LockIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Zm-68-56a12,12,0,1,1-12-12A12,12,0,0,1,140,152Z" />
    </svg>
  )
}

export function NavigationIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M234.35,129,53.06,42.08a16,16,0,0,0-22,18.54L53.27,128,31.08,195.38a16,16,0,0,0,22,18.54L234.35,127a.5.5,0,0,0,0-.94ZM53.27,195.38l0-.11L75.47,128,53.27,60.73l0-.11L231,128Z" />
    </svg>
  )
}

export function PersonWalkIcon({ size = 20, className = '' }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 256 256" fill="currentColor">
      <path d="M152,84a36,36,0,1,0-36-36A36,36,0,0,0,152,84Zm0-48a12,12,0,1,1-12,12A12,12,0,0,1,152,36Zm68,112a12,12,0,0,1-12,12c-37,0-55.27-18.47-70-33.3-1.71-1.72-3.36-3.4-5-5l-8.63,19.85L159,166.23a12,12,0,0,1,5,9.77v56a12,12,0,0,1-24,0V182.17l-25.37-18.12L83,236.78a12,12,0,1,1-22-9.57l50.06-115.13q-10.64.75-25,8.4a159.78,159.78,0,0,0-29.83,21.23,12,12,0,0,1-16.43-17.5c2.61-2.45,64.36-59.67,104.09-25.18,3.94,3.42,7.64,7.16,11.22,10.78C168.43,123.28,181,136,208,136A12,12,0,0,1,220,148Z" />
    </svg>
  )
}
