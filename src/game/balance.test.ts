import { describe, expect, it } from 'vitest'
import { createInitialState, effectiveOdds, hammerSword, moveSword, ringSubmissionBell, useHourglass } from './engine'
import { normalizeOdds } from './probability'
import { nextRandom } from './rng'
import type { GameState, HammerResult, Sword } from './types'

const RESULTS: HammerResult[] = ['destroyed', 'damaged', 'steady', 'success', 'great']

function onAnvil(patch: Partial<Sword> = {}): GameState {
  const initial = createInitialState(21)
  const heated = moveSword(initial, initial.swords[0].id, 'forge').state
  const state = moveSword(heated, initial.swords[0].id, 'anvil').state
  return {
    ...state,
    swords: state.swords.map((sword, index) => index === 0 ? {
      ...sword, level: 12, evolutionStage: 4, path: 'one-hand', ...patch,
    } : sword),
  }
}

// 用真实随机步寻找指定区间，不替换随机源，也不依赖抽样频率。
function seedForRoll(low: number, high: number): number {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const value = nextRandom(seed).value
    if (value >= low && value < high) return seed
  }
  throw new Error(`找不到随机区间 [${low}, ${high}) 的种子`)
}

function hammerAs(state: GameState, result: HammerResult, now = 1000): GameState {
  const sword = state.swords.find((candidate) => candidate.location === 'anvil')!
  const odds = effectiveOdds(state, sword)
  const total = RESULTS.reduce((sum, key) => sum + odds[key], 0)
  const start = RESULTS.slice(0, RESULTS.indexOf(result)).reduce((sum, key) => sum + odds[key], 0)
  const seed = seedForRoll(start / total, (start + odds[result]) / total)
  const hammered = hammerSword({ ...state, rngState: seed }, now).state
  expect(hammered.records.at(-1)?.result).toBe(result)
  expect(hammered.rngState).toBe(nextRandom(seed).state)
  return hammered
}

function anvilSword(state: GameState): Sword {
  return state.swords.find((sword) => sword.location === 'anvil')!
}

