import {
  BASE_ODDS,
  IRON_PATHS,
  RELICS,
  dailyTarget,
  merchantInventory,
  swordName,
  swordValue,
} from './content'
import { buildCalendarEntries } from './divineCalendar'
import { nextRandom, randomIndex } from './rng'
import type {
  EffectiveOdds,
  GameEvent,
  GameState,
  HammerRecord,
  HammerResult,
  RelicId,
  Sword,
  SwordKind,
  SwordLocation,
  Transition,
} from './types'

const RELIC_REFRESH_COST = 750n

function copySword(sword: Sword): Sword {
  return { ...sword }
}

function createSword(kind: SwordKind, day: number, serial: number, location: SwordLocation = 'rack'): Sword {
  return {
    id: `sword-${serial}`,
    kind,
    level: 0,
    heated: false,
    charge: 0,
    invincibleUntil: null,
    path: kind === 'branch' ? 'world-tree' : kind === 'nail' ? 'meteor' : kind === 'dagger' ? 'assassin' : null,
    evolutionStage: 0,
    location,
    dragonScaleArmed: false,
    relicShieldDay: null,
    streakResult: null,
    streakCount: 0,
    nextGreatBoost: false,
    steadyChain: 0,
    negativeChain: 0,
    forgeRelief: 0,
    createdDay: day,
  }
}

function shuffledRelicOffers(state: number, owned: RelicId[], count = 3): { offers: RelicId[]; state: number } {
  const available = RELICS.filter((relic) => !owned.includes(relic.id)).map((relic) => relic.id)
  const offers: RelicId[] = []
  let rngState = state
  while (offers.length < count && available.length > 0) {
    const picked = randomIndex(rngState, available.length)
    rngState = picked.state
    const [id] = available.splice(picked.index, 1)
    offers.push(id)
  }
  return { offers, state: rngState }
}

export function createInitialState(seed = 0x5f3759df): GameState {
  const swords = [createSword('iron', 1, 1), createSword('iron', 1, 2), createSword('iron', 1, 3)]
  const offers = shuffledRelicOffers(seed, [])
  return {
    version: 1,
    day: 1,
    health: 3,
    maxHealth: 3,
    coins: 0n,
    swords,
    selectedSwordId: null,
    dragonScales: 0,
    hourglasses: 0,
    relics: [],
    relicOffers: offers.offers,
    relicRefreshCost: RELIC_REFRESH_COST,
    merchantItems: merchantInventory(),
    calendar: buildCalendarEntries(1),
    records: [],
    discoveredNames: ['普通铁剑'],
    rngState: offers.state,
    nextSwordSerial: 4,
    nextRecordSerial: 1,
    lastHammer: null,
    pendingLowSubmitUntil: null,
    milestoneDays: [],
    gameOver: false,
    victorySeen: false,
  }
}

export function effectiveOdds(state: GameState, sword?: Sword): EffectiveOdds {
  const odds: EffectiveOdds = { ...BASE_ODDS }
  const level = Math.max(0, Math.min(99, sword?.level ?? 0))
  odds.destroyed = Math.min(4, level * 0.25)
  odds.damaged = Math.min(12, BASE_ODDS.damaged + level * 0.25)
  odds.success = 100 - odds.destroyed - odds.damaged - odds.steady - odds.great
  for (const relic of state.relics) {
    if (relic === 'lucky-tongs') odds.success += 5
    if (relic === 'soft-anvil') odds.damaged = Math.max(0, odds.damaged - 5)
    if (relic === 'tempered-gloves') odds.destroyed = Math.max(0, odds.destroyed - 3)
    if (relic === 'star-coal') odds.great += 3
    if (relic === 'fate-thread') {
      odds.great += 2
      odds.destroyed += 2
    }
  }
  // 零级绝不破坏，遗物也不能覆盖这一规则。
  if (level === 0) odds.destroyed = 0
  const relief = sword?.forgeRelief ?? 0
  const destroyedRelief = Math.min(odds.destroyed, relief * 0.5)
  const damagedRelief = Math.min(odds.damaged, relief * 2)
  odds.destroyed -= destroyedRelief
  odds.damaged -= damagedRelief
  odds.success += destroyedRelief + damagedRelief
  if (sword?.nextGreatBoost) odds.great += 25
  return odds
}

