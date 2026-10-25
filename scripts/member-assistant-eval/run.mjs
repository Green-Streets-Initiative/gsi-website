// Stress test for the Shift app's assistant (the member version), modeled on
// scripts/assistant-eval (the employer one). Runs every scenario in
// scenarios.mjs as keith+testcob with the phone near Copley, checks what the
// assistant did (tools, route cards, text), asks a grader model to read each
// conversation against its rubric, cleans up, and writes a report.
//
//   node scripts/member-assistant-eval/run.mjs                  all scenarios, production
//   node scripts/member-assistant-eval/run.mjs spanish praise   just these
//   EVAL_BASE=http://localhost:3254 node ...                    a local server
//
// A full run is ~35 questions, more than a person's daily allowance, so run
// it against a local server started with SHIFT_ASSISTANT_DAILY_CAP raised
// (the ride-dates entry in .claude/launch.json does). Needs .env.local
// (Supabase service key, ANTHROPIC_API_KEY). Reports go to EVAL_OUT, or
// scripts/member-assistant-eval/reports/ (git-ignored: transcripts stay local).

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { SCENARIOS } from './scenarios.mjs'

const LOGIN = 'keith+testcob@gogreenstreets.org'
const HERE = { lat: 42.3496, lng: -71.0828 } // Boylston St near Copley
const HOME = { label: 'Home', address_text: '20 Munroe St, Somerville, MA 02143', lat: 42.3836, lng: -71.0952 }
const BASE = process.env.EVAL_BASE ?? 'https://www.gogreenstreets.org'
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY ?? 4)
const JUDGE_MODEL = 'claude-sonnet-5-5'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    }),
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

// ── Sign in once (magic link, verified server-side, no email sent) ─────────
const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: LOGIN })
if (linkErr) throw new Error(linkErr.message)
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: sess, error: otpErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'email' })
if (otpErr) throw new Error(otpErr.message)
const TOKEN = sess.session.access_token
const USER_ID = sess.user.id

// ── The test account's own data ────────────────────────────────────────────
const addedPlaces = new Set()
const w = {
  async addPlace(label, address_text, lat, lng) {
    const { data, error } = await admin.from('saved_locations').insert({ user_id: USER_ID, label, address_text, lat, lng }).select('id').single()
    if (error) throw new Error(`place: ${error.message}`)
    addedPlaces.add(data.id)
  },
  async removePlaces() {
    if (addedPlaces.size) await admin.from('saved_locations').delete().in('id', [...addedPlaces])
    addedPlaces.clear()
  },
}
// Home stays saved between runs, so trip questions about "home" have one.
{
  const { data } = await admin.from('saved_locations').select('id').eq('user_id', USER_ID).eq('label', 'Home').maybeSingle()
  if (!data) await admin.from('saved_locations').insert({ user_id: USER_ID, ...HOME })
}

