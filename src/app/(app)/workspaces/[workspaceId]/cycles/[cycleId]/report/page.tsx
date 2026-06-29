'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Badge, Card, CardHeader, CardSection, EmptyState, useToast } from '@/components/ui'
import { useStageGuard } from '@/hooks/useStageGuard'

interface Score {
  id: string
  overall_score: number | null
  e_score: number | null
  s_score: number | null
  g_score: number | null
  ifrs_alignment_score: number | null
  sdg_alignment_score: number | null
  overall_completion_pct: number | null
  indicator_count_total: number | null
  indicator_count_completed: number | null
  calculated_at: string | null
}

interface Report {
  id: string
  report_version: number
  status: string
  storage_path_pdf: string | null
  storage_path_docx: string | null
  generated_at: string | null
  is_locked: boolean
  snapshot_id: string
}

interface CycleData {
  period_start: string
  period_end: string
  status: string
  workspaces: {
    organisations: {
      name: string
      sector: string | null
      country: string
      size_category: string | null
    } | null
  } | null
}

export default function ReportPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const guard = useStageGuard(workspaceId, cycleId, 7)
  const supabase = createClient()
  const { success, error: toastError, info } = useToast()

  const [cycle, setCycle] = useState<CycleData | null>(null)
  const [latestScore, setLatestScore] = useState<Score | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: cycleData } = await supabase
      .from('assessment_cycles')
      .select(`
        period_start, period_end, status,
        workspaces ( organisations ( name, sector, country, size_category ) )
      `)
      .eq('id', cycleId)
      .single()

    const { data: score } = await supabase
      .from('scores')
      .select('id, overall_score, e_score, s_score, g_score, ifrs_alignment_score, sdg_alignment_score, overall_completion_pct, indicator_count_total, indicator_count_completed, calculated_at')
      .eq('cycle_id', cycleId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()

    const { data: existingReports } = await supabase
      .from('reports')
      .select('id, report_version, status, storage_path_pdf, storage_path_docx, generated_at, is_locked, snapshot_id')
      .eq('workspace_id', workspaceId)
      .order('report_version', { ascending: false })

    const snapshotIds = existingReports?.map(r => r.snapshot_id) ?? []
    let cycleReports: Report[] = []
    if (snapshotIds.length > 0) {
      const { data: snapshots } = await supabase
        .from('report_snapshots')
        .select('id')
        .eq('cycle_id', cycleId)
        .in('id', snapshotIds)

      const cycleSnapshotIds = new Set(snapshots?.map(s => s.id) ?? [])
      cycleReports = (existingReports ?? []).filter(r => cycleSnapshotIds.has(r.snapshot_id))
    }

    setCycle(cycleData as unknown as CycleData)
    setLatestScore(score ?? null)
    setReports(cycleReports)
    setLoading(false)
  }, [cycleId, workspaceId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function generateReport() {
    if (!latestScore) {
      toastError('No scores found. Run the scoring engine before generating a report.')
      return
    }

    setGenerating(true)
    info('Generating report snapshot...')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setGenerating(false); return }

    const { data: responses } = await supabase
      .from('responses')
      .select(`
        id, indicator_id, value_number, value_text, value_boolean,
        source_reference, confidence_level, is_not_applicable, na_reason, consultant_note,
        indicators ( label, pillar, data_type, unit )
      `)
      .eq('cycle_id', cycleId)

    const { data: materialityTopics } = await supabase
      .from('materiality_topics')
      .select('*')
      .eq('cycle_id', cycleId)

    const { data: cycleIndicators } = await supabase
      .from('cycle_indicators')
      .select('indicator_id, is_material')
      .eq('cycle_id', cycleId)

    const { data: orgData } = await supabase
      .from('workspaces')
      .select(`organisations ( name, sector, sub_sector, country, size_category, employee_count, annual_turnover_bwp, registration_number )`)
      .eq('id', workspaceId)
      .single()

    const { data: scoringConfig } = await supabase
      .from('scoring_configs')
      .select('*')
      .eq('is_default', true)
      .single()

    const { data: emissionFactors } = await supabase
      .from('emission_factors')
      .select('id, label, factor, unit_denominator, source, category')

    const { data: frameworks } = await supabase
      .from('frameworks')
      .select('code, name, version, effective_date')

    const { data: activeIndicators } = await supabase
      .from('indicators')
      .select('id, label, pillar, materiality_tier, data_type, unit, is_active')
      .eq('is_active', true)

    const snapshotData = {
      cycle: { id: cycleId, period_start: cycle?.period_start, period_end: cycle?.period_end, status: cycle?.status },
      organisation: Array.isArray(orgData?.organisations) ? orgData.organisations[0] : orgData?.organisations,
      scores: latestScore,
      responses: responses ?? [],
      materiality_topics: materialityTopics ?? [],
      cycle_indicators: cycleIndicators ?? [],
      methodology_context: {
        snapshot_schema_version: '2.0',
        captured_at: new Date().toISOString(),
        scoring_config: scoringConfig ?? null,
        emission_factors: emissionFactors ?? [],
        frameworks: frameworks ?? [],
        indicator_library_snapshot: activeIndicators ?? [],
        platform_version: '1.0.0',
        bse_guidance_version: 'August 2024',
        gri_version: '2021',
        ifrs_s1_version: 'June 2023',
        ifrs_s2_version: 'June 2023',
      },
      generated_at: new Date().toISOString(),
    }

    const res = await fetch('/api/reports/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cycleId,
        workspaceId,
        snapshotData: JSON.parse(JSON.stringify(snapshotData)),
        scoreId: latestScore.id,
        userId: user.id,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      toastError(err.error ?? 'Failed to create report.')
      setGenerating(false)
      return
    }

    const result = await res.json()

    const { data: newReport } = await supabase
      .from('reports')
      .select('id, report_version, status, storage_path_pdf, storage_path_docx, generated_at, is_locked, snapshot_id')
      .eq('id', result.report_id)
      .single()

    if (newReport) {
      setReports((prev) => [newReport as Report, ...prev])
    }

    setGenerating(false)
    success(`Report v${result.version} generated successfully.`)
  }

  async function downloadReport(report: Report) {
    info('Generating Word document...')
    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        toastError(err.error ?? 'Failed to generate report.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ESG_Report_v${report.report_version}.docx`
      a.click()
      URL.revokeObjectURL(url)
      success('Word report downloaded.')
    } catch {
      toastError('Failed to generate report.')
    }
  }

  async function downloadExcel(report: Report) {
    info('Generating Excel workbook...')
    try {
      const res = await fetch('/api/reports/excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id }),
      })
      if (!res.ok) {
        const err = await res.json()
        toastError(err.error ?? 'Failed to generate Excel report.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ESG_Data_v${report.report_version}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      success('Excel workbook downloaded.')
    } catch {
      toastError('Failed to generate Excel report.')
    }
  }

  if (guard.checking || !guard.allowed) return null

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <Link href={`/workspaces/${workspaceId}/cycles/${cycleId}`} className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← Back to cycle
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Report</h1>
            <p className="text-sm text-gray-500 mt-1">
              Generate and download the ESG assessment report for client delivery.
            </p>
          </div>
          <Button loading={generating} disabled={!latestScore} onClick={generateReport}>
            + Generate report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 h-40 animate-pulse" />
          <div className="bg-white rounded-xl border border-gray-200 h-32 animate-pulse" />
        </div>
      ) : (
        <div className="space-y-6">
          {latestScore ? (
            <Card>
              <CardHeader title="Current scores — basis for report" />
              <CardSection>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {[
                    { label: 'Overall ESG', value: latestScore.overall_score, color: 'text-gray-900' },
                    { label: 'IFRS alignment', value: latestScore.ifrs_alignment_score, color: 'text-purple-700' },
                    { label: 'SDG alignment', value: latestScore.sdg_alignment_score, color: 'text-amber-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className={`text-3xl font-bold ${color}`}>{value?.toFixed(1) ?? '—'}</p>
                      <p className="text-xs text-gray-500 mt-1">{label}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
                  {[
                    { label: 'Environmental', value: latestScore.e_score, color: 'bg-green-500' },
                    { label: 'Social', value: latestScore.s_score, color: 'bg-sky-500' },
                    { label: 'Governance', value: latestScore.g_score, color: 'bg-purple-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-medium text-gray-900">{value?.toFixed(1) ?? '—'}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${value ?? 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {latestScore.indicator_count_completed ?? 0} of {latestScore.indicator_count_total ?? 0} indicators completed
                  ({latestScore.overall_completion_pct?.toFixed(0) ?? 0}%)
                  {latestScore.calculated_at && ` · Scored ${new Date(latestScore.calculated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </p>
              </CardSection>
            </Card>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
              <p className="text-sm font-medium text-amber-800">No scores calculated yet.</p>
              <p className="text-xs text-amber-700 mt-1">
                Complete data collection and run the scoring engine before generating a report.
              </p>
              <Link
                href={`/workspaces/${workspaceId}/cycles/${cycleId}/scoring`}
                className="mt-2 inline-block text-xs font-medium text-amber-700 underline"
              >
                Go to scoring →
              </Link>
            </div>
          )}

          <Card padding="none">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Generated reports</h2>
            </div>

            {reports.length === 0 ? (
              <EmptyState
                title="No reports generated yet"
                description={latestScore ? 'Click Generate report to create the first version.' : 'Run scoring first, then generate a report.'}
                action={
                  latestScore ? (
                    <Button size="sm" loading={generating} onClick={generateReport}>
                      Generate first report
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Version', 'Status', 'Generated', 'Download'].map((h) => (
                      <th key={h} className={`px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide ${h === 'Download' ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">v{report.report_version}</span>
                          {report.is_locked && <Badge variant="purple">Final</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={report.status === 'final' ? 'green' : 'gray'}>
                          {report.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        {report.generated_at
                          ? new Date(report.generated_at).toLocaleDateString('en-GB', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="secondary" size="sm" onClick={() => downloadReport(report)}>
                            Word
                          </Button>
                          <Button variant="secondary" size="sm" onClick={() => downloadExcel(report)}>
                            Excel
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div className="bg-gray-50 border border-gray-100 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-500 mb-1">Report format</p>
            <p className="text-xs text-gray-500">
              Word reports download as branded .docx files covering all IFRS S1/S2, GRI, BSE, and SDG
              disclosures with management placeholder comments. Excel workbooks contain 7 sheets
              including a dashboard, materiality matrix, indicator data, IFRS status tracker, targets,
              GRI index, and document register.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}