function pickHammerResult(state: GameState, sword: Sword): { result: HammerResult; rngState: number } {
  const odds = effectiveOdds(state, sword)
  const total = odds.destroyed + odds.damaged + odds.steady + odds.success + odds.great
  const random = nextRandom(state.rngState)
  let roll = random.value * total
  const ordered: [HammerResult, number][] = [
    ['destroyed', odds.destroyed],
    ['damaged', odds.damaged],
    ['steady', odds.steady],
    ['success', odds.success],
    ['great', odds.great],
  ]
  for (const [result, weight] of ordered) {
    if (roll < weight) return { result, rngState: random.state }
    roll -= weight
  }
  return { result: 'great', rngState: random.state }
}

function withMessage(state: GameState, message: string, tone: 'good' | 'bad' | 'neutral' = 'neutral'): Transition {
  return { state, events: [{ type: 'message', message, tone }] }
}

export function moveSword(state: GameState, swordId: string, location: SwordLocation): Transition {
  if (state.gameOver) return withMessage(state, '炉火已经熄灭。', 'bad')
  const sword = state.swords.find((candidate) => candidate.id === swordId)
  if (!sword) return withMessage(state, '这把剑已经不在铁匠铺里。', 'bad')
  if (location === 'forge' && sword.heated) return withMessage(state, '剑身已经记住炉火，不必再次加热。', 'neutral')
  if (location !== 'rack' && state.swords.some((candidate) => candidate.location === location && candidate.id !== swordId)) {
    return withMessage(state, '那里已经放着一把剑。', 'bad')
  }
  if (location === 'anvil' && !sword.heated) return withMessage(state, '冰冷的剑无法锻打。先送进火炉。', 'bad')

  const moved = location !== sword.location
  const changedSword = moved
    ? {
      ...sword,
      location,
      heated: location === 'forge' ? true : sword.heated,
      streakResult: null,
      streakCount: 0,
      steadyChain: 0,
      negativeChain: 0,
      nextGreatBoost: false,
    }
    : sword
  const swords = state.swords.map((candidate) => candidate.id === swordId ? changedSword : candidate)
  const events: GameEvent[] = []
  if (location === 'forge' && !sword.heated) events.push({ type: 'message', message: '火焰舔过剑身，它已永远记住这份温度。', tone: 'good' })
  const closesHammerWindow = moved && (sword.location === 'anvil' || location === 'anvil')
  return {
    state: { ...state, swords, selectedSwordId: swordId, lastHammer: closesHammerWindow ? null : state.lastHammer, pendingLowSubmitUntil: null },
    events,
  }
}

function evolveSword(sword: Sword, rngState: number): { sword: Sword; rngState: number; event?: GameEvent } {
  const stage = Math.floor(sword.level / 3)
  if (stage <= sword.evolutionStage) return { sword, rngState }

  let nextSword = { ...sword, evolutionStage: stage }
  let nextRng = rngState
  if (nextSword.kind === 'iron' && stage >= 3 && !nextSword.path) {
    const picked = randomIndex(nextRng, IRON_PATHS.length)
    nextRng = picked.state
    nextSword = { ...nextSword, path: IRON_PATHS[picked.index] }
  }
  const name = swordName(nextSword)
  return {
    sword: nextSword,
    rngState: nextRng,
    event: { type: 'evolution', swordId: sword.id, name },
  }
}

