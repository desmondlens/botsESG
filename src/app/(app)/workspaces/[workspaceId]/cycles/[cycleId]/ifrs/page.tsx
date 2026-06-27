'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Badge, Card, EmptyState, Textarea, useToast } from '@/components/ui'

interface DisclosureTemplate {
  id: string
  disclosure_code: string
  standard: string
  pillar: string
  disclosure_title: string
  disclosure_guidance: string | null
  is_quantitative: boolean
  indicator_coverage: string | null
  sort_order: number
}

interface IFRSDisclosure {
  id?: string
  cycle_id: string
  disclosure_code: string
  standard: string
  pillar: string
  disclosure_title: string
  disclosure_guidance: string | null
  narrative_response: string | null
  is_omitted: boolean
  omission_reason: string | null
  omission_target_year: number | null
}

const PILLAR_LABELS: Record<string, string> = {
  governance: 'Governance',
  strategy: 'Strategy',
  risk_management: 'Risk management',
  metrics_targets: 'Metrics and targets',
}

const PILLAR_COLORS: Record<string, { bg: string; text: string; border: string; badge: 'sky' | 'green' | 'purple' | 'amber' }> = {
  governance: { bg: 'bg-sky-50', text: 'text-sky-800', border: 'border-sky-200', badge: 'sky' },
  strategy: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200', badge: 'green' },
  risk_management: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', badge: 'purple' },
  metrics_targets: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', badge: 'amber' },
}

const STANDARD_COLORS: Record<string, 'sky' | 'purple'> = {
  IFRS_S1: 'sky',
  IFRS_S2: 'purple',
}

