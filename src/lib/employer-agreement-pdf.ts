import 'server-only'
import { createHash } from 'node:crypto'
import { jsPDF } from 'jspdf'
import {
  AGREEMENT_TITLE,
  AGREEMENT_PREAMBLE,
  AGREEMENT_SECTIONS,
  AGREEMENT_VERSION,
  ORDER_FORM_TITLE,
  ORDER_FORM_KEY_POINTS,
  ORDER_FORM_CLOSING,
  ORDER_FORM_WITNESS,
  GSI_PARTY,
  GSI_SIGNER,
  SPECIAL_TERMS_HEADING,
  SPECIAL_TERMS_NOTE,
  agreementPlainText,
  definedTermRanges,
  orderFormIntro,
  orderFormRows,
  specialTermsParagraphs,
  typeset,
} from '@/lib/employer-agreement'
import { GSI_WORDMARK_URL } from '@/app/shift/employers/portal/_lib/portal-constants'

// The PDF customers e-sign (Keith 2026-10-28/29): page 1 is the order form,
// closed by a two-party signature table, then the full agreement. Laid out
// like a standard signed agreement (Keith 2026-10-29): header and footer on
// every page, numbered sections, justified text, defined terms in bold.
// Signature, date and address fields are SignWell text tags in white text,
// so SignWell places them and nobody sees the tag. Signer 1 = the customer,
// signer 2 = GSI, matching the order of recipients sent to SignWell.

export type OrderTerms = {
  company: string
  plan: string
  /** Whole dollars per year. */
  annualFee: number
  /** Omitted when unknown; the agreement's Fees section covers both. */
  billing?: 'invoice' | 'card'
  /** YYYY-MM-DD */
  startDate: string
  /** Negotiated terms for this customer only, typed by GSI staff. */
  specialTerms?: string
}

export type Signer = { name: string; title: string; email: string }

/** Short fingerprint of the agreement text, printed on every page. */
export function agreementFingerprint(): string {
  return createHash('sha256').update(agreementPlainText()).digest('hex').slice(0, 12)
}

let logoCache: Uint8Array | null = null

/** GSI wordmark for page 1; null (no logo) if storage can't be reached. */
export async function loadAgreementLogo(): Promise<Uint8Array | null> {
  if (logoCache) return logoCache
  try {
    const res = await fetch(GSI_WORDMARK_URL)
    if (!res.ok) return null
    logoCache = new Uint8Array(await res.arrayBuffer())
    return logoCache
  } catch {
    return null
  }
}

// Characters the PDF's built-in Helvetica can draw (WinAnsi). Anything
// else in typed special terms becomes "?" rather than garbage.
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
function drawable(s: string): string {
  return s
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, (c) => (WIN_ANSI_EXTRA.includes(c) ? c : '?'))
}

type Rgb = [number, number, number]
const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 60
const TOP = 66
const BOTTOM = PAGE_H - 58
const TEXT_W = PAGE_W - MARGIN * 2
const INK: Rgb = [25, 26, 46]
const MUTED: Rgb = [75, 85, 99]
const GREEN: Rgb = [45, 106, 79]
const RULE: Rgb = [140, 146, 156]
const SHADE: Rgb = [242, 244, 241]
const BODY = 10
const LH = 13.6

type Piece = { text: string; bold: boolean }
type Word = { pieces: Piece[]; width: number }