export function hammerSword(state: GameState, now: number): Transition {
  if (state.gameOver) return withMessage(state, '炉火已经熄灭。', 'bad')
  const index = state.swords.findIndex((sword) => sword.location === 'anvil')
  if (index < 0) return withMessage(state, '工作台上没有剑。', 'bad')
  const original = state.swords[index]
  if (!original.heated) return withMessage(state, '剑身还是冷的。', 'bad')

  const snapshot = { sword: copySword(original), rngState: state.rngState, recordCount: state.records.length }
  const picked = pickHammerResult(state, original)
  let sword = copySword(original)
  let result = picked.result
  let preventedBy: HammerRecord['preventedBy']
  let destroyed = false
  let rngState = picked.rngState

  const dragonScaleWasArmed = sword.dragonScaleArmed
  sword.dragonScaleArmed = false
  sword.nextGreatBoost = false

  if (result === 'destroyed') {
    if (dragonScaleWasArmed) preventedBy = 'dragon-scale'
    else if (sword.invincibleUntil !== null && sword.invincibleUntil > now) preventedBy = 'ascension'
    else if (state.relics.includes('phoenix-ash') && !state.records.some((record) => record.day === state.day && record.preventedBy === 'relic')) preventedBy = 'relic'
    else if (state.relics.includes('guardian-mark') && sword.relicShieldDay !== state.day) {
      preventedBy = 'relic'
      sword.relicShieldDay = state.day
    } else destroyed = true
  }

  if (result === 'damaged') {
    if (sword.level === 0 && state.relics.includes('iron-will')) result = 'steady'
    else sword.level = Math.max(0, sword.level - 1)
  }
  if (result === 'success') sword.level = Math.min(99, sword.level + 1)
  if (result === 'great') sword.level = Math.min(99, sword.level + 2)

  const sameStreak = original.streakResult === result ? original.streakCount + 1 : 1
  sword.steadyChain = result === 'steady' ? original.steadyChain + 1 : 0
  sword.negativeChain = result === 'damaged' || result === 'destroyed' ? original.negativeChain + 1 : 0
  if (result === 'steady' || result === 'damaged') sword.forgeRelief = Math.min(5, original.forgeRelief + 1)
  else if (result === 'success' || result === 'great') sword.forgeRelief = 0

  // 特殊基础剑从第三次进化起体现各自的成长节奏。
  if (sword.evolutionStage >= 3 && sword.kind === 'branch' && sword.steadyChain > 0 && sword.steadyChain % 3 === 0) {
    sword.level = Math.min(99, sword.level + 1)
  }
  if (sword.evolutionStage >= 3 && sword.kind === 'nail' && result === 'great') {
    sword.level = Math.min(99, sword.level + 1)
  }

  let chargeGain = result === 'great' ? 2 : result === 'steady' || result === 'success' ? 1 : 0
  if (sword.evolutionStage >= 3 && sword.kind === 'dagger' && sameStreak >= 2 && (result === 'success' || result === 'great')) chargeGain += 1
  if (result === 'steady' && state.relics.includes('patient-bell')) chargeGain += 1
  if (result === 'steady' && sameStreak >= 2 && state.relics.includes('echo-hammer')) chargeGain += 1
  if (result === 'damaged' && sameStreak >= 2 && state.relics.includes('scarlet-apron')) sword.nextGreatBoost = true

  if (sword.invincibleUntil === null || sword.invincibleUntil <= now) {
    sword.invincibleUntil = null
    sword.charge += chargeGain
    if (sword.charge >= 10) {
      sword.charge = 0
      sword.invincibleUntil = now + (state.relics.includes('moon-water') ? 7000 : 5000)
    }
  }
  sword.streakResult = result
  sword.streakCount = sameStreak

  const evolved = destroyed ? { sword, rngState } : evolveSword(sword, rngState)
  sword = evolved.sword
  rngState = evolved.rngState
  const afterName = swordName(sword)
  const record: HammerRecord = {
    id: `record-${state.nextRecordSerial}`,
    day: state.day,
    swordId: sword.id,
    swordName: afterName,
    beforeLevel: original.level,
    afterLevel: destroyed ? null : sword.level,
    result,
    preventedBy,
    at: now,
  }

  const swords = destroyed ? state.swords.filter((candidate) => candidate.id !== sword.id) : state.swords.map((candidate) => candidate.id === sword.id ? sword : candidate)
  const events: GameEvent[] = [{ type: 'hammer', result, preventedBy }]
  if (evolved.event) events.push(evolved.event)
  return {
    state: {
      ...state,
      swords,
      selectedSwordId: destroyed ? null : sword.id,
      records: [...state.records, record].slice(-200),
      discoveredNames: state.discoveredNames.includes(afterName) ? state.discoveredNames : [...state.discoveredNames, afterName],
      rngState,
      nextRecordSerial: state.nextRecordSerial + 1,
      lastHammer: snapshot,
      pendingLowSubmitUntil: null,
    },
    events,
  }
}

