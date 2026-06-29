import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.NEWSDATA_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'News API not configured' }, { status: 503 })

  try {
    const res = await fetch(
      `https://newsdata.io/api/1/news?apikey=${apiKey}&country=bw&language=en&category=business&size=8`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 })
  }
}