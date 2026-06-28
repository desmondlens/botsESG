'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Badge, Card, EmptyState } from '@/components/ui'
import { useStageGuard } from '@/hooks/useStageGuard'

// ─── DFI requirement definitions ─────────────────────────────────────────────
// Each requirement maps to one or more indicator labels or IFRS disclosure codes
// that must be present and have a response to be considered met.

interface Requirement {
  id: string
  category: string
  label: string
  description: string
  indicatorLabels?: string[]       // partial match on indicator label
  ifrsCode?: string                // IFRS disclosure code
  requiresSource?: boolean         // must have source reference
  requiresTarget?: boolean         // must have target set
  mandatory: boolean               // mandatory vs recommended
}

interface DFI {
  id: string
  name: string
  fullName: string
  color: string
  bgColor: string
  borderColor: string
  focus: string
  requirements: Requirement[]
}

const DFIS: DFI[] = [
  {
    id: 'ceda',
    name: 'CEDA',
    fullName: 'Citizen Entrepreneurial Development Agency',
    color: 'text-sky-800',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    focus: 'Citizen-owned SMEs · Agribusiness · Manufacturing · Youth and women empowerment · Poultry Financial Suite',
    requirements: [
      // Environmental
      {
        id: 'ceda-ghg1', category: 'Environmental', mandatory: true,
        label: 'Scope 1 GHG emissions disclosed',
        description: 'CEDA ESG framework requires disclosure of direct GHG emissions from operations. Critical for agribusiness and manufacturing applicants.',
        indicatorLabels: ['Scope 1 GHG'],
      },
      {
        id: 'ceda-ghg2', category: 'Environmental', mandatory: true,
        label: 'Scope 2 GHG emissions disclosed',
        description: 'Indirect emissions from purchased electricity must be disclosed. Use BPC grid factor of 0.90 kgCO2e/kWh.',
        indicatorLabels: ['Scope 2 GHG'],
      },
      {
        id: 'ceda-energy', category: 'Environmental', mandatory: true,
        label: 'Energy consumption reported',
        description: 'Total energy use and renewable share required to demonstrate operational efficiency.',
        indicatorLabels: ['Total energy consumption'],
      },
      {
        id: 'ceda-water', category: 'Environmental', mandatory: true,
        label: 'Water withdrawal reported',
        description: 'Water consumption data required for agribusiness applicants — critical for poultry and horticulture operations.',
        indicatorLabels: ['Total water withdrawal'],
      },
      {
        id: 'ceda-waste', category: 'Environmental', mandatory: false,
        label: 'Waste management disclosed',
        description: 'Total waste generated and disposal method. Particularly relevant for poultry processing and food production operations.',
        indicatorLabels: ['Total waste generated'],
      },
      {
        id: 'ceda-compliance', category: 'Environmental', mandatory: true,
        label: 'Environmental regulatory compliance confirmed',
        description: 'CEDA requires evidence of compliance with Botswana environmental regulations — DEA permits, waste management certificates.',
        indicatorLabels: ['Environmental regulatory compliance'],
        requiresSource: true,
      },
      {
        id: 'ceda-climate', category: 'Environmental', mandatory: false,
        label: 'Climate risk assessment conducted',
        description: 'Demonstrates awareness of climate-related risks to the business model. Increasingly expected for agribusiness loans.',
        indicatorLabels: ['Climate-related risk assessment'],
      },
      // Social
      {
        id: 'ceda-employees', category: 'Social', mandatory: true,
        label: 'Total employees reported',
        description: 'CEDA prioritises job creation. Employee count is a core metric for measuring developmental impact.',
        indicatorLabels: ['Total number of employees'],
        requiresSource: true,
      },
      {
        id: 'ceda-minwage', category: 'Social', mandatory: true,
        label: 'Minimum wage compliance confirmed',
        description: 'Compliance with Botswana Employment Act minimum wage requirements must be confirmed.',
        indicatorLabels: ['Minimum wage compliance'],
        requiresSource: true,
      },
      {
        id: 'ceda-ohs', category: 'Social', mandatory: true,
        label: 'OHS — work-related fatalities disclosed',
        description: 'Occupational health and safety record is reviewed as part of CEDA social assessment.',
        indicatorLabels: ['Work-related fatalities'],
      },
      {
        id: 'ceda-gender', category: 'Social', mandatory: false,
        label: 'Gender workforce ratio reported',
        description: 'CEDA prioritises women empowerment. Gender disaggregation of workforce strengthens application.',
        indicatorLabels: ['Gender ratio of workforce'],
      },
      {
        id: 'ceda-training', category: 'Social', mandatory: false,
        label: 'Training hours per employee reported',
        description: 'Skills development is a CEDA priority. Training data demonstrates commitment to human capital.',
        indicatorLabels: ['Average training hours per employee'],
      },
      {
        id: 'ceda-econ', category: 'Social', mandatory: false,
        label: 'Economic value generated and distributed',
        description: 'Shows contribution to local economy — wages, taxes, community investment. Strengthens developmental impact case.',
        indicatorLabels: ['Economic value generated'],
      },
      // Governance
      {
        id: 'ceda-anticorrupt', category: 'Governance', mandatory: true,
        label: 'Anti-corruption policy in place',
        description: 'CEDA requires evidence of ethical governance practices as part of its ESG framework rollout.',
        indicatorLabels: ['Anti-corruption policy'],
        requiresSource: true,
      },
      {
        id: 'ceda-esgpol', category: 'Governance', mandatory: true,
        label: 'ESG or sustainability policy in place',
        description: 'A formal ESG policy document demonstrates commitment to CEDA\'s ESG framework requirements.',
        indicatorLabels: ['ESG or sustainability policy'],
        requiresSource: true,
      },
      {
        id: 'ceda-board', category: 'Governance', mandatory: false,
        label: 'Board composition disclosed',
        description: 'Board or governing body structure demonstrates sound governance for loan administration.',
        indicatorLabels: ['Board or governing body composition'],
      },
      {
        id: 'ceda-whistle', category: 'Governance', mandatory: false,
        label: 'Whistleblower protection mechanism',
        description: 'Internal reporting channels demonstrate governance maturity.',
        indicatorLabels: ['Whistleblower protection mechanism'],
      },
      // IFRS narrative
      {
        id: 'ceda-ifrs-gov', category: 'IFRS disclosures', mandatory: false,
        label: 'IFRS S1 governance narrative completed',
        description: 'Board oversight and management role disclosures strengthen the governance section of the ESG report.',
        ifrsCode: 'S1-6a',
      },
      {
        id: 'ceda-ifrs-risk', category: 'IFRS disclosures', mandatory: false,
        label: 'Risk management process described',
        description: 'How the entity identifies and manages sustainability risks — required for IFRS S1 alignment.',
        ifrsCode: 'S1-25a',
      },
    ],
  },
  {
    id: 'bdc',
    name: 'BDC',
    fullName: 'Botswana Development Corporation',
    color: 'text-green-800',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    focus: 'Medium and large enterprises · Manufacturing · Property · Tourism · IFC Performance Standards alignment',
    requirements: [
      // IFC Performance Standards alignment (BDC follows IFC E&S standards)
      {
        id: 'bdc-esms', category: 'Environmental', mandatory: true,
        label: 'Environmental and social management system evidenced',
        description: 'BDC aligns with IFC Performance Standards. An ESMS policy or document is required for medium and large loan applications.',
        indicatorLabels: ['ESG or sustainability policy'],
        requiresSource: true,
      },
      {
        id: 'bdc-ghg', category: 'Environmental', mandatory: true,
        label: 'GHG emissions (Scope 1 and 2) disclosed',
        description: 'IFC PS3 requires pollution prevention and GHG disclosure for all BDC-financed projects.',
        indicatorLabels: ['Scope 1 GHG', 'Scope 2 GHG'],
      },
      {
        id: 'bdc-energy', category: 'Environmental', mandatory: true,
        label: 'Energy efficiency measures disclosed',
        description: 'Total energy consumption and renewable share demonstrate PS3 resource efficiency.',
        indicatorLabels: ['Total energy consumption', 'Renewable energy share'],
      },
      {
        id: 'bdc-water', category: 'Environmental', mandatory: true,
        label: 'Water management disclosed',
        description: 'IFC PS3 and PS6 require water consumption disclosure and management approach for water-intensive operations.',
        indicatorLabels: ['Total water withdrawal'],
        requiresSource: true,
      },
      {
        id: 'bdc-waste', category: 'Environmental', mandatory: true,
        label: 'Hazardous and non-hazardous waste managed',
        description: 'IFC PS3 requires disclosure of waste volumes and disposal methods. Critical for manufacturing and processing applicants.',
        indicatorLabels: ['Total waste generated', 'Hazardous waste generated'],
        requiresSource: true,
      },
      {
        id: 'bdc-land', category: 'Environmental', mandatory: false,
        label: 'Land use and rehabilitation plan',
        description: 'IFC PS6 requires biodiversity and land use assessment for projects with significant land footprint.',
        indicatorLabels: ['Land use and rehabilitation'],
      },
      {
        id: 'bdc-climate', category: 'Environmental', mandatory: false,
        label: 'Climate risk assessed',
        description: 'BDC increasingly applies TCFD-aligned climate risk assessment for infrastructure and property loans.',
        indicatorLabels: ['Climate-related risk assessment'],
      },
      {
        id: 'bdc-employees', category: 'Social', mandatory: true,
        label: 'Workforce size and composition reported',
        description: 'IFC PS2 requires disclosure of employment figures and working conditions.',
        indicatorLabels: ['Total number of employees'],
        requiresSource: true,
      },
      {
        id: 'bdc-ohs', category: 'Social', mandatory: true,
        label: 'OHS management and incident data',
        description: 'IFC PS2 requires an occupational health and safety management system and incident disclosure.',
        indicatorLabels: ['Work-related fatalities', 'Work-related injury rate', 'Lost time injury frequency rate'],
        requiresSource: true,
      },
      {
        id: 'bdc-childlabour', category: 'Social', mandatory: true,
        label: 'Child labour and forced labour policies confirmed',
        description: 'IFC PS2 requires explicit policies and compliance confirmation on child and forced labour.',
        indicatorLabels: ['Child labour policy and compliance', 'Forced labour policy and compliance'],
        requiresSource: true,
      },
      {
        id: 'bdc-grievance', category: 'Social', mandatory: true,
        label: 'Grievance mechanism in place',
        description: 'IFC PS1 requires a grievance mechanism accessible to affected communities and workers.',
        indicatorLabels: ['Grievance mechanism'],
        requiresSource: true,
      },
      {
        id: 'bdc-community', category: 'Social', mandatory: false,
        label: 'Community engagement documented',
        description: 'IFC PS1 and PS5 require stakeholder engagement for projects with community impacts.',
        indicatorLabels: ['Community engagement mechanisms'],
      },
      {
        id: 'bdc-board', category: 'Governance', mandatory: true,
        label: 'Board composition and independence disclosed',
        description: 'BDC assesses corporate governance structure as part of investment appraisal.',
        indicatorLabels: ['Board or governing body composition', 'Independent board members'],
        requiresSource: true,
      },
      {
        id: 'bdc-anticorrupt', category: 'Governance', mandatory: true,
        label: 'Anti-corruption controls in place',
        description: 'BDC requires evidence of anti-corruption policies and training coverage.',
        indicatorLabels: ['Anti-corruption policy', 'Anti-corruption training coverage'],
        requiresSource: true,
      },
      {
        id: 'bdc-reporting', category: 'Governance', mandatory: false,
        label: 'Sustainability reporting practice confirmed',
        description: 'Evidence of prior ESG or sustainability reporting strengthens BDC application.',
        indicatorLabels: ['Sustainability reporting practice'],
      },
      {
        id: 'bdc-ifrs-strategy', category: 'IFRS disclosures', mandatory: false,
        label: 'IFRS S1 strategy narrative completed',
        description: 'How sustainability risks and opportunities affect the business model — required for IFRS S1 alignment.',
        ifrsCode: 'S1-10a',
      },
      {
        id: 'bdc-ifrs-climate', category: 'IFRS disclosures', mandatory: false,
        label: 'IFRS S2 climate risk narrative completed',
        description: 'Physical and transition climate risks relevant to BDC infrastructure and property portfolios.',
        ifrsCode: 'S2-10a',
      },
    ],
  },
  {
    id: 'ndb',
    name: 'NDB',
    fullName: 'National Development Bank',
    color: 'text-purple-800',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    focus: 'Agriculture · Property · Education · Retail · Citizens and non-citizens · Transitioning to dedicated agricultural bank',
    requirements: [
      {
        id: 'ndb-water', category: 'Environmental', mandatory: true,
        label: 'Water consumption data for agricultural operations',
        description: 'NDB agricultural lending requires water usage data given Botswana drought exposure. Critical for irrigation and livestock operations.',
        indicatorLabels: ['Total water withdrawal'],
        requiresSource: true,
      },
      {
        id: 'ndb-land', category: 'Environmental', mandatory: true,
        label: 'Land use and rehabilitation plan',
        description: 'NDB requires land use data for agricultural loan applications — area under cultivation, rehabilitation obligations.',
        indicatorLabels: ['Land use and rehabilitation'],
        requiresSource: true,
      },
      {
        id: 'ndb-ghg', category: 'Environmental', mandatory: false,
        label: 'GHG emissions baseline established',
        description: 'NDB is developing ESG lending criteria aligned with Botswana NDC. GHG baseline strengthens application.',
        indicatorLabels: ['Scope 1 GHG', 'Scope 2 GHG'],
      },
      {
        id: 'ndb-waste', category: 'Environmental', mandatory: false,
        label: 'Waste management approach disclosed',
        description: 'Waste from agricultural operations — organic waste, packaging, chemicals — should be disclosed.',
        indicatorLabels: ['Total waste generated'],
      },
      {
        id: 'ndb-employees', category: 'Social', mandatory: true,
        label: 'Employment figures reported',
        description: 'NDB measures developmental impact through job creation. Employee headcount is a primary metric.',
        indicatorLabels: ['Total number of employees'],
        requiresSource: true,
      },
      {
        id: 'ndb-minwage', category: 'Social', mandatory: true,
        label: 'Minimum wage compliance confirmed',
        description: 'Compliance with Botswana Employment Act is a prerequisite for NDB lending.',
        indicatorLabels: ['Minimum wage compliance'],
        requiresSource: true,
      },
      {
        id: 'ndb-ohs', category: 'Social', mandatory: true,
        label: 'OHS safety record disclosed',
        description: 'Agricultural and food processing operations carry OHS risks — NDB requires safety record disclosure.',
        indicatorLabels: ['Work-related fatalities', 'Work-related injury rate'],
      },
      {
        id: 'ndb-gender', category: 'Social', mandatory: false,
        label: 'Women employment ratio reported',
        description: 'NDB supports women economic empowerment. Gender disaggregation strengthens developmental impact score.',
        indicatorLabels: ['Gender ratio of workforce', 'Women in management'],
      },
      {
        id: 'ndb-local', category: 'Social', mandatory: false,
        label: 'Local procurement percentage reported',
        description: 'NDB prioritises local economic linkages — sourcing from local suppliers demonstrates community benefit.',
        indicatorLabels: ['Local procurement percentage'],
      },
      {
        id: 'ndb-esgpol', category: 'Governance', mandatory: true,
        label: 'ESG policy or sustainability policy in place',
        description: 'A formal ESG policy is increasingly required for NDB agricultural and commercial loan applications.',
        indicatorLabels: ['ESG or sustainability policy'],
        requiresSource: true,
      },
      {
        id: 'ndb-anticorrupt', category: 'Governance', mandatory: true,
        label: 'Anti-corruption policy confirmed',
        description: 'NDB requires confirmation of anti-corruption controls as part of governance assessment.',
        indicatorLabels: ['Anti-corruption policy'],
        requiresSource: true,
      },
      {
        id: 'ndb-board', category: 'Governance', mandatory: false,
        label: 'Board or governing body composition',
        description: 'Governance structure disclosure demonstrates management capacity for loan administration.',
        indicatorLabels: ['Board or governing body composition'],
      },
      {
        id: 'ndb-reporting', category: 'Governance', mandatory: false,
        label: 'Sustainability reporting practice',
        description: 'Prior ESG reporting demonstrates institutional capacity and governance maturity.',
        indicatorLabels: ['Sustainability reporting practice'],
      },
    ],
  },
]

