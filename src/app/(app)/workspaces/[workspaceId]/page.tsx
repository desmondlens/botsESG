import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge, Card, EmptyState, Button } from '@/components/ui'

interface Props {
  params: Promise<{ workspaceId: string }>
}

const cycleStatusVariant: Record<string, 'gray' | 'sky' | 'amber' | 'green' | 'purple'> = {
  draft: 'gray',
  in_progress: 'sky',
  submitted: 'amber',
  reviewed: 'green',
  locked: 'purple',
}

export default async function WorkspaceDetailPage({ params }: Props) {
  const { workspaceId } = await params
  const supabase = await createClient()

  const { data: workspace } = await supabase
    .from('workspaces')
    .select(`
      id, status, notes, created_at, assigned_consultant_id,
      organisations (
        id, name, registration_number, sector, sub_sector,
        size_category, country, employee_count, annual_turnover_bwp
      )
    `)
    .eq('id', workspaceId)
    .single()

  if (!workspace) notFound()

  const org = Array.isArray(workspace.organisations)
    ? workspace.organisations[0]
    : workspace.organisations

  const { data: cycles } = await supabase
    .from('assessment_cycles')
    .select('id, period_start, period_end, status, created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/workspaces" className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block">
          ← Back to workspaces
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{org?.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {org?.sector}
              {org?.sub_sector && ` · ${org.sub_sector}`}
              {' · '}{org?.country}
            </p>
          </div>
          <Link href={`/workspaces/${workspaceId}/cycles/new`}>
            <Button>+ New assessment cycle</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Organisation profile */}
        <Card className="col-span-1">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Organisation profile
          </h2>
          <dl className="space-y-3">
            {[
              { label: 'Registration', value: org?.registration_number },
              { label: 'Size', value: org?.size_category, capitalize: true },
              { label: 'Employees', value: org?.employee_count },
              {
                label: 'Annual turnover',
                value: org?.annual_turnover_bwp
                  ? `P ${Number(org.annual_turnover_bwp).toLocaleString()}`
                  : null,
              },
            ].map(({ label, value, capitalize }) => (
              <div key={label}>
                <dt className="text-xs text-gray-400">{label}</dt>
                <dd className={`text-sm text-gray-900 mt-0.5 ${capitalize ? 'capitalize' : ''}`}>
                  {value ?? '—'}
                </dd>
              </div>
            ))}
            <div>
              <dt className="text-xs text-gray-400">Workspace status</dt>
              <dd className="mt-0.5">
                <Badge variant={workspace.status === 'active' ? 'green' : 'gray'} dot>
                  {workspace.status}
                </Badge>
              </dd>
            </div>
            {workspace.notes && (
              <div>
                <dt className="text-xs text-gray-400">Notes</dt>
                <dd className="text-sm text-gray-700 mt-0.5">{workspace.notes}</dd>
              </div>
            )}
          </dl>
        </Card>

        {/* Assessment cycles */}
        <Card padding="none" className="col-span-2">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Assessment cycles</h2>
            <Link
              href={`/workspaces/${workspaceId}/cycles/new`}
              className="text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              + New cycle
            </Link>
          </div>

          {!cycles || cycles.length === 0 ? (
            <EmptyState
              title="No assessment cycles yet"
              description="Start the first cycle to begin data collection."
              action={
                <Link href={`/workspaces/${workspaceId}/cycles/new`}>
                  <Button size="sm">Start first cycle</Button>
                </Link>
              }
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Period', 'Status', 'Created', ''].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cycles.map((cycle) => (
                  <tr key={cycle.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {new Date(cycle.period_start).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                      {' → '}
                      {new Date(cycle.period_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={cycleStatusVariant[cycle.status] ?? 'gray'}>
                        {cycle.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {cycle.created_at
                        ? new Date(cycle.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/workspaces/${workspaceId}/cycles/${cycle.id}`}
                        className="text-xs font-medium text-sky-600 hover:text-sky-700"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}