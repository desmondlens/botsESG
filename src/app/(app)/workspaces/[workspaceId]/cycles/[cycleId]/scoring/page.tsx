'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Badge, Card, CardHeader, CardSection, EmptyState, useToast } from '@/components/ui'
import { useStageGuard } from '@/hooks/useStageGuard'

interface ScoringConfig {
  id: string
  config_name: string
  e_weight: number
  s_weight: number
  g_weight: number
  penalty_confidence_low: number
  penalty_confidence_estimated: number
  penalty_no_source: number
  material_weight_multiplier: number
  missing_indicator_score: number
}

interface ScoreComponent {
  indicator_id: string
  indicator_label: string
  pillar: 'E' | 'S' | 'G'
  is_material: boolean
  base_score: number
  confidence_penalty: number
  source_penalty: number
  adjusted_score: number
  weight_multiplier: number
  weighted_score: number
  score_reason: string
}

interface Score {
  id: string
  e_score: number | null
  s_score: number | null
  g_score: number | null
  overall_score: number | null
  ifrs_alignment_score: number | null
  sdg_alignment_score: number | null
  e_completion_pct: number | null
  s_completion_pct: number | null
  g_completion_pct: number | null
  overall_completion_pct: number | null
  indicator_count_total: number | null
  indicator_count_completed: number | null
  indicator_count_material: number | null
  indicator_count_material_completed: number | null
  calculated_at: string | null
  calculation_notes: {
    components: ScoreComponent[]
    config: ScoringConfig
  } | null
}

