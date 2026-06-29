import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Badge, Card } from '@/components/ui'

interface Props {
  params: Promise<{ workspaceId: string; cycleId: string }>
}

const cycleStatusVariant: Record<string, 'gray' | 'sky' | 'amber' | 'green' | 'purple'> = {
  draft: 'gray',
  in_progress: 'sky',
  submitted: 'amber',
  reviewed: 'green',
  locked: 'purple',
}

const stages = [
  {
    step: 1,
    label: 'Materiality assessment',
    description: 'Identify and score material topics by impact and financial significance.',
    href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/materiality`,
  },
  {
    step: 2,
    label: 'IFRS S1/S2 disclosures',
    description: 'Complete qualitative narrative disclosures required under IFRS S1 and S2.',
    href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/ifrs`,
  },
  {
    step: 3,
    label: 'Indicator selection',
    description: 'Confirm which ESG indicators are in scope based on materiality output.',
    href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/indicators`,
  },
  {
    step: 4,
    label: 'Data collection',
    description: 'Enter responses for each indicator with sources and confidence levels.',
    href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/assessment`,
  },
  {
    step: 5,
    label: 'Document vault',
    description: 'Upload and link evidence documents to indicators and responses.',
    href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/documents`,
  },
  {
    step: 6,
    label: 'Scoring',
    description: 'Run the scoring engine and review E, S, G pillar scores.',
    href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/scoring`,
  },
  {
    step: 7,
    label: 'Report',
    description: 'Generate the ESG report as Word document for client delivery.',
    href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/report`,
  },
  {
  step: 8,
  label: 'Finance readiness',
  description: 'Check ESG readiness for CEDA, BDC, and NDB loan applications.',
  href: (wId: string, cId: string) => `/workspaces/${wId}/cycles/${cId}/finance`,
},
]

export default async function CycleDetailPage({ params }: Props) {
  const { workspaceId, cycleId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }
  const { data: cycle } = await supabase
    .from('assessment_cycles')
    .select(`
      id, period_start, period_end, status, created_at, locked_at, workspace_id,
      workspaces ( organisations ( name, sector ) )
    `)
    .eq('id', cycleId)
    .eq('workspace_id', workspaceId)
    .single()

  if (!cycle) {
  return (
    <div className="p-8">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
        <p className="text-sm font-medium text-amber-800">Unable to load cycle.</p>
        <p className="text-xs text-amber-700 mt-1">The assessment cycle could not be found or you do not have access. Try refreshing the page.</p>
        <a href="/workspaces" className="mt-2 inline-block text-xs font-medium text-amber-700 underline">← Back to workspaces</a>
      </div>
    </div>
  )
}

  const ws = Array.isArray(cycle.workspaces) ? cycle.workspaces[0] : cycle.workspaces
  const org = ws
    ? (Array.isArray(ws.organisations) ? ws.organisations[0] : ws.organisations)
    : null

  const { count: materialityCount } = await supabase
    .from('materiality_topics')
    .select('*', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)

  const { count: indicatorCount } = await supabase
    .from('cycle_indicators')
    .select('*', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)

  const { count: responseCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)

  const { count: documentCount } = await supabase
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)

  const { data: score } = await supabase
    .from('scores')
    .select('overall_score, e_score, s_score, g_score, overall_completion_pct')
    .eq('cycle_id', cycleId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single()

  const stats = [
    { label: 'Material topics', value: materialityCount ?? 0 },
    { label: 'Indicators in scope', value: indicatorCount ?? 0 },
    { label: 'Responses entered', value: responseCount ?? 0 },
    { label: 'Documents uploaded', value: documentCount ?? 0 },
  ]

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspaceId}`}
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back to workspace
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-semibold text-gray-900">
                {org?.name ?? 'Assessment cycle'}
              </h1>
              <Badge variant={cycleStatusVariant[cycle.status] ?? 'gray'}>
                {cycle.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-gray-500">
              {new Date(cycle.period_start).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
              {' → '}
              {new Date(cycle.period_end).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Progress summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value }) => (
          <Card key={label}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1.5">{value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Stage navigation */}
        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Assessment stages</h2>
          <div className="space-y-3">
            {stages.map((stage) => (
              <Link
                key={stage.step}
                href={stage.href(workspaceId, cycleId)}
                className="flex items-center gap-4 bg-white rounded-xl border border-gray-200
                           px-5 py-4 hover:border-sky-200 hover:bg-sky-50 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-sky-100
                                flex items-center justify-center flex-shrink-0 transition-colors">
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-sky-700">
                    {stage.step}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 group-hover:text-sky-700">
                    {stage.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{stage.description}</p>
                </div>
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-sky-400 flex-shrink-0"
                  fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Score summary */}
        <div className="col-span-1">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">ESG scores</h2>
          <Card>
            {!score ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">No scores yet.</p>
                <p className="text-xs text-gray-400 mt-1">
                  Complete data collection and run the scoring engine.
                </p>
                <Link
                  href={`/workspaces/${workspaceId}/cycles/${cycleId}/scoring`}
                  className="mt-3 inline-block text-xs font-medium text-sky-600 hover:text-sky-700"
                >
                  Go to scoring →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Overall ESG score</p>
                  <p className="text-3xl font-semibold text-gray-900">
                    {score.overall_score?.toFixed(1) ?? '—'}
                    <span className="text-sm font-normal text-gray-400 ml-1">/ 100</span>
                  </p>
                  {score.overall_completion_pct != null && (
                    <p className="text-xs text-gray-400 mt-1">
                      {score.overall_completion_pct.toFixed(0)}% complete
                    </p>
                  )}
                </div>
                <div className="border-t border-gray-100 pt-4 space-y-2.5">
                  {[
                    { label: 'Environmental', value: score.e_score, color: 'bg-green-500' },
                    { label: 'Social', value: score.s_score, color: 'bg-sky-500' },
                    { label: 'Governance', value: score.g_score, color: 'bg-purple-500' },
                  ].map(({ label, value, color }) => (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-xs font-medium text-gray-900">{value?.toFixed(1) ?? '—'}</p>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full`} style={{ width: `${value ?? 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}