'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui'

interface EmissionFactor {
  id: string
  category: string
  subcategory: string
  label: string
  factor: number
  unit_numerator: string
  unit_denominator: string
  scope: string
  source: string
  ar_version: string | null
  gas_coverage: string
  region: string | null
  notes: string | null
}

interface GHGCalculatorProps {
  indicatorLabel: string
  indicatorUnit: string | null
  onResult: (tCO2e: number, calculationNote: string) => void
}

const UNIT_CONVERSIONS: Record<string, { to: string; factor: number; label: string }[]> = {
  litre: [
    { to: 'litre', factor: 1, label: 'Litres (L)' },
    { to: 'litre', factor: 1000, label: 'Cubic metres (m³) → L' },
  ],
  kWh: [
    { to: 'kWh', factor: 1, label: 'Kilowatt-hours (kWh)' },
    { to: 'kWh', factor: 1000, label: 'Megawatt-hours (MWh) → kWh' },
    { to: 'kWh', factor: 1000000, label: 'Gigawatt-hours (GWh) → kWh' },
  ],
  GJ: [
    { to: 'GJ', factor: 1, label: 'Gigajoules (GJ)' },
    { to: 'GJ', factor: 0.0036, label: 'kWh → GJ' },
    { to: 'GJ', factor: 3.6, label: 'MWh → GJ' },
  ],
  km: [
    { to: 'km', factor: 1, label: 'Kilometres (km)' },
    { to: 'km', factor: 1.60934, label: 'Miles → km' },
  ],
  tonne: [
    { to: 'tonne', factor: 1, label: 'Tonnes (t)' },
    { to: 'tonne', factor: 0.001, label: 'Kilograms (kg) → tonnes' },
  ],
  kg: [
    { to: 'kg', factor: 1, label: 'Kilograms (kg)' },
    { to: 'kg', factor: 1000, label: 'Tonnes → kg' },
  ],
  m3: [
    { to: 'm3', factor: 1, label: 'Cubic metres (m³)' },
    { to: 'm3', factor: 0.001, label: 'Litres → m³' },
  ],
  pkm: [
    { to: 'pkm', factor: 1, label: 'Passenger-kilometres (pkm)' },
  ],
}

// Determine which emission factor categories are relevant for a given indicator label
function getRelevantCategories(label: string): string[] {
  const l = label.toLowerCase()
  if (l.includes('scope 1') || l.includes('fuel') || l.includes('combustion')) return ['fuel']
  if (l.includes('scope 2') || l.includes('electricity')) return ['electricity']
  if (l.includes('refrigerant') || l.includes('fugitive')) return ['refrigerant']
  if (l.includes('transport') || l.includes('travel') || l.includes('fleet')) return ['transport']
  if (l.includes('waste')) return ['waste']
  if (l.includes('ghg') || l.includes('greenhouse') || l.includes('emission')) return ['fuel', 'electricity', 'refrigerant']
  return ['fuel', 'electricity', 'refrigerant', 'transport', 'waste']
}

