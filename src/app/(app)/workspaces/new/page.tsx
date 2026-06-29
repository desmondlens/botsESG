'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Input, Select, Textarea, useToast } from '@/components/ui'

const SECTOR_OPTIONS = [
  { value: 'Agribusiness', label: 'Agribusiness' },
  { value: 'Mining & Resources', label: 'Mining & Resources' },
  { value: 'Manufacturing', label: 'Manufacturing' },
  { value: 'Retail & Wholesale', label: 'Retail & Wholesale' },
  { value: 'Construction', label: 'Construction' },
  { value: 'Financial Services', label: 'Financial Services' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Education', label: 'Education' },
  { value: 'Hospitality & Tourism', label: 'Hospitality & Tourism' },
  { value: 'Transport & Logistics', label: 'Transport & Logistics' },
  { value: 'Professional Services', label: 'Professional Services' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Energy & Utilities', label: 'Energy & Utilities' },
  { value: 'Other', label: 'Other' },
]

const SIZE_OPTIONS = [
  { value: 'micro', label: 'Micro (1–10 employees)' },
  { value: 'small', label: 'Small (11–50 employees)' },
  { value: 'medium', label: 'Medium (51–250 employees)' },
  { value: 'large', label: 'Large (250+ employees)' },
]

export default function NewWorkspacePage() {
  const router = useRouter()
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [coiDeclared, setCoiDeclared] = useState(false)

  const [form, setForm] = useState({
    name: '',
    registration_number: '',
    sector: '',
    sub_sector: '',
    country: 'Botswana',
    size_category: '',
    employee_count: '',
    annual_turnover_bwp: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Organisation name is required.'
    if (!form.sector) e.sector = 'Please select a sector.'
    if (!form.size_category) e.size_category = 'Please select a size category.'
    if (form.employee_count && isNaN(parseInt(form.employee_count))) {
      e.employee_count = 'Must be a whole number.'
    }
    if (form.annual_turnover_bwp && isNaN(parseFloat(form.annual_turnover_bwp))) {
      e.annual_turnover_bwp = 'Must be a valid number.'
    }
    if (!coiDeclared) e.coi = 'You must declare no conflict of interest before proceeding.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toastError('Session expired. Please sign in again.')
      setLoading(false)
      return
    }

    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({
        name: form.name.trim(),
        registration_number: form.registration_number.trim() || null,
        sector: form.sector || null,
        sub_sector: form.sub_sector.trim() || null,
        country: form.country.trim(),
        size_category: (form.size_category as 'micro' | 'small' | 'medium' | 'large') || null,
        employee_count: form.employee_count ? parseInt(form.employee_count) : null,
        annual_turnover_bwp: form.annual_turnover_bwp ? parseFloat(form.annual_turnover_bwp) : null,
      })
      .select('id')
      .single()

    if (orgError || !org) {
      toastError('Failed to create organisation. Please try again.')
      setLoading(false)
      return
    }

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        org_id: org.id,
        assigned_consultant_id: user.id,
        status: 'active',
        notes: form.notes.trim() || null,
      })
      .select('id')
      .single()

    if (wsError || !workspace) {
      toastError('Failed to create workspace. Please try again.')
      setLoading(false)
      return
    }

    success(`Workspace created for ${form.name.trim()}.`)
    router.push(`/workspaces/${workspace.id}`)

    await supabase.from('audit_log').insert({
  table_name: 'workspaces',
  record_id: workspace.id,
  action: 'insert',
  new_values: {
    event: 'conflict_of_interest_declaration',
    declared_by: user.id,
    declared_at: new Date().toISOString(),
    organisation: form.name.trim(),
    declaration: 'Consultant declared no conflict of interest',
  },
  source_module: 'new_workspace',
})
  }


  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <Link href="/workspaces" className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← Back to workspaces
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">New workspace</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a client organisation and open a workspace to begin ESG assessment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Organisation details */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Organisation details</h2>
          <div className="space-y-4">
            <Input
              label="Organisation name"
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Kalahari Farms (Pty) Ltd"
              error={errors.name}
            />

            <Input
              label="Registration number"
              value={form.registration_number}
              onChange={(e) => set('registration_number', e.target.value)}
              placeholder="e.g. BW00012345678"
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Sector"
                required
                value={form.sector}
                onChange={(e) => set('sector', e.target.value)}
                options={SECTOR_OPTIONS}
                placeholder="Select sector"
                error={errors.sector}
              />
              <Input
                label="Sub-sector"
                value={form.sub_sector}
                onChange={(e) => set('sub_sector', e.target.value)}
                placeholder="e.g. Crop production"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Size category"
                required
                value={form.size_category}
                onChange={(e) => set('size_category', e.target.value)}
                options={SIZE_OPTIONS}
                placeholder="Select size"
                error={errors.size_category}
              />
              <Input
                label="Country"
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Number of employees"
                type="number"
                min="1"
                value={form.employee_count}
                onChange={(e) => set('employee_count', e.target.value)}
                placeholder="e.g. 45"
                error={errors.employee_count}
              />
              <Input
                label="Annual turnover (BWP)"
                type="number"
                min="0"
                value={form.annual_turnover_bwp}
                onChange={(e) => set('annual_turnover_bwp', e.target.value)}
                placeholder="e.g. 5000000"
                error={errors.annual_turnover_bwp}
              />
            </div>
          </div>
        </div>

        {/* Workspace notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-5">Workspace notes</h2>
          <Textarea
            label="Internal notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="e.g. Client referred by BDC. Targeting CEDA financing application Q3 2026."
          />
        </div>

        {/* Conflict of interest declaration */}
<div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
  <h2 className="text-sm font-semibold text-amber-900 mb-2">Conflict of interest declaration</h2>
  <p className="text-xs text-amber-800 mb-4">
    Before commencing this ESG assessment, the assigned consultant must confirm that no conflict
    of interest exists. A conflict of interest includes any direct or indirect financial interest
    in the client organisation, employment of an immediate family member in a senior role, or any
    personal relationship that could compromise objectivity.
  </p>
  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={coiDeclared}
      onChange={(e) => {
        setCoiDeclared(e.target.checked)
        if (errors.coi) setErrors((prev) => { const er = { ...prev }; delete er.coi; return er })
      }}
      className="mt-0.5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
    />
    <span className="text-xs text-amber-800 font-medium">
      I confirm that I have no conflict of interest in relation to this client organisation
      and that I am able to conduct this assessment with objectivity and independence.
      I understand that this declaration is recorded in the platform audit log.
    </span>
  </label>
  {errors.coi && (
    <p className="text-xs text-red-600 mt-2">{errors.coi}</p>
  )}
</div>
        <div className="flex items-center gap-3">
          <Button type="submit" loading={loading}>
            Create workspace
          </Button>
          <Link href="/workspaces" className="text-sm text-gray-500 hover:text-gray-700">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}