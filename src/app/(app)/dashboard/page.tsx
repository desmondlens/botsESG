import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Badge, Card, EmptyState } from '@/components/ui'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select(`
      id, status, created_at,
      organisations ( id, name, sector, size_category, country )
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data: recentCycles } = await supabase
    .from('assessment_cycles')
    .select(`
      id, period_start, period_end, status, workspace_id,
      workspaces ( organisations ( name ) )
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  const totalWorkspaces = workspaces?.length ?? 0
  const recentCount = recentCycles?.length ?? 0

  const cycleStatusVariant: Record<string, 'gray' | 'sky' | 'amber' | 'green' | 'purple'> = {
    draft: 'gray',
    in_progress: 'sky',
    submitted: 'amber',
    reviewed: 'green',
    locked: 'purple',
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back. Here is your portfolio overview.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active workspaces</p>
          <p className="text-3xl font-semibold text-gray-900 mt-2">{totalWorkspaces}</p>
          <p className="text-xs text-gray-400 mt-1">SME clients in progress</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total workspaces</p>
          <p className="text-3xl font-semibold text-gray-900 mt-2">{totalWorkspaces}</p>
          <p className="text-xs text-gray-400 mt-1">All time</p>
        </Card>
        <Card>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Recent cycles</p>
          <p className="text-3xl font-semibold text-gray-900 mt-2">{recentCount}</p>
          <p className="text-xs text-gray-400 mt-1">Last 5 assessment cycles</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Workspaces */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Active workspaces</h2>
            <Link href="/workspaces/new" className="text-xs font-medium text-sky-600 hover:text-sky-700">
              + New workspace
            </Link>
          </div>

          {!workspaces || workspaces.length === 0 ? (
            <EmptyState
              title="No workspaces yet"
              action={
                <Link href="/workspaces/new" className="text-sm font-medium text-sky-600 hover:text-sky-700">
                  Create your first workspace
                </Link>
              }
              size="sm"
            />
          ) : (
            <ul className="divide-y divide-gray-100">
              {workspaces.map((ws) => {
                const org = Array.isArray(ws.organisations) ? ws.organisations[0] : ws.organisations
                return (
                  <li key={ws.id}>
                    <Link
                      href={`/workspaces/${ws.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org?.name ?? 'Unnamed'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {org?.sector ?? 'No sector'} · {org?.size_category ?? '—'}
                        </p>
                      </div>
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Recent cycles */}
        <Card padding="none">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent assessment cycles</h2>
          </div>

          {!recentCycles || recentCycles.length === 0 ? (
            <EmptyState title="No assessment cycles yet" size="sm" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentCycles.map((cycle) => {
                const ws = Array.isArray(cycle.workspaces) ? cycle.workspaces[0] : cycle.workspaces
                const org = ws
                  ? (Array.isArray(ws.organisations) ? ws.organisations[0] : ws.organisations)
                  : null
                return (
                  <li key={cycle.id}>
                    <Link
                      href={`/workspaces/${cycle.workspace_id}/cycles/${cycle.id}`}
                      className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">{org?.name ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {cycle.period_start} → {cycle.period_end}
                        </p>
                      </div>
                      <Badge variant={cycleStatusVariant[cycle.status] ?? 'gray'}>
                        {cycle.status.replace('_', ' ')}
                      </Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}