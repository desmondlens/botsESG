'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Stage = 2 | 3 | 4 | 5 | 6 | 7 | 8

interface GuardResult {
  checking: boolean
  allowed: boolean
  reason: string | null
  redirectTo: string | null
}

export function useStageGuard(
  workspaceId: string,
  cycleId: string,
  stage: Stage
): GuardResult {
  const router = useRouter()
  const supabase = createClient()
  const [result, setResult] = useState<GuardResult>({
    checking: true,
    allowed: false,
    reason: null,
    redirectTo: null,
  })

  useEffect(() => {
    let cancelled = false

    async function check() {
      const base = `/workspaces/${workspaceId}/cycles/${cycleId}`

      // Stage 2 — IFRS disclosures: needs at least 1 materiality topic
      if (stage === 2) {
        const { count } = await supabase
          .from('materiality_topics')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycleId)

        if (!cancelled) {
          if ((count ?? 0) === 0) {
            setResult({
              checking: false, allowed: false,
              reason: 'Complete the materiality assessment before proceeding to IFRS disclosures.',
              redirectTo: `${base}/materiality`,
            })
          } else {
            setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
          }
        }
        return
      }

      // Stage 3 — Indicator selection: needs at least 1 materiality topic
      if (stage === 3) {
        const { count } = await supabase
          .from('materiality_topics')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycleId)

        if (!cancelled) {
          if ((count ?? 0) === 0) {
            setResult({
              checking: false, allowed: false,
              reason: 'Complete the materiality assessment before selecting indicators.',
              redirectTo: `${base}/materiality`,
            })
          } else {
            setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
          }
        }
        return
      }

      // Stage 4 — Data collection: needs at least 1 indicator selected
      if (stage === 4) {
        const { count } = await supabase
          .from('cycle_indicators')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycleId)
          .neq('inclusion_source', 'manual_exclude')

        if (!cancelled) {
          if ((count ?? 0) === 0) {
            setResult({
              checking: false, allowed: false,
              reason: 'Select at least one indicator before entering data.',
              redirectTo: `${base}/indicators`,
            })
          } else {
            setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
          }
        }
        return
      }

      // Stage 5 — Documents: needs at least 1 response entered
      if (stage === 5) {
        const { count } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycleId)

        if (!cancelled) {
          if ((count ?? 0) === 0) {
            setResult({
              checking: false, allowed: false,
              reason: 'Enter at least one indicator response before uploading documents.',
              redirectTo: `${base}/assessment`,
            })
          } else {
            setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
          }
        }
        return
      }

      // Stage 6 — Scoring: needs at least 1 response with a value
      if (stage === 6) {
        const { count } = await supabase
          .from('responses')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycleId)
          .or('value_number.not.is.null,value_text.not.is.null,value_boolean.not.is.null,is_not_applicable.eq.true')

        if (!cancelled) {
          if ((count ?? 0) === 0) {
            setResult({
              checking: false, allowed: false,
              reason: 'Enter at least one indicator value before running the scoring engine.',
              redirectTo: `${base}/assessment`,
            })
          } else {
            setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
          }
        }
        return
      }

      // Stage 7 — Report: needs at least 1 score calculated
      if (stage === 7) {
        const { count } = await supabase
          .from('scores')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycleId)

        if (!cancelled) {
          if ((count ?? 0) === 0) {
            setResult({
              checking: false, allowed: false,
              reason: 'Calculate scores before generating the report.',
              redirectTo: `${base}/scoring`,
            })
          } else {
            setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
          }
        }
        return
      }

      // Stage 8 — Finance readiness: needs at least 1 score calculated
      if (stage === 8) {
        const { count } = await supabase
          .from('scores')
          .select('*', { count: 'exact', head: true })
          .eq('cycle_id', cycleId)

        if (!cancelled) {
          if ((count ?? 0) === 0) {
            setResult({
              checking: false, allowed: false,
              reason: 'Calculate scores before viewing finance readiness.',
              redirectTo: `${base}/scoring`,
            })
          } else {
            setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
          }
        }
        return
      }

      if (!cancelled) {
        setResult({ checking: false, allowed: true, reason: null, redirectTo: null })
      }
    }

    check()
    return () => { cancelled = true }
  }, [workspaceId, cycleId, stage, supabase, router])

  // Auto-redirect
  useEffect(() => {
    if (!result.checking && !result.allowed && result.redirectTo) {
      router.replace(result.redirectTo)
    }
  }, [result, router])

  return result
}