import { createClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Check MFA status
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const { data: factors } = await supabase.auth.mfa.listFactors()
        const hasVerifiedFactor = factors?.totp?.some(f => f.status === 'verified')

        if (!hasVerifiedFactor) {
          // Not enrolled — redirect to MFA setup
          return NextResponse.redirect(`${origin}/mfa-setup`)
        }

        // Enrolled but not yet challenged this session
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel !== 'aal2') {
          return NextResponse.redirect(`${origin}/mfa-challenge`)
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}