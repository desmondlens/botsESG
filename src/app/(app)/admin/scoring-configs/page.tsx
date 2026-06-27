'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, Badge, Card, EmptyState, Input, useToast } from '@/components/ui'

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
  is_default: boolean
  created_at: string | null
}

export default function AdminScoringConfigsPage() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [configs, setConfigs] = useState<ScoringConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settingDefault, setSettingDefault] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    config_name: '',
    e_weight: '35',
    s_weight: '35',
    g_weight: '30',
    penalty_confidence_low: '20',
    penalty_confidence_estimated: '10',
    penalty_no_source: '10',
    material_weight_multiplier: '2',
  })

  const fetchConfigs = useCallback(async () => {
    const { data } = await supabase
      .from('scoring_configs')
      .select('*')
      .order('created_at', { ascending: false })
    setConfigs((data as ScoringConfig[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.config_name.trim()) e.config_name = 'Config name is required.'

    const eW = parseFloat(form.e_weight)
    const sW = parseFloat(form.s_weight)
    const gW = parseFloat(form.g_weight)

    if (isNaN(eW) || eW <= 0) e.e_weight = 'Must be a positive number.'
    if (isNaN(sW) || sW <= 0) e.s_weight = 'Must be a positive number.'
    if (isNaN(gW) || gW <= 0) e.g_weight = 'Must be a positive number.'

    if (!isNaN(eW) && !isNaN(sW) && !isNaN(gW)) {
      const total = eW + sW + gW
      if (Math.abs(total - 100) > 0.1) {
        e.g_weight = `Weights must sum to 100. Currently: ${total.toFixed(1)}`
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate() {
    if (!validate()) return
    setSaving(true)

    const eW = parseFloat(form.e_weight) / 100
    const sW = parseFloat(form.s_weight) / 100
    const gW = parseFloat(form.g_weight) / 100

    const { data, error } = await supabase
      .from('scoring_configs')
      .insert({
        config_name: form.config_name.trim(),
        e_weight: eW,
        s_weight: sW,
        g_weight: gW,
        penalty_confidence_low: parseFloat(form.penalty_confidence_low) / 100,
        penalty_confidence_estimated: parseFloat(form.penalty_confidence_estimated) / 100,
        penalty_no_source: parseFloat(form.penalty_no_source) / 100,
        material_weight_multiplier: parseFloat(form.material_weight_multiplier),
        missing_indicator_score: 0,
        is_default: false,
      })
      .select('*')
      .single()

    if (error || !data) {
      toastError('Failed to create scoring config.')
      setSaving(false)
      return
    }

    setConfigs((prev) => [data as ScoringConfig, ...prev])
    setForm({
      config_name: '',
      e_weight: '35',
      s_weight: '35',
      g_weight: '30',
      penalty_confidence_low: '20',
      penalty_confidence_estimated: '10',
      penalty_no_source: '10',
      material_weight_multiplier: '2',
    })
    setShowForm(false)
    setSaving(false)
    success(`"${data.config_name}" created.`)
  }

  async function setDefault(config: ScoringConfig) {
    setSettingDefault(config.id)

    // Remove default from all
    await supabase.from('scoring_configs').update({ is_default: false }).neq('id', 'none')

    // Set new default
    const { error } = await supabase
      .from('scoring_configs')
      .update({ is_default: true })
      .eq('id', config.id)

    if (error) {
      toastError('Failed to set default config.')
      setSettingDefault(null)
      return
    }

    setConfigs((prev) => prev.map((c) => ({ ...c, is_default: c.id === config.id })))
    success(`"${config.config_name}" is now the default scoring config.`)
    setSettingDefault(null)
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Scoring configurations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage scoring weights and penalty parameters. The default config is used for all new cycles.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ New config</Button>
      </div>

      {/* Methodology note */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl px-5 py-4 mb-6">
        <p className="text-xs font-semibold text-sky-700 mb-2">Scoring methodology</p>
        <div className="grid grid-cols-2 gap-4 text-xs text-sky-700">
          <div>
            <p className="font-medium mb-1">Pillar weights (must sum to 100%)</p>
            <p>Each pillar score is weighted to produce the overall ESG score. Adjust based on client sector and DFI requirements.</p>
          </div>
          <div>
            <p className="font-medium mb-1">Penalties (deducted from indicator score 0–100)</p>
            <p>Applied when data quality is low or sources are missing. Material indicators carry double weight by default.</p>
          </div>
        </div>
      </div>

      {/* New config form */}
      {showForm && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">New scoring configuration</h2>
          <div className="space-y-4">
            <Input
              label="Configuration name"
              required
              value={form.config_name}
              onChange={(e) => set('config_name', e.target.value)}
              placeholder="e.g. Agribusiness DFI Config"
              error={errors.config_name}
            />

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">
                Pillar weights <span className="text-gray-400">(must sum to 100)</span>
              </p>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Environmental (%)"
                  type="number"
                  min="1"
                  max="98"
                  value={form.e_weight}
                  onChange={(e) => set('e_weight', e.target.value)}
                  error={errors.e_weight}
                />
                <Input
                  label="Social (%)"
                  type="number"
                  min="1"
                  max="98"
                  value={form.s_weight}
                  onChange={(e) => set('s_weight', e.target.value)}
                  error={errors.s_weight}
                />
                <Input
                  label="Governance (%)"
                  type="number"
                  min="1"
                  max="98"
                  value={form.g_weight}
                  onChange={(e) => set('g_weight', e.target.value)}
                  error={errors.g_weight}
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-700 mb-2">Penalty points (deducted from score)</p>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Low confidence"
                  type="number"
                  min="0"
                  max="50"
                  value={form.penalty_confidence_low}
                  onChange={(e) => set('penalty_confidence_low', e.target.value)}
                  suffix="pts"
                />
                <Input
                  label="Estimated data"
                  type="number"
                  min="0"
                  max="50"
                  value={form.penalty_confidence_estimated}
                  onChange={(e) => set('penalty_confidence_estimated', e.target.value)}
                  suffix="pts"
                />
                <Input
                  label="No source reference"
                  type="number"
                  min="0"
                  max="50"
                  value={form.penalty_no_source}
                  onChange={(e) => set('penalty_no_source', e.target.value)}
                  suffix="pts"
                />
              </div>
            </div>

            <Input
              label="Material indicator weight multiplier"
              type="number"
              min="1"
              max="5"
              step="0.5"
              value={form.material_weight_multiplier}
              onChange={(e) => set('material_weight_multiplier', e.target.value)}
              hint="Material indicators carry this multiple of weight in pillar score calculations. Default is 2×."
              suffix="×"
            />
          </div>

          <div className="flex items-center gap-3 mt-5">
            <Button loading={saving} onClick={handleCreate}>
              Create config
            </Button>
            <button
              onClick={() => { setShowForm(false); setErrors({}) }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        </Card>
      )}

      {/* Config list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-32 animate-pulse" />
          ))}
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <EmptyState
            title="No scoring configs yet"
            action={<Button size="sm" onClick={() => setShowForm(true)}>+ Create first config</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {configs.map((config) => (
            <Card key={config.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{config.config_name}</h3>
                  {config.is_default && <Badge variant="green" dot>Default</Badge>}
                </div>
                <div className="flex items-center gap-3">
                  {!config.is_default && (
                    <button
                      onClick={() => setDefault(config)}
                      disabled={settingDefault === config.id}
                      className="text-xs font-medium text-sky-600 hover:text-sky-700 disabled:opacity-50"
                    >
                      {settingDefault === config.id ? 'Setting...' : 'Set as default'}
                    </button>
                  )}
                  <span className="text-xs text-gray-400">
                    {config.created_at
                      ? new Date(config.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                {/* Pillar weights */}
                <div className="col-span-2">
                  <p className="text-xs font-medium text-gray-500 mb-2">Pillar weights</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Environmental', value: config.e_weight, color: 'bg-green-500' },
                      { label: 'Social', value: config.s_weight, color: 'bg-sky-500' },
                      { label: 'Governance', value: config.g_weight, color: 'bg-purple-500' },
                    ].map(({ label, value, color }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-medium text-gray-900">{(value * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${value * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Penalties */}
                <div className="col-span-1">
                  <p className="text-xs font-medium text-gray-500 mb-2">Penalties</p>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Low confidence</span>
                      <span className="font-medium text-gray-900">−{(config.penalty_confidence_low * 100).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Estimated data</span>
                      <span className="font-medium text-gray-900">−{(config.penalty_confidence_estimated * 100).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">No source</span>
                      <span className="font-medium text-gray-900">−{(config.penalty_no_source * 100).toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Multiplier */}
                <div className="col-span-1">
                  <p className="text-xs font-medium text-gray-500 mb-2">Material multiplier</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ×{config.material_weight_multiplier}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Applied to material indicators
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}