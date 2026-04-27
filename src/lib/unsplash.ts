import 'server-only'

export interface UnsplashPhoto {
  url: string
  attribution: string
  attributionUrl: string
}

const PROXY_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/unsplash-proxy`
  : null

export async function resolveUnsplashPhoto(
  photoId: string
): Promise<UnsplashPhoto | null> {
  if (!PROXY_BASE) return null

  try {
    const res = await fetch(
      `${PROXY_BASE}?action=photo&id=${encodeURIComponent(photoId)}`,
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
