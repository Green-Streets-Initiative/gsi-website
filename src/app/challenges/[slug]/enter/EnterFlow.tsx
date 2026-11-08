'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ApiError, categoryLabel, errorText, joinNewsletter, lastDay, post, readPerson, withPreview, writePerson,
  type ChallengeView, type EntryView, type Person,
} from '../_lib/api'
import EmailGate, { INPUT, LABEL, PRIMARY } from '../_components/EmailGate'
import ShareButton from '../_components/ShareButton'
import { track } from '../_lib/track'
import { ACCEPT, MAX_MB, probeVideo, sendFile, typeOf, type Probe } from '../_lib/upload'
import { translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { creativeStrings, rich } from '@/lib/site-strings/challenges'

/**
 * Entering: confirm an email (first time only), then one short form, then the
 * ad's own page to share. Asks only what judging and a prize need; the rest is
 * read from the video itself: an uploaded file (the browser reads its length
 * and stills) or a YouTube, Vimeo or TikTok link (the platform tells us).
 */
export default function EnterFlow({ c, preview, locale = 'en' }: { c: ChallengeView; preview: string; locale?: SiteLocale }) {
  const t = translator(creativeStrings, locale)
  const [person, setPerson] = useState<Person | null>(null)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState<{ entry: EntryView; share_url: string } | null>(null)

  useEffect(() => {
    setPerson(readPerson())
    setReady(true)
  }, [])

  const link = (path: string) => withLang(withPreview(path, preview), locale)
  const back = link(`/challenges/${c.slug}`)

  if (c.phase !== 'open') {
    return (
      <Panel title={c.phase === 'soon' ? t('enter.not_yet') : t('enter.closed')}>
        <p className="text-[16px] text-navy">
          {c.phase === 'soon' ? t('enter.come_back') : t('enter.thanks')}
        </p>
        <Link href={back} className={`${PRIMARY} mt-5`}>{t('enter.back', { title: c.title })}</Link>
      </Panel>
    )
  }

  if (done) {
    return (
      <Panel title={t('done.title')}>
        <p className="text-[16px] leading-relaxed text-navy">
          {rich(t(done.entry.status === 'pending' ? 'done.pending' : 'done.ok'), {
            title: <span className="font-bold">{done.entry.title}</span>,
          })}
        </p>
        <p className="mt-3 text-[16px] leading-relaxed text-navy">{t('done.send', { n: c.finalist_count })}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ShareButton url={done.share_url} title={done.entry.title} locale={locale} />
          <Link href={link(`/challenges/${c.slug}/e/${done.entry.id}`)} className="inline-flex min-h-[48px] items-center px-2 font-bold text-forest underline-offset-4 hover:underline">
            {t('done.see_page')}
          </Link>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-6 border-t-2 border-navy/[0.1] pt-5">
          <button type="button" onClick={() => setDone(null)} className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">
            {t('mine.another')}
          </button>
          <Link href={back} className="inline-flex min-h-[44px] items-center font-bold text-navy underline-offset-4 hover:underline">
            {t('enter.back', { title: c.title })}
          </Link>
        </div>
      </Panel>
    )
  }

  if (!ready) return <Panel title={t('enter.title', { title: c.title })}><div className="h-40" /></Panel>

  if (!person) {
    return (
      <Panel title={t('enter.title', { title: c.title })}>
        <EmailGate
          slug={c.slug}
          preview={preview}
          intro={t('enter.intro')}
          onVerified={setPerson}
          locale={locale}
        />
      </Panel>
    )
  }

  return (
    <Panel title={t('enter.title', { title: c.title })}>
      <EntryForm c={c} preview={preview} person={person} onDone={setDone} locale={locale}
        onSignOut={() => { writePerson(null); setPerson(null) }} />
    </Panel>
  )
}

function EntryForm({ c, preview, person, onDone, onSignOut, locale }: {
  c: ChallengeView
  preview: string
  person: Person
  onDone: (d: { entry: EntryView; share_url: string }) => void
  onSignOut: () => void
  locale: SiteLocale
}) {
  const t = translator(creativeStrings, locale)
  const [source, setSource] = useState<'upload' | 'link'>('upload')
  const [link, setLink] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [probe, setProbe] = useState<Probe | null>(null)
  const [probing, setProbing] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
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

  const minS = c.min_seconds ?? 30
  const maxS = c.max_seconds ?? 60

  async function pick(f: File | null) {
    setFile(null)
    setProbe(null)
    setFileError(null)
    if (!f) return
    const type = typeOf(f)
    if (!type) { setFileError(t('file.type')); return }
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(t('file.too_big', { size: Math.round(f.size / 1024 / 1024), max: MAX_MB }))
      return
    }
    setProbing(true)
    try {
      const p = await probeVideo(f, locale)
      if (p.duration > maxS + 5 || p.duration < minS - 5) {
        setFileError(t('api.length', { min: minS, max: maxS, len: mmss(p.duration) }))
        return
      }
      setFile(f)
      setProbe(p)
    } catch (err) {
      setFileError((err as Error).message)
    } finally {
      setProbing(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (source === 'upload' && (!file || !probe)) { setError(t('file.first')); return }
    setBusy(true)
    setError(null)
    try {
      let upload: Record<string, unknown> | undefined
      if (source === 'upload' && file && probe) {
        const type = typeOf(file)!
        const start = await post<{ path: string; upload_url: string }>({ action: 'upload_start', slug: c.slug, preview, type, size: file.size }, person.token)
        setProgress(0)
        await sendFile(start.upload_url, file, type, setProgress, locale)
        upload = { path: start.path, duration_s: probe.duration, codec: probe.codec, thumb: probe.thumb, sheet: probe.sheet }
      }
      const r = await post<{ entry: EntryView; share_url: string }>({
        action: 'enter', slug: c.slug, preview, ...(upload ? { upload } : { link: link.trim() }), title, says, category,
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
      const fallback = t('err.try_minute')
      setError(err instanceof ApiError
        ? errorText(err, locale, fallback, { action: 'enter', maxEntries: c.max_entries_per_person, source, maxMb: MAX_MB }) || fallback
        : err instanceof Error && err.message ? err.message : fallback)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="text-[15px] text-ink-soft">
        {rich(t('form.as'), { name: <span className="font-bold text-navy">{person.first_name}</span>, email: person.email })}{' '}
        <button type="button" onClick={onSignOut} className="font-bold text-forest underline-offset-4 hover:underline">{t('form.not_you')}</button>
      </p>

      <fieldset>
        <legend className={LABEL}>{t('form.video')}</legend>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup">
          {([['upload', t('form.upload')], ['link', t('form.link')]] as const).map(([k, label]) => (
            <label key={k} className={`inline-flex min-h-[46px] cursor-pointer items-center rounded-full border-2 px-5 text-[16px] font-bold ${source === k ? 'border-navy bg-navy text-white' : 'border-navy/[0.16] bg-white text-navy hover:border-navy/40'}`}>
              <input type="radio" name="source" value={k} checked={source === k} onChange={() => { setSource(k); setError(null) }} className="sr-only" />
              {label}
            </label>
          ))}
        </div>

        {source === 'upload' ? (
          <div className="mt-4">
            {probe && file ? (
              <div className="flex items-center gap-4 rounded-[16px] bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={probe.thumb} alt="" className={`shrink-0 rounded-[10px] bg-navy object-cover ${probe.portrait ? 'h-28 w-16' : 'h-20 w-36'}`} />
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-bold text-navy">{file.name}</p>
                  <p className="text-[15px] text-ink-soft">{mmss(probe.duration)} · {Math.max(1, Math.round(file.size / 1024 / 1024))} MB</p>
                  <label className="mt-1 inline-flex min-h-[40px] cursor-pointer items-center font-bold text-forest underline-offset-4 hover:underline">
                    {t('form.choose_other')}
                    <input id="cb-file-change" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => void pick(e.target.files?.[0] ?? null)} />
                  </label>
                </div>
              </div>
            ) : (
              <label className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed border-navy/[0.24] bg-white px-4 py-6 text-center hover:border-navy/50">
                <span className="text-[17px] font-bold text-navy">{probing ? t('form.reading') : t('form.choose')}</span>
                <span className="mt-1 text-[14px] text-ink-soft">{t('form.file_hint', { mb: MAX_MB, min: minS, max: maxS })}</span>
                <input id="cb-file" type="file" accept={ACCEPT} className="sr-only" disabled={probing} onChange={(e) => void pick(e.target.files?.[0] ?? null)} />
              </label>
            )}
            {fileError && <p role="alert" className="mt-2 text-[15px] font-semibold text-ep-danger">{fileError}</p>}
          </div>
        ) : (
          <label className="mt-4 block">
            <span className="sr-only">{t('form.link_label')}</span>
            <input id="cb-link" required value={link} onChange={(e) => setLink(e.target.value)} inputMode="url" autoComplete="off"
              placeholder={t('form.link_placeholder')} className={INPUT} />
            <span className="mt-1.5 block text-[14px] text-ink-soft">{t('form.link_hint', { min: minS, max: maxS })}</span>
          </label>
        )}
      </fieldset>

      <label className="block">
        <span className={LABEL}>{t('form.title')}</span>
        <input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={INPUT} />
      </label>

      <label className="block">
        <span className={LABEL}>{t('form.says')}</span>
        <input required value={says} onChange={(e) => setSays(e.target.value)} maxLength={140}
          placeholder={t('form.says_placeholder')} className={INPUT} />
      </label>

      <fieldset>
        <legend className={LABEL}>{t('form.about')}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {c.categories.map((k) => (
            <label key={k.key} className={`inline-flex min-h-[46px] cursor-pointer items-center rounded-full border-2 px-5 text-[16px] font-bold ${category === k.key ? 'border-forest bg-forest text-white' : 'border-navy/[0.16] bg-white text-navy hover:border-navy/40'}`}>
              <input type="radio" name="category" value={k.key} checked={category === k.key} onChange={() => setCategory(k.key)} required className="sr-only" />
              {categoryLabel(c, k.key, locale)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL}>{t('form.last')}</span>
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={40} autoComplete="family-name" className={INPUT} />
          <span className="mt-1.5 block text-[14px] text-ink-soft">{t('form.last_hint')}</span>
        </label>
        <label className="block">
          <span className={LABEL}>{t('form.town')}</span>
          <input required value={town} onChange={(e) => setTown(e.target.value)} maxLength={60} autoComplete="address-level2" placeholder={t('form.town_placeholder')} className={INPUT} />
        </label>
      </div>

      <label className="block">
        <span className={LABEL}>{t('form.credit')}</span>
        <input value={credit} onChange={(e) => setCredit(e.target.value)} maxLength={80} placeholder={defaultCredit} className={INPUT} />
        <span className="mt-1.5 block text-[14px] text-ink-soft">{t('form.credit_hint')}</span>
      </label>

      <div className="space-y-3 rounded-[16px] bg-white p-4">
        <Check checked={eligible} onChange={setEligible}>{t('form.eligible')}</Check>
        <Check checked={rights} onChange={setRights}>{t('form.rights')}</Check>
        <Check checked={rules} onChange={setRules}>
          {rich(t('form.agree'), {
            link: (
              <Link href={withLang(withPreview(`/challenges/${c.slug}/rules`, preview), locale)} target="_blank" className="font-bold text-forest underline underline-offset-4">
                {t('form.agree_link')}
              </Link>
            ),
          })}
        </Check>
        <Check checked={newsletter} onChange={setNewsletter}>{t('form.newsletter')}</Check>
      </div>

      {error && <p role="alert" className="text-[15px] font-semibold text-ep-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={busy || !eligible || !rights || !rules} className={PRIMARY}>
          {progress != null ? t('form.uploading', { pct: Math.round(progress * 100) }) : busy ? t('form.checking') : t('form.submit')}
        </button>
        <span className="text-[15px] text-ink-soft">{t('form.closes', { date: lastDay(c.entries_close_at, locale) })}</span>
      </div>
    </form>
  )
}

function mmss(s: number): string {
  const t = Math.round(s)
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`
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
