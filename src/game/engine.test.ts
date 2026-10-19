import { describe, expect, it } from 'vitest'
import { dailyTarget, RELICS, swordName, swordValue } from './content'
import { armDragonScale, buyMerchantItem, buyRelic, createInitialState, disarmDragonScale, hammerSword, moveSword, refreshRelicOffers, ringSubmissionBell, useHourglass } from './engine'
import type { GameState, HammerRecord } from './types'

function putFirstSwordOnAnvil(state: GameState): GameState {
  const swordId = state.swords[0].id
  const heated = moveSword(state, swordId, 'forge').state
  return moveSword(heated, swordId, 'anvil').state
}

describe('铸剑核心规则', () => {
  it('初始三把剑需要先加热，且加热永久保留', () => {
    const initial = createInitialState(1)
    const swordId = initial.swords[0].id
    expect(moveSword(initial, swordId, 'anvil').state).toBe(initial)

    const heated = moveSword(initial, swordId, 'forge').state
    expect(heated.swords[0].heated).toBe(true)
    const stored = moveSword(heated, swordId, 'rack').state
    expect(stored.swords[0].heated).toBe(true)
    expect(moveSword(stored, swordId, 'anvil').state.swords[0].location).toBe('anvil')
  })

  it('价值和每日要求使用精确 BigInt 幂运算', () => {
    expect(swordValue({ kind: 'iron', level: 0 })).toBe(1000n)
    expect(swordValue({ kind: 'iron', level: 3 })).toBe(1953n)
    expect(swordValue({ kind: 'nail', level: 99 })).toBe(4_799_481_603_875_609n)
    expect(dailyTarget(1)).toBe(1000n)
    expect(dailyTarget(4)).toBe(1331n)
  })

  it('一次提交消耗剑、发放三把新剑并进入下一天', () => {
    const state = createInitialState(2)
    const swordId = state.swords[0].id
    const atCounter = moveSword(state, swordId, 'submission').state
    const submitted = ringSubmissionBell(atCounter, 1000).state

    expect(submitted.day).toBe(2)
    expect(submitted.health).toBe(3)
    expect(submitted.coins).toBe(1000n)
    expect(submitted.swords).toHaveLength(5)
    expect(submitted.swords.some((sword) => sword.id === swordId)).toBe(false)
  })

  it('不达标提交需要双响确认，并扣一点生命', () => {
    const state = createInitialState(3)
    state.day = 2
    const swordId = state.swords[0].id
    const atCounter = moveSword(state, swordId, 'submission').state
    const warning = ringSubmissionBell(atCounter, 1000)
    expect(warning.state.day).toBe(2)
    expect(warning.state.pendingLowSubmitUntil).toBe(4000)

    const submitted = ringSubmissionBell(warning.state, 2000).state
    expect(submitted.day).toBe(3)
    expect(submitted.health).toBe(2)
  })

  it('最后一把剑破坏后，空台双响仍可扣血过日并补发三把新剑', () => {
    const initial = putFirstSwordOnAnvil(createInitialState(13))
    const broken = hammerSword({
      ...initial,
      relics: ['gilded-chisel', 'old-ledger'],
      coins: 731n,
      rngState: 1,
      swords: [{ ...initial.swords[0], level: 1 }],
    }, 500).state
    expect(broken.swords).toHaveLength(0)
    expect(broken.lastHammer).not.toBeNull()

    const warning = ringSubmissionBell(broken, 1000).state
    expect(warning).toMatchObject({ day: 1, health: 3, coins: 731n, pendingLowSubmitUntil: 4000 })
    expect(warning.swords).toHaveLength(0)
    expect(warning.lastHammer).toEqual(broken.lastHammer)

    const submitted = ringSubmissionBell(warning, 3999)
    expect(submitted.state).toMatchObject({ day: 2, health: 2, coins: 731n, lastHammer: null, pendingLowSubmitUntil: null })
    expect(submitted.state.swords).toHaveLength(3)
    expect(submitted.state.swords.every((sword) => sword.createdDay === 2 && sword.level === 0 && sword.forgeRelief === 0)).toBe(true)
    expect(submitted.state.calendar.find((entry) => entry.day === 1)?.status).toBe('missed')
    expect(submitted.events).toContainEqual({ type: 'day-advanced', day: 2 })
  })

  it('空交不会取走炉内、工作台和剑架上的剑，超时必须重新双响确认', () => {
    const initial = putFirstSwordOnAnvil(createInitialState(14))
    const stocked = moveSword(initial, initial.swords[1].id, 'forge').state
    const state = { ...stocked, coins: 42n }
    const warning = ringSubmissionBell(state, 1000).state
    const expired = ringSubmissionBell(warning, 4001).state
    expect(expired).toMatchObject({ day: 1, health: 3, coins: 42n, pendingLowSubmitUntil: 7001 })
    expect(expired.swords).toEqual(state.swords)

    const submitted = ringSubmissionBell(expired, 5000).state
    expect(submitted).toMatchObject({ day: 2, health: 2, coins: 42n })
    expect(submitted.swords).toHaveLength(state.swords.length + 3)
    for (const sword of state.swords) expect(submitted.swords.find((candidate) => candidate.id === sword.id)).toEqual(sword)
  })

  it('空交仍触发正常商人补货和日期里程碑', () => {
    const initial = createInitialState(16)
    const beforeMerchant = { ...initial, day: 3, merchantItems: initial.merchantItems.map((item) => ({ ...item, stock: 0 })) }
    const merchantDay = ringSubmissionBell(ringSubmissionBell(beforeMerchant, 1000).state, 2000).state
    expect(merchantDay.day).toBe(4)
    expect(merchantDay.merchantItems).toEqual(initial.merchantItems)
    const beforeReward = { ...initial, day: 9 }
    const milestone = ringSubmissionBell(ringSubmissionBell(beforeReward, 1000).state, 2000).state
    expect(milestone).toMatchObject({ day: 10, health: 2, coins: 5000n })
    expect(milestone.milestoneDays).toContain(10)
  })

  it('最后一点生命空交后熄炉，后续敲铃不能继续扣血换日', () => {
    const state = { ...createInitialState(15), swords: [], health: 1 }
    const warning = ringSubmissionBell(state, 1000).state
    const ended = ringSubmissionBell(warning, 2000)
    expect(ended.state).toMatchObject({ day: 2, health: 0, coins: 0n, gameOver: true })
    expect(ended.state.swords).toHaveLength(3)
    expect(ended.events).toContainEqual({ type: 'game-over' })
    expect(ringSubmissionBell(ended.state, 2500).state).toBe(ended.state)
    expect(ringSubmissionBell(ended.state, 6000).state).toBe(ended.state)
  })

  it('沙漏恢复上一锤前的剑，但不回退随机数', () => {
    let state = putFirstSwordOnAnvil(createInitialState(4))
    state = { ...state, hourglasses: 1 }
    const before = state.swords.find((sword) => sword.location === 'anvil')!
    const hammered = hammerSword(state, 1000).state
    const consumedRng = hammered.rngState
    const restored = useHourglass(hammered).state
    const after = restored.swords.find((sword) => sword.id === before.id)!

    expect(after.level).toBe(before.level)
    expect(after.charge).toBe(before.charge)
    expect(restored.rngState).toBe(consumedRng)
    expect(restored.hourglasses).toBe(0)
    expect(restored.lastHammer).toBeNull()
  })

  it('移动清空所有连击，原地选择不关闭沙漏窗口，无效移动完整不变', () => {
    let state = putFirstSwordOnAnvil(createInitialState(6))
    state = {
      ...state, hourglasses: 1, rngState: 1,
      swords: state.swords.map((sword, index) => index === 0 ? { ...sword, level: 3, evolutionStage: 1 } : sword),
    }
    const armed = armDragonScale({ ...state, dragonScales: 1 }, state.swords[0].id).state
    const hammered = hammerSword(armed, 1000).state
    const swordId = state.swords[0].id
    const chained: GameState = {
      ...hammered,
      swords: hammered.swords.map((sword) => sword.id === swordId ? {
        ...sword, streakResult: 'damaged', streakCount: 2, steadyChain: 3, negativeChain: 2, nextGreatBoost: true,
      } : sword),
    }

    const selected = moveSword(chained, swordId, 'anvil').state
    expect(selected.lastHammer).toEqual(chained.lastHammer)
    expect(selected.swords).toEqual(chained.swords)
    expect(moveSword(chained, state.swords[1].id, 'anvil').state).toBe(chained)
    expect(moveSword(chained, swordId, 'forge').state).toBe(chained)

    const stored = moveSword(chained, swordId, 'rack').state
    expect(stored.swords.find((sword) => sword.id === swordId)).toMatchObject({
      streakResult: null, streakCount: 0, steadyChain: 0, negativeChain: 0, nextGreatBoost: false,
    })
    expect(stored.lastHammer).toBeNull()
    expect(useHourglass(stored).state).toBe(stored)
    expect(stored.hourglasses).toBe(1)
  })

  it('沙漏可救回破坏的剑，但不会挤掉后来占据工作台的另一把剑', () => {
    const initial = putFirstSwordOnAnvil(createInitialState(7))
    const state = {
      ...initial, hourglasses: 1, rngState: 1,
      swords: initial.swords.map((sword, index) => index === 0 ? { ...sword, level: 3, evolutionStage: 1 } : sword),
    }
    const original = state.swords[0]
    const destroyed = hammerSword(state, 1000).state
    expect(destroyed.swords.some((sword) => sword.id === original.id)).toBe(false)
    const restored = useHourglass(destroyed).state
    expect(restored.swords.find((sword) => sword.id === original.id)).toEqual(original)
    expect(restored.rngState).toBe(destroyed.rngState)
    expect(restored.hourglasses).toBe(0)

    const replacement = putFirstSwordOnAnvil(destroyed)
    expect(replacement.lastHammer).toBeNull()
    expect(useHourglass(replacement).state).toBe(replacement)
    // 旧存档可能仍携带已关闭窗口的快照，也不能删除新工作台剑。
    const staleSave = { ...replacement, lastHammer: destroyed.lastHammer }
    expect(useHourglass(staleSave).state).toBe(staleSave)
  })

  it('沙漏恢复龙鳞装备态，记录满200条时仍移除被撤销的一锤', () => {
    let state = putFirstSwordOnAnvil(createInitialState(8))
    state = { ...state, swords: state.swords.map((sword, index) => index === 0 ? { ...sword, level: 3, evolutionStage: 1 } : sword) }
    state = armDragonScale({ ...state, dragonScales: 1, hourglasses: 1, rngState: 1 }, state.swords[0].id).state
    const original = state.swords[0]
    const records: HammerRecord[] = Array.from({ length: 200 }, (_, index) => ({
      id: `record-${index + 1}`, day: 1, swordId: original.id, swordName: swordName(original),
      beforeLevel: original.level, afterLevel: original.level, result: 'steady', at: index,
    }))
    state = { ...state, records, nextRecordSerial: 201 }
    const hammered = hammerSword(state, 1000).state
    expect(hammered.records).toHaveLength(200)
    expect(hammered.swords[0].dragonScaleArmed).toBe(false)
    expect(hammered.records.at(-1)).toMatchObject({ result: 'destroyed', preventedBy: 'dragon-scale' })
    const restored = useHourglass(hammered).state
    expect(restored.swords.find((sword) => sword.id === original.id)).toEqual(original)
    expect(restored.records).toEqual(records.slice(1))
    expect(restored.records.some((record) => record.id === 'record-201')).toBe(false)
    expect(restored.dragonScales).toBe(0)
    expect(restored.hourglasses).toBe(0)
    expect(restored.rngState).toBe(hammered.rngState)
    expect(useHourglass(restored).state).toBe(restored)
    const nextHammer = hammerSword(restored, 2000).state
    expect(nextHammer.lastHammer?.sword).toEqual(original)
  })

  it('沙漏还原无敌绝对截止时间，不赠送新的无敌时长', () => {
    const initial = putFirstSwordOnAnvil(createInitialState(11))
    const state: GameState = {
      ...initial,
      hourglasses: 1,
      rngState: 1,
      swords: initial.swords.map((sword, index) => index === 0 ? { ...sword, level: 3, evolutionStage: 1, invincibleUntil: 1500 } : sword),
    }
    const hammered = hammerSword(state, 1000).state
    const restored = useHourglass(hammered).state
    expect(restored.swords.find((sword) => sword.id === state.swords[0].id)?.invincibleUntil).toBe(1500)
    expect(hammerSword({ ...restored, rngState: 1 }, 2000).state.swords.some((sword) => sword.id === state.swords[0].id)).toBe(false)
  })

  it('下一锤前可卸下龙鳞并退回物品架，且不影响沙漏窗口', () => {
    const initial = putFirstSwordOnAnvil(createInitialState(12))
    const armed = armDragonScale({ ...initial, dragonScales: 1, hourglasses: 1 }, initial.swords[0].id).state
    const disarmed = disarmDragonScale(armed, initial.swords[0].id)
    expect(disarmed.state.dragonScales).toBe(1)
    expect(disarmed.state.swords[0].dragonScaleArmed).toBe(false)
    expect(disarmed.state.lastHammer).toBe(armed.lastHammer)
    const ended = { ...armed, gameOver: true }
    expect(disarmDragonScale(ended, initial.swords[0].id).state).toBe(ended)
  })

  it('已加热的剑不会再次占用火炉', () => {
    const initial = createInitialState(5)
    const swordId = initial.swords[0].id
    const heated = moveSword(initial, swordId, 'forge').state
    const stored = moveSword(heated, swordId, 'rack').state
    expect(moveSword(stored, swordId, 'forge').state).toBe(stored)
  })

  it('遗物刷新始终收取750金币，包括旧存档里的涨价', () => {
    const state = { ...createInitialState(9), coins: 2000n, relicRefreshCost: 1500n }
    const first = refreshRelicOffers(state).state
    expect(first.coins).toBe(1250n)
    expect(first.relicRefreshCost).toBe(750n)
    const second = refreshRelicOffers(first).state
    expect(second.coins).toBe(500n)
    expect(second.relicRefreshCost).toBe(750n)
    expect(refreshRelicOffers(second).state).toBe(second)
  })

  it('购买和第20天免费遗物都不超过十件，满架赠礼消耗领取机会', () => {
    const initial = createInitialState(10)
    const relics = RELICS.slice(0, 10).map((relic) => relic.id)
    const full = { ...initial, relics, relicOffers: [RELICS[10].id] }
    expect(buyRelic(full, RELICS[10].id, initial.swords.map((sword) => sword.id)).state).toBe(full)

    const ready: GameState = {
      ...full,
      day: 19,
      swords: full.swords.map((sword, index) => index === 0 ? { ...sword, level: 30, location: 'submission' } : sword),
    }
    const reward = ringSubmissionBell(ready, 1000)
    expect(reward.state.day).toBe(20)
    expect(reward.state.relics).toEqual(relics)
    const submittedValue = swordValue(ready.swords[0])
    expect(reward.state.coins).toBe(submittedValue + submittedValue / 10n)
    expect(reward.state.rngState).toBe(ready.rngState)
    expect(reward.state.milestoneDays).toContain(20)
    expect(reward.events).toContainEqual(expect.objectContaining({ type: 'message', message: expect.stringContaining('遗物架已满') }))

    const replay: GameState = {
      ...reward.state,
      day: 19,
      relics: relics.slice(0, 9),
      swords: reward.state.swords.map((sword, index) => index === 0 ? { ...sword, level: 30, location: 'submission' } : sword),
    }
    expect(ringSubmissionBell(replay, 2000).state.relics).toHaveLength(9)
  })

  it.each(['branch', 'nail', 'dagger'] as const)('购买%s基础剑立即发现，补货重复购买不重复发现', (kind) => {
    const initial = createInitialState(51)
    const state = { ...initial, day: 4, coins: 20_000n }
    const item = state.merchantItems.find((candidate) => candidate.type === kind)!
    const bought = buyMerchantItem(state, item.id).state
    const sword = bought.swords.at(-1)!
    const name = swordName(sword)
    expect(sword).toMatchObject({ kind, level: 0, evolutionStage: 0, heated: false })
    expect(bought.discoveredNames).toEqual([...state.discoveredNames, name])
    expect(bought.rngState).toBe(state.rngState)
    expect(bought.coins).toBe(state.coins - item.price)
    expect(bought.records).toEqual(state.records)
    const restocked = { ...bought, merchantItems: bought.merchantItems.map((candidate) => candidate.id === item.id ? { ...candidate, stock: 1 } : candidate) }
    const repeated = buyMerchantItem(restocked, item.id).state
    expect(repeated.swords).toHaveLength(bought.swords.length + 1)
    expect(repeated.discoveredNames).toEqual(bought.discoveredNames)
    expect(repeated.discoveredNames.filter((discovery) => discovery === name)).toHaveLength(1)
    expect(repeated.rngState).toBe(state.rngState)
  })

  it.each(['dragon-scale', 'hourglass'] as const)('购买%s道具不发现任何武器', (type) => {
    const state = { ...createInitialState(52), day: 4, coins: 20_000n }
    const item = state.merchantItems.find((candidate) => candidate.type === type)!
    const bought = buyMerchantItem(state, item.id).state
    expect(bought.discoveredNames).toEqual(state.discoveredNames)
    expect(bought.swords).toEqual(state.swords)
    expect(bought.dragonScales).toBe(type === 'dragon-scale' ? 1 : 0)
    expect(bought.hourglasses).toBe(type === 'hourglass' ? 1 : 0)
    expect(bought.rngState).toBe(state.rngState)
  })

  it('失败的特殊剑购买不会预先解锁图鉴', () => {
    const initial = createInitialState(53)
    const state = { ...initial, day: 4 }
    const item = state.merchantItems.find((candidate) => candidate.type === 'branch')!
    const failed = buyMerchantItem(state, item.id).state
    expect(failed).toBe(state)
    expect(failed.discoveredNames).toEqual(['普通铁剑'])
  })

  it('降级不退化已解锁形态，普通3级和6级节点以及旧调用保持原名', () => {
    expect(swordName({ kind: 'iron', level: 3, path: null })).toBe('精良铁剑')
    expect(swordName({ kind: 'iron', level: 6, path: null })).toBe('骑士大剑')
    expect(swordName({ kind: 'iron', level: 2, path: null, evolutionStage: 1 })).toBe('精良铁剑')
    expect(swordName({ kind: 'iron', level: 5, path: null, evolutionStage: 2 })).toBe('骑士大剑')
    expect(swordName({ kind: 'iron', level: 17, path: 'one-hand', evolutionStage: 6 })).toBe('银翼剑')
    expect(swordName({ kind: 'branch', level: 17, path: 'world-tree', evolutionStage: 6 })).toBe('古木剑')
    expect(swordName({ kind: 'nail', level: 8, path: 'meteor', evolutionStage: 3 })).toBe('铆钉锤')
    expect(swordName({ kind: 'dagger', level: 8, path: 'assassin', evolutionStage: 3 })).toBe('淬毒短刃')
  })

  it('高等级的每个主要进化节点都有独立名称', () => {
    const oneHand = [9, 18, 27, 36, 45, 54, 63, 72, 81, 90, 99].map((level) => swordName({ kind: 'iron', level, path: 'one-hand' }))
    const worldTree = [0, 9, 18, 27, 36, 45, 54, 63, 72, 81, 90, 99].map((level) => swordName({ kind: 'branch', level, path: 'world-tree' }))
    expect(new Set(oneHand).size).toBe(oneHand.length)
    expect(new Set(worldTree).size).toBe(worldTree.length)
  })
  it('同一随机状态得到同一个敲打结果', () => {
    const first = putFirstSwordOnAnvil(createInitialState(42))
    const second = structuredClone(first)
    expect(hammerSword(first, 5000).events).toEqual(hammerSword(second, 5000).events)
  })
})
