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

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => { const e = { ...prev }; delete e[field]; return e })
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!form.email.trim()) e.email = 'Email is required.'
    if (!form.full_name.trim()) e.full_name = 'Full name is required.'
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters.'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleCreate() {
    if (!validate()) return
    setSaving(true)

    // Create auth user via Supabase Admin API
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim() },
      },
    })

    if (authError || !authData.user) {
      toastError(authError?.message ?? 'Failed to create auth user.')
      setSaving(false)
      return
    }

    // Insert into users table
    const { data: newUser, error: dbError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        role: form.role as 'consultant' | 'superadmin',
        is_active: true,
      })
      .select('id, email, full_name, role, is_active, created_at')
      .single()

    if (dbError || !newUser) {
      toastError('Auth user created but failed to save profile. Check Supabase.')
      setSaving(false)
      return
    }

    setUsers((prev) => [newUser as User, ...prev])
    setForm({ email: '', full_name: '', role: 'consultant', password: '' })
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
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', user.id)

    if (error) { toastError('Failed to update role.'); return }

    setUsers((prev) => prev.map((u) =>
      u.id === user.id ? { ...u, role: newRole } : u
    ))
    success(`${user.full_name} is now ${newRole}.`)
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
                onChange={(e) => set('full_name', e.target.value)}
                placeholder="e.g. Desmond Botshabelo"
                error={errors.full_name}
              />
              <Input
                label="Email address"
                type="email"
                required
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
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
                onChange={(e) => set('password', e.target.value)}
                placeholder="Min. 8 characters"
                error={errors.password}
                hint="User should change this on first login."
              />
              <Select
                label="Role"
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
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
    </div>
  )
}