const PILLAR_COLORS = {
  E: { bar: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50', badge: 'green' as const },
  S: { bar: 'bg-sky-500', text: 'text-sky-700', light: 'bg-sky-50', badge: 'sky' as const },
  G: { bar: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50', badge: 'purple' as const },
}

function ScoreGauge({ value, label, color }: { value: number | null; label: string; color: string }) {
  const v = value ?? 0
  return (
    <div className="text-center">
      <div className="relative w-24 h-24 mx-auto mb-2">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
          <circle
            cx="18" cy="18" r="15.9" fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={`${v} 100`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-gray-900">{v.toFixed(0)}</span>
        </div>
      </div>
      <p className="text-xs font-medium text-gray-600">{label}</p>
    </div>
  )
}

export default function ScoringPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const guard = useStageGuard(workspaceId, cycleId, 6)
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [score, setScore] = useState<Score | null>(null)
  const [config, setConfig] = useState<ScoringConfig | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedPillar, setExpandedPillar] = useState<'E' | 'S' | 'G' | null>(null)

  const fetchData = useCallback(async () => {
    const { data: configs } = await supabase
      .from('scoring_configs')
      .select('*')
      .eq('is_default', true)
      .limit(1)
      .single()

    setConfig(configs ?? null)

    const { data: latestScore } = await supabase
      .from('scores')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .single()

    setScore(latestScore as unknown as Score ?? null)
    setLoading(false)
  }, [cycleId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function calculateScores() {
    if (!config) return
    setCalculating(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCalculating(false); return }

    const { data: ci } = await supabase
      .from('cycle_indicators')
      .select(`indicator_id, is_material, indicators ( id, pillar, label, data_type )`)
      .eq('cycle_id', cycleId)
      .neq('inclusion_source', 'manual_exclude')

    const { data: responses } = await supabase
      .from('responses')
      .select('indicator_id, value_number, value_text, value_boolean, confidence_level, source_reference, is_not_applicable')
      .eq('cycle_id', cycleId)

    const responseMap = new Map(responses?.map((r) => [r.indicator_id, r]) ?? [])
    const components: ScoreComponent[] = []

    for (const row of ci ?? []) {
      const ind = Array.isArray(row.indicators) ? row.indicators[0] : row.indicators
      if (!ind) continue

      const response = responseMap.get(row.indicator_id)
      const pillar = ind.pillar as 'E' | 'S' | 'G'

      let base_score = 0
      let score_reason = 'No response entered'

      if (response) {
        if (response.is_not_applicable) {
          base_score = 100
          score_reason = 'Marked as not applicable'
        } else if (
          response.value_number !== null ||
          (response.value_text !== null && response.value_text !== '') ||
          response.value_boolean !== null
        ) {
          base_score = 100
          score_reason = 'Response provided'
        } else {
          score_reason = 'Response record exists but no value entered'
        }
      }

      let confidence_penalty = 0
      if (base_score > 0 && !response?.is_not_applicable) {
        if (response?.confidence_level === 'low') {
          confidence_penalty = config.penalty_confidence_low * 100
          score_reason += ` (−${confidence_penalty} low confidence)`
        } else if (response?.confidence_level === 'estimated') {
          confidence_penalty = config.penalty_confidence_estimated * 100
          score_reason += ` (−${confidence_penalty} estimated data)`
        }
      }

      let source_penalty = 0
      if (base_score > 0 && !response?.is_not_applicable && !response?.source_reference) {
        source_penalty = config.penalty_no_source * 100
        score_reason += ` (−${source_penalty} no source)`
      }

      const adjusted_score = Math.max(0, base_score - confidence_penalty - source_penalty)
      const weight_multiplier = row.is_material ? config.material_weight_multiplier : 1
      const weighted_score = adjusted_score * weight_multiplier

      components.push({
        indicator_id: row.indicator_id,
        indicator_label: ind.label,
        pillar,
        is_material: row.is_material,
        base_score,
        confidence_penalty,
        source_penalty,
        adjusted_score,
        weight_multiplier,
        weighted_score,
        score_reason,
      })
    }

    function pillarScore(pillar: 'E' | 'S' | 'G') {
      const pc = components.filter((c) => c.pillar === pillar)
      if (pc.length === 0) return { score: null, completion: null, total: 0, completed: 0, material: 0, material_completed: 0 }
      const total_weight = pc.reduce((sum, c) => sum + c.weight_multiplier, 0)
      const weighted_sum = pc.reduce((sum, c) => sum + c.weighted_score, 0)
      const score = total_weight > 0 ? weighted_sum / total_weight : 0
      const completed = pc.filter((c) => c.base_score > 0).length
      const material = pc.filter((c) => c.is_material).length
      const material_completed = pc.filter((c) => c.is_material && c.base_score > 0).length
      const completion = pc.length > 0 ? (completed / pc.length) * 100 : 0
      return { score, completion, total: pc.length, completed, material, material_completed }
    }

    const e = pillarScore('E')
    const s = pillarScore('S')
    const g = pillarScore('G')

    const overall_score =
      (e.score ?? 0) * config.e_weight +
      (s.score ?? 0) * config.s_weight +
      (g.score ?? 0) * config.g_weight

    const total = components.length
    const completed = components.filter((c) => c.base_score > 0).length
    const overall_completion = total > 0 ? (completed / total) * 100 : 0

    const { data: ifrsFrameworks } = await supabase.from('frameworks').select('id').in('code', ['IFRS_S1', 'IFRS_S2'])
    const { data: ifrsRefs } = await supabase
      .from('indicator_framework_refs')
      .select('indicator_id')
      .in('framework_id', ifrsFrameworks?.map(f => f.id) ?? [])

    const ifrsIndicatorIds = new Set(ifrsRefs?.map((r) => r.indicator_id) ?? [])
    const ifrsComponents = components.filter((c) => ifrsIndicatorIds.has(c.indicator_id))
    const ifrs_score = ifrsComponents.length > 0
      ? (ifrsComponents.filter((c) => c.base_score > 0).length / ifrsComponents.length) * 100
      : null

    const { data: sdgTags } = await supabase
      .from('indicator_sdg_tags')
      .select('indicator_id, sdg_number')
      .in('indicator_id', components.map((c) => c.indicator_id))

    const sdgsCovered = new Set<number>()
    const sdgsTotal = new Set<number>()
    for (const tag of sdgTags ?? []) {
      sdgsTotal.add(tag.sdg_number)
      const comp = components.find((c) => c.indicator_id === tag.indicator_id)
      if (comp && comp.base_score > 0) sdgsCovered.add(tag.sdg_number)
    }
    const sdg_score = sdgsTotal.size > 0 ? (sdgsCovered.size / sdgsTotal.size) * 100 : null

    const { data: newScore, error: scoreError } = await supabase
      .from('scores')
      .insert({
        cycle_id: cycleId,
        scoring_config_id: config.id,
        e_score: e.score,
        s_score: s.score,
        g_score: g.score,
        overall_score,
        ifrs_alignment_score: ifrs_score,
        sdg_alignment_score: sdg_score,
        e_completion_pct: e.completion,
        s_completion_pct: s.completion,
        g_completion_pct: g.completion,
        overall_completion_pct: overall_completion,
        indicator_count_total: total,
        indicator_count_completed: completed,
        indicator_count_material: e.material + s.material + g.material,
        indicator_count_material_completed: e.material_completed + s.material_completed + g.material_completed,
        calculated_by: user.id,
        calculation_notes: JSON.parse(JSON.stringify({ components, config })),
      })
      .select('*')
      .single()

    if (scoreError) {
      toastError('Failed to save scores. Please try again.')
    } else if (newScore) {
      setScore(newScore as unknown as Score)
      success(`Scores calculated. Overall ESG: ${overall_score.toFixed(1)} / 100`)
    }

    setCalculating(false)
  }

  const components = score?.calculation_notes?.components ?? []
  const pillarComponents = (pillar: 'E' | 'S' | 'G') => components.filter((c) => c.pillar === pillar)
if (guard.checking || !guard.allowed) return null

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <Link href={`/workspaces/${workspaceId}/cycles/${cycleId}`} className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← Back to cycle
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Scoring</h1>
            <p className="text-sm text-gray-500 mt-1">
              Calculate ESG scores based on collected responses. Scores are transparent and fully explainable.
            </p>
          </div>
          <Button loading={calculating} disabled={!config} onClick={calculateScores}>
            {score ? 'Recalculate scores' : 'Calculate scores'}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 h-64 animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 h-20 animate-pulse" />
            ))}
          </div>
        </div>
      ) : !score ? (
        <Card>
          <EmptyState
            title="No scores calculated yet"
            description="Complete data collection then click Calculate scores."
            action={
              <Button loading={calculating} disabled={!config} onClick={calculateScores}>
                Calculate scores
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Score overview */}
          <Card>
            <CardHeader
              title="Score overview"
              action={
                <span className="text-xs text-gray-400">
                  {score.calculated_at
                    ? `Calculated ${new Date(score.calculated_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}`
                    : ''}
                </span>
              }
            />
            <CardSection>
              <div className="grid grid-cols-5 gap-4 mb-6">
                <div className="col-span-2 flex items-center justify-center border-r border-gray-100">
                  <div className="text-center">
                    <p className="text-5xl font-bold text-gray-900 mb-1">
                      {score.overall_score?.toFixed(1) ?? '—'}
                    </p>
                    <p className="text-sm text-gray-500">Overall ESG score</p>
                    <p className="text-xs text-gray-400 mt-1">out of 100</p>
                  </div>
                </div>
                <ScoreGauge value={score.e_score} label="Environmental" color="#22c55e" />
                <ScoreGauge value={score.s_score} label="Social" color="#0ea5e9" />
                <ScoreGauge value={score.g_score} label="Governance" color="#a855f7" />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-5">
                <div className="bg-purple-50 rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-purple-700 mb-1">IFRS S1/S2 alignment</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {score.ifrs_alignment_score?.toFixed(1) ?? '—'}
                    <span className="text-sm font-normal text-purple-500 ml-1">/ 100</span>
                  </p>
                  <p className="text-xs text-purple-600 mt-0.5">Financial materiality readiness</p>
                </div>
                <div className="bg-amber-50 rounded-lg px-4 py-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">SDG alignment</p>
                  <p className="text-2xl font-bold text-amber-900">
                    {score.sdg_alignment_score?.toFixed(1) ?? '—'}
                    <span className="text-sm font-normal text-amber-500 ml-1">/ 100</span>
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">SDG impact coverage breadth</p>
                </div>
              </div>
            </CardSection>
          </Card>

          {/* Completion stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total indicators', value: score.indicator_count_total },
              { label: 'Completed', value: score.indicator_count_completed },
              { label: 'Material indicators', value: score.indicator_count_material },
              { label: 'Material completed', value: score.indicator_count_material_completed },
            ].map(({ label, value }) => (
              <Card key={label} padding="sm">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{value ?? '—'}</p>
              </Card>
            ))}
          </div>

          {/* Pillar breakdowns */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-900">Score breakdown by pillar</h2>
            {(['E', 'S', 'G'] as const).map((pillar) => {
              const colors = PILLAR_COLORS[pillar]
              const pillarLabel = { E: 'Environmental', S: 'Social', G: 'Governance' }[pillar]
              const pillarScore = { E: score.e_score, S: score.s_score, G: score.g_score }[pillar]
              const completion = { E: score.e_completion_pct, S: score.s_completion_pct, G: score.g_completion_pct }[pillar]
              const pc = pillarComponents(pillar)
              const isExpanded = expandedPillar === pillar

              return (
                <div key={pillar} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div
                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedPillar(isExpanded ? null : pillar)}
                  >
                    <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <p className={`text-sm font-semibold ${colors.text}`}>{pillarLabel}</p>
                        <p className="text-sm font-bold text-gray-900">{pillarScore?.toFixed(1) ?? '—'} / 100</p>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${colors.bar} rounded-full`} style={{ width: `${pillarScore ?? 0}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {completion?.toFixed(0) ?? 0}% complete · {pc.filter((c) => c.base_score > 0).length} of {pc.length} indicators answered
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>

                  {isExpanded && pc.length > 0 && (
                    <div className="border-t border-gray-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="text-left px-5 py-2.5 font-medium text-gray-500">Indicator</th>
                            <th className="text-right px-3 py-2.5 font-medium text-gray-500">Base</th>
                            <th className="text-right px-3 py-2.5 font-medium text-gray-500">Penalties</th>
                            <th className="text-right px-3 py-2.5 font-medium text-gray-500">Adjusted</th>
                            <th className="text-right px-3 py-2.5 font-medium text-gray-500">Weight</th>
                            <th className="text-right px-5 py-2.5 font-medium text-gray-500">Weighted</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {pc.map((c) => (
                            <tr key={c.indicator_id} className="hover:bg-gray-50">
                              <td className="px-5 py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-gray-900">{c.indicator_label}</span>
                                  {c.is_material && <Badge variant="green">material</Badge>}
                                </div>
                                <p className="text-gray-400 mt-0.5">{c.score_reason}</p>
                              </td>
                              <td className="text-right px-3 py-2.5 text-gray-700">{c.base_score}</td>
                              <td className="text-right px-3 py-2.5">
                                {c.confidence_penalty + c.source_penalty > 0 ? (
                                  <Badge variant="red">−{c.confidence_penalty + c.source_penalty}</Badge>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="text-right px-3 py-2.5 font-medium text-gray-900">
                                {c.adjusted_score.toFixed(0)}
                              </td>
                              <td className="text-right px-3 py-2.5 text-gray-500">×{c.weight_multiplier}</td>
                              <td className="text-right px-5 py-2.5 font-semibold text-gray-900">
                                {c.weighted_score.toFixed(0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Scoring config */}
          {config && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 px-5 py-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">Scoring configuration: {config.config_name}</p>
              <div className="grid grid-cols-4 gap-3 text-xs text-gray-500">
                <div>E weight: <span className="font-medium text-gray-700">{(config.e_weight * 100).toFixed(0)}%</span></div>
                <div>S weight: <span className="font-medium text-gray-700">{(config.s_weight * 100).toFixed(0)}%</span></div>
                <div>G weight: <span className="font-medium text-gray-700">{(config.g_weight * 100).toFixed(0)}%</span></div>
                <div>Material multiplier: <span className="font-medium text-gray-700">×{config.material_weight_multiplier}</span></div>
                <div>Low confidence: <span className="font-medium text-gray-700">−{(config.penalty_confidence_low * 100).toFixed(0)}</span></div>
                <div>Estimated data: <span className="font-medium text-gray-700">−{(config.penalty_confidence_estimated * 100).toFixed(0)}</span></div>
                <div>No source: <span className="font-medium text-gray-700">−{(config.penalty_no_source * 100).toFixed(0)}</span></div>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button
              onClick={() => window.location.href = `/workspaces/${workspaceId}/cycles/${cycleId}/report`}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              }
              iconPosition="right"
            >
              Continue to report
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}