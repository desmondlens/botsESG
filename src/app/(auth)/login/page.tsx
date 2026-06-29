'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, Input } from '@/components/ui'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true)
  setError(null)

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    setError('Invalid email or password. Please try again.')
    setLoading(false)
    return
  }

  // Check MFA enrollment
  const { data: factors } = await supabase.auth.mfa.listFactors()
  const hasVerifiedFactor = factors?.totp?.some(f => f.status === 'verified')

  if (!hasVerifiedFactor) {
    router.push('/mfa-setup')
    return
  }

  // Check assurance level — if not aal2, challenge required
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.currentLevel !== 'aal2') {
    router.push('/mfa-challenge')
    return
  }

  router.push('/dashboard')
  router.refresh()
}

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-600 mb-4">
            <span className="text-white font-semibold text-lg">B</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Botsfirm ESG</h1>
          <p className="text-sm text-gray-500 mt-1">Internal consultant platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@botsfirm.co.bw"
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              error={error ?? undefined}
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full justify-center"
            >
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Botsfirm Solidarity · Internal use only
        </p>
      </div>
    </div>
  )
}