describe('等级风险与每剑锻造补偿', () => {
  it.each([false, true])('当前零级实际不会破坏，命运丝线=%s', (withFateThread) => {
    const initial = onAnvil({ level: 0, evolutionStage: 4 })
    const state: GameState = { ...initial, rngState: 1, relics: withFateThread ? ['fate-thread'] : [] }
    expect(effectiveOdds(state, anvilSword(state)).destroyed).toBe(0)
    expect(normalizeOdds(effectiveOdds(state, anvilSword(state))).find((entry) => entry.key === 'destroyed')?.exact).toBe(0)
    const hammered = hammerSword(state, 1000).state
    expect(hammered.records.at(-1)).toMatchObject({ result: 'damaged', afterLevel: 0 })
    expect(hammered.swords).toHaveLength(state.swords.length)
    expect(anvilSword(hammered)).toMatchObject({ level: 0, evolutionStage: 4, forgeRelief: 1 })
  })

  it('等级提高会增加风险，但高等级封顶仍低于旧破坏8%和损伤17%', () => {
    const state = onAnvil()
    const odds = [0, 1, 8, 16, 99, 100].map((level) => effectiveOdds(state, { ...anvilSword(state), level }))
    for (let index = 1; index < 4; index += 1) {
      expect(odds[index].destroyed).toBeGreaterThan(odds[index - 1].destroyed)
      expect(odds[index].damaged).toBeGreaterThan(odds[index - 1].damaged)
    }
    expect(odds[4]).toEqual(odds[3])
    expect(odds[5]).toEqual(odds[4])
    expect(odds[4].destroyed).toBeLessThan(8)
    expect(odds[4].damaged).toBeLessThan(17)
    for (const weights of odds) expect(Object.values(weights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(100)
  })

  it.each([0, 1, 8, 99])('%i级的补偿仅把实际减少的负面权重转给成功，大成功不变', (level) => {
    const state = onAnvil({ level })
    const sword = anvilSword(state)
    const base = effectiveOdds(state, sword)
    for (const forgeRelief of [1, 3, 5]) {
      const relieved = effectiveOdds(state, { ...sword, forgeRelief })
      expect(relieved.destroyed).toBeCloseTo(Math.max(0, base.destroyed - forgeRelief * 0.5))
      expect(relieved.damaged).toBeCloseTo(Math.max(0, base.damaged - forgeRelief * 2))
      expect(relieved.success - base.success).toBeCloseTo(base.destroyed - relieved.destroyed + base.damaged - relieved.damaged)
      expect(relieved.steady).toBe(base.steady)
      expect(relieved.great).toBe(base.great)
      const segments = normalizeOdds(relieved)
      expect(segments.every((entry) => entry.exact >= 0)).toBe(true)
      expect(segments.reduce((sum, entry) => sum + entry.exact, 0)).toBeCloseTo(100)
    }
  })

  it('遗物先调整权重，补偿不产生负权重，下一锤大成功加成保持独立', () => {
    const initial = onAnvil({ level: 1, forgeRelief: 5 })
    const state: GameState = { ...initial, relics: ['soft-anvil', 'tempered-gloves', 'fate-thread'] }
    const sword = anvilSword(state)
    const base = effectiveOdds(state, { ...sword, forgeRelief: 0 })
    const relieved = effectiveOdds(state, sword)
    expect(relieved.destroyed).toBe(0)
    expect(relieved.damaged).toBe(0)
    expect(relieved.success - base.success).toBeCloseTo(base.destroyed + base.damaged)
    expect(effectiveOdds(state, { ...sword, nextGreatBoost: true })).toEqual({ ...relieved, great: relieved.great + 25 })
    expect(normalizeOdds(relieved).filter((entry) => entry.key === 'destroyed' || entry.key === 'damaged')).toEqual([
      expect.objectContaining({ key: 'destroyed', exact: 0 }),
      expect.objectContaining({ key: 'damaged', exact: 0 }),
    ])
  })

  it.each(['steady', 'damaged'] as const)('连续%s逐次叠层，最多五层', (result) => {
    let state = onAnvil({ level: 30, evolutionStage: 10 })
    for (let count = 1; count <= 7; count += 1) {
      state = hammerAs(state, result, count * 1000)
      expect(anvilSword(state).forgeRelief).toBe(Math.min(5, count))
    }
  })

  it('维持与损伤混合连续也叠层，降到零级后立即按新等级计算', () => {
    let state = onAnvil({ level: 2, evolutionStage: 1 })
    for (const [index, result] of (['steady', 'damaged', 'steady', 'damaged'] as const).entries()) {
      state = hammerAs(state, result, (index + 1) * 1000)
      expect(anvilSword(state).forgeRelief).toBe(index + 1)
    }
    const sword = anvilSword(state)
    expect(sword).toMatchObject({ level: 0, evolutionStage: 1, forgeRelief: 4 })
    const odds = effectiveOdds(state, sword)
    expect(odds.destroyed).toBe(0)
    expect(odds.damaged).toBe(0)
    expect(odds).not.toEqual(effectiveOdds(state, { ...sword, level: 2 }))
  })

  it.each(['success', 'great'] as const)('%s清空已有补偿层，而非只减一层', (result) => {
    const state = onAnvil({ forgeRelief: 5 })
    const hammered = hammerAs(state, result)
    expect(anvilSword(hammered)).toMatchObject({ level: result === 'success' ? 13 : 14, forgeRelief: 0 })
  })

  it('破坏及被龙鳞阻挡的破坏不改变快照或剑的补偿层', () => {
    const initial = onAnvil({ forgeRelief: 2 })
    const destroyed = hammerAs(initial, 'destroyed')
    expect(destroyed.swords.some((sword) => sword.id === initial.swords[0].id)).toBe(false)
    expect(destroyed.lastHammer?.sword.forgeRelief).toBe(2)
    const protectedState = onAnvil({ forgeRelief: 2, dragonScaleArmed: true })
    const protectedSword = hammerAs(protectedState, 'destroyed')
    expect(anvilSword(protectedSword)).toMatchObject({ forgeRelief: 2, dragonScaleArmed: false })
    expect(protectedSword.records.at(-1)?.preventedBy).toBe('dragon-scale')
  })

  it('补偿不跨剑，存放和空交换日仍保留原剑的层数', () => {
    const hammered = hammerAs(onAnvil(), 'steady')
    const first = anvilSword(hammered)
    const stored = moveSword(hammered, first.id, 'rack').state
    expect(stored.swords.find((sword) => sword.id === first.id)?.forgeRelief).toBe(1)
    const secondId = stored.swords.find((sword) => sword.id !== first.id)!.id
    const heated = moveSword(stored, secondId, 'forge').state
    const switched = moveSword(heated, secondId, 'anvil').state
    expect(anvilSword(switched).forgeRelief).toBe(0)
    const secondHammer = hammerAs(switched, 'steady')
    expect(secondHammer.swords.find((sword) => sword.id === first.id)?.forgeRelief).toBe(1)
    expect(anvilSword(secondHammer).forgeRelief).toBe(1)
    const advanced = ringSubmissionBell(ringSubmissionBell(secondHammer, 2000).state, 3000).state
    expect(advanced.day).toBe(2)
    for (const sword of secondHammer.swords) expect(advanced.swords.find((candidate) => candidate.id === sword.id)?.forgeRelief).toBe(sword.forgeRelief)
    expect(advanced.swords.filter((sword) => sword.createdDay === 2).map((sword) => sword.forgeRelief)).toEqual([0, 0, 0])
    expect(advanced.lastHammer).toBeNull()
  })

  it('沙漏恢复补偿和真实下一锤概率，但继续使用已前进的随机状态', () => {
    const initial = { ...onAnvil({ forgeRelief: 2 }), hourglasses: 1 }
    const original = anvilSword(initial)
    const originalOdds = effectiveOdds(initial, original)
    const hammered = hammerAs(initial, 'damaged')
    expect(anvilSword(hammered)).toMatchObject({ level: 11, forgeRelief: 3 })
    const restored = useHourglass(hammered).state
    expect(anvilSword(restored)).toEqual(original)
    expect(effectiveOdds(restored, anvilSword(restored))).toEqual(originalOdds)
    expect(restored.rngState).toBe(hammered.rngState)
    expect(restored.hourglasses).toBe(0)
    const next = nextRandom(hammered.rngState)
    const total = RESULTS.reduce((sum, key) => sum + originalOdds[key], 0)
    let boundary = 0
    const expected = RESULTS.find((key) => {
      boundary += originalOdds[key] / total
      return next.value < boundary
    })!
    const nextHammer = hammerSword(restored, 2000).state
    expect(nextHammer.records.at(-1)?.result).toBe(expected)
    expect(nextHammer.rngState).toBe(next.state)
    expect(nextHammer.lastHammer?.sword.forgeRelief).toBe(2)
  })

  it('补偿把实际抽样边界从损伤移向维持、从维持移向成功，而非只改变展示', () => {
    const base = onAnvil({ level: 12, forgeRelief: 0 })
    const original = anvilSword(base)
    const odds = effectiveOdds(base, original)
    const relievedSword = { ...original, forgeRelief: 5 }
    const relievedOdds = effectiveOdds(base, relievedSword)
    const originalNegative = odds.destroyed + odds.damaged
    const relievedNegative = relievedOdds.destroyed + relievedOdds.damaged
    for (const { low, high, before, after } of [
      { low: Math.max(odds.destroyed, relievedNegative), high: originalNegative, before: 'damaged', after: 'steady' },
      { low: relievedNegative + relievedOdds.steady, high: originalNegative + odds.steady, before: 'steady', after: 'success' },
    ]) {
      const seed = seedForRoll(low / 100, high / 100)
      const unrelieved = hammerSword({ ...base, rngState: seed }, 1000).state
      const relieved = hammerSword({
        ...base, rngState: seed,
        swords: base.swords.map((sword) => sword.id === original.id ? relievedSword : sword),
      }, 1000).state
      expect(unrelieved.records.at(-1)?.result).toBe(before)
      expect(relieved.records.at(-1)?.result).toBe(after)
    }
  })
})
