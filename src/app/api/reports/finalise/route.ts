import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    const { reportId, finalisationNotes } = await req.json()
    if (!reportId) return NextResponse.json({ error: 'reportId required' }, { status: 400 })

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    // Verify superadmin
    const { data: currentUser } = await supabase
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (currentUser?.role !== 'superadmin') {
      return NextResponse.json({ error: 'Only superadmins can finalise reports.' }, { status: 403 })
    }

    // Get the report
    const { data: report } = await supabase
      .from('reports')
      .select('id, report_version, status, generated_by, snapshot_id, workspace_id')
      .eq('id', reportId)
      .single()

    if (!report) return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
    if (report.status === 'final') return NextResponse.json({ error: 'Report is already finalised.' }, { status: 400 })

    // Segregation of duties check
    const { count: superadminCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'superadmin')
      .eq('is_active', true)

    if ((superadminCount ?? 0) > 1 && report.generated_by === user.id) {
      return NextResponse.json({
        error: 'Segregation of duties: the report must be finalised by a different superadmin than the one who generated it.'
      }, { status: 403 })
    }

    // Get cycle_id from snapshot
    const { data: snapshot } = await supabase
      .from('report_snapshots')
      .select('cycle_id')
      .eq('id', report.snapshot_id)
      .single()

    // Finalise the report
    await supabase
      .from('reports')
      .update({
        status: 'final',
        is_locked: true,
        finalised_by: user.id,
        finalised_at: new Date().toISOString(),
        finalisation_notes: finalisationNotes ?? null,
      })
      .eq('id', reportId)

    // Lock the assessment cycle
    if (snapshot?.cycle_id) {
      await supabase
        .from('assessment_cycles')
        .update({
          is_locked: true,
          locked_at: new Date().toISOString(),
          locked_by: user.id,
          lock_reason: `Report v${report.report_version} finalised by ${currentUser.full_name ?? user.email}`,
          status: 'approved',
        })
        .eq('id', snapshot.cycle_id)

      // Log lifecycle event
      await supabase.from('assessment_lifecycle_events').insert({
        cycle_id: snapshot.cycle_id,
        event_type: 'approved',
        from_status: 'submitted',
        to_status: 'locked',
        performed_by: user.id,
        performed_by_email: user.email,
        notes: `Report v${report.report_version} finalised and cycle locked for DFI submission. ${finalisationNotes ?? ''}`,
      })
    }

    return NextResponse.json({ success: true, message: `Report v${report.report_version} finalised and cycle locked.` })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}