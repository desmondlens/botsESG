'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Badge, Card, EmptyState, useToast } from '@/components/ui'
import { useStageGuard } from '@/hooks/useStageGuard'
interface Indicator {
  id: string
  pillar: 'E' | 'S' | 'G'
  label: string
  description: string | null
  guidance: string | null
  data_type: 'quantitative' | 'qualitative' | 'binary'
  unit: string | null
  materiality_tier: 'core' | 'supplementary'
  sector_relevance: string[] | null
  framework_refs: { framework_code: string; disclosure_title: string | null }[]
}

interface CycleIndicator {
  indicator_id: string
  is_material: boolean
  inclusion_source: string
}

const PILLAR_LABELS = { E: 'Environmental', S: 'Social', G: 'Governance' }
const PILLAR_COLORS = {
  E: { dot: 'bg-green-500', text: 'text-green-700', border: 'border-green-200', bg: 'bg-green-50', badge: 'green' as const },
  S: { dot: 'bg-sky-500', text: 'text-sky-700', border: 'border-sky-200', bg: 'bg-sky-50', badge: 'sky' as const },
  G: { dot: 'bg-purple-500', text: 'text-purple-700', border: 'border-purple-200', bg: 'bg-purple-50', badge: 'purple' as const },
}

export default function IndicatorSelectionPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const guard = useStageGuard(workspaceId, cycleId, 3)
  const router = useRouter()
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [cycleIndicators, setCycleIndicators] = useState<CycleIndicator[]>([])
  const [orgSector, setOrgSector] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'E' | 'S' | 'G'>('all')
  const [showCoreOnly, setShowCoreOnly] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('organisations(sector)')
      .eq('id', workspaceId)
      .single()

    const org = ws?.organisations
    const sector = Array.isArray(org) ? org[0]?.sector : (org as { sector?: string } | null)?.sector
    setOrgSector(sector ?? null)

    const { data: inds } = await supabase
      .from('indicators')
      .select(`
        id, pillar, label, description, guidance,
        data_type, unit, materiality_tier, sector_relevance,
        indicator_framework_refs ( framework_code, disclosure_title )
      `)
      .eq('is_active', true)
      .order('pillar', { ascending: true })
      .order('materiality_tier', { ascending: true })

    const { data: ci } = await supabase
      .from('cycle_indicators')
      .select('indicator_id, is_material, inclusion_source')
      .eq('cycle_id', cycleId)

    setIndicators(
      (inds?.map((i) => ({ ...i, framework_refs: i.indicator_framework_refs ?? [] })) as Indicator[]) ?? []
    )
    setCycleIndicators(ci ?? [])
    setLoading(false)
  }, [workspaceId, cycleId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function isSelected(indicatorId: string) {
    return cycleIndicators.some(
      (ci) => ci.indicator_id === indicatorId && ci.inclusion_source !== 'manual_exclude'
    )
  }

  function isMaterial(indicatorId: string) {
    return cycleIndicators.some((ci) => ci.indicator_id === indicatorId && ci.is_material)
  }

  async function toggleIndicator(indicator: Indicator) {
    const existing = cycleIndicators.find((ci) => ci.indicator_id === indicator.id)
    const currently_selected = isSelected(indicator.id)

    if (currently_selected) {
      await supabase
        .from('cycle_indicators')
        .update({ inclusion_source: 'manual_exclude' })
        .eq('cycle_id', cycleId)
        .eq('indicator_id', indicator.id)

      setCycleIndicators((prev) =>
        prev.map((ci) =>
          ci.indicator_id === indicator.id ? { ...ci, inclusion_source: 'manual_exclude' } : ci
        )
      )
    } else {
      const { data } = await supabase
        .from('cycle_indicators')
        .upsert({
          cycle_id: cycleId,
          indicator_id: indicator.id,
          is_material: false,
          inclusion_source: 'manual_include',
        })
        .select('indicator_id, is_material, inclusion_source')
        .single()

      if (data) {
        setCycleIndicators((prev) => {
          const filtered = prev.filter((ci) => ci.indicator_id !== indicator.id)
          return [...filtered, data]
        })
      }
    }
  }

  async function selectAllCore() {
    setSaving(true)
    const coreIndicators = indicators.filter((i) => i.materiality_tier === 'core')

    const upserts = coreIndicators.map((i) => ({
      cycle_id: cycleId,
      indicator_id: i.id,
      is_material: false,
      inclusion_source: 'manual_include' as const,
    }))

    const { data, error } = await supabase
      .from('cycle_indicators')
      .upsert(upserts)
      .select('indicator_id, is_material, inclusion_source')

    if (error) {
      toastError('Failed to select core indicators.')
      setSaving(false)
      return
    }

    if (data) {
      setCycleIndicators((prev) => {
        const existingIds = data.map((d) => d.indicator_id)
        const filtered = prev.filter((ci) => !existingIds.includes(ci.indicator_id))
        return [...filtered, ...data]
      })
    }

    success(`${coreIndicators.length} core indicators selected.`)
    setSaving(false)
  }

  const filteredIndicators = indicators.filter((i) => {
    if (filter !== 'all' && i.pillar !== filter) return false
    if (showCoreOnly && i.materiality_tier !== 'core') return false
    return true
  })

  const selectedCount = cycleIndicators.filter((ci) => ci.inclusion_source !== 'manual_exclude').length

  const byPillar = {
    E: filteredIndicators.filter((i) => i.pillar === 'E'),
    S: filteredIndicators.filter((i) => i.pillar === 'S'),
    G: filteredIndicators.filter((i) => i.pillar === 'G'),
  }

  const pillarsToShow = filter === 'all' ? (['E', 'S', 'G'] as const) : [filter]
if (guard.checking || !guard.allowed) return null
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <Link href={`/workspaces/${workspaceId}/cycles/${cycleId}`} className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← Back to cycle
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Indicator selection</h1>
            <p className="text-sm text-gray-500 mt-1">
              Select which ESG indicators are in scope for this assessment cycle.
              Core indicators are recommended as a minimum.
            </p>
          </div>
          <Button variant="secondary" loading={saving} onClick={selectAllCore}>
            Select all core
          </Button>
        </div>
      </div>

      {/* Stats + filters */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{selectedCount}</span> of{' '}
          {indicators.length} indicators selected
        </p>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showCoreOnly}
              onChange={(e) => setShowCoreOnly(e.target.checked)}
              className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
            />
            Core only
          </label>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            {(['all', 'E', 'S', 'G'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setFilter(p)}
                className={`px-3 py-1.5 transition-colors ${
                  filter === p ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p === 'all' ? 'All' : PILLAR_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-14 bg-white rounded-xl border border-gray-200 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : indicators.length === 0 ? (
        <Card>
          <EmptyState title="No indicators in library" description="Contact your administrator." />
        </Card>
      ) : (
        <div className="space-y-8">
          {pillarsToShow.map((pillar) => {
            const pillarInds = byPillar[pillar]
            if (pillarInds.length === 0) return null
            const colors = PILLAR_COLORS[pillar]
            const pillarSelected = pillarInds.filter((i) => isSelected(i.id)).length

            return (
              <div key={pillar}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                  <h2 className="text-sm font-semibold text-gray-900">{PILLAR_LABELS[pillar]}</h2>
                  <span className="text-xs text-gray-400">
                    {pillarSelected} / {pillarInds.length} selected
                  </span>
                </div>

                <div className="space-y-2">
                  {pillarInds.map((indicator) => {
                    const selected = isSelected(indicator.id)
                    const material = isMaterial(indicator.id)
                    const isExpanded = expandedId === indicator.id
                    const isCore = indicator.materiality_tier === 'core'

                    return (
                      <div
                        key={indicator.id}
                        className={`rounded-xl border transition-colors ${
                          selected ? `${colors.border} ${colors.bg}` : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleIndicator(indicator)}
                            className="rounded border-gray-300 text-sky-600 focus:ring-sky-500 flex-shrink-0 w-4 h-4"
                          />

                          <div
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : indicator.id)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium ${selected ? colors.text : 'text-gray-900'}`}>
                                {indicator.label}
                              </p>
                              {isCore && <Badge variant="gray">Core</Badge>}
                              {material && <Badge variant="green">Material</Badge>}
                              <Badge
                                variant={
                                  indicator.data_type === 'quantitative' ? 'amber'
                                  : indicator.data_type === 'binary' ? 'purple'
                                  : 'gray'
                                }
                              >
                                {indicator.data_type}
                                {indicator.unit && ` · ${indicator.unit}`}
                              </Badge>
                            </div>
                            {indicator.description && (
                              <p className="text-xs text-gray-400 mt-0.5 truncate">{indicator.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {indicator.framework_refs.slice(0, 2).map((ref) => (
                              <span
                                key={ref.framework_code}
                                className="text-xs px-1.5 py-0.5 bg-white border border-gray-200 text-gray-500 rounded font-mono"
                              >
                                {ref.framework_code}
                              </span>
                            ))}
                          </div>

                          <svg
                            onClick={() => setExpandedId(isExpanded ? null : indicator.id)}
                            className={`w-4 h-4 text-gray-300 cursor-pointer transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-gray-100 px-4 py-4 space-y-3 bg-white bg-opacity-60">
                            {indicator.guidance && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Collection guidance</p>
                                <p className="text-xs text-gray-600">{indicator.guidance}</p>
                              </div>
                            )}
                            {indicator.framework_refs.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Framework references</p>
                                <div className="space-y-1">
                                  {indicator.framework_refs.map((ref) => (
                                    <div key={ref.framework_code} className="flex items-start gap-2">
                                      <span className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded flex-shrink-0">
                                        {ref.framework_code}
                                      </span>
                                      <span className="text-xs text-gray-500">{ref.disclosure_title}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {indicator.sector_relevance && (
                              <div>
                                <p className="text-xs font-medium text-gray-500 mb-1">Sector relevance</p>
                                <div className="flex flex-wrap gap-1">
                                  {indicator.sector_relevance.map((s) => (
                                    <Badge
                                      key={s}
                                      variant={s === orgSector ? 'sky' : 'gray'}
                                    >
                                      {s}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}

          {selectedCount > 0 && (
            <div className="pt-2">
              <Button
                onClick={() => router.push(`/workspaces/${workspaceId}/cycles/${cycleId}/assessment`)}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                }
                iconPosition="right"
              >
                Continue to data collection
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}