'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Input, Textarea, Badge, EmptyState, useToast } from '@/components/ui'

interface MaterialityTopic {
  id: string
  topic_name: string
  topic_description: string | null
  impact_score: number | null
  financial_score: number | null
  is_material: boolean | null
  ifrs_relevant: boolean | null
  sdg_tags: number[] | null
  sector_context: string | null
  consultant_note: string | null
  time_horizon: string | null
  financial_effect: string | null
}

const SDG_LIST = [
  { n: 1, label: 'No Poverty' },
  { n: 2, label: 'Zero Hunger' },
  { n: 3, label: 'Good Health' },
  { n: 4, label: 'Quality Education' },
  { n: 5, label: 'Gender Equality' },
  { n: 6, label: 'Clean Water' },
  { n: 7, label: 'Clean Energy' },
  { n: 8, label: 'Decent Work' },
  { n: 9, label: 'Industry & Innovation' },
  { n: 10, label: 'Reduced Inequalities' },
  { n: 11, label: 'Sustainable Cities' },
  { n: 12, label: 'Responsible Consumption' },
  { n: 13, label: 'Climate Action' },
  { n: 14, label: 'Life Below Water' },
  { n: 15, label: 'Life on Land' },
  { n: 16, label: 'Peace & Justice' },
  { n: 17, label: 'Partnerships' },
]

const SUGGESTED_TOPICS = [
  'Energy consumption and efficiency',
  'Greenhouse gas emissions',
  'Water use and management',
  'Waste generation and disposal',
  'Land use and biodiversity',
  'Employee health and safety',
  'Labour practices and fair wages',
  'Community relations',
  'Anti-corruption and ethics',
  'Board governance and accountability',
  'Supply chain management',
  'Product/service quality and safety',
]

function ScoreSlider({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
}) {
  const v = value ?? 1
  const colors = ['', 'bg-gray-200', 'bg-amber-200', 'bg-amber-400', 'bg-orange-500', 'bg-red-500']
  const labels = ['', 'Not significant', 'Low', 'Medium', 'High', 'Very high']
  const badgeVariants = ['gray', 'gray', 'amber', 'amber', 'orange', 'red'] as const

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <Badge variant={badgeVariants[Math.floor(v)] ?? 'gray'}>
          {v} — {labels[Math.floor(v)]}
        </Badge>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={0.5}
        value={v}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-sky-600"
      />
      <div className="flex justify-between text-xs text-gray-300 mt-0.5">
        <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
      </div>
    </div>
  )
}

