'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Badge } from '@/components/ui'

interface Workspace {
  id: string
  status: string
  created_at: string | null
  organisations: { name: string; sector: string | null } | null
  latest_score: number | null
  latest_cycle_id: string | null
  cycles_count: number
}

interface NewsArticle {
  title: string
  description: string | null
  link: string
  pubDate: string | null
  source_name: string | null
}

interface WeatherData {
  temp: number
  condition: string
  humidity: number
  wind: number
  location: string
  forecast: { day: string; high: number; low: number; icon: string }[]
  mock: boolean
}

const ADS = [
  {
    tag: 'BotsPay',
    tagColor: 'bg-sky-500',
    headline: 'Automate your payroll in minutes',
    sub: 'PAYE, leave, terminal benefits — built for Botswana SMEs. Fully compliant with BURS 2025/2026 tax bands.',
    cta: 'Learn more',
    href: 'https://botsfirm.co.bw',
    bg: 'from-sky-900 to-sky-700',
  },
  {
    tag: 'QuickBooks',
    tagColor: 'bg-green-500',
    headline: 'Get your books in order',
    sub: 'QuickBooks setup, cleanup, training, and ongoing support. Certified QuickBooks ProAdvisor — Selebi-Phikwe.',
    cta: 'Book a session',
    href: 'https://botsfirm.co.bw',
    bg: 'from-green-900 to-green-700',
  },
  {
    tag: 'ESG Assessments',
    tagColor: 'bg-purple-500',
    headline: 'Finance-ready ESG reports',
    sub: 'GRI 2021, IFRS S1/S2, BSE-aligned reports for CEDA, BDC, and NDB loan applications. Built for Botswana SMEs.',
    cta: 'Start assessment',
    href: '#',
    bg: 'from-purple-900 to-purple-700',
  },
  {
    tag: 'Business Plans',
    tagColor: 'bg-amber-500',
    headline: 'Bankable business plans',
    sub: 'Feasibility studies, financial projections, and development finance proposals. CEDA, YDF, NDB ready.',
    cta: 'Get started',
    href: 'https://botsfirm.co.bw',
    bg: 'from-amber-800 to-amber-600',
  },
  {
    tag: 'ESMS',
    tagColor: 'bg-red-500',
    headline: 'IFC-aligned ESMS documents',
    sub: 'Environmental and Social Management Systems aligned to IFC Performance Standards PS1-PS8 for DFI submissions.',
    cta: 'Request a quote',
    href: 'https://botsfirm.co.bw',
    bg: 'from-red-900 to-red-700',
  },
]

// ─── Clock — hydration safe ───────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState<Date | null>(null)

  useEffect(() => {
    setTime(new Date())
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!time) return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col items-center justify-center">
      <div className="font-mono text-3xl font-bold text-gray-200 tracking-widest">--:--:--</div>
      <p className="text-xs text-gray-300 mt-1">Loading...</p>
    </div>
  )

  const hours = time.getHours().toString().padStart(2, '0')
  const minutes = time.getMinutes().toString().padStart(2, '0')
  const seconds = time.getSeconds().toString().padStart(2, '0')
  const dateStr = time.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex flex-col items-center justify-center">
      <div className="font-mono text-3xl font-bold text-gray-900 tracking-widest">
        {hours}<span className="animate-pulse text-sky-500">:</span>{minutes}
        <span className="text-gray-300">:</span>
        <span className="text-lg text-gray-400">{seconds}</span>
      </div>
      <p className="text-xs text-gray-400 mt-1">{dateStr}</p>
      <p className="text-xs font-medium text-sky-600 mt-1">Botswana Standard Time (UTC+2)</p>
    </div>
  )
}

