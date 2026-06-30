export const TEAM_COLORS: Record<string, string> = {
  'Brazil': '#D97706', 'Belgium': '#DC2626', 'France': '#1D4ED8',
  'Croatia': '#EA580C', 'England': '#1E3A8A', 'Argentina': '#2563EB',
  'Germany': '#0284C7', 'Spain': '#DC2626', 'Portugal': '#16A34A',
  'Uruguay': '#2563EB', 'Canada': '#DC2626', 'Morocco': '#D97706',
  'Japan': '#1D4ED8', 'Netherlands': '#EA580C', 'Senegal': '#7C3AED',
  'United States': '#2563EB', 'Australia': '#D97706', 'Switzerland': '#DC2626',
  'Poland': '#DC2626', 'South Korea': '#DC2626', 'Tunisia': '#D97706',
  'Cameroon': '#16A34A', 'Ghana': '#D97706', 'Ecuador': '#D97706',
  'Qatar': '#7C3AED', 'Iran': '#16A34A', 'Saudi Arabia': '#16A34A',
  'Wales': '#DC2626', 'Denmark': '#DC2626',
}

export function tc(team: string): string {
  return TEAM_COLORS[team] || 'var(--t1)'
}
