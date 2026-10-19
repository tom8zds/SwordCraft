import { IRON_PATHS, swordName } from './content'
import { createInitialState } from './engine'
import type { GameState, Sword } from './types'
import { randomIndex } from './rng'

const STORAGE_KEY = 'swordcraft.save.v1'

interface SerializedState extends Omit<GameState, 'coins' | 'relicRefreshCost' | 'merchantItems' | 'calendar'> {
  coins: string
  relicRefreshCost: string
  merchantItems: Array<Omit<GameState['merchantItems'][number], 'price'> & { price: string }>
  calendar: Array<Omit<GameState['calendar'][number], 'target'> & { target: string }>
}

function serialize(state: GameState): SerializedState {
  return {
    ...state,
    coins: state.coins.toString(),
    relicRefreshCost: state.relicRefreshCost.toString(),
    merchantItems: state.merchantItems.map((item) => ({ ...item, price: item.price.toString() })),
    calendar: state.calendar.map((entry) => ({ ...entry, target: entry.target.toString() })),
  }
}

function parseUnsignedInteger(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) throw new Error('非法金额字段')
  return BigInt(value)
}

function restoreSword(sword: Sword & { pathChoices?: unknown }): Sword {
  const restored = { ...sword }
  delete restored.pathChoices
  return {
    ...restored,
    steadyChain: sword.steadyChain ?? 0,
    negativeChain: sword.negativeChain ?? 0,
    forgeRelief: Number.isInteger(sword.forgeRelief) ? Math.max(0, Math.min(5, sword.forgeRelief)) : 0,
  }
}

function deserialize(value: unknown): GameState {
  if (!value || typeof value !== 'object') throw new Error('存档不是对象')
  const raw = value as Partial<SerializedState>
  if (raw.version !== 1 || !Array.isArray(raw.swords) || !Array.isArray(raw.records) || !Array.isArray(raw.calendar) || !Array.isArray(raw.merchantItems)) {
    throw new Error('存档版本或结构不受支持')
  }
  const serialized = raw as SerializedState
  let rngState = serialized.rngState
  const discoveredNames = [...serialized.discoveredNames]
  const discoverSword = (sword: Sword) => {
    const name = swordName(sword)
    if (!discoveredNames.includes(name)) discoveredNames.push(name)
  }
  const restoreAndBindSword = (rawSword: Sword): Sword => {
    const sword = restoreSword(rawSword)
    const stage = Math.max(sword.evolutionStage, Math.floor(sword.level / 3))
    if (sword.kind !== 'iron' || sword.path || stage < 3) return sword
    const picked = randomIndex(rngState, IRON_PATHS.length)
    rngState = picked.state
    const evolved = { ...sword, path: IRON_PATHS[picked.index], evolutionStage: stage }
    discoverSword(evolved)
    return evolved
  }
  const swords = serialized.swords.map(restoreAndBindSword)
  let lastHammer = raw.lastHammer ? { ...raw.lastHammer, sword: restoreSword(raw.lastHammer.sword) } : null
  if (lastHammer) {
    const snapshotSword = lastHammer.sword
    const current = swords.find((sword) => sword.id === snapshotSword.id)
    if (current?.path && snapshotSword.kind === 'iron' && !snapshotSword.path && Math.max(snapshotSword.evolutionStage, Math.floor(snapshotSword.level / 3)) >= 3) {
      lastHammer = { ...lastHammer, sword: { ...snapshotSword, path: current.path } }
    } else lastHammer = { ...lastHammer, sword: restoreAndBindSword(snapshotSword) }
  }
  // 补记当前持有和上一锤已持有的形态，不推断其他路线或抹去已售、已碎历史。
  for (const sword of swords) discoverSword(sword)
  if (lastHammer) discoverSword(lastHammer.sword)
  return {
    ...serialized,
    dragonScales: Number.isInteger(raw.dragonScales) && raw.dragonScales! >= 0 ? raw.dragonScales! : 0,
    hourglasses: Number.isInteger(raw.hourglasses) && raw.hourglasses! >= 0 ? raw.hourglasses! : 0,
    lastHammer,
    pendingLowSubmitUntil: raw.pendingLowSubmitUntil ?? null,
    milestoneDays: Array.isArray(raw.milestoneDays) ? raw.milestoneDays : [],
    victorySeen: raw.victorySeen ?? false,
    swords,
    rngState,
    discoveredNames,
    coins: parseUnsignedInteger(raw.coins),
    relicRefreshCost: 750n,
    merchantItems: raw.merchantItems.map((item) => ({ ...item, price: parseUnsignedInteger(item.price) })),
    calendar: raw.calendar.map((entry) => ({ ...entry, target: parseUnsignedInteger(entry.target) })),
  }
}

export function saveGame(state: GameState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)))
    return true
  } catch {
    return false
  }
}

export function loadGame(): { state: GameState; recovered: boolean } {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return { state: createInitialState(), recovered: false }
    return { state: deserialize(JSON.parse(stored)), recovered: true }
  } catch {
    return { state: createInitialState(), recovered: false }
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // 存储不可用时，新状态仍可留在内存中继续游戏。
  }
}
