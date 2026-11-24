// Waits until Vercel has deployed this checkout's HEAD commit (or the commit
// given), so the stress test runs against the change just pushed. Used by the
// Monday fixing routine, which can't run shell loops unattended.
//
//   node scripts/assistant-eval/wait-for-deploy.mjs [sha]
//
// Prints "deployed <sha>" and exits 0, or says why not and exits 1 (deploy
// failed, or nothing after 20 minutes).

import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..')
const sha = process.argv[2] ?? execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const repo = 'Green-Streets-Initiative/gsi-website'

for (let i = 0; i < 80; i++) {
  let state = ''
  try {
    state = execFileSync('gh', ['api', `repos/${repo}/commits/${sha}/statuses`, '--jq', '[.[]|select(.context|test("Vercel"))][0].state'], { encoding: 'utf8' }).trim()
  } catch {
    // a failed request is retried on the next pass
  }
  if (state === 'success') {
    console.log(`deployed ${sha}`)
    process.exit(0)
  }
  if (state === 'failure' || state === 'error') {
    console.log(`Vercel deploy ${state} for ${sha}: nothing new is live`)
    process.exit(1)
  }
  await new Promise((r) => setTimeout(r, 15_000))
}
console.log(`no finished Vercel deploy for ${sha} after 20 minutes`)
process.exit(1)