export default function GHGCalculator({ indicatorLabel, indicatorUnit, onResult }: GHGCalculatorProps) {
  const supabase = createClient()

  const [factors, setFactors] = useState<EmissionFactor[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFactorId, setSelectedFactorId] = useState('')
  const [activityValue, setActivityValue] = useState('')
  const [unitConversion, setUnitConversion] = useState('1')
  const [result, setResult] = useState<number | null>(null)
  const [showCalculator, setShowCalculator] = useState(false)

  const relevantCategories = getRelevantCategories(indicatorLabel)

  const fetchFactors = useCallback(async () => {
    const { data } = await supabase
      .from('emission_factors')
      .select('*')
      .in('category', relevantCategories)
      .eq('is_active', true)
      .order('category', { ascending: true })
      .order('label', { ascending: true })

    setFactors((data as EmissionFactor[]) ?? [])
    setLoading(false)
  }, [relevantCategories, supabase])

  useEffect(() => {
    if (showCalculator) fetchFactors()
  }, [showCalculator, fetchFactors])

  const selectedFactor = factors.find((f) => f.id === selectedFactorId)

  const availableConversions = selectedFactor
    ? (UNIT_CONVERSIONS[selectedFactor.unit_denominator] ?? [
        { to: selectedFactor.unit_denominator, factor: 1, label: selectedFactor.unit_denominator },
      ])
    : []

  function calculate() {
    if (!selectedFactor || !activityValue) return

    const activity = parseFloat(activityValue)
    const conversion = parseFloat(unitConversion)

    if (isNaN(activity) || isNaN(conversion)) return

    // Convert activity to the factor's denominator unit, then multiply by factor
    const activityConverted = activity * conversion
    const kgCO2e = activityConverted * selectedFactor.factor
    const tCO2e = kgCO2e / 1000

    setResult(tCO2e)
  }

  function applyResult() {
    if (result === null || !selectedFactor) return

    const convLabel = availableConversions.find((c) => c.factor === parseFloat(unitConversion))?.label ?? ''
    const note = `GHG Calculator: ${activityValue} ${convLabel} × ${selectedFactor.factor} kgCO2e/${selectedFactor.unit_denominator} (${selectedFactor.label}, ${selectedFactor.source}) = ${result.toFixed(4)} tCO2e`

    onResult(parseFloat(result.toFixed(4)), note)
    setShowCalculator(false)
    setResult(null)
    setActivityValue('')
    setSelectedFactorId('')
  }

  // Group factors by category for the select
  const groupedFactors = factors.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = []
    acc[f.category].push(f)
    return acc
  }, {} as Record<string, EmissionFactor[]>)

  const categoryLabels: Record<string, string> = {
    fuel: 'Fuel combustion',
    electricity: 'Electricity',
    refrigerant: 'Refrigerants',
    transport: 'Transport',
    waste: 'Waste',
  }

  if (!showCalculator) {
    return (
      <button
        onClick={() => setShowCalculator(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600
                   hover:text-sky-700 border border-sky-200 px-2.5 py-1.5 rounded-lg
                   hover:bg-sky-50 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        GHG calculator
      </button>
    )
  }

  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-xs font-semibold text-green-800">GHG Calculator</p>
          <Badge variant="green">Emissions = Activity × Emission Factor</Badge>
        </div>
        <button
          onClick={() => setShowCalculator(false)}
          className="text-green-400 hover:text-green-600 text-xs"
        >
          Close
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-green-700">Loading emission factors...</p>
      ) : (
        <>
          {/* Step 1: Select emission factor */}
          <div>
            <label className="block text-xs font-medium text-green-800 mb-1">
              1. Select emission factor
            </label>
            <select
              value={selectedFactorId}
              onChange={(e) => {
                setSelectedFactorId(e.target.value)
                setUnitConversion('1')
                setResult(null)
              }}
              className="w-full px-3 py-2 text-sm border border-green-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-green-500
                         text-gray-900 bg-white"
            >
              <option value="">Select an emission factor...</option>
              {Object.entries(groupedFactors).map(([cat, catFactors]) => (
                <optgroup key={cat} label={categoryLabels[cat] ?? cat}>
                  {catFactors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label} — {f.factor} kgCO2e/{f.unit_denominator} ({f.source})
                      {f.region ? ` [${f.region}]` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Factor details */}
          {selectedFactor && (
            <div className="bg-white rounded-lg border border-green-100 px-3 py-2 text-xs space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">{selectedFactor.label}</span>
                <Badge variant="green">Scope {selectedFactor.scope}</Badge>
                <Badge variant="gray">{selectedFactor.source}</Badge>
                {selectedFactor.ar_version && <Badge variant="gray">{selectedFactor.ar_version}</Badge>}
                {selectedFactor.region && <Badge variant="sky">{selectedFactor.region}</Badge>}
              </div>
              <p className="text-gray-700 font-mono">
                {selectedFactor.factor} {selectedFactor.unit_numerator}/{selectedFactor.unit_denominator}
              </p>
              {selectedFactor.notes && (
                <p className="text-gray-500">{selectedFactor.notes}</p>
              )}
            </div>
          )}

          {/* Step 2: Enter activity data */}
          {selectedFactor && (
            <div>
              <label className="block text-xs font-medium text-green-800 mb-1">
                2. Enter activity data
              </label>
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <input
                    type="number"
                    value={activityValue}
                    onChange={(e) => { setActivityValue(e.target.value); setResult(null) }}
                    placeholder="Enter quantity"
                    className="w-full px-3 py-2 text-sm border border-green-200 rounded-lg
                               focus:outline-none focus:ring-2 focus:ring-green-500
                               placeholder:text-gray-400 text-gray-900"
                  />
                </div>

                {/* Unit conversion selector */}
                {availableConversions.length > 1 && (
                  <div className="flex-1">
                    <select
                      value={unitConversion}
                      onChange={(e) => { setUnitConversion(e.target.value); setResult(null) }}
                      className="w-full px-3 py-2 text-sm border border-green-200 rounded-lg
                                 focus:outline-none focus:ring-2 focus:ring-green-500
                                 text-gray-900 bg-white"
                    >
                      {availableConversions.map((c) => (
                        <option key={c.label} value={c.factor}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={calculate}
                  disabled={!activityValue || !selectedFactorId}
                  className="px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700
                             disabled:bg-green-300 text-white rounded-lg transition-colors
                             disabled:cursor-not-allowed flex-shrink-0"
                >
                  Calculate
                </button>
              </div>

              {/* Formula preview */}
              {activityValue && selectedFactor && (
                <p className="text-xs text-green-700 mt-1.5 font-mono">
                  {activityValue} × {parseFloat(unitConversion) !== 1 ? `${unitConversion} (conversion) × ` : ''}
                  {selectedFactor.factor} kgCO2e/{selectedFactor.unit_denominator} ÷ 1000 = ? tCO2e
                </p>
              )}
            </div>
          )}

          {/* Result */}
          {result !== null && (
            <div className="bg-white border border-green-200 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-green-700 mb-0.5">Calculated emissions</p>
                  <p className="text-2xl font-bold text-green-800">
                    {result.toFixed(4)}
                    <span className="text-sm font-normal text-green-600 ml-1">tCO2e</span>
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    = {(result * 1000).toFixed(2)} kgCO2e
                  </p>
                </div>
                <button
                  onClick={applyResult}
                  className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium
                             px-4 py-2 rounded-lg transition-colors"
                >
                  Apply to response
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Clicking Apply will set the response value to {result.toFixed(4)} tCO2e
                and add a calculation note.
              </p>
            </div>
          )}

          {/* Methodology note */}
          <div className="text-xs text-green-700 border-t border-green-200 pt-2">
            <p className="font-medium mb-0.5">Sources</p>
            <p>DEFRA 2023 Greenhouse Gas Conversion Factors · IPCC AR6 GWP100 · BPC Botswana Grid</p>
            <p className="mt-0.5">Always verify emission factors against the most recent published sources for your reporting year.</p>
          </div>
        </>
      )}
    </div>
  )
}