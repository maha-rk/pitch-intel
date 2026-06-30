import { NextResponse } from 'next/server'

export const revalidate = 60

export async function GET() {
  try {
    const r = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) }
    )
    if (!r.ok) return NextResponse.json({ matches: [] })

    const data = await r.json()
    const events: any[] = data.events ?? []

    const matches = events.map((e: any) => {
      const comp = e.competitions?.[0] ?? {}
      const competitors: any[] = comp.competitors ?? []
      const home = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0] ?? {}
      const away = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1] ?? {}
      return {
        id: e.id ?? '',
        home: home.team?.shortDisplayName ?? home.team?.displayName ?? '',
        away: away.team?.shortDisplayName ?? away.team?.displayName ?? '',
        home_score: home.score ?? '0',
        away_score: away.score ?? '0',
        status: comp.status?.type?.shortDetail ?? '',
        date: comp.date ?? '',
      }
    }).filter((m: any) => m.home && m.away)

    return NextResponse.json({ matches, date: data.day?.date ?? '' })
  } catch {
    return NextResponse.json({ matches: [] })
  }
}
