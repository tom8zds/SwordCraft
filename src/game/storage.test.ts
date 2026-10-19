import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { armDragonScale, createInitialState, effectiveOdds, hammerSword, moveSword, useHourglass } from './engine'
import { loadGame, saveGame } from './storage'
import { IRON_PATHS, swordName } from './content'
import { nextRandom, randomIndex } from './rng'
import { WEAPON_CATALOG } from './weaponCatalog'

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>()

  get length(): number {
    return this.#values.size
  }

  clear(): void {
    this.#values.clear()
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value)
  }
}

const originalStorage = window.localStorage

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: new MemoryStorage() })
})

afterEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: originalStorage })
})

describe('本地存档', () => {
  it('往返保存远超安全整数的金币和 RNG 状态', () => {
    const source = { ...createInitialState(123), coins: 987654321012345678901234567890n }
    expect(saveGame(source)).toBe(true)
    const loaded = loadGame()
    expect(loaded.recovered).toBe(true)
    expect(loaded.state.coins).toBe(source.coins)
    expect(loaded.state.rngState).toBe(source.rngState)
  })

  it('保留旧局剑、金币和RNG，同时规范固定刷新价', () => {
    const source = createInitialState(77)
    source.coins = 12345678901234567890n
    source.relicRefreshCost = 2250n
    source.swords[0].heated = true
    source.swords[0].location = 'anvil'
    source.swords[0].level = 6
    saveGame(source)
    const restored = loadGame()
    expect(restored.recovered).toBe(true)
    expect(restored.state.swords[0]).toEqual(source.swords[0])
    expect(restored.state.coins).toBe(source.coins)
    expect(restored.state.rngState).toBe(source.rngState)
    expect(restored.state.relicRefreshCost).toBe(750n)
  })

  it('旧版缺少库存字段时不可使用不存在的龙鳞或沙漏', () => {
    const source = createInitialState(88)
    source.coins = 7000n
    saveGame(source)
    const raw = JSON.parse(window.localStorage.getItem('swordcraft.save.v1')!)
    delete raw.dragonScales
    delete raw.hourglasses
    delete raw.lastHammer
    delete raw.pendingLowSubmitUntil
    delete raw.milestoneDays
    delete raw.victorySeen
    window.localStorage.setItem('swordcraft.save.v1', JSON.stringify(raw))
    const loaded = loadGame()
    expect(loaded.recovered).toBe(true)
    expect(loaded.state.coins).toBe(7000n)
    expect(loaded.state.rngState).toBe(source.rngState)
    expect(loaded.state.dragonScales).toBe(0)
    expect(loaded.state.hourglasses).toBe(0)
    expect(armDragonScale(loaded.state, source.swords[0].id).state).toBe(loaded.state)
    expect(saveGame(loaded.state)).toBe(true)
  })

  it('补偿跨存档保留，旧局和旧沙漏快照缺字段时仍可回溯并继续锻造', () => {
    const initial = createInitialState(91)
    const swordId = initial.swords[0].id
    const heated = moveSword(initial, swordId, 'forge').state
    const anvil = moveSword(heated, swordId, 'anvil').state
    const source = {
      ...anvil,
      hourglasses: 1,
      rngState: 5000,
      swords: anvil.swords.map((sword) => sword.id === swordId ? { ...sword, level: 6, forgeRelief: 3 } : sword),
    }
    const hammered = hammerSword(source, 1000).state
    saveGame(hammered)
    const current = loadGame().state
    const currentSword = current.swords.find((sword) => sword.id === swordId)!
    expect(effectiveOdds(current, currentSword)).toEqual(effectiveOdds(hammered, hammered.swords.find((sword) => sword.id === swordId)))
    const restored = useHourglass(current).state
    expect(restored.swords.find((sword) => sword.id === swordId)?.forgeRelief).toBe(3)
    expect(restored.rngState).toBe(hammered.rngState)

    const legacy = JSON.parse(window.localStorage.getItem('swordcraft.save.v1')!)
    for (const sword of legacy.swords) delete sword.forgeRelief
    delete legacy.lastHammer.sword.forgeRelief
    window.localStorage.setItem('swordcraft.save.v1', JSON.stringify(legacy))
    const loaded = loadGame()
    expect(loaded.recovered).toBe(true)
    const rewound = useHourglass(loaded.state).state
    const rewoundSword = rewound.swords.find((sword) => sword.id === swordId)!
    expect(rewoundSword.forgeRelief).toBe(0)
    expect(effectiveOdds(rewound, rewoundSword)).toEqual(effectiveOdds(initial, { ...source.swords[0], forgeRelief: 0 }))
    const continued = hammerSword({ ...rewound, rngState: 5000 }, 2000).state
    expect(continued.swords.find((sword) => sword.id === swordId)?.forgeRelief).toBe(1)
    expect(continued.hourglasses).toBe(0)
    expect(continued.records.at(-1)?.result).toBe('steady')
  })

  it('旧候选路线自动随机绑定并保存，刷新不重抽且沙漏不改变已锁路线', () => {
    const source = createInitialState(92)
    source.swords[0] = { ...source.swords[0], level: 8, evolutionStage: 3, heated: true, location: 'anvil' }
    source.swords[1] = { ...source.swords[1], level: 12, evolutionStage: 4, path: 'greatsword' }
    source.rngState = 123
    source.hourglasses = 1
    source.lastHammer = { sword: { ...source.swords[0], level: 9 }, rngState: 80, recordCount: 0 }
    source.coins = 7000n
    saveGame(source)
    const raw = JSON.parse(window.localStorage.getItem('swordcraft.save.v1')!)
    raw.swords[0].pathChoices = ['one-hand', 'sword-shield']
    raw.swords[1].pathChoices = ['one-hand', 'sword-shield']
    raw.lastHammer.sword.pathChoices = ['one-hand', 'sword-shield']
    window.localStorage.setItem('swordcraft.save.v1', JSON.stringify(raw))

    const loaded = loadGame()
    const picked = randomIndex(123, IRON_PATHS.length)
    const first = loaded.state.swords[0]
    expect(loaded.recovered).toBe(true)
    expect(first).toMatchObject({ id: source.swords[0].id, level: 8, evolutionStage: 3, path: IRON_PATHS[picked.index] })
    expect(loaded.state.swords[1].path).toBe('greatsword')
    expect(loaded.state.coins).toBe(7000n)
    expect(loaded.state.discoveredNames).toContain(swordName(first))
    expect(loaded.state.rngState).toBe(picked.state)
    const rewound = useHourglass(loaded.state).state
    expect(rewound.swords.find((sword) => sword.id === first.id)).toMatchObject({ level: 9, path: first.path })
    expect(rewound.rngState).toBe(picked.state)
    saveGame(loaded.state)
    const refreshed = loadGame().state
    expect(refreshed.swords).toEqual(loaded.state.swords)
    expect(refreshed.rngState).toBe(picked.state)
    const continued = hammerSword({ ...refreshed, rngState: 11264 }, 2000).state
    expect(continued.swords.find((sword) => sword.id === first.id)?.path).toBe(first.path)
    expect(continued.rngState).toBe(nextRandom(11264).state)
  })

  it('旧存档仅剩已碎剑快照时也会自动绑定路线，分叉前快照仍保持未分支', () => {
    const source = createInitialState(93)
    const snapshotSword = { ...source.swords[0], level: 9, evolutionStage: 3, location: 'anvil' as const, heated: true }
    source.swords = []
    source.rngState = 321
    source.hourglasses = 1
    source.lastHammer = { sword: snapshotSword, rngState: 0, recordCount: 0 }
    saveGame(source)
    const loaded = loadGame().state
    const picked = randomIndex(321, IRON_PATHS.length)
    const rescued = useHourglass(loaded).state
    expect(rescued.swords[0]).toMatchObject({ level: 9, path: IRON_PATHS[picked.index] })
    expect(rescued.rngState).toBe(picked.state)

    const beforeSplit = { ...source, lastHammer: { rngState: 0, recordCount: 0, sword: { ...snapshotSword, level: 8, evolutionStage: 2 } } }
    saveGame(beforeSplit)
    const unbranched = loadGame().state
    expect(unbranched.lastHammer?.sword.path).toBeNull()
    expect(unbranched.rngState).toBe(321)

    const alreadyBound = {
      ...source,
      swords: [{ ...snapshotSword, path: 'sword-shield' as const }],
      lastHammer: { rngState: 0, recordCount: 0, sword: { ...snapshotSword, path: 'greatsword' as const } },
    }
    saveGame(alreadyBound)
    const preserved = loadGame().state
    expect(preserved.swords[0].path).toBe('sword-shield')
    expect(preserved.lastHammer?.sword.path).toBe('greatsword')
    expect(preserved.rngState).toBe(321)
  })

  it('旧档补记持有剑和上一锤形态，保留已售已碎历史且不解锁其他路线或消耗随机数', () => {
    const source = createInitialState(94)
    source.coins = 98765n
    source.rngState = 654321
    source.swords = [
      { ...source.swords[0], level: 8, evolutionStage: 6, path: 'one-hand', heated: true, location: 'anvil', invincibleUntil: 9000, forgeRelief: 4 },
      { ...source.swords[1], kind: 'branch', path: 'world-tree', level: 18, evolutionStage: 6 },
      { ...source.swords[2], kind: 'dagger', path: 'assassin' },
    ]
    const brokenSword = { ...source.swords[0], id: 'old-broken-nail', kind: 'nail' as const, path: 'meteor' as const, level: 9, evolutionStage: 3 }
    source.lastHammer = { sword: brokenSword, rngState: 12, recordCount: 0 }
    source.discoveredNames = [
      swordName({ kind: 'iron', path: 'greatsword', level: 99 }),
      swordName({ kind: 'nail', path: 'meteor', level: 72 }),
    ]
    const expectedDiscoveries = [...source.discoveredNames, ...source.swords.map(swordName), swordName(brokenSword)]
    expect(saveGame(source)).toBe(true)
    const loaded = loadGame()
    expect(loaded.recovered).toBe(true)
    expect(loaded.state.discoveredNames).toEqual(expectedDiscoveries)
    expect(loaded.state.swords).toEqual(source.swords)
    expect(loaded.state.lastHammer).toEqual(source.lastHammer)
    expect(loaded.state.coins).toBe(source.coins)
    expect(loaded.state.rngState).toBe(source.rngState)
    expect(loaded.state.records).toEqual(source.records)
    expect(WEAPON_CATALOG.filter((entry) => loaded.state.discoveredNames.includes(entry.name)).map((entry) => entry.name).sort()).toEqual([...expectedDiscoveries].sort())
    expect(saveGame(loaded.state)).toBe(true)
    const refreshed = loadGame()
    expect(refreshed.recovered).toBe(true)
    expect(refreshed.state).toEqual(loaded.state)
  })

  it('同名现有剑补记一次，已知路径的旧沙漏快照也能补记但不会解锁中间形态', () => {
    const source = createInitialState(95)
    source.discoveredNames = []
    const snapshot = { ...source.swords[0], level: 18, evolutionStage: 6, path: 'sword-shield' as const, heated: true, location: 'anvil' as const }
    source.lastHammer = { sword: snapshot, rngState: 1, recordCount: 0 }
    expect(saveGame(source)).toBe(true)
    const loaded = loadGame()
    expect(loaded.recovered).toBe(true)
    expect(loaded.state.discoveredNames).toEqual([swordName(source.swords[0]), swordName(snapshot)])
    expect(loaded.state.discoveredNames).not.toContain(swordName({ ...snapshot, level: 9, evolutionStage: 3 }))
    expect(loaded.state.rngState).toBe(source.rngState)
    expect(loaded.state.swords).toEqual(source.swords)
    expect(loaded.state.lastHammer).toEqual(source.lastHammer)
  })

  it('损坏存档不会阻止新游戏', () => {
    window.localStorage.setItem('swordcraft.save.v1', '{broken')
    const loaded = loadGame()
    expect(loaded.recovered).toBe(false)
    expect(loaded.state.day).toBe(1)
    expect(loaded.state.swords).toHaveLength(3)
  })
})
