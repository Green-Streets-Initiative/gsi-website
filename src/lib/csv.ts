/**
 * CSV for every download on the site (employer portal exports, walk audit
 * results, ride turnout), so each file follows one rule:
 *  - every cell quoted, quotes doubled;
 *  - text that starts like a spreadsheet formula (= + - @, a tab or a
 *    return) gets a leading apostrophe, so Excel or Sheets shows it instead
 *    of running it. Names and notes are typed by members and guests, and a
 *    name like =HYPERLINK(…) would otherwise run when an employer opens the
 *    export. Plain numbers ("-3.50", "+2") stay as they are;
 *  - a download starts with a byte-order mark, which is how Excel knows the
 *    file is UTF-8 and shows "José" rather than "JosÃ©".
 * Arrays join with "; " and objects become JSON, for the walk audit's answers.
 */

const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^[+-]?\d[\d,]*(\.\d+)?%?$/

export function csvCell(v: unknown): string {
  let s = v == null ? '' : Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
  if (typeof v !== 'number' && FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}

/** Saves rows (or CSV text built elsewhere, such as on the server) as a file. Browser only. */
export function downloadCsv(filename: string, csv: string | readonly (readonly unknown[])[]): void {
  const text = typeof csv === 'string' ? csv : toCsv(csv)
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename.replace(/[\\/:*?"<>|]/g, '-')
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Some browsers start the download after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
