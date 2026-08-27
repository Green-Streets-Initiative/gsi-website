const BIKESHARE_LOGOS: Record<string, string> = {
  bluebikes: '/assets/nearby/bluebikes.svg',
  valleybike: '/assets/nearby/valleybike.svg',
}

const BORROW_LOGOS: Record<string, string> = {
  cargob: '/assets/nearby/cargob.png',
}

export function bikeshareLogoUrl(systemId: string): string | null {
  return BIKESHARE_LOGOS[systemId] ?? null
}

export function borrowLogoUrl(org: string): string | null {
  return BORROW_LOGOS[org] ?? null
}
