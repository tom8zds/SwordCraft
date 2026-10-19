import type { EffectiveOdds, HammerResult } from './types'

export interface ProbabilitySegment {
  key: HammerResult
  short: string
  label: string
  color: number
  exact: number
}

const META: Record<HammerResult, { short: string; label: string; color: number }> = {
  destroyed: { short: '碎', label: '破坏', color: 0xe84d5b },
  damaged: { short: '损', label: '损伤', color: 0xf08a45 },
  steady: { short: '维', label: '维持', color: 0x45b8d8 },
  success: { short: '成', label: '成功', color: 0x68c96d },
  great: { short: '大', label: '大成功', color: 0xa978e8 },
}

const ORDER: HammerResult[] = ['destroyed', 'damaged', 'steady', 'success', 'great']

export function normalizeOdds(odds: EffectiveOdds): ProbabilitySegment[] {
  const total = ORDER.reduce((sum, key) => sum + odds[key], 0)
  if (total <= 0) return []
  return ORDER.map((key) => ({
    key,
    short: META[key].short,
    label: META[key].label,
    color: META[key].color,
    exact: odds[key] / total * 100,
  }))
}