export function armDragonScale(state: GameState, swordId: string): Transition {
  if (state.dragonScales <= 0) return withMessage(state, '物品架上没有龙鳞。', 'bad')
  const target = state.swords.find((sword) => sword.id === swordId)
  if (!target) return withMessage(state, '找不到这把剑。', 'bad')
  if (target.dragonScaleArmed) return withMessage(state, '剑上已经覆着龙鳞。', 'neutral')
  return {
    state: {
      ...state,
      dragonScales: state.dragonScales - 1,
      swords: state.swords.map((sword) => sword.id === swordId ? { ...sword, dragonScaleArmed: true } : sword),
    },
    events: [{ type: 'message', message: '龙鳞贴合剑身，下一锤后便会化为灰烬。', tone: 'good' }],
  }
}

export function disarmDragonScale(state: GameState, swordId: string): Transition {
  if (state.gameOver) return withMessage(state, '炉火已经熄灭。', 'bad')
  const target = state.swords.find((sword) => sword.id === swordId)
  if (!target) return withMessage(state, '找不到这把剑。', 'bad')
  if (!target.dragonScaleArmed) return withMessage(state, '剑上没有装备龙鳞。', 'neutral')
  return {
    state: {
      ...state,
      dragonScales: state.dragonScales + 1,
      swords: state.swords.map((sword) => sword.id === swordId ? { ...sword, dragonScaleArmed: false } : sword),
    },
    events: [{ type: 'message', message: '龙鳞从剑身脱落，重新归入物品架。', tone: 'good' }],
  }
}

export function useHourglass(state: GameState): Transition {
  if (state.hourglasses <= 0) return withMessage(state, '没有可用的沙漏。', 'bad')
  if (!state.lastHammer) return withMessage(state, '流沙找不到可以回去的时刻。', 'bad')
  const snapshot = state.lastHammer
  const current = state.swords.find((sword) => sword.id === snapshot.sword.id)
  if ((current && current.location !== 'anvil') || state.swords.some((sword) => sword.location === 'anvil' && sword.id !== snapshot.sword.id)) {
    return withMessage(state, '这把剑已经离开上一锤的时刻。', 'bad')
  }
  const others = state.swords.filter((sword) => sword.id !== snapshot.sword.id)
  const restored = copySword(snapshot.sword)
  // 满200条时，追加新锤已经挤掉最旧记录，撤销仍需删除最后一条。
  const records = state.records.slice(0, Math.min(snapshot.recordCount, Math.max(0, state.records.length - 1)))
  return {
    state: {
      ...state,
      swords: [...others, restored],
      selectedSwordId: restored.id,
      hourglasses: state.hourglasses - 1,
      records,
      lastHammer: null,
      pendingLowSubmitUntil: null,
    },
    events: [{ type: 'message', message: '流沙倒转，上一锤留下的裂痕消失了。', tone: 'good' }],
  }
}