export default function IFRSDisclosuresPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const router = useRouter()
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [templates, setTemplates] = useState<DisclosureTemplate[]>([])
  const [disclosures, setDisclosures] = useState<Record<string, IFRSDisclosure>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedCode, setExpandedCode] = useState<string | null>(null)
  const [filterPillar, setFilterPillar] = useState<string>('all')
  const [filterStandard, setFilterStandard] = useState<string>('all')

  const fetchData = useCallback(async () => {
    const { data: tmplData } = await supabase
      .from('ifrs_disclosure_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    const { data: discData } = await supabase
      .from('ifrs_disclosures')
      .select('*')
      .eq('cycle_id', cycleId)

    const discMap: Record<string, IFRSDisclosure> = {}
    for (const tmpl of tmplData ?? []) {
      const existing = discData?.find((d) => d.disclosure_code === tmpl.disclosure_code)
      discMap[tmpl.disclosure_code] = existing ?? {
        cycle_id: cycleId,
        disclosure_code: tmpl.disclosure_code,
        standard: tmpl.standard,
        pillar: tmpl.pillar,
        disclosure_title: tmpl.disclosure_title,
        disclosure_guidance: tmpl.disclosure_guidance,
        narrative_response: null,
        is_omitted: false,
        omission_reason: null,
        omission_target_year: null,
      }
    }

    setTemplates((tmplData as DisclosureTemplate[]) ?? [])
    setDisclosures(discMap)
    setLoading(false)
  }, [cycleId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function saveDisclosure(code: string, updates: Partial<IFRSDisclosure>) {
    setSaving(code)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(null); return }

    const current = disclosures[code]
    const merged = { ...current, ...updates }

    const existing = await supabase
      .from('ifrs_disclosures')
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('disclosure_code', code)
      .single()

    if (existing.data?.id) {
      const { error } = await supabase
        .from('ifrs_disclosures')
        .update({ ...updates, completed_by: user.id })
        .eq('id', existing.data.id)
      if (error) { toastError('Failed to save disclosure.'); setSaving(null); return }
    } else {
      const { error } = await supabase
        .from('ifrs_disclosures')
        .insert({
          cycle_id: cycleId,
          disclosure_code: merged.disclosure_code,
          standard: merged.standard,
          pillar: merged.pillar,
          disclosure_title: merged.disclosure_title,
          disclosure_guidance: merged.disclosure_guidance,
          narrative_response: merged.narrative_response,
          is_omitted: merged.is_omitted,
          omission_reason: merged.omission_reason,
          omission_target_year: merged.omission_target_year,
          completed_by: user.id,
        })
      if (error) { toastError('Failed to save disclosure.'); setSaving(null); return }
    }

    setDisclosures((prev) => ({
      ...prev,
      [code]: { ...prev[code], ...updates },
    }))

    setSaving(null)
  }

  function updateLocal(code: string, updates: Partial<IFRSDisclosure>) {
    setDisclosures((prev) => ({ ...prev, [code]: { ...prev[code], ...updates } }))
  }

  const filteredTemplates = templates.filter((t) => {
    if (filterPillar !== 'all' && t.pillar !== filterPillar) return false
    if (filterStandard !== 'all' && t.standard !== filterStandard) return false
    return true
  })

  const pillars = ['governance', 'strategy', 'risk_management', 'metrics_targets']
  const pillarTemplates = (pillar: string) => filteredTemplates.filter((t) => t.pillar === pillar)

  const completedCount = templates.filter((t) => {
    const d = disclosures[t.disclosure_code]
    return d?.is_omitted || (d?.narrative_response && d.narrative_response.trim().length > 0) || t.is_quantitative
  }).length

  const totalCount = templates.length
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <Link
          href={`/workspaces/${workspaceId}/cycles/${cycleId}`}
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back to cycle
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">IFRS S1/S2 disclosures</h1>
            <p className="text-sm text-gray-500 mt-1">
              Complete all required qualitative narrative disclosures under IFRS S1 and S2.
              Quantitative disclosures are covered by the indicator library.
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-semibold text-gray-900">{completionPct}%</p>
            <p className="text-xs text-gray-400">{completedCount} of {totalCount} addressed</p>
          </div>
        </div>
        <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-sky-500 rounded-full transition-all duration-300"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Info box */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl px-5 py-4 mb-6">
        <p className="text-xs font-semibold text-sky-700 mb-1">How to use this section</p>
        <p className="text-xs text-sky-700 leading-relaxed">
          Each disclosure below corresponds to a specific IFRS S1 or S2 paragraph requirement.
          Enter the narrative response, or mark as omitted with a reason and target year.
          Quantitative disclosures (marked with a data indicator badge) are populated automatically
          from your indicator responses and do not require manual input here.
          All responses — including omissions — will appear in the Word report with management
          placeholder comments where narrative is incomplete.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', 'IFRS_S1', 'IFRS_S2'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStandard(s)}
              className={`px-3 py-1.5 transition-colors ${
                filterStandard === s ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'All standards' : s.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', ...pillars] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPillar(p)}
              className={`px-3 py-1.5 transition-colors ${
                filterPillar === p ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'all' ? 'All pillars' : PILLAR_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-16 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <EmptyState title="No IFRS disclosure templates found" description="Contact your administrator." />
        </Card>
      ) : (
        <div className="space-y-8">
          {pillars.map((pillar) => {
            const pillarTmpls = pillarTemplates(pillar)
            if (pillarTmpls.length === 0) return null
            const colors = PILLAR_COLORS[pillar]
            const pillarCompleted = pillarTmpls.filter((t) => {
              const d = disclosures[t.disclosure_code]
              return d?.is_omitted || (d?.narrative_response && d.narrative_response.trim().length > 0) || t.is_quantitative
            }).length

            return (
              <div key={pillar}>
                {/* Pillar header */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${colors.bg} border ${colors.border} mb-3`}>
                  <h2 className={`text-sm font-semibold ${colors.text}`}>{PILLAR_LABELS[pillar]}</h2>
                  <span className="text-xs text-gray-500">
                    {pillarCompleted} / {pillarTmpls.length} addressed
                  </span>
                </div>

                <div className="space-y-2">
                  {pillarTmpls.map((tmpl) => {
                    const disc = disclosures[tmpl.disclosure_code]
                    const isExpanded = expandedCode === tmpl.disclosure_code
                    const isSaving = saving === tmpl.disclosure_code
                    const isQuantitative = tmpl.is_quantitative
                    const hasResponse = disc?.narrative_response && disc.narrative_response.trim().length > 0
                    const isOmitted = disc?.is_omitted
                    const isComplete = isQuantitative || hasResponse || isOmitted

                    return (
                      <div
                        key={tmpl.disclosure_code}
                        className={`bg-white rounded-xl border transition-colors ${
                          isComplete ? 'border-green-200' : 'border-gray-200'
                        }`}
                      >
                        {/* Header row */}
                        <div
                          className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                          onClick={() => !isQuantitative && setExpandedCode(isExpanded ? null : tmpl.disclosure_code)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {tmpl.disclosure_code}
                              </span>
                              <p className="text-sm font-medium text-gray-900">{tmpl.disclosure_title}</p>
                              <Badge variant={STANDARD_COLORS[tmpl.standard] ?? 'gray'}>
                                {tmpl.standard.replace('_', ' ')}
                              </Badge>
                              {isQuantitative && (
                                <Badge variant="amber">Data indicator</Badge>
                              )}
                              {isComplete && !isQuantitative && (
                                <Badge variant="green">✓ Complete</Badge>
                              )}
                              {isOmitted && (
                                <Badge variant="gray">Omitted</Badge>
                              )}
                              {isSaving && (
                                <span className="text-xs text-gray-400">Saving...</span>
                              )}
                            </div>
                          </div>

                          {!isQuantitative && (
                            <svg
                              className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          )}
                        </div>

                        {/* Quantitative indicator note */}
                        {isQuantitative && (
                          <div className="border-t border-gray-100 px-5 py-3 bg-amber-50">
                            <p className="text-xs text-amber-700">
                              This disclosure is covered quantitatively by your indicator responses:
                              <span className="font-medium"> {tmpl.indicator_coverage}</span>.
                              No narrative input required here — values will be pulled automatically into the report.
                            </p>
                          </div>
                        )}

                        {/* Expanded narrative panel */}
                        {isExpanded && !isQuantitative && (
                          <div className="border-t border-gray-100 px-5 py-5 space-y-4">
                            {/* Guidance */}
                            <div className="bg-sky-50 border border-sky-100 rounded-lg px-4 py-3">
                              <p className="text-xs font-medium text-sky-700 mb-1">IFRS requirement</p>
                              <p className="text-xs text-sky-700 leading-relaxed">{tmpl.disclosure_guidance}</p>
                            </div>

                            {/* Omitted toggle */}
                            <div className="flex items-center gap-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={disc?.is_omitted ?? false}
                                  onChange={(e) => {
                                    updateLocal(tmpl.disclosure_code, { is_omitted: e.target.checked })
                                    saveDisclosure(tmpl.disclosure_code, { is_omitted: e.target.checked })
                                  }}
                                  className="rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-xs font-medium text-gray-700">
                                  Mark as omitted for this reporting period
                                </span>
                              </label>
                            </div>

                            {disc?.is_omitted ? (
                              <div className="grid grid-cols-2 gap-4">
                                <Textarea
                                  label="Omission reason"
                                  rows={2}
                                  value={disc?.omission_reason ?? ''}
                                  onChange={(e) => updateLocal(tmpl.disclosure_code, { omission_reason: e.target.value || null })}
                                  onBlur={(e) => saveDisclosure(tmpl.disclosure_code, { omission_reason: e.target.value || null })}
                                  placeholder="Explain why this disclosure is omitted (e.g. information not available, not applicable to entity size)"
                                />
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Target year for compliance
                                  </label>
                                  <input
                                    type="number"
                                    min="2024"
                                    max="2050"
                                    value={disc?.omission_target_year ?? ''}
                                    onChange={(e) => updateLocal(tmpl.disclosure_code, {
                                      omission_target_year: e.target.value ? parseInt(e.target.value) : null
                                    })}
                                    onBlur={(e) => saveDisclosure(tmpl.disclosure_code, {
                                      omission_target_year: e.target.value ? parseInt(e.target.value) : null
                                    })}
                                    placeholder="e.g. 2026"
                                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg
                                               focus:outline-none focus:ring-2 focus:ring-sky-500
                                               placeholder:text-gray-400 text-gray-900"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <Textarea
                                  label="Narrative response"
                                  rows={5}
                                  value={disc?.narrative_response ?? ''}
                                  onChange={(e) => updateLocal(tmpl.disclosure_code, { narrative_response: e.target.value || null })}
                                  onBlur={(e) => saveDisclosure(tmpl.disclosure_code, { narrative_response: e.target.value || null })}
                                  placeholder="Enter the narrative disclosure response here. This text will appear directly in the Word report under this IFRS disclosure heading. Where management input is needed, leave blank and a placeholder comment will be inserted in the report."
                                  hint="Changes are saved when you click outside this field."
                                />
                                {!hasResponse && (
                                  <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                                    <span className="text-amber-500 text-sm flex-shrink-0">⚠</span>
                                    <p className="text-xs text-amber-700">
                                      No response entered. The Word report will include a highlighted management placeholder
                                      for this disclosure with the IFRS requirement text.
                                    </p>
                                  </div>
                                )}
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

          {/* Continue */}
          <div className="pt-2">
            <Button
              onClick={() => router.push(`/workspaces/${workspaceId}/cycles/${cycleId}/indicators`)}
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              }
              iconPosition="right"
            >
              Continue to indicator selection
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}