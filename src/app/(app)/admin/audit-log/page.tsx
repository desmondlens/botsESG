'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge, Card, EmptyState } from '@/components/ui'

interface AuditEntry {
  id: string
  table_name: string
  record_id: string | null
  action: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  changed_by: string | null
  changed_at: string | null
  user_name?: string
}

const ACTION_COLORS: Record<string, 'green' | 'amber' | 'red' | 'sky'> = {
  insert: 'green',
  update: 'amber',
  delete: 'red',
}

const TABLE_LABELS: Record<string, string> = {
  workspaces: 'Workspace',
  organisations: 'Organisation',
  assessment_cycles: 'Assessment cycle',
  materiality_topics: 'Materiality topic',
  cycle_indicators: 'Cycle indicator',
  responses: 'Response',
  documents: 'Document',
  scores: 'Score',
  reports: 'Report',
  report_snapshots: 'Report snapshot',
  users: 'User',
  indicators: 'Indicator',
  scoring_configs: 'Scoring config',
  ifrs_disclosures: 'IFRS disclosure',
}

// Fields to show in summary per table
const SUMMARY_FIELDS: Record<string, string[]> = {
  responses: ['value_number', 'value_text', 'value_boolean', 'confidence_level', 'source_reference'],
  materiality_topics: ['topic_name', 'impact_score', 'financial_score', 'is_material'],
  organisations: ['name', 'sector', 'country'],
  workspaces: ['status', 'notes'],
  assessment_cycles: ['period_start', 'period_end', 'status'],
  users: ['full_name', 'email', 'role', 'is_active'],
  indicators: ['label', 'pillar', 'is_active'],
  scoring_configs: ['config_name', 'is_default'],
  ifrs_disclosures: ['disclosure_code', 'disclosure_title', 'is_omitted'],
  documents: ['filename', 'document_type'],
  scores: ['overall_score', 'e_score', 's_score', 'g_score'],
}

const FIELD_LABELS: Record<string, string | null> = {
  value_number: 'Value',
  value_text: 'Response',
  value_boolean: 'Answer',
  confidence_level: 'Confidence',
  source_reference: 'Source',
  is_not_applicable: 'Not applicable',
  consultant_note: 'Consultant note',
  target_value: 'Target value',
  target_year: 'Target year',
  topic_name: 'Topic',
  impact_score: 'Impact score',
  financial_score: 'Financial score',
  is_material: 'Material',
  time_horizon: 'Time horizon',
  financial_effect: 'Financial effect',
  full_name: 'Name',
  email: 'Email',
  role: 'Role',
  is_active: 'Active',
  label: 'Indicator',
  pillar: 'Pillar',
  config_name: 'Config name',
  is_default: 'Default config',
  disclosure_code: 'Disclosure',
  narrative_response: 'Narrative',
  is_omitted: 'Omitted',
  filename: 'File',
  document_type: 'Document type',
  overall_score: 'Overall score',
  e_score: 'Environmental score',
  s_score: 'Social score',
  g_score: 'Governance score',
  status: 'Status',
  period_start: 'Period start',
  period_end: 'Period end',
  updated_at: null,
  created_at: null,
  updated_by: null,
  created_by: null,
}

function formatFieldValue(field: string, val: unknown): string {
  if (val === null || val === undefined) return 'empty'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (field.includes('score') && typeof val === 'number') return `${val.toFixed(1)} / 100`
  if (typeof val === 'string' && val.length > 60) return val.slice(0, 60) + '...'
  return String(val)
}

function getSummaryFields(tableName: string): string[] {
  return SUMMARY_FIELDS[tableName] ?? ['id']
}

function getSummary(entry: AuditEntry): string {
  const tableLabel = TABLE_LABELS[entry.table_name] ?? entry.table_name

  if (entry.action === 'update') {
    const old = entry.old_values ?? {}
    const next = entry.new_values ?? {}
    const changed = Object.keys(next).filter(
      (k) => FIELD_LABELS[k] !== null &&
             FIELD_LABELS[k] !== undefined &&
             JSON.stringify(old[k]) !== JSON.stringify(next[k])
    )
    if (changed.length === 0) return `Updated ${tableLabel.toLowerCase()}`
    return changed.slice(0, 2).map((k) => {
      const label = FIELD_LABELS[k] ?? k
      const from = formatFieldValue(k, old[k])
      const to = formatFieldValue(k, next[k])
      return `${label} changed from ${from} to ${to}`
    }).join(' · ')
  }

  const data = entry.action === 'delete' ? entry.old_values : entry.new_values
  if (!data) return `${entry.action === 'insert' ? 'Added' : 'Deleted'} ${tableLabel.toLowerCase()}`

  const fields = getSummaryFields(entry.table_name)
  const parts = fields
    .filter((f) => data[f] !== null && data[f] !== undefined && FIELD_LABELS[f] !== null)
    .map((f) => `${FIELD_LABELS[f] ?? f}: ${formatFieldValue(f, data[f])}`)
    .slice(0, 3)

  const verb = entry.action === 'insert' ? 'Added' : 'Deleted'
  return parts.length > 0
    ? `${verb} ${tableLabel.toLowerCase()} — ${parts.join(', ')}`
    : `${verb} ${tableLabel.toLowerCase()}`
}

