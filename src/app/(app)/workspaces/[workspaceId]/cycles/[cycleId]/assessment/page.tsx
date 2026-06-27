'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Badge, Card, EmptyState, useToast } from '@/components/ui'
import GHGCalculator from '@/components/GHGCalculator'

interface Indicator {
  id: string
  pillar: 'E' | 'S' | 'G'
  label: string
  description: string | null
  guidance: string | null
  data_type: 'quantitative' | 'qualitative' | 'binary'
  unit: string | null
  materiality_tier: 'core' | 'supplementary'
}

interface Response {
  id?: string
  indicator_id: string
  value_number: number | null
  value_text: string | null
  value_boolean: boolean | null
  source_reference: string | null
  confidence_level: 'high' | 'medium' | 'low' | 'estimated'
  is_not_applicable: boolean
  na_reason: string | null
  consultant_note: string | null
  target_value: number | null
  target_year: number | null
}

const PILLAR_LABELS = { E: 'Environmental', S: 'Social', G: 'Governance' }
const PILLAR_COLORS = {
  E: { dot: 'bg-green-500', text: 'text-green-700', light: 'bg-green-50' },
  S: { dot: 'bg-sky-500', text: 'text-sky-700', light: 'bg-sky-50' },
  G: { dot: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-50' },
}
const CONFIDENCE_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
  { value: 'estimated', label: 'Estimated' },
]
const CONFIDENCE_BADGE: Record<string, 'green' | 'amber' | 'orange' | 'red'> = {
  high: 'green',
  medium: 'amber',
  low: 'orange',
  estimated: 'red',
}

