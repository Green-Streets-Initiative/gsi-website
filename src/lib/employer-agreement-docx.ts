import 'server-only'
import JSZip from 'jszip'
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
  definedTermRanges,
  orderFormIntro,
  orderFormRows,
  specialTermsParagraphs,
  typeset,
} from '@/lib/employer-agreement'
import type { OrderTerms } from '@/lib/employer-agreement-pdf'

// The Word copy of the agreement (Keith 2026-10-29): what a customer's
// lawyer marks up with tracked changes and emails back. Built from the same
// text as the signed PDF (order form with this customer's terms, then the
// full agreement), with real Word headings, automatic section numbering and
// real tables, so edits and renumbering behave. Track Changes is on when it
// opens. The signed version still goes through SignWell.

const REVIEW_LINE = 'For review. The signed version is sent through SignWell.'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type RunOpts = { bold?: boolean; italic?: boolean; color?: string; size?: number }

function run(text: string, o: RunOpts = {}): string {
  const rpr = [
    o.bold ? '<w:b/>' : '',
    o.italic ? '<w:i/>' : '',
    o.color ? `<w:color w:val="${o.color}"/>` : '',
    o.size ? `<w:sz w:val="${o.size}"/><w:szCs w:val="${o.size}"/>` : '',
  ].join('')
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`
}

/** Text as runs, defined terms in bold, as in the PDF. */
function textRuns(text: string, o: RunOpts = {}): string {
  const t = typeset(text)
  const ranges = o.bold ? [] : definedTermRanges(t)
  let out = ''
  let at = 0
  for (const [a, b] of ranges) {
    if (a > at) out += run(t.slice(at, a), o)
    out += run(t.slice(a, b), { ...o, bold: true })
    at = b
  }
  if (at < t.length) out += run(t.slice(at), o)
  return out
}

function para(content: string, ppr = ''): string {
  return `<w:p>${ppr ? `<w:pPr>${ppr}</w:pPr>` : ''}${content}</w:p>`
}

const styled = (style: string, extra = '') => `<w:pStyle w:val="${style}"/>${extra}`

function cell(content: string, width: number, shade?: string): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${shade}"/>` : ''}</w:tcPr>${content}</w:tc>`
}

function table(rows: string[], widths: number[]): string {
  return `<w:tbl><w:tblPr><w:tblStyle w:val="AgreementTable"/><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>${widths
    .map((w) => `<w:gridCol w:w="${w}"/>`)
    .join('')}</w:tblGrid>${rows.join('')}</w:tbl>`
}

const TEXT_W = 12240 - 2 * 1296

function signatureCell(party: string, who: { name: string; title: string } | null, notice: { attn: string; email: string; address: string }): string {
  const line = (label: string, value: string) => para(run(`${label}: `, { bold: true }) + run(value), styled('TableText'))
  return [
    para(run(party, { bold: true }), styled('TableText', '<w:jc w:val="center"/>')),
    para(run('Signature:', { bold: true }), styled('TableText', '<w:spacing w:before="240" w:after="360"/>')),
    para(run('_______________________________________'), styled('TableText')),
    line('Name', who?.name ?? ''),
    line('Title', who?.title ?? ''),
    line('Date', ''),
    para(run('Notice', { bold: true }), styled('TableText', '<w:spacing w:before="200"/><w:jc w:val="center"/>')),
    line('Attn', notice.attn),
    line('Email', notice.email),
    line('Address', notice.address),
  ].join('')
}

function documentXml(order: OrderTerms): string {
  const body: string[] = []
  const [titleTop, titleBottom] = ORDER_FORM_TITLE.split(': ')

  body.push(para(run(REVIEW_LINE, { italic: true, color: '4B5563' }), styled('ReviewNote')))
  body.push(para(run(titleTop.toUpperCase()), styled('Title')))
  body.push(para(run((titleBottom ?? '').toUpperCase()), styled('Title', '<w:spacing w:after="240"/>')))
  body.push(para(textRuns(orderFormIntro(order.company)), styled('BodyText')))

  body.push(para(run('Order details'), styled('Heading2')))
  const labelW = 2400
  body.push(
    table(
      orderFormRows(order).map(
        ([label, value]) =>
          `<w:tr>${cell(para(run(label, { bold: true }), styled('TableText')), labelW, 'F2F4F1')}${cell(para(run(typeset(value)), styled('TableText')), TEXT_W - labelW)}</w:tr>`,
      ),
      [labelW, TEXT_W - labelW],
    ),
  )

  const special = specialTermsParagraphs(order.specialTerms)
  if (special.length) {
    body.push(para(run(SPECIAL_TERMS_HEADING), styled('Heading2')))
    body.push(para(textRuns(SPECIAL_TERMS_NOTE, { bold: true }), styled('BodyText')))
    for (const p of special) body.push(para(textRuns(p), styled('BodyText')))
  }

  body.push(para(run('Key points in plain words'), styled('Heading2')))
  for (const p of ORDER_FORM_KEY_POINTS) {
    body.push(para(textRuns(p), styled('KeyPoint', '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr>')))
  }
  body.push(para(textRuns(ORDER_FORM_CLOSING), styled('BodyText', '<w:spacing w:before="120"/>')))
  body.push(para(textRuns(ORDER_FORM_WITNESS), styled('BodyText')))

  const half = TEXT_W / 2
  body.push(
    table(
      [
        `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(
          signatureCell(GSI_PARTY.legalName.toUpperCase(), GSI_SIGNER, {
            attn: `${GSI_SIGNER.name}, ${GSI_SIGNER.title}`,
            email: GSI_PARTY.noticeEmails.join(' and '),
            address: GSI_PARTY.address,
          }),
          half,
        )}${cell(signatureCell(`CUSTOMER: ${order.company.toUpperCase()}`, null, { attn: '', email: '', address: '' }), half)}</w:tr>`,
      ],
      [half, half],
    ),
  )

  // The agreement, on a new page; Heading 1 paragraphs number themselves.
  body.push(para('<w:r><w:br w:type="page"/></w:r>'))
  body.push(para(run(AGREEMENT_TITLE.toUpperCase()), styled('Title')))
  body.push(para(run(`Version ${AGREEMENT_VERSION}`, { color: '4B5563' }), styled('Subtitle')))
  body.push(para(textRuns(AGREEMENT_PREAMBLE), styled('BodyText')))
  for (const s of AGREEMENT_SECTIONS) {
    body.push(para(run(typeset(s.heading)), styled('Heading1')))
    body.push(para(textRuns(s.body), styled('BodyText')))
  }
  body.push(para(run('[End of Agreement]', { italic: true, color: '4B5563' }), styled('BodyText', '<w:jc w:val="center"/>')))

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/><w:footerReference w:type="default" r:id="rIdFooter"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1296" w:right="1296" w:bottom="1296" w:left="1296" w:header="648" w:footer="648" w:gutter="0"/></w:sectPr></w:body></w:document>`
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="191A2E"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="BodyText"><w:name w:val="Body Text"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="160"/><w:jc w:val="both"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:color w:val="2D6A4F"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:keepNext/><w:numPr><w:numId w:val="1"/></w:numPr><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="BodyText"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:caps/><w:u w:val="single"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="KeyPoint"><w:name w:val="Key Point"/><w:basedOn w:val="BodyText"/><w:pPr><w:spacing w:after="60"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr><w:rPr><w:sz w:val="19"/><w:szCs w:val="19"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ReviewNote"><w:name w:val="Review Note"/><w:basedOn w:val="Normal"/><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="4" w:space="4" w:color="8C929C"/></w:pBdr><w:spacing w:after="240"/><w:jc w:val="center"/></w:pPr></w:style>
<w:style w:type="paragraph" w:styleId="Header"><w:name w:val="header"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="right"/></w:pPr><w:rPr><w:b/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="center" w:pos="4824"/><w:tab w:val="right" w:pos="9648"/></w:tabs></w:pPr><w:rPr><w:color w:val="4B5563"/><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
<w:style w:type="table" w:styleId="AgreementTable"><w:name w:val="Agreement Table"/><w:basedOn w:val="TableNormal"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="8C929C"/><w:left w:val="single" w:sz="4" w:space="0" w:color="8C929C"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="8C929C"/><w:right w:val="single" w:sz="4" w:space="0" w:color="8C929C"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="8C929C"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="8C929C"/></w:tblBorders><w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>
</w:styles>`

// numId 1: agreement sections ("1.", on Heading 1). numId 2: key points.
const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:pStyle w:val="Heading1"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="540"/></w:tabs><w:ind w:left="540" w:hanging="540"/></w:pPr></w:lvl></w:abstractNum>
<w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="360"/></w:pPr></w:lvl></w:abstractNum>
<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`

const SETTINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:trackRevisions/><w:defaultTabStop w:val="720"/><w:characterSpacingControl w:val="doNotCompress"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>`

const HEADER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Header"/></w:pPr><w:r><w:t>SHIFT EMPLOYER PLATFORM AGREEMENT</w:t></w:r></w:p></w:hdr>`

const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:t xml:space="preserve">Version ${AGREEMENT_VERSION}</w:t></w:r><w:r><w:tab/><w:t xml:space="preserve">Page </w:t></w:r><w:fldSimple w:instr=" PAGE "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:t xml:space="preserve"> of </w:t></w:r><w:fldSimple w:instr=" NUMPAGES "><w:r><w:t>1</w:t></w:r></w:fldSimple><w:r><w:tab/><w:t>Review copy</w:t></w:r></w:p></w:ftr>`

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdHeader" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rIdFooter" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`

function coreXml(order: OrderTerms): string {
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(`${AGREEMENT_TITLE} - ${order.company} (review copy)`)}</dc:title><dc:creator>Green Streets Initiative</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>`
}

export async function buildAgreementDocx(order: OrderTerms): Promise<Buffer> {
  const zip = new JSZip()
  const parts: Array<[string, string]> = [
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['docProps/core.xml', coreXml(order)],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/document.xml', documentXml(order)],
    ['word/styles.xml', STYLES],
    ['word/numbering.xml', NUMBERING],
    ['word/settings.xml', SETTINGS],
    ['word/header1.xml', HEADER],
    ['word/footer1.xml', FOOTER],
  ]
  // No folder entries: a .docx package lists parts only.
  for (const [name, xml] of parts) zip.file(name, xml, { createFolders: false })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
