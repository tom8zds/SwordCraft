import { RELICS } from './content'

export const FURNISHING_BASE = '/assets/game/furnishings/'
export const FURNISHING_IDS: readonly string[] = [
  ...RELICS.map((relic) => relic.id),
  'dragon-scale', 'hourglass', 'weapon-book', 'relic-book', 'manual-book', 'relic-altar',
  'cabinet', 'offering-table', 'merchant-entrance', 'offering-bell', 'offering-sign',
  'codex-panel', 'merchant-panel', 'relic-panel', 'calendar-panel',
]

export function furnishingUrl(id: string): string {
  return `${FURNISHING_BASE}${id}.png`
}
