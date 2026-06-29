'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button, useToast } from '@/components/ui'

export default function MFAChallenGePage() {
  const supabase = createClient()
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialising, setInitialising] = useState(true)

  useEffect(() => {
    async function startChallenge() {
      const { data: factors } = await supabase.auth.mfa.listFactors()
      const totp = factors?.totp?.find(f => f.status === 'verified')

      if (!totp) {
        router.replace('/mfa-setup')
        return
      }

      setFactorId(totp.id)

      const { data: challenge, error } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      })

      if (error || !challenge) {
        setErrorMsg('Failed to start MFA challenge.')
        return
      }

      setChallengeId(challenge.id)
      setInitialising(false)
    }

    startChallenge()
  }, [supabase, router, setErrorMsg])

  async function verify() {
    if (code.length !== 6) {
      setErrorMsg('Enter the 6-digit code from your authenticator app.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code,
    })

    if (error) {
      setErrorMsg('Invalid code. Please try again.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  if (initialising) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-sm p-8">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Two-factor authentication</h1>
            <p className="text-xs text-gray-500">Botsfirm ESG Platform</p>
          </div>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Enter the 6-digit code from your authenticator app to continue.
        </p>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && verify()}
          placeholder="000000"
          autoFocus
          className="w-full text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />

        <Button onClick={verify} loading={loading} className="w-full">
          Verify
        </Button>

        <p className="text-xs text-gray-400 text-center mt-4">
          Open your authenticator app to find the code for Botsfirm ESG.
        </p>
      </div>
    </div>
  )
}