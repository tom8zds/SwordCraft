import { describe, expect, it } from 'vitest'
import { dailyTarget } from './content'
import { buyMerchantItem, createInitialState, ringSubmissionBell } from './engine'
import { divineDate, formatDivineDate, monthCalendar, monthDays, shiftDivineMonth } from './divineCalendar'
import type { GameState } from './types'

describe('神历与整月历史', () => {
  it('模拟第一日从神历26年3月5日开始，按真实月长跨月跨年', () => {
    expect(divineDate(1)).toEqual({ year: 26, month: 3, day: 5 })
    expect(formatDivineDate(1)).toBe('神历26年3月5日')
    expect(divineDate(27)).toEqual({ year: 26, month: 3, day: 31 })
    expect(divineDate(28)).toEqual({ year: 26, month: 4, day: 1 })
    expect(divineDate(302)).toEqual({ year: 26, month: 12, day: 31 })
    expect(divineDate(303)).toEqual({ year: 27, month: 1, day: 1 })
    expect(divineDate(727)).toEqual({ year: 28, month: 2, day: 29 })
    expect(divineDate(728)).toEqual({ year: 28, month: 3, day: 1 })
  })

  it('月份移动遵守公历闰年规则，不受0–99年偏移影响', () => {
    expect(monthDays(26, 2)).toBe(28)
    expect(monthDays(28, 2)).toBe(29)
    expect(monthDays(100, 2)).toBe(28)
    expect(monthDays(400, 2)).toBe(29)
    expect(monthDays(26, 4)).toBe(30)
    expect(monthDays(26, 3)).toBe(31)
    expect(shiftDivineMonth(26, 12, 1)).toEqual({ year: 27, month: 1 })
    expect(shiftDivineMonth(26, 1, -1)).toEqual({ year: 25, month: 12 })
    expect(shiftDivineMonth(26, 3, 25)).toEqual({ year: 28, month: 4 })
  })

  it('整月42格包含全部真实日号，开局之前不可经营', () => {
    const cells = monthCalendar(createInitialState(), 26, 3)
    expect(cells).toHaveLength(42)
    expect(cells.filter((cell) => cell.inMonth).map((cell) => cell.date.day)).toEqual(Array.from({ length: 31 }, (_, index) => index + 1))
    expect(cells.filter((cell) => cell.inMonth && cell.date.day < 5).every((cell) => cell.status === 'ineligible' && cell.gameDay === null && cell.target === null && !cell.merchant)).toBe(true)
    expect(cells.find((cell) => cell.inMonth && cell.date.day === 5)).toMatchObject({ gameDay: 1, status: 'current', target: 1000n })
    expect(monthCalendar(createInitialState(), 28, 2).filter((cell) => cell.inMonth)).toHaveLength(29)
    expect(monthCalendar(createInitialState(), 25, 12).every((cell) => cell.status === 'ineligible')).toBe(true)
  })

  it('缺失旧历史保持未知，已知结果来自存档而非日期猜测', () => {
    const initial = createInitialState()
    const state = {
      ...initial,
      day: 31,
      calendar: [
        { day: 2, target: dailyTarget(2), status: 'met' as const, merchant: false },
        { day: 7, target: dailyTarget(7), status: 'missed' as const, merchant: false },
      ],
    }
    const cells = monthCalendar(state, 26, 3)
    expect(cells.find((cell) => cell.gameDay === 1)?.status).toBe('unknown')
    expect(cells.find((cell) => cell.gameDay === 2)?.status).toBe('met')
    expect(cells.find((cell) => cell.gameDay === 7)?.status).toBe('missed')
    const april = monthCalendar(state, 26, 4)
    expect(april.find((cell) => cell.gameDay === 31)?.status).toBe('current')
    expect(april.find((cell) => cell.gameDay === 32)?.status).toBe('future')
  })

  it('商人仍每四个模拟日来访，不按日号重排或消耗随机数', () => {
    const initial = createInitialState(21)
    const cells = monthCalendar(initial, 26, 3)
    expect(cells.find((cell) => cell.gameDay === 4)).toMatchObject({ date: { day: 8 }, merchant: true })
    expect(cells.find((cell) => cell.gameDay === 8)).toMatchObject({ date: { day: 12 }, merchant: true })
    expect(cells.find((cell) => cell.gameDay === 28)).toMatchObject({ date: { month: 4, day: 1 }, merchant: true })
    const merchantDay = { ...initial, day: 4, coins: 100_000n }
    const bought = buyMerchantItem(merchantDay, merchantDay.merchantItems[0].id)
    expect(bought.state).not.toBe(merchantDay)
    const ordinaryDay = { ...merchantDay, day: 5 }
    expect(buyMerchantItem(ordinaryDay, ordinaryDay.merchantItems[0].id).state).toBe(ordinaryDay)
    expect(bought.state.rngState).toBe(merchantDay.rngState)
  })

  it('连续过日超过整月不丢达标或未达标记录，即使旧档没有当前条目', () => {
    let state: GameState = { ...createInitialState(22), health: 100, maxHealth: 100, calendar: [] }
    for (let day = 1; day <= 35; day += 1) {
      const met = day % 2 === 1
      const offered = { ...state, swords: met ? [{ ...state.swords[0], level: 99, location: 'submission' as const }] : [] }
      const first = ringSubmissionBell(offered, day * 10_000).state
      state = met ? first : ringSubmissionBell(first, day * 10_000 + 1000).state
    }
    expect(state.day).toBe(36)
    const history = state.calendar.filter((entry) => entry.day < state.day)
    expect(history).toHaveLength(35)
    expect(history.map((entry) => entry.status)).toEqual(Array.from({ length: 35 }, (_, index) => index % 2 === 0 ? 'met' : 'missed'))
    expect(state.calendar.find((entry) => entry.day === 36)?.status).toBe('current')
    const march = monthCalendar(state, 26, 3)
    expect(march.find((cell) => cell.gameDay === 1)?.status).toBe('met')
    expect(march.find((cell) => cell.gameDay === 2)?.status).toBe('missed')
  })
})
