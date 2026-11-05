'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiError, joinNewsletter, lastDay, post, readPerson, withPreview, writePerson,
  type ChallengeView, type EntryView, type Person,
} from '../_lib/api'
import EmailGate, { INPUT, LABEL, PRIMARY } from '../_components/EmailGate'
import ShareButton from '../_components/ShareButton'
import { track } from '../_lib/track'

/**
 * Entering: confirm an email (first time only), then one short form, then the
 * ad's own page to share. Asks only what judging and a prize need; the rest is
 * read from the video link.
 */
export default function EnterFlow({ c, preview }: { c: ChallengeView; preview: string }) {
  const [person, setPerson] = useState<Person | null>(null)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState<{ entry: EntryView; share_url: string } | null>(null)

  useEffect(() => {
    setPerson(readPerson())
    setReady(true)
  }, [])

  const back = withPreview(`/challenges/${c.slug}`, preview)

  if (c.phase !== 'open') {
    return (
      <Panel title={c.phase === 'soon' ? 'Entries aren’t open yet' : 'Entries have closed'}>
        <p className="text-[16px] text-navy">
          {c.phase === 'soon' ? 'Come back when entries open.' : 'Thanks to everyone who entered. See the entries and what happens next.'}
        </p>
        <Link href={back} className={`${PRIMARY} mt-5`}>Back to {c.title}</Link>
      </Panel>
    )
  }

  if (done) {
    return (
      <Panel title="Your ad is in.">
        <p className="text-[16px] leading-relaxed text-navy">
          <span className="font-bold">{done.entry.title}</span> is entered.
          {done.entry.status === 'pending' ? ' It shows in the gallery once our quick check finishes, usually within minutes.' : ' It’s in the gallery now.'}
        </p>
        <p className="mt-3 text-[16px] leading-relaxed text-navy">
          Send it around now. If it makes the final {c.finalist_count}, the people who&rsquo;ve seen it are the ones who&rsquo;ll vote.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ShareButton url={done.share_url} title={done.entry.title} />
          <Link href={withPreview(`/challenges/${c.slug}/e/${done.entry.id}`, preview)} className="inline-flex min-h-[48px] items-center px-2 font-bold text-forest underline-offset-4 hover:underline">
            See its page
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-6 border-t-2 border-navy/[0.1] pt-5">
          <button type="button" onClick={() => setDone(null)} className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">
            Enter another ad
          </button>
          <Link href={back} className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">
            Back to {c.title}
          </Link>
        </div>
      </Panel>
    )
  }

  if (!ready) return <Panel title={`Enter ${c.title}`}><div className="h-40" /></Panel>

  if (!person) {
    return (
      <Panel title={`Enter ${c.title}`}>
        <EmailGate
          slug={c.slug}
          preview={preview}
          intro="First, your email. We'll send a code to confirm it, and tell you if your ad makes the final."
          onVerified={setPerson}
        />
      </Panel>
    )
  }

  return (
    <Panel title={`Enter ${c.title}`}>
      <EntryForm c={c} preview={preview} person={person} onDone={setDone}
        onSignOut={() => { writePerson(null); setPerson(null) }} />
    </Panel>
  )
}

