// "Write it for me" on the challenge builder's "What's it about?" box (Keith
// 2026-10-31: "be sure that the assistant can help draft one"). One short
// model call from the challenge as it stands in the builder; nothing is
// saved, the words land in the box for the admin to edit.
import Anthropic from '@anthropic-ai/sdk'

export type DescribeInput = {
  name?: string
  starts_on?: string
  ends_on?: string
  trips?: string
  rewards?: string[]
  /** What they've written so far: tighten it, keep its meaning. */
  current?: string
}

const MODEL = 'claude-sonnet-5-5'
export const DESCRIPTION_MAX = 280

const RULES = `You write the one- or two-sentence description that employees read on a workplace challenge's page in the Shift app, right under the challenge's name and dates. Shift is a free app from Green Streets Initiative, a nonprofit in Somerville, MA, that helps people walk, bike, take transit and carpool more.

What it does: says why the company is running the challenge and what to aim for, so someone glancing at it knows whether and how to take part.

Rules:
- One or two sentences, under ${DESCRIPTION_MAX} characters. Plain, warm, direct; written to the employee ("you").
- Use only the facts given (name, dates, which trips count, rewards). Never invent a reason, number, prize or detail. Don't repeat the dates: they show right above.
- If there is a reward, name the goal plainly (e.g. "Make 8 trips on foot, by bike, transit or carpool to enter the drawing for a $25 gift card"). Name each reward exactly as given.
- Don't spell out the trip rules (distances, daily limits): "How trips count" sits right below. A short phrase like "on foot, by bike, transit or carpool" is enough, and mention a rule only when it changes what people do (e.g. only trips to or from the office).
- Never position anything against cars or driving, and don't guilt anyone; talk about the good of walking, biking, transit and carpooling. Say "active transportation", never "sustainable". Never call people "riders". Never write "the way you already move", "the trips you already take" or any variant.
- No emoji, no hashtags, no exclamation marks, no quotation marks around the text.
- Reply with the description text only.`

function facts(c: DescribeInput, employer: string): string {
  const lines = [
    `Workplace: ${employer}`,
    c.name?.trim() && `Challenge name: ${c.name.trim()}`,
    c.starts_on && c.ends_on && `Dates: ${c.starts_on} to ${c.ends_on}`,
    c.trips?.trim() && `Which trips count: ${c.trips.trim()}`,
    // On the Basics step the rewards aren't chosen yet, so say nothing about them.
    c.rewards?.length ? `Rewards: ${c.rewards.map((r) => r.trim()).filter(Boolean).join('; ')}` : 'Rewards: not chosen yet. Say nothing about rewards, prizes or a leaderboard.',
  ].filter(Boolean)
  return lines.join('\n')
}

/** Text only, trimmed to the box's limit; null when the model gave nothing usable. */
export async function draftDescription(c: DescribeInput, employer: string): Promise<string | null> {
  const current = String(c.current ?? '').trim().slice(0, 1000)
  const ask = current
    ? `Tighten this description the admin wrote. Keep their meaning and any facts they included; fix it to the rules.\n\n<their_text>\n${current}\n</their_text>`
    : 'Write the description.'
  const msg = await new Anthropic().messages.create({
    model: MODEL,
    // Room to think first: at 300 it sometimes spent it all thinking and wrote nothing.
    max_tokens: 2000,
    system: RULES,
    messages: [{ role: 'user', content: `${facts(c, employer)}\n\n${ask}` }],
  })
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
    .replace(/^["“]|["”]$/g, '')
    .trim()
  if (!text) return null
  if (text.length <= DESCRIPTION_MAX) return text
  // Over the limit: keep whole sentences that fit.
  const sentences = text.match(/[^.?!]+[.?!]+/g) ?? [text]
  let out = ''
  for (const s of sentences) {
    if ((out + s).trim().length > DESCRIPTION_MAX) break
    out += s
  }
  return out.trim() || text.slice(0, DESCRIPTION_MAX).trim()
}
