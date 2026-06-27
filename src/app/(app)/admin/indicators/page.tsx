'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge, Card, EmptyState, useToast } from '@/components/ui'

interface Indicator {
  id: string
  pillar: 'E' | 'S' | 'G'
  label: string
  description: string | null
  data_type: 'quantitative' | 'qualitative' | 'binary'
  unit: string | null
  materiality_tier: 'core' | 'supplementary'
  sector_relevance: string[] | null
  is_active: boolean
  version: number
  created_at: string | null
  indicator_framework_refs: {
    framework_code: string
    disclosure_title: string | null
    is_primary: boolean | null
  }[]
}

const PILLAR_COLORS = {
  E: { dot: 'bg-green-500', text: 'text-green-700', badge: 'green' as const },
  S: { dot: 'bg-sky-500', text: 'text-sky-700', badge: 'sky' as const },
  G: { dot: 'bg-purple-500', text: 'text-purple-700', badge: 'purple' as const },
}

const PILLAR_LABELS = { E: 'Environmental', S: 'Social', G: 'Governance' }

export default function AdminIndicatorsPage() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'E' | 'S' | 'G'>('all')
  const [tierFilter, setTierFilter] = useState<'all' | 'core' | 'supplementary'>('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  const fetchIndicators = useCallback(async () => {
    const { data } = await supabase
      .from('indicators')
      .select(`
        id, pillar, label, description, data_type, unit,
        materiality_tier, sector_relevance, is_active, version, created_at,
        indicator_framework_refs ( framework_code, disclosure_title, is_primary )
      `)
      .order('pillar', { ascending: true })
      .order('materiality_tier', { ascending: true })
      .order('label', { ascending: true })

    setIndicators((data as Indicator[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchIndicators()
  }, [fetchIndicators])

  async function toggleActive(indicator: Indicator) {
    setToggling(indicator.id)
    const { error } = await supabase
      .from('indicators')
      .update({ is_active: !indicator.is_active })
      .eq('id', indicator.id)

    if (error) {
      toastError('Failed to update indicator.')
      setToggling(null)
      return
    }

    setIndicators((prev) => prev.map((i) =>
      i.id === indicator.id ? { ...i, is_active: !i.is_active } : i
    ))
    success(`"${indicator.label}" ${indicator.is_active ? 'deactivated' : 'activated'}.`)
    setToggling(null)
  }

  const filtered = indicators.filter((i) => {
    if (filter !== 'all' && i.pillar !== filter) return false
    if (tierFilter !== 'all' && i.materiality_tier !== tierFilter) return false
    if (activeFilter === 'active' && !i.is_active) return false
    if (activeFilter === 'inactive' && i.is_active) return false
    return true
  })

  const counts = {
    total: indicators.length,
    active: indicators.filter((i) => i.is_active).length,
    E: indicators.filter((i) => i.pillar === 'E').length,
    S: indicators.filter((i) => i.pillar === 'S').length,
    G: indicators.filter((i) => i.pillar === 'G').length,
    core: indicators.filter((i) => i.materiality_tier === 'core').length,
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Indicator library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage the ESG indicator library. Deactivated indicators are excluded from new assessment cycles.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Total', value: counts.total },
          { label: 'Active', value: counts.active },
          { label: 'Environmental', value: counts.E },
          { label: 'Social', value: counts.S },
          { label: 'Governance', value: counts.G },
        ].map(({ label, value }) => (
          <Card key={label} padding="sm">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-xl font-semibold text-gray-900 mt-0.5">{value}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', 'E', 'S', 'G'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilter(p)}
              className={`px-3 py-1.5 transition-colors ${
                filter === p ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'all' ? 'All pillars' : PILLAR_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', 'core', 'supplementary'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 transition-colors capitalize ${
                tierFilter === t ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'all' ? 'All tiers' : t}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', 'active', 'inactive'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActiveFilter(a)}
              className={`px-3 py-1.5 transition-colors capitalize ${
                activeFilter === a ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {a === 'all' ? 'All status' : a}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} indicator{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Indicator list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-14 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState title="No indicators match your filters" />
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((indicator) => {
            const colors = PILLAR_COLORS[indicator.pillar]
            const isExpanded = expandedId === indicator.id
            const primaryRef = indicator.indicator_framework_refs.find((r) => r.is_primary)

            return (
              <div
                key={indicator.id}
                className={`bg-white rounded-xl border transition-colors ${
                  indicator.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                }`}
              >
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : indicator.id)}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{indicator.label}</p>
                      <Badge variant={colors.badge}>{indicator.pillar}</Badge>
                      {indicator.materiality_tier === 'core' && (
                        <Badge variant="gray">Core</Badge>
                      )}
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
                      {!indicator.is_active && <Badge variant="red">Inactive</Badge>}
                    </div>
                  </div>

                  {/* Primary GRI ref */}
                  {primaryRef && (
                    <span className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0">
                      {primaryRef.framework_code}
                    </span>
                  )}

                  {/* Toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleActive(indicator) }}
                    disabled={toggling === indicator.id}
                    className={`text-xs font-medium flex-shrink-0 transition-colors ${
                      indicator.is_active
                        ? 'text-red-400 hover:text-red-600'
                        : 'text-green-600 hover:text-green-700'
                    } disabled:opacity-50`}
                  >
                    {toggling === indicator.id ? '...' : indicator.is_active ? 'Deactivate' : 'Activate'}
                  </button>

                  <svg
                    className={`w-4 h-4 text-gray-300 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50">
                    {indicator.description && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                        <p className="text-xs text-gray-700">{indicator.description}</p>
                      </div>
                    )}
                    {indicator.indicator_framework_refs.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Framework references</p>
                        <div className="space-y-1">
                          {indicator.indicator_framework_refs.map((ref) => (
                            <div key={ref.framework_code} className="flex items-start gap-2">
                              <span className="text-xs font-mono px-1.5 py-0.5 bg-white border border-gray-200 text-gray-600 rounded flex-shrink-0">
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
                            <Badge key={s} variant="gray">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-gray-400">Version {indicator.version}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}