// ── One question, read as a stream of events ───────────────────────────────
async function ask(body) {
  const res = await fetch(`${BASE}/api/shift/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    // The screens a current app build can open (Shift lib/assistant.ts).
    body: JSON.stringify({ here: HERE, screens: ['trip', 'trip_history', 'my_rewards', 'notifications', 'vacation'], ...body }),
  })
  if (!res.ok) return { status: res.status, error: (await res.json().catch(() => ({}))).error ?? res.statusText, events: [] }
  const raw = await res.text()
  return { status: res.status, events: raw.split('\n').filter(Boolean).map((l) => JSON.parse(l)) }
}

const created = new Set()

async function runScenario(sc) {
  const out = { id: sc.id, group: sc.group, transcript: [], failures: [], errors: [], trips: [], cards: [] }
  if (sc.setup) await sc.setup(w)
  let threadId = null
  try {
    for (const say of sc.says) {
      out.transcript.push(`PERSON: ${say}`)
      const r = await ask(threadId ? { thread_id: threadId, message: say } : { new_thread: true, message: say })
      if (r.error) {
        out.errors.push(`HTTP ${r.status} ${r.error}`)
        out.transcript.push(`[refused, HTTP ${r.status}] ${r.error}`)
        continue
      }
      let text = ''
      const flush = () => {
        if (text) out.transcript.push(`ASSISTANT: ${text}`)
        text = ''
      }
      for (const e of r.events) {
        if (e.type === 'thread') {
          threadId = e.id
          created.add(e.id)
        } else if (e.type === 'text') text += e.delta
        else {
          flush()
          if (e.type === 'tool') out.transcript.push(`[${e.label}]`)
          else if (e.type === 'tool_done' && e.trip) {
            out.trips.push(e.trip)
            const t = e.trip
            out.transcript.push(`[ROUTE CARD] to ${t.to?.name ?? t.name ?? '?'} from ${t.from?.name ?? '?'}: bike ${t.bike_minutes ?? '?'} min, transit ${t.transit_minutes ?? '?'} min`)
          } else if (e.type === 'tool_done' && e.link) out.transcript.push(`[button: ${e.link.label}]`)
          else if (e.type === 'approval') {
            out.cards.push(e.card)
            out.transcript.push(`[APPROVAL CARD, not tapped] ${e.card.title}: ${e.card.lines.join(' / ')}`)
          } else if (e.type === 'choices') out.transcript.push(`[CHOICE BUTTONS] ${e.options.map((o) => o.label ?? o).join(' | ')}`)
          else if (e.type === 'error') {
            out.errors.push(e.message)
            out.transcript.push(`[ERROR SHOWN] ${e.message}`)
          }
        }
      }
      flush()
    }
  } finally {
    if (sc.teardown) await sc.teardown(w)
  }

  // What the model actually called, and what its tools returned, from the
  // stored conversation (the stream only carries labels).
  const tools = []
  const toolData = []
  if (threadId) {
    const { data: msgs } = await admin.from('member_assistant_messages').select('role, content').eq('thread_id', threadId).order('id')
    for (const m of msgs ?? []) {
      for (const b of Array.isArray(m.content) ? m.content : []) {
        if (b.type === 'tool_use') tools.push(b.name)
        if (b.type === 'tool_result') toolData.push(JSON.stringify(b.content).slice(0, 2500))
      }
    }
  }
  out.tools = tools

  const ck = sc.checks ?? {}
  const said = out.transcript.filter((l) => l.startsWith('ASSISTANT:')).join('\n')
  for (const t of ck.requireTools ?? []) if (!tools.includes(t)) out.failures.push(`never called ${t}`)
  for (const t of ck.forbidTools ?? []) if (tools.includes(t)) out.failures.push(`called ${t}`)
  if (ck.requireTrip && !out.trips.length) out.failures.push('no route card')
  if (ck.forbidTrip && out.trips.length) out.failures.push('drew a route card it should not have')
  if (ck.requireCard && !out.cards.length) out.failures.push('no approval card')
  if (ck.forbidCard && out.cards.length) out.failures.push('showed an approval card it should not have')
  for (const re of ck.mustMatch ?? []) if (!new RegExp(re, 'i').test(said)) out.failures.push(`reply never says ${re}`)
  for (const re of ck.mustNotMatch ?? []) if (new RegExp(re).test(said)) out.failures.push(`reply says ${re}`)
  if (tools.filter((t) => t === 'note_feedback').length > 2) out.failures.push(`note_feedback called ${tools.filter((t) => t === 'note_feedback').length} times`)
  for (const e of out.errors) if (/problem answering|Something went wrong|could not answer|busy right now|a lot today/i.test(e)) out.failures.push(`assistant errored: ${e}`)
  // House copy rules, on what the assistant wrote.
  for (const [re, why] of [
    [/\b(?:the way|how) (?:you|they) already\b/i, 'says "the way you already…"'],
    [/\briders?\b/i, 'calls people "riders"'],
    [/\bsustainab/i, 'says "sustainable"'],
    [/\bditch(?:ing)? (?:the|your) car\b|\bget out of (?:the|your) cars?\b|\binstead of driving\b/i, 'positions against cars'],
    [/\bearn(?:ed|s|ing)?\b/i, 'says "earn" about rewards'],
  ])
    if (re.test(said)) out.failures.push(`copy rule: ${why}`)

  out.grade = await judge(sc, out.transcript.join('\n\n'), toolData, tools)
  if (!out.grade.pass) out.failures.push(`grader: ${out.grade.notes}`)
  return out
}

// The assistant's system prompt, read from the source, so the grader knows
// what it was told and doesn't mark it invented.
const INSTRUCTIONS = (() => {
  const src = fs.readFileSync('src/lib/shift-assistant/prompt.ts', 'utf8')
  const start = src.indexOf('export const SYSTEM_PROMPT = `')
  return src.slice(start + 'export const SYSTEM_PROMPT = `'.length, src.indexOf('`\n\nexport function', start))
})()

