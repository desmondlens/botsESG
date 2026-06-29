import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Verify caller is superadmin
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { data: { user: caller } } = await supabase.auth.getUser()
    if (!caller) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: callerData } = await supabase
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerData?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmins can create users.' }, { status: 403 })
    }

    // Use service role to create user
    const adminSupabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => [], setAll: () => {} } }
    )

    const { email, password, full_name, role, superadmin_reason } = await req.json()

    // Create auth user
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message ?? 'Failed to create user.' }, { status: 500 })
    }

    // Insert profile
    const { data: newUser, error: dbError } = await adminSupabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        full_name,
        role,
        is_active: true,
      })
      .select('id, email, full_name, role, is_active, created_at')
      .single()

    if (dbError || !newUser) {
      return NextResponse.json({ error: 'User created in auth but profile save failed.' }, { status: 500 })
    }

    return NextResponse.json({ user: newUser })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}