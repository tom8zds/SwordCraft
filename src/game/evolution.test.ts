import { describe, expect, it } from 'vitest'
import { IRON_PATHS, swordName } from './content'
import { createInitialState, hammerSword, moveSword, useHourglass } from './engine'
import { nextRandom, randomIndex } from './rng'
import type { GameState, SwordKind } from './types'

function readySword(level: number, kind: SwordKind = 'iron'): GameState {
  const initial = createInitialState(31)
  const id = initial.swords[0].id
  const heated = moveSword(initial, id, 'forge').state
  const state = moveSword(heated, id, 'anvil').state
  return {
    ...state,
    swords: state.swords.map((sword, index) => index === 0 ? {
      ...sword, level, evolutionStage: Math.floor(level / 3), kind,
      path: kind === 'branch' ? 'world-tree' : null,
    } : sword),
  }
}

// 搜寻真实 RNG 的正向锤击与后续路线区间，不替换随机函数。
function seedForPath(path: typeof IRON_PATHS[number]): number {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const hammer = nextRandom(seed)
    if (hammer.value < 0.54 || hammer.value >= 0.95) continue
    const picked = randomIndex(hammer.state, IRON_PATHS.length)
    if (IRON_PATHS[picked.index] === path) return seed
  }
  throw new Error(`找不到 ${path} 的随机状态`)
}

function anvilSword(state: GameState) {
  return state.swords.find((sword) => sword.location === 'anvil')!
}