interface ResponseMap {
  [label: string]: {
    hasValue: boolean
    hasSource: boolean
    hasTarget: boolean
    confidence: string
  }
}

interface IFRSMap {
  [code: string]: {
    hasNarrative: boolean
    isOmitted: boolean
  }
}

const STATUS_CONFIG = {
  met: { label: 'Met', variant: 'green' as const, dot: 'bg-green-500' },
  partial: { label: 'Partial', variant: 'amber' as const, dot: 'bg-amber-400' },
  missing: { label: 'Missing', variant: 'red' as const, dot: 'bg-red-500' },
}

export default function FinanceReadinessPage() {
  const { workspaceId, cycleId } = useParams<{ workspaceId: string; cycleId: string }>()
  const guard = useStageGuard(workspaceId, cycleId, 8)
  const supabase = createClient()
  const [responseMap, setResponseMap] = useState<ResponseMap>({})
  const [ifrsMap, setIfrsMap] = useState<IFRSMap>({})
  const [loading, setLoading] = useState(true)
  const [activeDFI, setActiveDFI] = useState('ceda')
  const [filterMandatory, setFilterMandatory] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: responses } = await supabase
      .from('responses')
      .select('indicator_id, value_number, value_text, value_boolean, source_reference, confidence_level, is_not_applicable, target_value, indicators(label)')
      .eq('cycle_id', cycleId)

    const { data: ifrsDiscs } = await supabase
      .from('ifrs_disclosures')
      .select('disclosure_code, narrative_response, is_omitted')
      .eq('cycle_id', cycleId)

    const rMap: ResponseMap = {}
    for (const r of responses ?? []) {
      const ind = Array.isArray(r.indicators) ? r.indicators[0] : r.indicators
      const label = ind?.label as string
      if (!label) continue
      const hasValue = r.is_not_applicable ||
        r.value_number !== null ||
        (r.value_text !== null && r.value_text !== '') ||
        r.value_boolean !== null
      rMap[label] = {
        hasValue,
        hasSource: !!r.source_reference,
        hasTarget: r.target_value !== null,
        confidence: r.confidence_level ?? 'medium',
      }
    }

    const iMap: IFRSMap = {}
    for (const d of ifrsDiscs ?? []) {
      iMap[d.disclosure_code] = {
        hasNarrative: !!d.narrative_response,
        isOmitted: d.is_omitted,
      }
    }

    setResponseMap(rMap)
    setIfrsMap(iMap)
    setLoading(false)
  }, [cycleId, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  function getRequirementStatus(req: Requirement): 'met' | 'partial' | 'missing' {
    // IFRS disclosure requirement
    if (req.ifrsCode) {
      const disc = ifrsMap[req.ifrsCode]
      if (!disc) return 'missing'
      if (disc.isOmitted) return 'partial'
      return disc.hasNarrative ? 'met' : 'missing'
    }

    // Indicator requirement — check all indicator labels (partial match)
    if (!req.indicatorLabels || req.indicatorLabels.length === 0) return 'missing'

    const matches = req.indicatorLabels.map((labelFragment) => {
      const key = Object.keys(responseMap).find((k) =>
        k.toLowerCase().includes(labelFragment.toLowerCase())
      )
      return key ? responseMap[key] : null
    }).filter(Boolean)

    if (matches.length === 0) return 'missing'

    const allHaveValues = matches.every((m) => m!.hasValue)
    if (!allHaveValues) return 'missing'

    if (req.requiresSource && matches.some((m) => !m!.hasSource)) return 'partial'

    return 'met'
  }

  function getReadinessScore(dfi: DFI): { score: number; mandatory: number; mandatoryMet: number; total: number; met: number } {
    let met = 0
    let mandatoryMet = 0
    const mandatory = dfi.requirements.filter((r) => r.mandatory).length

    for (const req of dfi.requirements) {
      const status = getRequirementStatus(req)
      if (status === 'met') {
        met++
        if (req.mandatory) mandatoryMet++
      } else if (status === 'partial') {
        met += 0.5
        if (req.mandatory) mandatoryMet += 0.5
      }
    }

    return {
      score: Math.round((met / dfi.requirements.length) * 100),
      mandatory,
      mandatoryMet: Math.round(mandatoryMet),
      total: dfi.requirements.length,
      met: Math.round(met),
    }
  }

  const currentDFI = DFIS.find((d) => d.id === activeDFI) ?? DFIS[0]
  const filteredReqs = filterMandatory
    ? currentDFI.requirements.filter((r) => r.mandatory)
    : currentDFI.requirements

  // Group by category
  const categories = [...new Set(filteredReqs.map((r) => r.category))]

  const scoreColor = (score: number) =>
    score >= 70 ? 'text-green-700' : score >= 40 ? 'text-amber-600' : 'text-red-600'
  const scoreBg = (score: number) =>
    score >= 70 ? 'bg-green-50 border-green-200' : score >= 40 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
  
  if (guard.checking || !guard.allowed) return null
  
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <Link href={`/workspaces/${workspaceId}/cycles/${cycleId}`} className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← Back to cycle
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Finance readiness</h1>
        <p className="text-sm text-gray-500 mt-1">
          How ready is this ESG assessment for submission to Botswana development finance institutions.
        </p>
      </div>

      {/* DFI overview cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {DFIS.map((dfi) => {
          const { score, mandatoryMet, mandatory } = getReadinessScore(dfi)
          return (
            <button
              key={dfi.id}
              onClick={() => setActiveDFI(dfi.id)}
              className={`text-left rounded-xl border-2 p-4 transition-all ${
                activeDFI === dfi.id
                  ? `${dfi.borderColor} ${dfi.bgColor}`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <p className={`text-sm font-bold ${activeDFI === dfi.id ? dfi.color : 'text-gray-900'}`}>
                  {dfi.name}
                </p>
                <p className={`text-2xl font-bold ${scoreColor(score)}`}>{score}%</p>
              </div>
              <p className="text-xs text-gray-500 mb-3">{dfi.fullName}</p>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all ${
                    score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-500'
                  }`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {mandatoryMet} of {mandatory} mandatory requirements met
              </p>
            </button>
          )
        })}
      </div>

      {/* Active DFI detail */}
      <div className={`rounded-xl border ${currentDFI.borderColor} ${currentDFI.bgColor} px-5 py-4 mb-6`}>
        <p className={`text-xs font-semibold ${currentDFI.color} mb-1`}>{currentDFI.fullName}</p>
        <p className="text-xs text-gray-600">{currentDFI.focus}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {['all', 'mandatory'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterMandatory(f === 'mandatory')}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors capitalize ${
                (f === 'mandatory') === filterMandatory
                  ? 'bg-sky-600 border-sky-600 text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === 'all' ? 'All requirements' : 'Mandatory only'}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-gray-400">Loading...</span>}
      </div>

      {/* Requirements by category */}
      {categories.map((category) => {
        const catReqs = filteredReqs.filter((r) => r.category === category)
        const catMet = catReqs.filter((r) => getRequirementStatus(r) === 'met').length
        const catPartial = catReqs.filter((r) => getRequirementStatus(r) === 'partial').length

        return (
          <div key={category} className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-semibold text-gray-900">{category}</h2>
              <span className="text-xs text-gray-400">
                {catMet} met · {catPartial} partial · {catReqs.length - catMet - catPartial} missing
              </span>
            </div>

            <div className="space-y-2">
              {catReqs.map((req) => {
                const status = getRequirementStatus(req)
                const config = STATUS_CONFIG[status]

                return (
                  <div
                    key={req.id}
                    className={`bg-white rounded-xl border px-5 py-4 flex items-start gap-4 ${
                      status === 'met' ? 'border-green-200' :
                      status === 'partial' ? 'border-amber-200' :
                      'border-gray-200'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-medium text-gray-900">{req.label}</p>
                        {req.mandatory && (
                          <Badge variant="red">Required</Badge>
                        )}
                        <Badge variant={config.variant}>{config.label}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">{req.description}</p>
                      {status !== 'met' && req.indicatorLabels && (
                        <p className="text-xs text-gray-400 mt-1">
                          Mapped to:{' '}
                          {req.indicatorLabels.map((l) => (
                            <span key={l} className="font-medium text-gray-500">{l}</span>
                          )).reduce((prev, curr) => <>{prev}, {curr}</>)}
                          {' '}—{' '}
                          <Link
                            href={`/workspaces/${workspaceId}/cycles/${cycleId}/assessment`}
                            className="text-sky-600 hover:text-sky-700 underline"
                          >
                            go to data collection →
                          </Link>
                        </p>
                      )}
                      {status !== 'met' && req.ifrsCode && (
                        <p className="text-xs text-gray-400 mt-1">
                          IFRS disclosure {req.ifrsCode} —{' '}
                          <Link
                            href={`/workspaces/${workspaceId}/cycles/${cycleId}/ifrs`}
                            className="text-sky-600 hover:text-sky-700 underline"
                          >
                            go to IFRS disclosures →
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Summary */}
      <Card>
        <div className="grid grid-cols-3 gap-4">
          {DFIS.map((dfi) => {
            const { score, met, total, mandatoryMet, mandatory } = getReadinessScore(dfi)
            return (
              <div key={dfi.id} className={`rounded-lg border px-4 py-3 ${scoreBg(score)}`}>
                <p className={`text-xs font-semibold mb-2 ${dfi.color}`}>{dfi.name} — {dfi.fullName}</p>
                <p className={`text-3xl font-bold mb-1 ${scoreColor(score)}`}>{score}%</p>
                <p className="text-xs text-gray-500">{met} of {total} requirements met</p>
                <p className="text-xs text-gray-500">{mandatoryMet} of {mandatory} mandatory</p>
                <div className="mt-2 h-1.5 bg-white bg-opacity-60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}