function EntryForm({ c, preview, person, onDone, onSignOut }: {
  c: ChallengeView
  preview: string
  person: Person
  onDone: (d: { entry: EntryView; share_url: string }) => void
  onSignOut: () => void
}) {
  const [link, setLink] = useState('')
  const [title, setTitle] = useState('')
  const [says, setSays] = useState('')
  const [category, setCategory] = useState('')
  const [lastName, setLastName] = useState(person.last_name ?? '')
  const [town, setTown] = useState(person.town ?? '')
  const [credit, setCredit] = useState('')
  const [eligible, setEligible] = useState(false)
  const [rights, setRights] = useState(false)
  const [rules, setRules] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const defaultCredit = `${person.first_name}${lastName.trim() ? ` ${lastName.trim()[0].toUpperCase()}.` : ''}`

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await post<{ entry: EntryView; share_url: string }>({
        action: 'enter', slug: c.slug, preview, link: link.trim(), title, says, category,
        last_name: lastName, town, credit_name: credit.trim() || defaultCredit,
        confirm: { adult: eligible, resident: eligible, rights, people: rights, rules },
      }, person.token)
      writePerson({ ...person, last_name: lastName.trim(), town: town.trim() })
      if (newsletter) joinNewsletter(person.email, person.first_name)
      track('creative_entry_submitted', { slug: c.slug, category, platform: r.entry.platform, newsletter })
      onDone(r)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) { onSignOut(); return }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again in a minute.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="text-[15px] text-ink-soft">
        Entering as <span className="font-bold text-navy">{person.first_name}</span> ({person.email}).{' '}
        <button type="button" onClick={onSignOut} className="font-bold text-forest underline-offset-4 hover:underline">Not you?</button>
      </p>

      <label className="block">
        <span className={LABEL}>Link to your video</span>
        <input required value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoComplete="off"
          placeholder="youtube.com/…, vimeo.com/… or tiktok.com/…" className={INPUT} />
        <span className="mt-1.5 block text-[14px] text-ink-soft">
          Public or unlisted. {c.min_seconds ?? 30} to {c.max_seconds ?? 60} seconds.
        </span>
      </label>

      <label className="block">
        <span className={LABEL}>Title</span>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={INPUT} />
      </label>

      <label className="block">
        <span className={LABEL}>In one line, what does your ad say?</span>
        <input required value={says} onChange={(e) => setSays(e.target.value)} maxLength={140}
          placeholder="The bus gets you there before you'd find parking." className={INPUT} />
      </label>

      <fieldset>
        <legend className={LABEL}>It&rsquo;s mostly about</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {c.categories.map((k) => (
            <label key={k.key} className={`inline-flex min-h-[46px] cursor-pointer items-center rounded-full border-2 px-5 text-[16px] font-bold ${category === k.key ? 'border-forest bg-forest text-white' : 'border-navy/[0.16] bg-white text-navy hover:border-navy/40'}`}>
              <input type="radio" name="category" value={k.key} checked={category === k.key} onChange={() => setCategory(k.key)} required className="sr-only" />
              {k.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>Last name</span>
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={40} autoComplete="family-name" className={INPUT} />
          <span className="mt-1.5 block text-[14px] text-ink-soft">For a prize. Only the initial shows.</span>
        </label>
        <label className="block">
          <span className={LABEL}>Your city or town</span>
          <input required value={town} onChange={(e) => setTown(e.target.value)} maxLength={60} autoComplete="address-level2" placeholder="Somerville" className={INPUT} />
        </label>
      </div>

      <label className="block">
        <span className={LABEL}>Credit it as</span>
        <input value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={80} placeholder={defaultCredit} className={INPUT} />
        <span className="mt-1.5 block text-[14px] text-ink-soft">Made it with others? Name the team.</span>
      </label>

      <div className="space-y-3 rounded-[16px] bg-white p-4">
        <Check checked={eligible} onChange={setEligible}>I&rsquo;m 18 or older and live in Massachusetts.</Check>
        <Check checked={rights} onChange={setRights}>I made this, I have the rights to its music and images, and everyone in it agreed to be in it.</Check>
        <Check checked={rules} onChange={setRules}>
          I agree to the{' '}
          <Link href={withPreview(`/challenges/${c.slug}/rules`, preview)} target="_blank" className="font-bold text-forest underline underline-offset-4">official rules</Link>,
          including that Green Streets may share and run my ad, with credit.
        </Check>
        <Check checked={newsletter} onChange={setNewsletter}>Send me the Green Streets newsletter, once a month. (Optional)</Check>
      </div>

      {error && <p role="alert" className="text-[15px] font-semibold text-ep-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy || !eligible || !rights || !rules} className={PRIMARY}>
          {busy ? 'Checking your video…' : 'Enter my ad'}
        </button>
        <span className="text-[15px] text-ink-soft">Entries close {lastDay(c.entries_close_at)}.</span>
      </div>
    </form>
  )
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-relaxed text-navy">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-forest" />
      <span>{children}</span>
    </label>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[640px] px-6 pb-20 pt-4">
      <h1 className="font-headline text-[clamp(2rem,4.6vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.01em] text-navy">{title}</h1>
      <div className="mt-6">{children}</div>
    </div>
  )
}