export default function MaterialityPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [topics, setTopics] = useState<MaterialityTopic[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTopic, setNewTopic] = useState({ topic_name: '', topic_description: '' })
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const fetchTopics = useCallback(async () => {
    const { data } = await supabase
      .from('materiality_topics')
      .select('*')
      .eq('cycle_id', cycleId)
      .order('created_at', { ascending: true })
    setTopics(data ?? [])
    setLoading(false)
  }, [cycleId, supabase])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  async function addTopic() {
    if (!newTopic.topic_name.trim()) {
      setAddError('Topic name is required.')
      return
    }
    setAdding(true)
    setAddError(null)

    const { data, error } = await supabase
      .from('materiality_topics')
      .insert({
        cycle_id: cycleId,
        topic_name: newTopic.topic_name.trim(),
        topic_description: newTopic.topic_description.trim() || null,
        impact_score: 1,
        financial_score: 1,
      })
      .select('*')
      .single()

    if (error || !data) {
      toastError('Failed to add topic. Please try again.')
      setAdding(false)
      return
    }

    setTopics((prev) => [...prev, data])
    setNewTopic({ topic_name: '', topic_description: '' })
    setShowAddForm(false)
    setExpandedId(data.id)
    setAdding(false)
    success(`"${data.topic_name}" added.`)
  }

  async function updateTopic(id: string, updates: Partial<MaterialityTopic>) {
    setSaving(id)
    const { data, error } = await supabase
      .from('materiality_topics')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (!error && data) {
      setTopics((prev) => prev.map((t) => (t.id === id ? data : t)))
    } else {
      toastError('Failed to save changes.')
    }
    setSaving(null)
  }

  async function deleteTopic(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.from('materiality_topics').delete().eq('id', id)
    if (error) {
      toastError('Failed to delete topic.')
      return
    }
    setTopics((prev) => prev.filter((t) => t.id !== id))
    if (expandedId === id) setExpandedId(null)
    success(`"${name}" deleted.`)
  }

  function toggleSdg(topic: MaterialityTopic, sdg: number) {
    const current = topic.sdg_tags ?? []
    const updated = current.includes(sdg)
      ? current.filter((n) => n !== sdg)
      : [...current, sdg].sort((a, b) => a - b)
    updateTopic(topic.id, { sdg_tags: updated })
  }

  const materialTopics = topics.filter((t) => t.is_material)

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
            <h1 className="text-2xl font-semibold text-gray-900">Materiality assessment</h1>
            <p className="text-sm text-gray-500 mt-1">
              Score each topic by impact significance (GRI lens) and financial significance (IFRS S1 lens).
              Topics scoring 3.0 or above on either axis are material.
            </p>
          </div>
          <Button onClick={() => setShowAddForm(true)} className="flex-shrink-0">
            + Add topic
          </Button>
        </div>
      </div>

      {/* Scoring guide */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl px-5 py-4 mb-6">
        <p className="text-xs font-semibold text-sky-700 mb-2">Scoring guide</p>
        <div className="grid grid-cols-2 gap-4 text-xs text-sky-700">
          <div>
            <p className="font-medium mb-1">Impact score (GRI lens)</p>
            <p>How significant is the organisation's impact on people and the environment through this topic?</p>
          </div>
          <div>
            <p className="font-medium mb-1">Financial score (IFRS S1 lens)</p>
            <p>How significantly could this topic affect the organisation's financial position, cash flows, or access to capital?</p>
          </div>
        </div>
      </div>

      {/* Add topic form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border border-sky-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">New topic</h3>
          <div className="space-y-3 mb-4">
            <Input
              label="Topic name"
              required
              value={newTopic.topic_name}
              onChange={(e) => {
                setNewTopic((p) => ({ ...p, topic_name: e.target.value }))
                setAddError(null)
              }}
              placeholder="e.g. Energy consumption and efficiency"
              error={addError ?? undefined}
            />
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TOPICS.filter(
                (s) => !topics.some((t) => t.topic_name.toLowerCase() === s.toLowerCase())
              ).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setNewTopic((p) => ({ ...p, topic_name: s }))}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-sky-50 hover:text-sky-700
                             text-gray-600 rounded-md transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <Input
              label="Description (optional)"
              value={newTopic.topic_description}
              onChange={(e) => setNewTopic((p) => ({ ...p, topic_description: e.target.value }))}
              placeholder="Brief description of this topic in the client's context"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={addTopic}
              loading={adding}
              disabled={!newTopic.topic_name.trim()}
            >
              Add topic
            </Button>
            <button
              onClick={() => {
                setShowAddForm(false)
                setNewTopic({ topic_name: '', topic_description: '' })
                setAddError(null)
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-16 animate-pulse" />
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200">
          <EmptyState
            title="No topics added yet"
            description="Add the sustainability topics relevant to this client to begin the materiality assessment."
            action={
              <Button onClick={() => setShowAddForm(true)} size="sm">
                + Add first topic
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs text-gray-500 px-1 mb-2">
            <span>{topics.length} topics total</span>
            <span className="text-green-600 font-medium">{materialTopics.length} material</span>
            <span>{topics.length - materialTopics.length} not material</span>
          </div>

          {topics.map((topic) => {
            const isExpanded = expandedId === topic.id
            const isSaving = saving === topic.id

            return (
              <div
                key={topic.id}
                className={`bg-white rounded-xl border transition-colors ${
                  topic.is_material ? 'border-green-200' : 'border-gray-200'
                }`}
              >
                <div
                  className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : topic.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{topic.topic_name}</p>
                      {topic.is_material && <Badge variant="green">Material</Badge>}
                      {topic.ifrs_relevant && <Badge variant="purple">IFRS relevant</Badge>}
                      {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
                    </div>
                    {topic.topic_description && (
                      <p className="text-xs text-gray-400 mt-0.5">{topic.topic_description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Impact</p>
                      <p className="text-sm font-semibold text-gray-900">{topic.impact_score ?? '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Financial</p>
                      <p className="text-sm font-semibold text-gray-900">{topic.financial_score ?? '—'}</p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 py-5 space-y-5">
                    <div className="grid grid-cols-2 gap-6">
                      <ScoreSlider
                        label="Impact score (GRI lens)"
                        value={topic.impact_score}
                        onChange={(v) => updateTopic(topic.id, { impact_score: v })}
                      />
                      <ScoreSlider
                        label="Financial score (IFRS S1 lens)"
                        value={topic.financial_score}
                        onChange={(v) => updateTopic(topic.id, { financial_score: v })}
                      />
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">SDG tags</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SDG_LIST.map((sdg) => {
                          const selected = (topic.sdg_tags ?? []).includes(sdg.n)
                          return (
                            <button
                              key={sdg.n}
                              onClick={() => toggleSdg(topic, sdg.n)}
                              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                                selected
                                  ? 'bg-sky-600 border-sky-600 text-white'
                                  : 'bg-white border-gray-200 text-gray-600 hover:border-sky-300'
                              }`}
                            >
                              SDG {sdg.n} · {sdg.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                      
                      {/* Time horizon */}
<div>
  <label className="block text-xs font-medium text-gray-600 mb-1.5">
    Time horizon <span className="text-gray-400">(IFRS S1)</span>
  </label>
  <div className="flex gap-2">
    {[
      { value: 'short', label: 'Short (0–2 yrs)' },
      { value: 'medium', label: 'Medium (2–10 yrs)' },
      { value: 'long', label: 'Long (10+ yrs)' },
      { value: 'multiple', label: 'Multiple' },
    ].map((h) => (
      <button
        key={h.value}
        onClick={() => updateTopic(topic.id, { time_horizon: topic.time_horizon === h.value ? null : h.value })}
        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
          topic.time_horizon === h.value
            ? 'bg-sky-600 border-sky-600 text-white'
            : 'bg-white border-gray-200 text-gray-600 hover:border-sky-300'
        }`}
      >
        {h.label}
      </button>
    ))}
  </div>
</div>

{/* Financial effect */}
<Textarea
  label="Financial effect (IFRS S1)"
  rows={2}
  value={topic.financial_effect ?? ''}
  onChange={(e) =>
    setTopics((prev) =>
      prev.map((t) =>
        t.id === topic.id ? { ...t, financial_effect: e.target.value } : t
      )
    )
  }
  onBlur={(e) => updateTopic(topic.id, { financial_effect: e.target.value || null })}
  placeholder="Describe how this topic could affect financial position, performance, or cash flows..."
  hint="Required for IFRS S1 alignment on financially material topics."
/>
                    <Textarea
                      label="Consultant note"
                      rows={2}
                      value={topic.consultant_note ?? ''}
                      onChange={(e) =>
                        setTopics((prev) =>
                          prev.map((t) =>
                            t.id === topic.id ? { ...t, consultant_note: e.target.value } : t
                          )
                        )
                      }
                      onBlur={(e) => updateTopic(topic.id, { consultant_note: e.target.value || null })}
                      placeholder="Notes on why this topic is or is not material for this client..."
                    />

                    <div className="flex justify-end">
                      <button
                        onClick={() => deleteTopic(topic.id, topic.topic_name)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Delete topic
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {materialTopics.length > 0 && (
            <div className="pt-4">
              <Button
                onClick={() => window.location.href = `/workspaces/${workspaceId}/cycles/${cycleId}/indicators`}
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
          )}
        </div>
      )}
    </div>
  )
}