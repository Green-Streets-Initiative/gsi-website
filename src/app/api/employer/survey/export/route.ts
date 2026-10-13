import { requirePortalCaller } from '@/lib/employer/portal-auth'
import { buildSurveyExport } from '@/lib/employer/survey-export-server'
import { exportCsv, exportText } from '@/lib/employer/survey-exports'
import type { RuleSet } from '@/lib/employer/survey-instrument'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORMATS = new Set(['massdep', 'cambridge', 'boston', 'emissions'])

/**
 * One filing summary for a survey as totals (see survey-export-server). The
 * caller must be on the company's portal team.
 * GET /api/employer/survey/export?survey_id=<uuid>&format=<rule set>
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const surveyId = url.searchParams.get('survey_id')
  const format = url.searchParams.get('format') ?? ''
  if (!surveyId || !/^[0-9a-f-]{36}$/i.test(surveyId) || !FORMATS.has(format)) {
    return Response.json({ error: 'survey_id and format required' }, { status: 400 })
  }
  const built = await buildSurveyExport(surveyId, format as RuleSet)
  if (!built) return Response.json({ error: 'not_found' }, { status: 404 })
  const check = await requirePortalCaller(request, built.survey.group_id)
  if (!check.ok) return check.res
  return Response.json({ doc: built.doc, csv: exportCsv(built.doc), text: exportText(built.doc) })
}