function getChangedFields(entry: AuditEntry): { field: string; from: unknown; to: unknown }[] {
  if (entry.action !== 'update' || !entry.old_values || !entry.new_values) return []
  return Object.keys(entry.new_values)
    .filter((k) => JSON.stringify(entry.old_values![k]) !== JSON.stringify(entry.new_values![k]))
    .map((k) => ({ field: k, from: entry.old_values![k], to: entry.new_values![k] }))
}

function formatVal(val: unknown): string {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 80)
  return String(val).slice(0, 80)
}

const PAGE_SIZE = 50

export default function AdminAuditLogPage() {
  const supabase = createClient()

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filterAction, setFilterAction] = useState('all')
  const [filterTable, setFilterTable] = useState('all')
  const [page, setPage] = useState(0)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Step 1: fetch audit log rows (no join)
    let query = supabase
      .from('audit_log')
      .select('id, table_name, record_id, action, old_values, new_values, changed_by, changed_at')
      .order('changed_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filterAction !== 'all') query = query.eq('action', filterAction)
    if (filterTable !== 'all') query = query.eq('table_name', filterTable)

    const { data, error: qError } = await query

    if (qError) {
      setError(qError.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as AuditEntry[]

    // Step 2: fetch user names separately
    const userIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))] as string[]
    const userMap = new Map<string, string>()

    if (userIds.length > 0) {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds)

      for (const u of usersData ?? []) {
        userMap.set(u.id, u.full_name ?? u.email ?? 'Unknown')
      }
    }

    setEntries(rows.map((r) => ({
      ...r,
      user_name: r.changed_by ? (userMap.get(r.changed_by) ?? 'Unknown') : 'System',
    })))

    setLoading(false)
  }, [supabase, filterAction, filterTable, page])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const tables = Object.keys(TABLE_LABELS)

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Every data change across the platform — inserts, updates, and deletes captured automatically.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['all', 'insert', 'update', 'delete']).map((a) => (
            <button
              key={a}
              onClick={() => { setFilterAction(a); setPage(0) }}
              className={`px-3 py-1.5 transition-colors capitalize ${
                filterAction === a ? 'bg-sky-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {a === 'all' ? 'All actions' : a}
            </button>
          ))}
        </div>

        <select
          value={filterTable}
          onChange={(e) => { setFilterTable(e.target.value); setPage(0) }}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="all">All tables</option>
          {tables.map((t) => (
            <option key={t} value={t}>{TABLE_LABELS[t]}</option>
          ))}
        </select>

        <button
          onClick={fetchEntries}
          className="text-xs font-medium text-sky-600 hover:text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
        >
          ↻ Refresh
        </button>

        <span className="text-xs text-gray-400 ml-auto">Page {page + 1}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-4">
          <p className="text-xs text-red-700 font-medium">Error loading audit log: {error}</p>
        </div>
      )}

      {/* Entries */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-14 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <Card>
          <EmptyState
            title="No audit log entries"
            description="Changes to data will appear here automatically."
          />
        </Card>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry) => {
            const isExpanded = expandedId === entry.id
            const changedFields = getChangedFields(entry)
            const tableLabel = TABLE_LABELS[entry.table_name] ?? entry.table_name
            const summary = getSummary(entry)
            const actionColor = ACTION_COLORS[entry.action] ?? 'gray'

            return (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                >
                  <Badge variant={actionColor}>{entry.action}</Badge>

                  <span className="text-xs font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded flex-shrink-0">
                    {tableLabel}
                  </span>

                  <p className="flex-1 text-xs text-gray-600 truncate min-w-0">{summary}</p>

                  <span className="text-xs text-gray-500 flex-shrink-0 font-medium">
                    {entry.user_name}
                  </span>

                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {entry.changed_at
                      ? new Date(entry.changed_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : '—'}
                  </span>

                  <svg
                    className={`w-4 h-4 text-gray-300 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-4">
                    {/* Meta */}
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <p className="font-medium text-gray-500 mb-1">Table</p>
                        <p className="font-mono text-gray-700">{entry.table_name}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 mb-1">Record ID</p>
                        <p className="font-mono text-gray-700 break-all">{entry.record_id ?? '—'}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-500 mb-1">Changed by</p>
                        <p className="text-gray-700">{entry.user_name}</p>
                        <p className="text-gray-400 font-mono">{entry.changed_by ?? '—'}</p>
                      </div>
                    </div>

                    {/* UPDATE diff */}
                    {entry.action === 'update' && changedFields.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          Changed fields ({changedFields.length})
                        </p>
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-400 mb-1">
                            <span>Field</span>
                            <span className="text-red-400">Before</span>
                            <span className="text-green-600">After</span>
                          </div>
                          {changedFields.map(({ field, from, to }) => (
                            <div key={field} className="grid grid-cols-3 gap-2 text-xs">
                              <span className="font-mono text-gray-600 truncate">{field}</span>
                              <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded truncate">
                                {formatVal(from)}
                              </span>
                              <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded truncate">
                                {formatVal(to)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* INSERT / DELETE raw data */}
                    {(entry.action === 'insert' || entry.action === 'delete') && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          {entry.action === 'insert' ? 'Inserted data' : 'Deleted data'}
                        </p>
                        <div className="bg-white rounded-lg border border-gray-200 p-3 overflow-auto max-h-48">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                            {JSON.stringify(
                              entry.action === 'insert' ? entry.new_values : entry.old_values,
                              null, 2
                            )}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-5">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="text-xs font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>
        <span className="text-xs text-gray-400">
          Showing {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + entries.length}
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={entries.length < PAGE_SIZE}
          className="text-xs font-medium text-gray-600 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  )
}