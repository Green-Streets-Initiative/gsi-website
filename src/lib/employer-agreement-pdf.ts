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
  GSI_SIGNER,
  agreementPlainText,
} from '@/lib/employer-agreement'

// The PDF customers e-sign (Keith 2026-10-28/29): page 1 is the order form
// with both signature blocks, then the full agreement. Signature and date
// fields are SignWell text tags in white text, so SignWell places them and
// nobody sees the tag. Signer 1 = the customer, signer 2 = GSI, matching
// the order of recipients sent to SignWell.

export type OrderTerms = {
  company: string
  plan: string
  /** Whole dollars per year. */
  annualFee: number
  /** Omitted when unknown; the agreement's Fees section covers both. */
  billing?: 'invoice' | 'card'
  /** YYYY-MM-DD */
  startDate: string
}

export type Signer = { name: string; title: string; email: string }

/** Short fingerprint of the agreement text, printed on every page. */
export function agreementFingerprint(): string {
  return createHash('sha256').update(agreementPlainText()).digest('hex').slice(0, 12)
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 60
const TEXT_W = PAGE_W - MARGIN * 2
const INK: [number, number, number] = [25, 26, 46]
const MUTED: [number, number, number] = [75, 85, 99]

export function buildAgreementPdf(order: OrderTerms, signer: Signer): Buffer {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  let y = MARGIN

  const para = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number]; gap?: number; indent?: number } = {}) => {
    const size = opts.size ?? 10.5
    const indent = opts.indent ?? 0
    doc.setFont('helvetica', opts.bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...(opts.color ?? INK))
    const lines = doc.splitTextToSize(text, TEXT_W - indent) as string[]
    const lh = size * 1.4
    for (const line of lines) {
      if (y + lh > PAGE_H - MARGIN) {
        doc.addPage()
        y = MARGIN
      }
      doc.text(line, MARGIN + indent, y)
      y += lh
    }
    y += opts.gap ?? 6
  }

  // A labelled line: bold label, then the value.
  const field = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...INK)
    doc.text(label, MARGIN, y)
    const lw = doc.getTextWidth(`${label} `)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(value, TEXT_W - lw) as string[]
    lines.forEach((line, i) => doc.text(line, MARGIN + lw, y + i * 14.5))
    y += lines.length * 14.5 + 3
  }

  // ---- Page 1: the order form ----
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(45, 106, 79)
  doc.text('GREEN STREETS INITIATIVE  ·  SHIFT', MARGIN, y)
  y += 24
  para(ORDER_FORM_TITLE, { size: 17, bold: true, gap: 10 })

  field('Customer:', order.company)
  field('Signer:', `${signer.name}, ${signer.title}, ${signer.email}`)
  field('Plan:', order.plan)
  field('Annual fee:', `$${order.annualFee.toLocaleString('en-US')}`)
  if (order.billing) {
    field('Billing:', order.billing === 'invoice' ? 'Invoice, due in 30 days' : 'Card')
  }
  field(
    'Term:',
    `12 months from ${longDate(order.startDate)}, renewing each year unless either side declines before the renewal date. GSI sends a reminder with the renewal fee at least 30 days before.`,
  )
  field(
    'Terms:',
    `${AGREEMENT_TITLE}, version ${AGREEMENT_VERSION}, attached and at gogreenstreets.org/shift/employers/agreement.`,
  )
  y += 8

  para('Key points in plain words', { size: 11.5, bold: true, gap: 4 })
  ORDER_FORM_KEY_POINTS.forEach((p, i) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(...INK)
    doc.text(`${i + 1}.`, MARGIN + 4, y)
    para(p, { indent: 20, gap: 2 })
  })
  y += 6
  para(ORDER_FORM_CLOSING, { size: 10, color: MUTED, gap: 14 })

  // Two signature blocks side by side, anchored near the bottom of page 1.
  const blockTop = Math.max(y + 8, PAGE_H - MARGIN - 150)
  const colW = (TEXT_W - 30) / 2
  const sigBlock = (x: number, heading: string, who: Signer, n: 1 | 2) => {
    let by = blockTop
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...INK)
    doc.text(heading, x, by)
    by += 18
    // Tag first (white, so only SignWell sees it), then the rule under it.
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(`{{s:${n}:y:::sig_${n}:180:34}}`, x, by + 22)
    doc.setDrawColor(...MUTED)
    doc.line(x, by + 30, x + colW, by + 30)
    doc.setTextColor(...MUTED)
    doc.text('Signature', x, by + 41)
    by += 58
    doc.setFontSize(10)
    doc.setTextColor(...INK)
    doc.text(`${who.name}, ${who.title}`, x, by)
    by += 16
    doc.setTextColor(...MUTED)
    doc.text('Date:', x, by)
    doc.setTextColor(255, 255, 255)
    doc.text(`{{af_d_s:${n}:y:::date_${n}:110:14}}`, x + 28, by)
  }
  sigBlock(MARGIN, 'Customer', signer, 1)
  sigBlock(MARGIN + colW + 30, 'Green Streets Initiative', GSI_SIGNER, 2)

  // ---- The full agreement ----
  doc.addPage()
  y = MARGIN
  para(AGREEMENT_TITLE, { size: 15, bold: true, gap: 2 })
  para(`Version ${AGREEMENT_VERSION}`, { size: 10, color: MUTED, gap: 10 })
  para(AGREEMENT_PREAMBLE, { gap: 10 })
  for (const s of AGREEMENT_SECTIONS) {
    if (y + 40 > PAGE_H - MARGIN) {
      doc.addPage()
      y = MARGIN
    }
    para(s.heading, { size: 11, bold: true, gap: 2 })
    para(s.body, { gap: 10 })
  }

  // Footer on every page: version, fingerprint, page count.
  const fp = agreementFingerprint()
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(
      `${AGREEMENT_TITLE}  ·  Version ${AGREEMENT_VERSION}  ·  Text ${fp}  ·  Page ${i} of ${pages}`,
      MARGIN,
      PAGE_H - 30,
    )
  }

  return Buffer.from(doc.output('arraybuffer'))
}