function milestoneReward(state: GameState, day: number): { state: GameState; events: GameEvent[] } {
  if (![10, 20, 30].includes(day) || state.milestoneDays.includes(day)) return { state, events: [] }
  if (day === 10) {
    return {
      state: { ...state, coins: state.coins + 5000n, milestoneDays: [...state.milestoneDays, day] },
      events: [{ type: 'message', message: '第十日：城镇送来 5,000 金币的锻造赏金。', tone: 'good' }],
    }
  }
  if (day === 20) {
    if (state.relics.length >= 10) {
      return {
        state: { ...state, milestoneDays: [...state.milestoneDays, day] },
        events: [{ type: 'message', message: '第二十日：遗物架已满十件，无法再收下赠礼。', tone: 'neutral' }],
      }
    }
    const available = RELICS.map((relic) => relic.id).filter((id) => !state.relics.includes(id))
    if (available.length === 0) return { state: { ...state, milestoneDays: [...state.milestoneDays, day] }, events: [] }
    const picked = randomIndex(state.rngState, available.length)
    const id = available[picked.index]
    return {
      state: { ...state, relics: [...state.relics, id], rngState: picked.state, milestoneDays: [...state.milestoneDays, day] },
      events: [{ type: 'message', message: '第二十日：古老遗物选择了你的铁匠铺。', tone: 'good' }],
    }
  }
  return {
    state: {
      ...state,
      maxHealth: state.maxHealth + 1,
      health: Math.min(state.maxHealth + 1, state.health + 1),
      milestoneDays: [...state.milestoneDays, day],
      victorySeen: true,
    },
    events: [{ type: 'message', message: '第三十日：你已成为铸剑大师，仍可继续经营。', tone: 'good' }],
  }
}

export function ringSubmissionBell(state: GameState, now: number): Transition {
  if (state.gameOver) return withMessage(state, '没有人会来收走熄炉后的剑。', 'bad')
  const sword = state.swords.find((candidate) => candidate.location === 'submission')
  const baseValue = sword ? swordValue(sword) : 0n
  const value = state.relics.includes('gilded-chisel') ? baseValue + baseValue / 10n : baseValue
  const target = dailyTarget(state.day)
  const met = value >= target
  if (!met && (state.pendingLowSubmitUntil === null || state.pendingLowSubmitUntil <= now)) {
    return {
      state: { ...state, pendingLowSubmitUntil: now + 3000 },
      events: [{ type: 'message', message: sword ? '铃声沉闷，剑价不足。三秒内再敲一次，将扣 1 点生命并进入下一天。' : '上供台没有剑。三秒内再敲一次，将扣 1 点生命、无金币收入并进入下一天。', tone: 'bad' }],
    }
  }

  const history = [
    ...state.calendar.filter((entry) => entry.day !== state.day),
    { day: state.day, target, status: met ? 'met' as const : 'missed' as const, merchant: state.day % 4 === 0 },
  ]
  const nextDay = state.day + 1
  let health = met ? state.health : state.health - 1
  let coins = state.coins + value
  if (!met && state.relics.includes('old-ledger')) coins += value / 5n
  const remaining: Sword[] = state.swords.filter((candidate) => candidate.id !== sword?.id).map((candidate) => ({ ...candidate, streakResult: null, streakCount: 0 }))
  let nextSerial = state.nextSwordSerial
  for (let count = 0; count < 3; count += 1) {
    remaining.push(createSword('iron', nextDay, nextSerial))
    nextSerial += 1
  }

  const gameOver = health <= 0
  if (gameOver) health = 0
  let nextState: GameState = {
    ...state,
    day: nextDay,
    health,
    coins,
    swords: remaining,
    selectedSwordId: null,
    merchantItems: nextDay % 4 === 0 ? merchantInventory() : state.merchantItems,
    calendar: buildCalendarEntries(nextDay, history),
    nextSwordSerial: nextSerial,
    lastHammer: null,
    pendingLowSubmitUntil: null,
    gameOver,
  }
  const events: GameEvent[] = [{ type: 'message', message: met ? `成交。${value.toString()} 金币落入钱箱。` : sword ? '交付未达标，扣除 1 点生命。' : '今日空手交付，扣除 1 点生命，没有金币收入。', tone: met ? 'good' : 'bad' }]
  if (!gameOver) {
    const milestone = milestoneReward(nextState, nextDay)
    nextState = milestone.state
    events.push(...milestone.events, { type: 'day-advanced', day: nextDay })
  } else events.push({ type: 'game-over' })
  return { state: nextState, events }
}

