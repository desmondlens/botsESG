import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get('lat') ?? '-24.6282'
  const lon = searchParams.get('lon') ?? '25.9231'

  const apiKey = process.env.WEATHER_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      temp: 20, condition: 'Clear', humidity: 30, wind: 10,
      location: 'Gaborone, Botswana',
      forecast: [
        { day: 'Mon', high: 22, low: 8, icon: '☀️' },
        { day: 'Tue', high: 24, low: 9, icon: '☀️' },
        { day: 'Wed', high: 21, low: 7, icon: '⛅' },
        { day: 'Thu', high: 19, low: 6, icon: '☁️' },
        { day: 'Fri', high: 23, low: 8, icon: '☀️' },
      ],
      mock: true,
    })
  }

  try {
    const res = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&days=5&aqi=no`
    )
    const data = await res.json()
    const current = data.current as Record<string, unknown>
    const condText = String((current.condition as Record<string, unknown>)?.text ?? 'Clear')

    const forecast = (data.forecast.forecastday as Array<Record<string, unknown>>).map((d) => {
      const day = d.day as Record<string, unknown>
      const text = String((day.condition as Record<string, unknown>)?.text ?? '')
      const icon = text.toLowerCase().includes('sun') || text.toLowerCase().includes('clear') ? '☀️'
        : text.toLowerCase().includes('cloud') ? '⛅'
        : text.toLowerCase().includes('rain') ? '🌧️'
        : text.toLowerCase().includes('thunder') ? '⛈️'
        : '🌤️'
      return {
        day: new Date(d.date as string).toLocaleDateString('en-GB', { weekday: 'short' }),
        high: Math.round(day.maxtemp_c as number),
        low: Math.round(day.mintemp_c as number),
        icon,
      }
    })

    return NextResponse.json({
      temp: Math.round(current.temp_c as number),
      condition: condText,
      humidity: current.humidity,
      wind: Math.round(current.wind_kph as number),
      location: `${data.location.name}, ${data.location.country}`,
      forecast,
      mock: false,
    })
  } catch {
    return NextResponse.json({
      temp: 20, condition: 'Clear', humidity: 30, wind: 10,
      location: 'Gaborone, Botswana',
      forecast: [
        { day: 'Mon', high: 22, low: 8, icon: '☀️' },
        { day: 'Tue', high: 24, low: 9, icon: '☀️' },
        { day: 'Wed', high: 21, low: 7, icon: '⛅' },
        { day: 'Thu', high: 19, low: 6, icon: '☁️' },
        { day: 'Fri', high: 23, low: 8, icon: '☀️' },
      ],
      mock: true,
    })
  }
}