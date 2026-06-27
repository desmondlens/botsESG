import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button, Badge, Card, EmptyState } from '@/components/ui'

export default async function WorkspacesPage() {
  const supabase = await createClient()

  const { data: workspaces } = await supabase
    .from('workspaces')
    .select(`
      id, status, created_at,
      organisations ( id, name, sector, sub_sector, size_category, country, employee_count )
    `)
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Workspaces</h1>
          <p className="text-sm text-gray-500 mt-1">All SME client workspaces assigned to you.</p>
        </div>
        <Link href="/workspaces/new">
          <Button>+ New workspace</Button>
        </Link>
      </div>

      {!workspaces || workspaces.length === 0 ? (
        <Card>
          <EmptyState
            title="No workspaces yet"
            description="Create a workspace to begin an ESG assessment for a client."
            action={
              <Link href="/workspaces/new">
                <Button size="sm">Create first workspace</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Organisation', 'Sector', 'Size', 'Status', 'Created', ''].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workspaces.map((ws) => {
                const org = Array.isArray(ws.organisations) ? ws.organisations[0] : ws.organisations
                return (
                  <tr key={ws.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{org?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{org?.country ?? '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      {org?.sector ?? '—'}
                      {org?.sub_sector && <span className="text-gray-400"> · {org.sub_sector}</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-600 capitalize">{org?.size_category ?? '—'}</td>
                    <td className="px-5 py-4">
                      <Badge variant={ws.status === 'active' ? 'green' : 'gray'} dot>
                        {ws.status}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {ws.created_at
                        ? new Date(ws.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/workspaces/${ws.id}`} className="text-xs font-medium text-sky-600 hover:text-sky-700">
                        Open →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}