// ─── Calendar — hydration safe ────────────────────────────────────────────────
function MiniCalendar() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 h-full animate-pulse" />
  )

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const monthName = today.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayDate = today.getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
      <p className="text-xs font-semibold text-gray-700 text-center mb-3">{monthName}</p>
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-xs font-medium text-gray-400 pb-1">{d}</div>
        ))}
        {cells.map((d, i) => (
          <div
            key={i}
            className={`text-xs rounded-full w-6 h-6 flex items-center justify-center mx-auto ${
              d === todayDate
                ? 'bg-sky-600 text-white font-bold'
                : d ? 'text-gray-600 hover:bg-gray-100' : ''
            }`}
          >
            {d ?? ''}
          </div>
        ))}
      </div>
    </div>
  )
}

function ScorePill({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-gray-400">No score</span>
  const color = score >= 70 ? 'bg-green-100 text-green-700'
    : score >= 40 ? 'bg-amber-100 text-amber-700'
    : 'bg-red-100 text-red-700'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score.toFixed(1)}
    </span>
  )
}

export default function DashboardPage() {
  const supabase = createClient()

  // ── All state declarations first ──────────────────────────────────────────
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [news, setNews] = useState<NewsArticle[]>([])
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true)
  const [loadingNews, setLoadingNews] = useState(true)
  const [newsError, setNewsError] = useState(false)
  const [currentAd, setCurrentAd] = useState(0)
  const [adTransition, setAdTransition] = useState(false)
  const [totalCycles, setTotalCycles] = useState(0)
  const [totalReports, setTotalReports] = useState(0)

  // ── All callbacks ─────────────────────────────────────────────────────────
  const fetchWorkspaces = useCallback(async () => {
    const { data: wsData } = await supabase
      .from('workspaces')
      .select(`id, status, created_at, organisations(name, sector)`)
      .order('created_at', { ascending: false })

    const { data: cyclesData } = await supabase
      .from('assessment_cycles')
      .select('id, workspace_id, status')

    const { data: scoresData } = await supabase
      .from('scores')
      .select('cycle_id, overall_score, calculated_at')
      .order('calculated_at', { ascending: false })

    const { data: reportsData } = await supabase
      .from('reports')
      .select('id')

    setTotalCycles(cyclesData?.length ?? 0)
    setTotalReports(reportsData?.length ?? 0)

    const enriched: Workspace[] = (wsData ?? []).map((ws) => {
      const wsCycles = cyclesData?.filter((c) => c.workspace_id === ws.id) ?? []
      const cycleIds = wsCycles.map((c) => c.id)
      const wsScores = scoresData?.filter((s) => cycleIds.includes(s.cycle_id)) ?? []
      const latestScore = wsScores.length > 0 ? wsScores[0].overall_score : null
      const latestCycleId = wsScores.length > 0
        ? scoresData?.find((s) => s.overall_score === latestScore)?.cycle_id ?? null
        : wsCycles[wsCycles.length - 1]?.id ?? null
      const org = Array.isArray(ws.organisations) ? ws.organisations[0] : ws.organisations
      return {
        id: ws.id,
        status: ws.status,
        created_at: ws.created_at,
        organisations: org ?? null,
        latest_score: latestScore,
        latest_cycle_id: latestCycleId,
        cycles_count: wsCycles.length,
      }
    })

    setWorkspaces(enriched)
    setLoadingWorkspaces(false)
  }, [supabase])

  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch(
        `https://newsdata.io/api/1/news?apikey=pub_bb6f5f1af06249388eeebc60a91b0f3b&country=bw&language=en&category=business&size=8`
      )
      const json = await res.json()
      if (json.status === 'success' && json.results) {
        setNews(json.results.slice(0, 8))
      } else {
        setNewsError(true)
      }
    } catch {
      setNewsError(true)
    }
    setLoadingNews(false)
  }, [])

  const fetchWeather = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords
            const res = await fetch(`/api/weather?lat=${latitude}&lon=${longitude}`)
            const data = await res.json()
            setWeather(data)
          },
          async () => {
            const res = await fetch('/api/weather')
            const data = await res.json()
            setWeather(data)
          }
        )
      } else {
        const res = await fetch('/api/weather')
        const data = await res.json()
        setWeather(data)
      }
    } catch {
      // silent fail
    }
  }, [])

  // ── All effects ───────────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setAdTransition(true)
      setTimeout(() => {
        setCurrentAd((prev) => (prev + 1) % ADS.length)
        setAdTransition(false)
      }, 300)
    }, 6000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchWorkspaces()
    fetchNews()
    fetchWeather()
  }, [fetchWorkspaces, fetchNews, fetchWeather])

  // ── Derived values ────────────────────────────────────────────────────────
  const ad = ADS[currentAd]
  const activeWorkspaces = workspaces.filter((w) => w.status === 'active').length
  const avgScore = workspaces.filter((w) => w.latest_score != null).length > 0
    ? workspaces.filter((w) => w.latest_score != null)
        .reduce((sum, w) => sum + (w.latest_score ?? 0), 0) /
      workspaces.filter((w) => w.latest_score != null).length
    : null

  return (
    <div className="p-6 max-w-7xl">

      {/* Ad ribbon */}
      <div className={`bg-gradient-to-r ${ad.bg} rounded-xl mb-6 px-6 py-5 flex items-center justify-between transition-opacity duration-300 ${adTransition ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-4">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full text-white ${ad.tagColor}`}>
            {ad.tag}
          </span>
          <div>
            <p className="text-white font-semibold text-sm">{ad.headline}</p>
            <p className="text-xs mt-0.5 max-w-xl" style={{ color: 'rgba(255,255,255,0.75)' }}>{ad.sub}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <a href={ad.href} target="_blank" rel="noopener noreferrer"
            className="bg-white text-gray-900 text-xs font-semibold px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
            {ad.cta} →
          </a>
          <div className="flex gap-1.5">
            {ADS.map((_, i) => (
              <button key={i} onClick={() => setCurrentAd(i)}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentAd ? 'bg-white' : 'bg-white bg-opacity-40'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Top row */}
      <div className="grid grid-cols-12 gap-4 mb-6">

        {/* Clock + Weather */}
        <div className="col-span-3 space-y-3">
          <LiveClock />
          {weather && (
            <div className="bg-gradient-to-br from-sky-600 to-sky-800 rounded-xl px-4 py-3 text-white">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-sky-200">{weather.location}</p>
                  <p className="text-3xl font-bold mt-0.5">{weather.temp}°C</p>
                  <p className="text-xs text-sky-200 mt-0.5">{weather.condition}</p>
                </div>
                <div className="text-right text-xs text-sky-200 space-y-0.5">
                  <p>💧 {weather.humidity}%</p>
                  <p>💨 {weather.wind} km/h</p>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1 border-t border-sky-500 pt-2">
                {weather.forecast.map((f) => (
                  <div key={f.day} className="text-center">
                    <p className="text-xs text-sky-300">{f.day}</p>
                    <p className="text-sm">{f.icon}</p>
                    <p className="text-xs font-medium">{f.high}°</p>
                    <p className="text-xs text-sky-300">{f.low}°</p>
                  </div>
                ))}
              </div>
              {weather.mock && (
                <p className="text-xs text-sky-400 mt-1.5 text-center">
                  Typical values — add WEATHER_API_KEY for live data
                </p>
              )}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="col-span-2">
          <MiniCalendar />
        </div>

        {/* Stats */}
        <div className="col-span-7 grid grid-cols-4 gap-3 content-start">
          {[
            { label: 'Active workspaces', value: activeWorkspaces, color: 'text-sky-700', bg: 'bg-sky-50' },
            { label: 'Total cycles', value: totalCycles, color: 'text-purple-700', bg: 'bg-purple-50' },
            { label: 'Reports generated', value: totalReports, color: 'text-green-700', bg: 'bg-green-50' },
            {
              label: 'Portfolio avg score',
              value: avgScore != null ? `${avgScore.toFixed(1)}` : '—',
              color: avgScore != null && avgScore >= 70 ? 'text-green-700'
                : avgScore != null && avgScore >= 40 ? 'text-amber-700' : 'text-red-700',
              bg: 'bg-gray-50',
            },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl border border-gray-200 px-4 py-4`}>
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Middle row */}
      <div className="grid grid-cols-12 gap-4 mb-6">

        {/* ESG Portfolio */}
        <div className="col-span-7">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">ESG portfolio</h2>
                <p className="text-xs text-gray-400 mt-0.5">All client workspaces and latest scores</p>
              </div>
              <Link href="/workspaces/new" className="text-xs font-medium text-sky-600 hover:text-sky-700">
                + New workspace
              </Link>
            </div>

            {loadingWorkspaces ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : workspaces.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-gray-400">No workspaces yet.</p>
                <Link href="/workspaces/new" className="mt-2 inline-block text-xs font-medium text-sky-600 hover:text-sky-700">
                  Create your first workspace →
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {workspaces.map((ws) => (
                  <Link
                    key={ws.id}
                    href={ws.latest_cycle_id
                      ? `/workspaces/${ws.id}/cycles/${ws.latest_cycle_id}`
                      : `/workspaces/${ws.id}`}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-1 h-8 rounded-full flex-shrink-0" style={{
                      background: ws.latest_score == null ? '#e5e7eb'
                        : ws.latest_score >= 70 ? '#22c55e'
                        : ws.latest_score >= 40 ? '#f59e0b'
                        : '#ef4444'
                    }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {ws.organisations?.name ?? 'Unnamed'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ws.organisations?.sector ?? 'No sector'} · {ws.cycles_count} cycle{ws.cycles_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <ScorePill score={ws.latest_score} />
                      <Badge variant={ws.status === 'active' ? 'green' : 'gray'} dot>
                        {ws.status}
                      </Badge>
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* News feed */}
        <div className="col-span-5">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-full">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Botswana business news</h2>
                <p className="text-xs text-gray-400 mt-0.5">Live feed via NewsData.io</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </div>

            {loadingNews ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded animate-pulse" />
                    <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : newsError ? (
              <div className="px-5 py-6 text-center">
                <p className="text-xs text-gray-400">Unable to load news.</p>
                <div className="mt-4 space-y-2 text-left">
                  {[
                    { label: 'Mmegi Online', href: 'https://www.mmegi.bw' },
                    { label: 'Daily News Botswana', href: 'https://dailynews.gov.bw' },
                    { label: 'The Africa Report', href: 'https://www.theafricareport.com/country/botswana/' },
                  ].map(({ label, href }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-sky-600 hover:text-sky-700">
                      → {label}
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 overflow-y-auto max-h-80">
                {news.map((article, i) => (
                  <a key={i} href={article.link} target="_blank" rel="noopener noreferrer"
                    className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                    <p className="text-xs font-medium text-gray-900 leading-snug line-clamp-2">
                      {article.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400">{article.source_name ?? 'Botswana'}</span>
                      {article.pubDate && (
                        <span className="text-xs text-gray-300">
                          · {new Date(article.pubDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row — service links */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'BotsPay', desc: 'Payroll SaaS', icon: '💰', href: 'https://botspay.work', color: 'hover:border-sky-300 hover:bg-sky-50' },
          { label: 'QuickBooks', desc: 'Bookkeeping', icon: '📊', href: 'https://botsfirm.co.bw', color: 'hover:border-green-300 hover:bg-green-50' },
          { label: 'ESG Platform', desc: 'This app', icon: '🌿', href: '/workspaces', color: 'hover:border-purple-300 hover:bg-purple-50' },
          { label: 'Business Plans', desc: 'DFI proposals', icon: '📋', href: 'https://botsfirm.co.bw', color: 'hover:border-amber-300 hover:bg-amber-50' },
          { label: 'ESMS Docs', desc: 'IFC standards', icon: '📄', href: '/workspaces', color: 'hover:border-red-300 hover:bg-red-50' },
        ].map(({ label, desc, icon, href, color }) => (
          <Link key={label} href={href}
            className={`bg-white rounded-xl border border-gray-200 px-4 py-4 flex items-center gap-3 transition-all ${color}`}>
            <span className="text-2xl">{icon}</span>
            <div>
              <p className="text-sm font-medium text-gray-900">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}