function ResponseRow({
  indicator,
  response,
  onSave,
  saving,
}: {
  indicator: Indicator
  response: Response
  onSave: (indicatorId: string, updates: Partial<Response>) => void
  saving: boolean
}) {
  const [local, setLocal] = useState<Response>(response)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => { setLocal(response) }, [response])

  function update(field: keyof Response, value: unknown) {
    const updated = { ...local, [field]: value }
    setLocal(updated)
    onSave(indicator.id, { [field]: value })
  }

  function applyGHGResult(tCO2e: number, note: string) {
  update('value_number', tCO2e)
  update('consultant_note', note)
}

  const hasValue =
    local.is_not_applicable ||
    local.value_number !== null ||
    (local.value_text !== null && local.value_text !== '') ||
    local.value_boolean !== null

  return (
    <div className={`border-b border-gray-100 last:border-0 transition-opacity ${saving ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-12 gap-3 px-4 py-3 items-start">
        {/* Indicator label */}
        <div className="col-span-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900 leading-tight">{indicator.label}</p>
            {hasValue && <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
          </div>
          {indicator.unit && <p className="text-xs text-gray-400 mt-0.5">{indicator.unit}</p>}
        </div>

        {/* Value input */}
        <div className="col-span-3">
          {local.is_not_applicable ? (
            <span className="text-xs text-gray-400 italic">N/A</span>
          ) : indicator.data_type === 'quantitative' ? (
            <input
              type="number"
              value={local.value_number ?? ''}
              onChange={(e) => update('value_number', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="Enter value"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                         placeholder:text-gray-300 text-gray-900"
            />
          ) : indicator.data_type === 'binary' ? (
            <div className="flex gap-2">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  onClick={() => update('value_boolean', local.value_boolean === v ? null : v)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    local.value_boolean === v
                      ? v ? 'bg-green-600 border-green-600 text-white' : 'bg-red-500 border-red-500 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {v ? 'Yes' : 'No'}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              rows={2}
              value={local.value_text ?? ''}
              onChange={(e) => update('value_text', e.target.value || null)}
              placeholder="Enter response"
              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                         placeholder:text-gray-300 text-gray-900 resize-none"
            />
          )}
        </div>

        {/* Source reference */}
        <div className="col-span-3">
          <input
            type="text"
            value={local.source_reference ?? ''}
            onChange={(e) => update('source_reference', e.target.value || null)}
            placeholder="Source document"
            className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                       placeholder:text-gray-300 text-gray-900"
          />
        </div>

        {/* Confidence */}
        <div className="col-span-1">
          <select
            value={local.confidence_level}
            onChange={(e) => update('confidence_level', e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-700 bg-white"
          >
            {CONFIDENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Expand */}
        <div className="col-span-1 flex items-center justify-end">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="bg-gray-50 border-t border-gray-100 px-4 py-4 space-y-3">
          {indicator.guidance && (
            <div className="bg-sky-50 border border-sky-100 rounded-lg px-3 py-2.5">
              <p className="text-xs font-medium text-sky-700 mb-0.5">Collection guidance</p>
              <p className="text-xs text-sky-700">{indicator.guidance}</p>
            </div>
          )}
          {/* GHG calculator — show for GHG-related quantitative indicators */}
{indicator.data_type === 'quantitative' && (
  indicator.label.toLowerCase().includes('ghg') ||
  indicator.label.toLowerCase().includes('scope') ||
  indicator.label.toLowerCase().includes('emission') ||
  indicator.label.toLowerCase().includes('greenhouse')
) && (
  <GHGCalculator
    indicatorLabel={indicator.label}
    indicatorUnit={indicator.unit}
    onResult={applyGHGResult}
  />
)}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={local.is_not_applicable}
                  onChange={(e) => update('is_not_applicable', e.target.checked)}
                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-xs font-medium text-gray-700">Not applicable</span>
              </label>
              {local.is_not_applicable && (
                <input
                  type="text"
                  value={local.na_reason ?? ''}
                  onChange={(e) => update('na_reason', e.target.value || null)}
                  placeholder="Reason this indicator does not apply"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg
                             focus:outline-none focus:ring-2 focus:ring-sky-500
                             placeholder:text-gray-300 text-gray-700"
                />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Consultant note</label>
              <textarea
                rows={2}
                value={local.consultant_note ?? ''}
                onChange={(e) => update('consultant_note', e.target.value || null)}
                placeholder="Internal note on data quality or context"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-sky-500
                           placeholder:text-gray-300 text-gray-700 resize-none"
              />
            </div>
            {/* Target fields — quantitative only */}
{indicator.data_type === 'quantitative' && (
  <div>
    <label className="block text-xs font-medium text-gray-700 mb-1.5">
      Target <span className="text-gray-400">(optional)</span>
    </label>
    <div className="flex gap-2 items-center">
      <input
        type="number"
        value={local.target_value ?? ''}
        onChange={(e) => update('target_value', e.target.value === '' ? null : parseFloat(e.target.value))}
        placeholder={`Target value ${indicator.unit ? `(${indicator.unit})` : ''}`}
        className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-sky-500
                   placeholder:text-gray-300 text-gray-700"
      />
      <span className="text-xs text-gray-400">by</span>
      <input
        type="number"
        min="2020"
        max="2050"
        value={local.target_year ?? ''}
        onChange={(e) => update('target_year', e.target.value === '' ? null : parseInt(e.target.value))}
        placeholder="Year"
        className="w-24 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-sky-500
                   placeholder:text-gray-300 text-gray-700"
      />
    </div>
  </div>
)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Confidence:</span>
            <Badge variant={CONFIDENCE_BADGE[local.confidence_level] ?? 'gray'}>
              {local.confidence_level}
            </Badge>
            {!local.source_reference && !local.is_not_applicable && (
              <Badge variant="amber">No source — −10pts</Badge>
            )}
            {local.confidence_level === 'low' && !local.is_not_applicable && (
              <Badge variant="orange">Low confidence — −20pts</Badge>
            )}
            {local.confidence_level === 'estimated' && !local.is_not_applicable && (
              <Badge variant="red">Estimated — −10pts</Badge>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AssessmentPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const supabase = createClient()
  const { success: toastSuccess, error: toastError } = useToast()

  const [indicators, setIndicators] = useState<Indicator[]>([])
  const [responses, setResponses] = useState<Record<string, Response>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'E' | 'S' | 'G'>('all')
  const [showIncomplete, setShowIncomplete] = useState(false)
  const saveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const fetchData = useCallback(async () => {
    const { data: ci } = await supabase
      .from('cycle_indicators')
      .select(`indicator_id, indicators ( id, pillar, label, description, guidance, data_type, unit, materiality_tier )`)
      .eq('cycle_id', cycleId)
      .neq('inclusion_source', 'manual_exclude')

    const inds = (ci ?? [])
      .map((row) => {
        const ind = Array.isArray(row.indicators) ? row.indicators[0] : row.indicators
        return ind as Indicator | null
      })
      .filter(Boolean) as Indicator[]

    inds.sort((a, b) => a.pillar.localeCompare(b.pillar) || a.label.localeCompare(b.label))
    setIndicators(inds)

    const { data: existingResponses } = await supabase
      .from('responses')
      .select('*')
      .eq('cycle_id', cycleId)

    const responseMap: Record<string, Response> = {}
    for (const ind of inds) {
      const existing = existingResponses?.find((r) => r.indicator_id === ind.id)
      responseMap[ind.id] = existing ? {
        id: existing.id,
        indicator_id: existing.indicator_id,
        value_number: existing.value_number,
        value_text: existing.value_text,
        value_boolean: existing.value_boolean,
        source_reference: existing.source_reference,
        confidence_level: existing.confidence_level as 'high' | 'medium' | 'low' | 'estimated',
        is_not_applicable: existing.is_not_applicable,
        na_reason: existing.na_reason,
        consultant_note: existing.consultant_note,
        target_value: existing.target_value,
        target_year: existing.target_year,
      } : {
        indicator_id: ind.id,
        value_number: null,
        value_text: null,
        value_boolean: null,
        source_reference: null,
        confidence_level: 'medium' as const,
        is_not_applicable: false,
        na_reason: null,
        consultant_note: null,
        target_value: null,
        target_year: null,
      }
    }

    setResponses(responseMap)
    setLoading(false)
  }, [cycleId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSave(indicatorId: string, updates: Partial<Response>) {
    const timers = saveTimers.current
    if (timers.has(indicatorId)) clearTimeout(timers.get(indicatorId))

    const timer = setTimeout(async () => {
      setSavingId(indicatorId)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const current = responses[indicatorId]
      const merged = { ...current, ...updates }

      const existing = await supabase
        .from('responses')
        .select('id')
        .eq('cycle_id', cycleId)
        .eq('indicator_id', indicatorId)
        .single()

      if (existing.data?.id) {
        const { error } = await supabase
          .from('responses')
          .update({ ...updates, updated_by: user.id })
          .eq('id', existing.data.id)
        if (error) toastError('Failed to save response.')
      } else {
        const { error } = await supabase
          .from('responses')
          .insert({
            cycle_id: cycleId,
            indicator_id: indicatorId,
            value_number: merged.value_number,
            value_text: merged.value_text,
            value_boolean: merged.value_boolean,
            source_reference: merged.source_reference,
            confidence_level: merged.confidence_level,
            is_not_applicable: merged.is_not_applicable,
            na_reason: merged.na_reason,
            consultant_note: merged.consultant_note,
            created_by: user.id,
            updated_by: user.id,
            target_value: merged.target_value,
            target_year: merged.target_year,
          })
        if (error) toastError('Failed to save response.')
      }

      setResponses((prev) => ({ ...prev, [indicatorId]: { ...prev[indicatorId], ...updates } }))
      setSavingId(null)
      timers.delete(indicatorId)
    }, 800)

    saveTimers.current.set(indicatorId, timer)
  }

  function hasValue(indicatorId: string) {
    const r = responses[indicatorId]
    if (!r) return false
    return (
      r.is_not_applicable ||
      r.value_number !== null ||
      (r.value_text !== null && r.value_text !== '') ||
      r.value_boolean !== null
    )
  }

  const completedCount = indicators.filter((i) => hasValue(i.id)).length
  const completionPct = indicators.length > 0 ? Math.round((completedCount / indicators.length) * 100) : 0

  const filteredIndicators = indicators.filter((i) => {
    if (filter !== 'all' && i.pillar !== filter) return false
    if (showIncomplete && hasValue(i.id)) return false
    return true
  })

  const byPillar = {
    E: filteredIndicators.filter((i) => i.pillar === 'E'),
    S: filteredIndicators.filter((i) => i.pillar === 'S'),
    G: filteredIndicators.filter((i) => i.pillar === 'G'),
  }
  const pillarsToShow = filter === 'all' ? (['E', 'S', 'G'] as const) : [filter]

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <Link href={`/workspaces/${workspaceId}/cycles/${cycleId}`} className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← Back to cycle
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Data collection</h1>
            <p className="text-sm text-gray-500 mt-1">
              Enter responses for each indicator. Changes are saved automatically.
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-gray-900">{completionPct}%</p>
            <p className="text-xs text-gray-400">{completedCount} of {indicators.length} complete</p>
          </div>
        </div>
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-5">
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
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showIncomplete}
            onChange={(e) => setShowIncomplete(e.target.checked)}
            className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
          />
          Show incomplete only
        </label>
      </div>

      {loading ? (
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="h-10 bg-gray-50 border-b border-gray-100 animate-pulse" />
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-14 border-b border-gray-100 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : indicators.length === 0 ? (
        <Card>
          <EmptyState
            title="No indicators selected"
            description="Go to indicator selection to choose which indicators to assess."
            action={
              <Button
                size="sm"
                onClick={() => window.location.href = `/workspaces/${workspaceId}/cycles/${cycleId}/indicators`}
              >
                Go to indicator selection
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {pillarsToShow.map((pillar) => {
            const pillarInds = byPillar[pillar]
            if (pillarInds.length === 0) return null
            const colors = PILLAR_COLORS[pillar]
            const pillarCompleted = pillarInds.filter((i) => hasValue(i.id)).length

            return (
              <div key={pillar} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-3 ${colors.light} border-b border-gray-100`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    <h2 className={`text-sm font-semibold ${colors.text}`}>{PILLAR_LABELS[pillar]}</h2>
                  </div>
                  <span className="text-xs text-gray-500">{pillarCompleted} / {pillarInds.length} complete</span>
                </div>

                <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50">
                  <div className="col-span-4 text-xs font-medium text-gray-500">Indicator</div>
                  <div className="col-span-3 text-xs font-medium text-gray-500">Value</div>
                  <div className="col-span-3 text-xs font-medium text-gray-500">Source reference</div>
                  <div className="col-span-1 text-xs font-medium text-gray-500">Confidence</div>
                  <div className="col-span-1" />
                </div>

                {pillarInds.map((indicator) => (
                  <ResponseRow
                    key={indicator.id}
                    indicator={indicator}
                    response={responses[indicator.id] ?? {
                      indicator_id: indicator.id,
                      value_number: null,
                      value_text: null,
                      value_boolean: null,
                      source_reference: null,
                      confidence_level: 'medium',
                      is_not_applicable: false,
                      na_reason: null,
                      consultant_note: null,
                    }}
                    onSave={handleSave}
                    saving={savingId === indicator.id}
                  />
                ))}
              </div>
            )
          })}

          {completedCount > 0 && (
            <div className="pt-2">
              <Button
                onClick={() => window.location.href = `/workspaces/${workspaceId}/cycles/${cycleId}/documents`}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                }
                iconPosition="right"
              >
                Continue to document vault
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}