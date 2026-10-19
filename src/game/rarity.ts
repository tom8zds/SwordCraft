export interface WeaponRarity {
  name: string
  minLevel: number
  color: number
  cssColor: string
}

export const WEAPON_RARITIES: readonly WeaponRarity[] = [
  { name: '普通', minLevel: 0, color: 0xe8e5df, cssColor: '#e8e5df' },
  { name: '精良', minLevel: 3, color: 0x70cc7d, cssColor: '#70cc7d' },
  { name: '稀有', minLevel: 6, color: 0x63a9ed, cssColor: '#63a9ed' },
  { name: '史诗', minLevel: 9, color: 0xb78be8, cssColor: '#b78be8' },
  { name: '传说', minLevel: 27, color: 0xf0c75e, cssColor: '#f0c75e' },
  { name: '神话', minLevel: 54, color: 0xef6f68, cssColor: '#ef6f68' },
]

export function weaponRarity(level: number): WeaponRarity {
  for (let index = WEAPON_RARITIES.length - 1; index > 0; index -= 1) {
    if (level >= WEAPON_RARITIES[index].minLevel) return WEAPON_RARITIES[index]
  }
  return WEAPON_RARITIES[0]
}

/** 墙面铭牌空间有限；金额运算保持 BigInt，详情仍展示完整金额。 */
export function compactWeaponValue(value: bigint): string {
  const absolute = value < 0n ? -value : value
  const sign = value < 0n ? '-' : ''
  for (const [unit, suffix] of [[1_000_000_000_000n, '万亿'], [100_000_000n, '亿'], [10_000n, '万']] as const) {
    if (absolute < unit) continue
    const tenths = absolute * 10n / unit
    return `${sign}${tenths / 10n}${tenths % 10n ? `.${tenths % 10n}` : ''}${suffix}`
  }
  return value.toString()
}