export function buyMerchantItem(state: GameState, itemId: string): Transition {
  if (state.day % 4 !== 0) return withMessage(state, '商人的车轮声还很远。', 'bad')
  const item = state.merchantItems.find((candidate) => candidate.id === itemId)
  if (!item || item.stock <= 0) return withMessage(state, '货架已经空了。', 'bad')
  let price = item.price
  if (state.relics.includes('double-bell') && ['iron', 'branch', 'nail', 'dagger'].includes(item.type)) price = price * 4n / 5n
  if (state.coins < price) return withMessage(state, '钱袋不够重。', 'bad')

  let swords = state.swords
  let discoveredNames = state.discoveredNames
  let dragonScales = state.dragonScales
  let hourglasses = state.hourglasses
  let nextSwordSerial = state.nextSwordSerial
  if (item.type === 'dragon-scale') dragonScales += 1
  else if (item.type === 'hourglass') hourglasses += 1
  else {
    const sword = createSword(item.type, state.day, nextSwordSerial)
    swords = [...swords, sword]
    const name = swordName(sword)
    if (!discoveredNames.includes(name)) discoveredNames = [...discoveredNames, name]
    nextSwordSerial += 1
  }
  return {
    state: {
      ...state,
      coins: state.coins - price,
      swords,
      discoveredNames,
      dragonScales,
      hourglasses,
      nextSwordSerial,
      merchantItems: state.merchantItems.map((candidate) => candidate.id === itemId ? { ...candidate, stock: candidate.stock - 1 } : candidate),
    },
    events: [{ type: 'message', message: `${item.name} 已归入铁匠铺。`, tone: 'good' }],
  }
}

export function buyRelic(state: GameState, relicId: RelicId, swordIds: string[]): Transition {
  if (state.relics.length >= 10) return withMessage(state, '遗物架已经放满十件珍宝。', 'bad')
  if (!state.relicOffers.includes(relicId) || state.relics.includes(relicId)) return withMessage(state, '祭台不承认这件遗物。', 'bad')
  const relic = RELICS.find((candidate) => candidate.id === relicId)
  if (!relic) return withMessage(state, '遗物已经从尘世消失。', 'bad')
  const sacrifices = state.swords.filter((sword) => swordIds.includes(sword.id))
  if (sacrifices.length !== relic.cost || sacrifices.some((sword) => sword.kind !== 'iron')) {
    return withMessage(state, `祭台需要 ${relic.cost} 把普通铁剑。`, 'bad')
  }
  const consumed = new Set(sacrifices.map((sword) => sword.id))
  const relics = [...state.relics, relicId]
  const offers = shuffledRelicOffers(state.rngState, relics)
  return {
    state: {
      ...state,
      swords: state.swords.filter((sword) => !consumed.has(sword.id)),
      relics,
      relicOffers: offers.offers,
      rngState: offers.state,
      selectedSwordId: consumed.has(state.selectedSwordId ?? '') ? null : state.selectedSwordId,
      lastHammer: state.lastHammer && consumed.has(state.lastHammer.sword.id) ? null : state.lastHammer,
    },
    events: [{ type: 'message', message: `${relic.name} 在祭台上苏醒。`, tone: 'good' }],
  }
}

export function refreshRelicOffers(state: GameState): Transition {
  if (state.coins < RELIC_REFRESH_COST) return withMessage(state, '没有足够金币拨动命运轮盘。', 'bad')
  const offers = shuffledRelicOffers(state.rngState, state.relics)
  return {
    state: {
      ...state,
      coins: state.coins - RELIC_REFRESH_COST,
      relicOffers: offers.offers,
      relicRefreshCost: RELIC_REFRESH_COST,
      rngState: offers.state,
    },
    events: [{ type: 'message', message: '祭台上的影子重新排列。', tone: 'neutral' }],
  }
}

export function restartGame(state: GameState): Transition {
  const restarted = createInitialState(state.rngState ^ 0x9e3779b9)
  return { state: restarted, events: [{ type: 'message', message: '新火点燃，三把铁剑等待第一锤。', tone: 'good' }] }
}
