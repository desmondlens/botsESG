'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button, Input, useToast } from '@/components/ui'

interface Props {
  params: Promise<{ workspaceId: string }>
}

export default function NewCyclePage({ params }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { error: toastError } = useToast()

  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
  period_start: '',
  period_end: '',
  reporting_boundary: '',
})

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
    }
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.period_start) e.period_start = 'Period start date is required.'
    if (!form.period_end) e.period_end = 'Period end date is required.'
    if (form.period_start && form.period_end && form.period_end <= form.period_start) {
      e.period_end = 'End date must be after start date.'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)

    const { workspaceId } = await params

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toastError('Session expired. Please sign in again.')
      setLoading(false)
      return
    }

    const { data: cycle, error: cycleError } = await supabase
      .from('assessment_cycles')
      .insert({
        workspace_id: workspaceId,
        period_start: form.period_start,
        period_end: form.period_end,
        status: 'draft',
        created_by: user.id,
        reporting_boundary: form.reporting_boundary.trim() || null,
              })
      .select('id')
      .single()

    if (cycleError || !cycle) {
      toastError('Failed to create assessment cycle. Please try again.')
      setLoading(false)
      return
    }

    router.push(`/workspaces/${workspaceId}/cycles/${cycle.id}`)
  }

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-semibold text-gray-900">New assessment cycle</h1>
        <p className="text-sm text-gray-500 mt-1">
          Define the reporting period for this ESG assessment.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-900">Reporting period</h2>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Period start"
              type="date"
              required
              value={form.period_start}
              onChange={(e) => set('period_start', e.target.value)}
              error={errors.period_start}
            />
            <Input
              label="Period end"
              type="date"
              required
              value={form.period_end}
              onChange={(e) => set('period_end', e.target.value)}
              error={errors.period_end}
            />
          </div>
          <Input
            label="Reporting boundary"
            value={form.reporting_boundary}
            onChange={(e) => set('reporting_boundary', e.target.value)}
            placeholder="e.g. Kalahari Farms (Pty) Ltd only — excludes subsidiary KF Processing CC"
            hint="Describe which legal entities and sites are included in this assessment. Required for IFRS S1 alignment."
          />

          <div className="bg-sky-50 border border-sky-100 rounded-lg px-4 py-3">
            <p className="text-xs text-sky-700">
              The reporting period should align with the client's financial year where possible.
              For a first assessment, a 12-month period ending on the most recent financial
              year-end is recommended.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={loading}>
            Create cycle
          </Button>
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}