import { describe, expect, it } from 'vitest'
import { compactWeaponValue, weaponRarity } from './rarity'

describe('武器等级品质', () => {
  it.each([
    [0, 2, '普通', '#e8e5df'],
    [3, 5, '精良', '#70cc7d'],
    [6, 8, '稀有', '#63a9ed'],
    [9, 26, '史诗', '#b78be8'],
    [27, 53, '传说', '#f0c75e'],
    [54, 100, '神话', '#ef6f68'],
  ] as const)('%i至%i级显示%s品质和同一颜色', (first, last, name, cssColor) => {
    for (const level of [first, last]) expect(weaponRarity(level)).toMatchObject({ name, cssColor })
    if (first > 0) expect(weaponRarity(first - 1).name).not.toBe(name)
    if (last < 100) expect(weaponRarity(last + 1).name).not.toBe(name)
  })

  it('损伤跌过品质边界立即切回低档，不影响独立武器永久外形', () => {
    expect(weaponRarity(27).name).toBe('传说')
    expect(weaponRarity(26).name).toBe('史诗')
    expect(weaponRarity(54).name).toBe('神话')
    expect(weaponRarity(53).name).toBe('传说')
  })
})

describe('墙面武器金额', () => {
  it.each([
    [0n, '0'], [9999n, '9999'], [10_000n, '1万'], [19_999n, '1.9万'],
    [100_000_000n, '1亿'], [3_927_274_772_238n, '3.9万亿'],
    [987_654_321_012_345_678_901n, '987654321万亿'], [-19_999n, '-1.9万'],
  ] as const)('%s以无浮点精度损失的紧凑金额展示', (value, text) => {
    expect(compactWeaponValue(value)).toBe(text)
  })
})