describe('自动随机进化', () => {
  it.each(IRON_PATHS)('第九级直接随机绑定%s并将真实形态写入记录与图鉴', (path) => {
    const original = readySword(8)
    const rngState = seedForPath(path)
    const state = { ...original, rngState }
    const transition = hammerSword(state, 1000)
    const evolved = anvilSword(transition.state)
    expect(evolved).toMatchObject({ level: 9, evolutionStage: 3, path })
    expect(transition.state.records.at(-1)).toMatchObject({ result: 'success', swordName: swordName(evolved), afterLevel: 9 })
    expect(transition.state.discoveredNames).toContain(swordName(evolved))
    expect(transition.events).toContainEqual({ type: 'evolution', swordId: evolved.id, name: swordName(evolved) })
    expect(transition.state.rngState).toBe(nextRandom(nextRandom(rngState).state).state)
    expect(hammerSword(state, 1000)).toEqual(transition)
  })

  it('大成功从八级跨到十级时只绑定一次路线，后续升级和降级都不重抽', () => {
    const state = { ...readySword(8), rngState: 15360 }
    const evolved = hammerSword(state, 1000).state
    const sword = anvilSword(evolved)
    expect(evolved.records.at(-1)?.result).toBe('great')
    expect(sword).toMatchObject({ level: 10, evolutionStage: 3 })
    expect(IRON_PATHS).toContain(sword.path)
    const damaged = hammerSword({ ...evolved, rngState: 640 }, 2000).state
    expect(anvilSword(damaged)).toMatchObject({ level: 9, path: sword.path, evolutionStage: 3 })
    expect(damaged.rngState).toBe(nextRandom(640).state)
    const later = hammerSword({
      ...damaged, rngState: 11264,
      swords: damaged.swords.map((candidate) => candidate.id === sword.id ? { ...candidate, level: 11 } : candidate),
    }, 3000).state
    expect(anvilSword(later)).toMatchObject({ level: 12, evolutionStage: 4, path: sword.path })
    expect(later.rngState).toBe(nextRandom(11264).state)
  })

  it('沙漏退回分叉前等级与路线，但不回退已经消耗的进化随机数', () => {
    const original = { ...readySword(8), rngState: seedForPath('sword-shield'), hourglasses: 1 }
    const evolved = hammerSword(original, 1000).state
    const restored = useHourglass(evolved).state
    expect(anvilSword(restored)).toEqual(anvilSword(original))
    expect(restored.rngState).toBe(evolved.rngState)
    expect(restored.hourglasses).toBe(0)
    expect(restored.records).toEqual(original.records)
  })

  it('低阶普通剑与特殊素材不抽普通分支随机数', () => {
    const low = hammerSword({ ...readySword(2), rngState: 11264 }, 1000).state
    expect(anvilSword(low)).toMatchObject({ level: 3, evolutionStage: 1, path: null })
    expect(low.rngState).toBe(nextRandom(11264).state)
    const branch = hammerSword({ ...readySword(8, 'branch'), rngState: 11264 }, 1000).state
    expect(anvilSword(branch)).toMatchObject({ kind: 'branch', level: 9, path: 'world-tree' })
    expect(branch.rngState).toBe(nextRandom(11264).state)
  })

  it.each([
    [99, 11264, 'success'],
    [98, 15360, 'great'],
    [99, 15360, 'great'],
  ] as const)('单手铁剑从%i级以随机种子%i跨到100，仅进化一次且不额外抽随机数', (level, rngState, result) => {
    const initial = readySword(level)
    const state = { ...initial, rngState, swords: initial.swords.map((sword) => sword.location === 'anvil' ? { ...sword, path: 'one-hand' as const } : sword) }
    const transition = hammerSword(state, 1000)
    const sword = anvilSword(transition.state)
    expect(sword).toMatchObject({ level: 100, evolutionStage: 34, path: 'one-hand' })
    expect(swordName(sword)).toBe('无尽之剑')
    expect(transition.events.filter((event) => event.type === 'evolution')).toEqual([{ type: 'evolution', swordId: sword.id, name: '无尽之剑' }])
    expect(transition.state.records.at(-1)).toMatchObject({ result, afterLevel: 100, swordName: '无尽之剑' })
    expect(transition.state.discoveredNames).toContain('无尽之剑')
    expect(transition.state.rngState).toBe(nextRandom(rngState).state)
    const capped = hammerSword({ ...transition.state, rngState: 15360 }, 2000)
    expect(anvilSword(capped.state)).toMatchObject({ level: 100, evolutionStage: 34 })
    expect(capped.events.filter((event) => event.type === 'evolution')).toEqual([])
    expect(capped.state.rngState).toBe(nextRandom(15360).state)
  })

  it.each([
    ['iron', 'greatsword'], ['iron', 'sword-shield'],
    ['branch', 'world-tree'], ['nail', 'meteor'], ['dagger', 'assassin'],
  ] as const)('%s的%s路线成功、大成功及额外成长都不会超过99', (kind, path) => {
    const initial = readySword(99, kind)
    const state = { ...initial, swords: initial.swords.map((sword) => sword.location === 'anvil' ? { ...sword, path, steadyChain: 2 } : sword) }
    for (const rngState of [11264, 15360, 5000]) {
      const transition = hammerSword({ ...state, rngState }, 1000)
      expect(anvilSword(transition.state)).toMatchObject({ level: 99, evolutionStage: 33, path })
      expect(swordName(anvilSword(transition.state))).not.toBe('无尽之剑')
      expect(transition.state.rngState).toBe(nextRandom(rngState).state)
    }
  })

  it('首次达到100后沙漏恢复永昼神锋，普通损伤至99和更低仍永久保留无尽形态', () => {
    const initial = readySword(99)
    const state = { ...initial, rngState: 11264, hourglasses: 1, swords: initial.swords.map((sword) => sword.location === 'anvil' ? { ...sword, path: 'one-hand' as const } : sword) }
    expect(swordName(anvilSword(state))).toBe('永昼神锋')
    const infinity = hammerSword(state, 1000).state
    const rewound = useHourglass(infinity).state
    expect(anvilSword(rewound)).toEqual(anvilSword(state))
    expect(swordName(anvilSword(rewound))).toBe('永昼神锋')
    expect(rewound.rngState).toBe(infinity.rngState)
    expect(rewound.discoveredNames).toContain('无尽之剑')
    const damaged = hammerSword({ ...infinity, rngState: 640 }, 2000).state
    expect(anvilSword(damaged)).toMatchObject({ level: 99, evolutionStage: 34 })
    const further = hammerSword({ ...damaged, rngState: 640 }, 3000).state
    expect(anvilSword(further)).toMatchObject({ level: 98, evolutionStage: 34 })
    expect(swordName(anvilSword(further))).toBe('无尽之剑')
    expect(anvilSword(useHourglass(further).state)).toEqual(anvilSword(damaged))
  })
})