export function buildAgreementPdf(order: OrderTerms, signer: Signer, logo: Uint8Array | null = null): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  let y = TOP

  const font = (bold: boolean, size: number, color: Rgb = INK, style: 'normal' | 'italic' = 'normal') => {
    doc.setFont('helvetica', bold ? 'bold' : style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
  }
  const newPage = () => {
    doc.addPage()
    y = TOP
  }
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage()
  }

  // Split text into words, bolding defined terms: a quoted term inside
  // parentheses, as in ("GSI") or (the "Order").
  const words = (text: string, size: number, allBold = false): Word[] => {
    const raw = typeset(text)
    const bold = new Array<boolean>(raw.length).fill(allBold)
    if (!allBold) {
      for (const [a, b] of definedTermRanges(raw)) for (let i = a; i < b; i++) bold[i] = true
    }
    const out: Word[] = []
    let i = 0
    while (i < raw.length) {
      if (raw[i] === ' ') {
        i++
        continue
      }
      const pieces: Piece[] = []
      while (i < raw.length && raw[i] !== ' ') {
        const b = bold[i]
        let t = ''
        while (i < raw.length && raw[i] !== ' ' && bold[i] === b) t += raw[i++]
        pieces.push({ text: t, bold: b })
      }
      let width = 0
      for (const p of pieces) {
        font(p.bold, size)
        width += doc.getTextWidth(p.text)
      }
      out.push({ pieces, width })
    }
    return out
  }

  // A justified paragraph (last line ragged), starting at x within width w.
  const para = (
    text: string,
    opts: { x?: number; w?: number; size?: number; lh?: number; gap?: number; bold?: boolean; color?: Rgb; align?: 'justify' | 'left' | 'center' } = {},
  ) => {
    const x = opts.x ?? MARGIN
    const w = opts.w ?? TEXT_W
    const size = opts.size ?? BODY
    const lh = opts.lh ?? (size === BODY ? LH : size * 1.36)
    const align = opts.align ?? 'justify'
    const ws = words(text, size, opts.bold)
    font(false, size)
    const space = doc.getTextWidth(' ')
    const lines: Word[][] = []
    let line: Word[] = []
    let lw = 0
    for (const wd of ws) {
      const next = line.length ? lw + space + wd.width : wd.width
      if (line.length && next > w) {
        lines.push(line)
        line = [wd]
        lw = wd.width
      } else {
        line.push(wd)
        lw = next
      }
    }
    if (line.length) lines.push(line)
    lines.forEach((ln, li) => {
      // No single last line alone at the top of a page.
      if (li === lines.length - 2 && li > 0 && y + 2 * lh > BOTTOM) newPage()
      ensure(lh)
      const natural = ln.reduce((s, wd) => s + wd.width, 0)
      const last = li === lines.length - 1
      const gap = align === 'justify' && !last && ln.length > 1 ? (w - natural) / (ln.length - 1) : space
      let cx = align === 'center' ? x + (w - (natural + space * (ln.length - 1))) / 2 : x
      for (const wd of ln) {
        for (const p of wd.pieces) {
          font(p.bold, size, opts.color)
          doc.text(p.text, cx, y)
          cx += doc.getTextWidth(p.text)
        }
        cx += gap
      }
      y += lh
    })
    y += opts.gap ?? 7
  }

  // "1.  HEADING", caps, bold, underlined; kept with the first lines below it.
  const heading = (num: string | null, text: string) => {
    ensure(LH * 4)
    const label = typeset(text).toUpperCase()
    font(true, BODY)
    const tx = num ? MARGIN + 26 : MARGIN
    if (num) doc.text(num, MARGIN, y)
    doc.text(label, tx, y)
    doc.setDrawColor(...INK)
    doc.setLineWidth(0.6)
    doc.line(tx, y + 1.6, tx + doc.getTextWidth(label), y + 1.6)
    y += LH + 2
  }

  // Invisible SignWell tag; the field lands where the tag text sits.
  const tag = (text: string, x: number, baseline: number) => {
    font(false, 7, [255, 255, 255])
    doc.text(text, x, baseline)
  }

  // ---- Page 1: the order form ----
  if (logo) {
    // Wordmark is 1944 x 278.
    doc.addImage(logo, 'PNG', MARGIN, 30, 126, 18, 'gsi-wordmark', 'SLOW')
    // The image's first pixel column is a gray edge; keep it off the page.
    doc.setFillColor(255, 255, 255)
    doc.rect(MARGIN - 1, 29, 1.6, 20, 'F')
  }
  const [titleTop, titleBottom] = ORDER_FORM_TITLE.split(': ')
  y = TOP + 2
  font(true, 13, GREEN)
  doc.text(titleTop.toUpperCase(), PAGE_W / 2, y, { align: 'center' })
  y += 16
  doc.text((titleBottom ?? '').toUpperCase(), PAGE_W / 2, y, { align: 'center' })
  y += 22

  para(orderFormIntro(order.company), { gap: 10 })

  // Order details: a bordered two-column table, labels shaded.
  heading(null, 'Order details')
  const rows = orderFormRows(order)
  const labelW = 118
  const pad = 5
  y -= 6
  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.6)
  for (const [label, value] of rows) {
    font(false, BODY)
    const lines = doc.splitTextToSize(typeset(value), TEXT_W - labelW - pad * 2) as string[]
    const h = lines.length * LH + pad * 2 - 4
    ensure(h)
    doc.setFillColor(...SHADE)
    doc.rect(MARGIN, y, labelW, h, 'F')
    doc.rect(MARGIN, y, TEXT_W, h)
    doc.line(MARGIN + labelW, y, MARGIN + labelW, y + h)
    font(true, BODY)
    doc.text(label, MARGIN + pad, y + pad + 7.5)
    font(false, BODY)
    lines.forEach((ln, i) => doc.text(ln, MARGIN + labelW + pad, y + pad + 7.5 + i * LH))
    y += h
  }
  y += 18

  // Special terms: only when GSI staff typed some; long text runs on to
  // the next page like any paragraph.
  const special = specialTermsParagraphs(order.specialTerms)
  if (special.length) {
    heading(null, SPECIAL_TERMS_HEADING)
    para(SPECIAL_TERMS_NOTE, { gap: 6, bold: true })
    special.forEach((p, i) => para(drawable(p), { gap: i === special.length - 1 ? 14 : 5 }))
  }

  heading(null, 'Key points in plain words')
  ORDER_FORM_KEY_POINTS.forEach((p, i) => {
    font(false, BODY)
    doc.text(`${i + 1}.`, MARGIN + 4, y)
    para(p, { x: MARGIN + 20, w: TEXT_W - 20, gap: 2 })
  })
  y += 4
  para(ORDER_FORM_CLOSING, { gap: 8 })

  // Signature table: one column per party, each with signature, name,
  // title, date and where legal notices go.
  const colW = TEXT_W / 2
  const headH = 20
  let tTop = 0
  // Lays out one party's column from tTop; draws only when `draw` is set,
  // so the table can be measured first and kept whole on one page.
  const cell = (
    draw: boolean,
    n: 1 | 2,
    x: number,
    party: string,
    who: Signer,
    notice: { attn: string; address: string | null; email: string },
  ): number => {
    const cx = x + 10
    const cw = colW - 20
    let cy = tTop + headH + 10
    if (draw) {
      font(true, 9.5)
      doc.text(party, x + colW / 2, tTop + 13.5, { align: 'center' })
      font(false, 8, MUTED)
      doc.text('Signature', cx, cy)
    }
    const lineY = cy + 34
    if (draw) {
      tag(`{{s:${n}:y:::sig_${n}:180:34}}`, cx, lineY - 8)
      doc.setDrawColor(...INK)
      doc.setLineWidth(0.6)
      doc.line(cx, lineY, cx + cw, lineY)
    }
    cy = lineY + 15
    const row = (label: string, value: string | null, fieldTag?: string) => {
      const lx = cx + 44
      font(true, 9.5)
      if (draw) doc.text(`${label}:`, cx, cy)
      if (draw && fieldTag) tag(fieldTag, lx, cy)
      font(false, 9.5)
      const lines = value ? (doc.splitTextToSize(typeset(value), cw - 44) as string[]) : ['']
      if (draw) lines.forEach((ln, i) => doc.text(ln, lx, cy + i * 12.5))
      cy += lines.length * 12.5 + 2
    }
    row('Name', who.name)
    row('Title', who.title)
    row('Date', null, `{{af_d_s:${n}:y:::date_${n}:110:12}}`)
    cy += 6
    if (draw) {
      font(true, 9.5)
      doc.text('Notice', x + colW / 2, cy, { align: 'center' })
    }
    cy += 14
    row('Attn', notice.attn)
    row('Email', notice.email)
    row('Address', notice.address, notice.address ? undefined : `{{t:${n}:n:Notice address::address_${n}:${Math.round(cw - 48)}:12}}`)
    return cy
  }
  const gsiCol = [2, MARGIN, GSI_PARTY.legalName.toUpperCase(), GSI_SIGNER, {
    attn: `${GSI_SIGNER.name}, ${GSI_SIGNER.title}`,
    address: GSI_PARTY.address,
    email: GSI_PARTY.noticeEmails.join(' and '),
  }] as const
  const customerCol = [1, MARGIN + colW, `CUSTOMER: ${order.company.toUpperCase()}`, signer, {
    attn: `${signer.name}, ${signer.title}`,
    address: null,
    email: signer.email,
  }] as const
  const tableH = Math.max(cell(false, ...gsiCol), cell(false, ...customerCol)) + 4
  if (y + LH + 6 + tableH > BOTTOM) newPage()
  para(ORDER_FORM_WITNESS, { gap: 6 })
  tTop = y
  const tBottom = Math.max(cell(true, ...gsiCol), cell(true, ...customerCol)) + 4
  doc.setDrawColor(...INK)
  doc.setLineWidth(0.8)
  doc.rect(MARGIN, tTop, TEXT_W, tBottom - tTop)
  doc.line(MARGIN + colW, tTop, MARGIN + colW, tBottom)
  doc.line(MARGIN, tTop + headH, MARGIN + TEXT_W, tTop + headH)
  y = tBottom

  // ---- The full agreement ----
  newPage()
  font(true, 13, GREEN)
  doc.text(AGREEMENT_TITLE.toUpperCase(), PAGE_W / 2, y + 6, { align: 'center' })
  y += 22
  font(false, 9.5, MUTED)
  doc.text(`Version ${AGREEMENT_VERSION}`, PAGE_W / 2, y, { align: 'center' })
  y += 22
  para(AGREEMENT_PREAMBLE, { gap: 12 })
  AGREEMENT_SECTIONS.forEach((s, i) => {
    heading(`${i + 1}.`, s.heading)
    para(s.body, { gap: 12 })
  })
  y += 4
  ensure(LH)
  font(false, 9, MUTED, 'italic')
  doc.text('[End of Agreement]', PAGE_W / 2, y, { align: 'center' })

  // Header and footer on every page.
  const fp = agreementFingerprint()
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    font(true, 8, INK)
    doc.text('SHIFT EMPLOYER PLATFORM AGREEMENT', PAGE_W - MARGIN, 42, { align: 'right' })
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.4)
    doc.line(MARGIN, 52, PAGE_W - MARGIN, 52)
    doc.line(MARGIN, PAGE_H - 44, PAGE_W - MARGIN, PAGE_H - 44)
    font(false, 8, MUTED)
    doc.text(`Version ${AGREEMENT_VERSION}`, MARGIN, PAGE_H - 32)
    doc.text(`Page ${i} of ${pages}`, PAGE_W / 2, PAGE_H - 32, { align: 'center' })
    doc.text(`Text ${fp}`, PAGE_W - MARGIN, PAGE_H - 32, { align: 'right' })
  }

  return Buffer.from(doc.output('arraybuffer'))
}
