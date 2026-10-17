#!/usr/bin/env node
// Tell Bing (and the other IndexNow engines: Yandex, Seznam, Naver) that pages
// on gogreenstreets.org are new or changed, so they're crawled within hours
// instead of weeks. ChatGPT's web answers lean on Bing's index.
//
//   node scripts/seo/indexnow.mjs                 # every URL in the live sitemap
//   node scripts/seo/indexnow.mjs /guides/x ...   # just these paths
//   node scripts/seo/indexnow.mjs --match guides  # sitemap URLs containing "guides"
//
// The key file is public/<KEY>.txt (it must stay published at that address).
// Run it after shipping or changing pages; the SEO routine does (seo/methodology.md).

const KEY = 'cd0458d2c4c93e8a73b09c51a8e336d8'
const HOST = 'www.gogreenstreets.org'
const SITE = `https://${HOST}`

const args = process.argv.slice(2)
let urls
if (args.length && args[0] !== '--match') {
  urls = args.map((p) => (p.startsWith('http') ? p : `${SITE}${p}`))
} else {
  const xml = await (await fetch(`${SITE}/sitemap.xml`)).text()
  urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  if (args[0] === '--match') urls = urls.filter((u) => u.includes(args[1] ?? ''))
}
urls = [...new Set(urls)].filter((u) => u.startsWith(SITE))
if (!urls.length) {
  console.error('No URLs to submit.')
  process.exit(1)
}

// IndexNow takes up to 10,000 URLs per request.
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
})
// 200 = accepted, 202 = accepted and the key is still being checked.
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urls.length} URLs`)
if (res.status >= 300) {
  console.error(await res.text())
  process.exit(1)
}
