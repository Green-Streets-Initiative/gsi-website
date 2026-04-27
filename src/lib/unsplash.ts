import 'server-only'

export interface UnsplashPhoto {
  url: string
  attribution: string
  attributionUrl: string
}

export async function resolveUnsplashPhoto(
  photoId: string
): Promise<UnsplashPhoto | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) return null

  try {
    const res = await fetch(
      `https://api.unsplash.com/photos/${photoId}?client_id=${key}`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) return null
    const data = await res.json()
    const raw = data?.urls?.raw
    const username = data?.user?.username
    const name = data?.user?.name
    if (!raw || !username || !name) return null
    return {
      url: `${raw}&crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080`,
      attribution: `Photo by ${name} on Unsplash`,
      attributionUrl: `https://unsplash.com/@${username}`,
    }
  } catch {
    return null
  }
}
