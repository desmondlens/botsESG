'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button, Badge, Card, EmptyState, Input, Select, useToast } from '@/components/ui'

interface User {
  id: string
  email: string
  full_name: string
  role: 'superadmin' | 'consultant'
  is_active: boolean
  created_at: string | null
}

const ROLE_OPTIONS = [
  { value: 'consultant', label: 'Consultant' },
  { value: 'superadmin', label: 'Superadmin' },
]

export default function AdminUsersPage() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showSuperadminConfirm, setShowSuperadminConfirm] = useState(false)
  const [superadminReason, setSuperadminReason] = useState('')
  const [pendingRoleChange, setPendingRoleChange] = useState<{ user: User; newRole: 'consultant' | 'superadmin' } | null>(null)

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'consultant',
    password: '',
  })

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, created_at')
      .order('created_at', { ascending: false })
    setUsers((data as User[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.email.trim()) e.email = 'Email is required.'
    if (!form.full_name.trim()) e.full_name = 'Full name is required.'
    if (!form.password || form.password.length < 12) e.password = 'Password must be at least 12 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate() {
  if (!validate()) return

  if (form.role === 'superadmin' && !superadminReason.trim()) {
    setShowSuperadminConfirm(true)
    return
  }

  setSaving(true)

  const res = await fetch('/api/admin/create-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: form.email.trim(),
      password: form.password,
      full_name: form.full_name.trim(),
      role: form.role,
      superadmin_reason: superadminReason,
    }),
  })

  const result = await res.json()

  if (!res.ok) {
    toastError(result.error ?? 'Failed to create user.')
    setSaving(false)
    return
  }

  setUsers((prev) => [result.user as User, ...prev])
  setForm({ email: '', full_name: '', role: 'consultant', password: '' })
  setSuperadminReason('')
  setShowSuperadminConfirm(false)
  setShowForm(false)
  setSaving(false)
  success(`${form.full_name.trim()} added as ${form.role}.`)
}

  async function toggleActive(user: User) {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)

    if (error) { toastError('Failed to update user status.'); return }

    setUsers((prev) => prev.map((u) =>
      u.id === user.id ? { ...u, is_active: !u.is_active } : u
    ))
    success(`${user.full_name} ${user.is_active ? 'deactivated' : 'activated'}.`)
  }

  async function changeRole(user: User, newRole: 'consultant' | 'superadmin') {
    if (newRole === 'superadmin') {
      setPendingRoleChange({ user, newRole })
      return
    }
    await applyRoleChange(user, newRole, '')
  }

  async function applyRoleChange(user: User, newRole: 'consultant' | 'superadmin', reason: string) {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', user.id)

    if (error) { toastError('Failed to update role.'); return }

    setUsers((prev) => prev.map((u) =>
      u.id === user.id ? { ...u, role: newRole } : u
    ))
    setPendingRoleChange(null)
    setSuperadminReason('')
    success(`${user.full_name} is now ${newRole}.${reason ? ` Reason: ${reason}` : ''}`)
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage consultant accounts and access levels.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>+ Add user</Button>
      </div>

      {/* Add user form */}
      {showForm && (
        <Card className="mb-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">New user</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Full name"
                required
                value={form.full_name}
                onChange={(e) => setField('full_name', e.target.value)}
                placeholder="e.g. Desmond Botshabelo"
                error={errors.full_name}
              />
              <Input
                label="Email address"
                type="email"
                required
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="e.g. desmond@botsfirm.co.bw"
                error={errors.email}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Temporary password"
                type="password"
                required
                value={form.password}
                onChange={(e) => setField('password', e.target.value)}
                placeholder="Min. 12 characters"
                error={errors.password}
                hint="Minimum 12 characters. User should change this on first login."
              />
              <Select
                label="Role"
                value={form.role}
                onChange={(e) => setField('role', e.target.value)}
                options={ROLE_OPTIONS}
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-5">
            <Button loading={saving} onClick={handleCreate}>
              Create user
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

      {/* Users table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 h-16 animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <EmptyState
            title="No users yet"
            description="Add consultants to give them access to the platform."
            action={<Button size="sm" onClick={() => setShowForm(true)}>+ Add first user</Button>}
          />
        </Card>
      ) : (
        <Card padding="none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-900">{user.full_name}</td>
                  <td className="px-5 py-4 text-gray-600">{user.email}</td>
                  <td className="px-5 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => changeRole(user, e.target.value as 'consultant' | 'superadmin')}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700
                                 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="consultant">Consultant</option>
                      <option value="superadmin">Superadmin</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <Badge variant={user.is_active ? 'green' : 'gray'} dot>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-500">
                    {user.created_at
                      ? new Date(user.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => toggleActive(user)}
                      className={`text-xs font-medium ${
                        user.is_active
                          ? 'text-red-400 hover:text-red-600'
                          : 'text-green-600 hover:text-green-700'
                      }`}
                    >
                      {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Superadmin creation confirmation modal */}
      {showSuperadminConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Confirm superadmin access</h3>
            <p className="text-xs text-gray-500 mb-4">
              Superadmin accounts have full platform access including user management, audit logs, and report finalisation.
              Provide a reason for this access level — it will be recorded in the audit log.
            </p>
            <textarea
              value={superadminReason}
              onChange={(e) => setSuperadminReason(e.target.value)}
              placeholder="Reason for superadmin access (required)"
              rows={3}
              className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <div className="flex gap-3">
              <Button
                loading={saving}
                disabled={!superadminReason.trim()}
                onClick={handleCreate}
              >
                Confirm and create
              </Button>
              <button
                onClick={() => { setShowSuperadminConfirm(false); setSuperadminReason('') }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role change to superadmin confirmation modal */}
      {pendingRoleChange && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Promote {pendingRoleChange.user.full_name} to superadmin?
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              This will grant full platform access. Provide a reason — it will be recorded in the audit log.
            </p>
            <textarea
              value={superadminReason}
              onChange={(e) => setSuperadminReason(e.target.value)}
              placeholder="Reason for promoting to superadmin (required)"
              rows={3}
              className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-300 rounded-xl px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
            />
            <div className="flex gap-3">
              <Button
                disabled={!superadminReason.trim()}
                onClick={() => applyRoleChange(pendingRoleChange.user, pendingRoleChange.newRole, superadminReason)}
              >
                Confirm promotion
              </Button>
              <button
                onClick={() => { setPendingRoleChange(null); setSuperadminReason('') }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}