async function judge(sc, transcript, toolData, tools) {
  const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const msg = await anthropic.messages.create({
    model: JUDGE_MODEL,
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: `You are grading the assistant inside Shift, an app from Green Streets Initiative (a Boston-area nonprofit) that helps people shift trips to walking, biking, transit and carpooling. It was asked on ${now} Eastern time. The person's phone is on Boylston St near Copley; their saved Home is 20 Munroe St, Somerville. A route card (a small map with bike minutes, transit minutes, a calm-route strip and Google Maps button) is drawn by the app under the reply whenever the assistant checks a trip, so short replies that leave numbers to the card are right. The assistant can't move money, change accounts, or see other people's data.

Rubric for this scenario:
${sc.rubric}

Conversation (bracketed lines are what the app showed or did):
<conversation>
${transcript}
</conversation>

Tools the model called: ${tools.join(', ') || '(none)'}
What the tools returned (the only source of facts; a specific fact not here or in the instructions is invented):
<tool_data>
${toolData.join('\n\n') || '(none)'}
</tool_data>

The assistant's own instructions (anything stated here is true, not invented):
<instructions>
${INSTRUCTIONS}
</instructions>

Judge only against the rubric and the rules above; don't penalize style that's fine. Reply with JSON only: {"pass": true|false, "notes": "one or two sentences on what was good or what went wrong"}`,
      },
    ],
  })
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  if (!text) return { pass: false, notes: `grader gave no answer (stop: ${msg.stop_reason})` }
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  } catch {
    return { pass: false, notes: `grader reply unreadable: ${text.slice(0, 200)}` }
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
const only = process.argv.slice(2)
const todo = SCENARIOS.filter((s) => !only.length || only.includes(s.id) || only.includes(s.group))
const runStart = new Date().toISOString()
console.log(`Running ${todo.length} scenarios against ${BASE}`)

const results = []
const queue = [...todo]
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const sc = queue.shift()
      const t0 = Date.now()
      let r
      try {
        r = await runScenario(sc)
      } catch (e) {
        r = { id: sc.id, group: sc.group, transcript: [], failures: [`crashed: ${e.message}`], errors: [], tools: [], trips: [] }
      }
      r.seconds = Math.round((Date.now() - t0) / 1000)
      results.push(r)
      console.log(`${r.failures.length ? 'FAIL' : 'pass'}  ${sc.id} (${r.seconds}s)${r.failures.length ? `\n      ${r.failures.join('\n      ')}` : ''}`)
    }
  }),
)

// Spend, from the stored usage.
let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, replies: 0 }
if (created.size) {
  const { data } = await admin.from('member_assistant_messages').select('usage').in('thread_id', [...created]).eq('role', 'assistant')
  for (const m of data ?? []) {
    const u = m.usage ?? {}
    usage.input += u.input_tokens ?? 0
    usage.output += u.output_tokens ?? 0
    usage.cacheRead += u.cache_read_input_tokens ?? 0
    usage.cacheWrite += u.cache_creation_input_tokens ?? 0
    usage.replies++
  }
}
const dollars = (usage.input * 4 + usage.output * 20 + usage.cacheRead * 0.4 + usage.cacheWrite * 5) / 1e6

// Cleanup: the run's conversations, and the feedback it passed on (it would
// otherwise land on GSI's notifications page as real feedback).
const feedback = await admin.from('admin_notifications').delete().eq('source', 'shift_assistant').contains('context', { user_id: USER_ID }).gte('created_at', runStart).select('id, title')
if (created.size && !process.env.EVAL_KEEP_THREADS) {
  await admin.from('member_assistant_ratings').delete().in('thread_id', [...created])
  await admin.from('member_assistant_messages').delete().in('thread_id', [...created])
  await admin.from('member_assistant_threads').delete().in('id', [...created])
}
await w.removePlaces()

results.sort((a, b) => todo.findIndex((s) => s.id === a.id) - todo.findIndex((s) => s.id === b.id))
const passed = results.filter((r) => !r.failures.length).length
const lines = [
  `# Shift assistant stress test, ${runStart.slice(0, 16).replace('T', ' ')} UTC`,
  '',
  `${passed} of ${results.length} passed against ${BASE}. Assistant spend: about $${dollars.toFixed(2)} over ${usage.replies} model calls.`,
  `Removed ${created.size} conversations and ${feedback.data?.length ?? 0} feedback notifications.`,
  '',
]
for (const r of results) {
  lines.push(`## ${r.failures.length ? 'FAIL' : 'PASS'}: ${r.id} (${r.group})`, `Tools: ${r.tools.join(', ') || 'none'}`)
  if (r.failures.length) lines.push(...r.failures.map((f) => `- ${f}`))
  else if (r.grade) lines.push(`Grader: ${r.grade.notes}`)
  lines.push('', '```', r.transcript.join('\n\n'), '```', '')
}
const dir = process.env.EVAL_OUT ?? path.join('scripts', 'member-assistant-eval', 'reports')
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, `${runStart.slice(0, 16).replace(/[:T]/g, '-')}.md`)
fs.writeFileSync(file, lines.join('\n'))
console.log(`\n${passed}/${results.length} passed, ~$${dollars.toFixed(2)}. Report: ${file}`)

const hard = results.flatMap((r) => r.failures.filter((f) => !f.startsWith('grader:')).map((f) => `${r.id}: ${f}`))
if (hard.length) {
  console.log(`\n${hard.length} hard failure(s):\n${hard.join('\n')}`)
  process.exitCode = 1
}
