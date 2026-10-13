/**
 * Turn a pasted or uploaded staff list into rows for
 * add_employer_survey_recipients: email, name, department, site. Accepts a
 * CSV with a header (email, name or first/last, department, site or
 * location), a header-less CSV, or a plain "Name <email>" list. Sites are
 * matched to the workplace's offices by name.
 */
export type StaffRow = { email: string; name?: string; department?: string; location_id?: string }
export type ParsedStaff = { rows: StaffRow[]; wrong: string[] }

const EMAIL_RE = /^[^\s@<>()[\],;:"']+@[^\s@<>()[\],;:"']+\.[a-z]{2,}$/i

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (c === '"') inQ = false
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',' || c === '\t' || c === ';') {
      out.push(cur)
      cur = ''
    } else cur += c
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

function siteFor(text: string | undefined, sites: { id: string; name: string }[]): string | undefined {
  const t = (text ?? '').trim().toLowerCase()
  if (!t) return undefined
  const hit = sites.find((s) => s.name.toLowerCase() === t) ?? sites.find((s) => s.name.toLowerCase().includes(t) || t.includes(s.name.toLowerCase()))
  return hit?.id
}

export function parseStaff(text: string, sites: { id: string; name: string }[]): ParsedStaff {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows: StaffRow[] = []
  const wrong: string[] = []
  const seen = new Set<string>()
  if (lines.length === 0) return { rows, wrong }

  const first = splitCsvLine(lines[0]).map((h) => h.toLowerCase())
  const hasHeader = first.some((h) => /e-?mail/.test(h)) && !first.some((h) => h.includes('@'))
  const col = (names: RegExp) => first.findIndex((h) => names.test(h))
  const iEmail = hasHeader ? col(/e-?mail/) : -1
  const iName = hasHeader ? col(/^(full ?)?name$|^employee( name)?$|^display ?name$/) : -1
  const iFirst = hasHeader ? col(/^first( ?name)?$|^given/) : -1
  const iLast = hasHeader ? col(/^last( ?name)?$|^surname$|^family/) : -1
  const iDept = hasHeader ? col(/depart|team|division|tenant/) : -1
  const iSite = hasHeader ? col(/site|location|office|building|campus/) : -1

  for (const line of hasHeader ? lines.slice(1) : lines) {
    let email = ''
    let name = ''
    let department = ''
    let site = ''
    if (hasHeader) {
      const cells = splitCsvLine(line)
      email = cells[iEmail] ?? ''
      name = iName >= 0 ? (cells[iName] ?? '') : [cells[iFirst], cells[iLast]].filter(Boolean).join(' ')
      department = iDept >= 0 ? (cells[iDept] ?? '') : ''
      site = iSite >= 0 ? (cells[iSite] ?? '') : ''
    } else {
      // "Jane Doe <jane@x.com>", "jane@x.com, Jane Doe, Finance", or "jane@x.com"
      const m = line.match(/<([^<>]+)>/)
      if (m) {
        email = m[1]
        name = line.replace(m[0], '').replace(/["',;]/g, ' ').trim()
      } else {
        const cells = splitCsvLine(line)
        const e = cells.findIndex((c) => c.includes('@'))
        if (e >= 0) {
          email = cells[e]
          const rest = cells.filter((_, i) => i !== e).filter(Boolean)
          name = rest[0] ?? ''
          department = rest[1] ?? ''
          site = rest[2] ?? ''
        } else {
          email = line
        }
      }
    }
    email = email.trim().replace(/^mailto:/i, '').toLowerCase()
    if (!email) continue
    if (!EMAIL_RE.test(email)) {
      wrong.push(email)
      continue
    }
    if (seen.has(email)) continue
    seen.add(email)
    const row: StaffRow = { email }
    if (name.trim()) row.name = name.trim().slice(0, 120)
    if (department.trim()) row.department = department.trim().slice(0, 80)
    const loc = siteFor(site, sites)
    if (loc) row.location_id = loc
    rows.push(row)
  }
  return { rows, wrong }
}
