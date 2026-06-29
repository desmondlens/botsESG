'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui'

export default function MFASetupPage() {
  const supabase = createClient()
  const router = useRouter()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [step, setStep] = useState<'intro' | 'qr' | 'verify'>('intro')
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [loading, setLoading] = useState(false)

  async function startEnrollment() {
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Botsfirm ESG Authenticator',
    })

    if (error || !data) {
      setErrorMsg(error?.message ?? 'Failed to start MFA enrollment.')
      setLoading(false)
      return
    }

    setFactorId(data.id)
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setStep('qr')
    setLoading(false)
  }

  async function verifyEnrollment() {
    if (verifyCode.length !== 6) {
      setErrorMsg('Enter the 6-digit code from your authenticator app.')
      return
    }

    setLoading(true)

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    })

    if (challengeError || !challengeData) {
      setErrorMsg(challengeError?.message ?? 'Failed to create MFA challenge.')
      setLoading(false)
      return
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    })

    if (verifyError) {
      setErrorMsg('Invalid code. Please try again.')
      setLoading(false)
      return
    }

    setSuccessMsg('MFA enabled successfully. Your account is now protected.')
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm w-full max-w-md p-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-sky-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Set up two-factor authentication</h1>
            <p className="text-xs text-gray-500">Required for all Botsfirm ESG accounts</p>
          </div>
        </div>

                {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-red-700">{errorMsg}</p>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-green-700">{successMsg}</p>
          </div>
        )}

        {step === 'intro' && (
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
              <p className="text-sm font-medium text-amber-800 mb-1">MFA is required</p>
              <p className="text-xs text-amber-700">
                This platform handles confidential ESG assessment data submitted to development finance institutions.
                Two-factor authentication is mandatory for all accounts.
              </p>
            </div>

            <p className="text-sm text-gray-600 mb-4">You will need an authenticator app such as:</p>
            <ul className="space-y-1.5 mb-6">
              {['Google Authenticator', 'Microsoft Authenticator', 'Authy'].map((app) => (
                <li key={app} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                  {app}
                </li>
              ))}
            </ul>

            <Button onClick={startEnrollment} loading={loading} className="w-full">
              Set up authenticator app
            </Button>
          </div>
        )}

        {step === 'qr' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Scan this QR code with your authenticator app, then click Continue.
            </p>

            {qrCode && (
              <div className="flex justify-center mb-4">
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48 border border-gray-200 rounded-lg" />
              </div>
            )}

            <div className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
              <p className="text-xs text-gray-500 mb-1">Manual entry key</p>
              <p className="text-xs font-mono text-gray-700 break-all">{secret}</p>
            </div>

            <Button onClick={() => setStep('verify')} className="w-full">
              Continue — enter verification code
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Enter the 6-digit code shown in your authenticator app to complete setup.
            </p>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center text-2xl font-mono tracking-widest border border-gray-300 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />

            <Button onClick={verifyEnrollment} loading={loading} className="w-full">
              Verify and enable MFA
            </Button>

            <button
              onClick={() => setStep('qr')}
              className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600"
            >
              ← Back to QR code
            </button>
          </div>
        )}
      </div>
    </div>
  )
}