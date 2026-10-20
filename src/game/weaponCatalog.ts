import { INFINITY_FORM, IRON_PATHS, KIND_ECONOMY, PATH_LABELS, swordEvolutionStage, swordName } from './content'
import type { Sword, SwordKind, SwordPath } from './types'
import { WEAPON_DESCRIPTIONS } from './weaponDescriptions'

export interface WeaponCatalogEntry {
  id: string
  name: string
  description: string
  visualScale: number
  kind: SwordKind
  path: SwordPath | null
  level: number
  evolutionStage: number
  family: string
  familyLabel: string
}

const VISUAL_SCALES: Readonly<Record<number, number>> = { 45: 1.06, 54: 1.10, 63: 1.14, 72: 1.18, 81: 1.22, 90: 1.26, 99: 1.30, [INFINITY_FORM.level]: 1.34 }

function createWeaponCatalog(): WeaponCatalogEntry[] {
  const entries: WeaponCatalogEntry[] = []
  const appendFamily = (kind: SwordKind, path: SwordPath | null, firstLevel: number, lastLevel: number) => {
    const names = new Set<string>()
    const family = kind === 'iron' ? path ?? 'iron-base' : kind
    const familyLabel = kind === 'iron' && path ? PATH_LABELS[path] : KIND_ECONOMY[kind].label
    for (let level = firstLevel; level <= lastLevel; level += 1) {
      const evolutionStage = swordEvolutionStage({ kind, path, level })
      const name = swordName({ kind, path, level, evolutionStage })
      if (names.has(name)) continue
      names.add(name)
      const description = WEAPON_DESCRIPTIONS[name]
      if (!description) throw new Error(`武器图鉴缺少描述：${name}`)
      const visualScale = VISUAL_SCALES[level] ?? 1
      entries.push({ id: `${kind}:${path ?? 'base'}:${level}`, name, description, visualScale, kind, path, level, evolutionStage, family, familyLabel })
    }
  }

  // 只枚举实际可达的命名区间，不生成游戏状态，也不消耗随机命运。
  appendFamily('iron', null, 0, 8)
  for (const path of IRON_PATHS) appendFamily('iron', path, 9, 99)
  appendFamily('branch', 'world-tree', 0, 99)
  appendFamily('nail', 'meteor', 0, 99)
  appendFamily('dagger', 'assassin', 0, 99)
  // 新形态只追加，旧目录索引同时也是既有武器图片文件名的一部分。
  appendFamily('iron', 'one-hand', INFINITY_FORM.level, INFINITY_FORM.level)
  return entries
}

export const WEAPON_CATALOG: readonly WeaponCatalogEntry[] = createWeaponCatalog()

const nameToEntryMap: Readonly<Record<string, WeaponCatalogEntry>> = Object.fromEntries(WEAPON_CATALOG.map((entry) => [entry.name, entry]))

export function getWeaponCatalogEntry(sword: Pick<Sword, 'kind' | 'path' | 'level'> & Partial<Pick<Sword, 'evolutionStage'>>): WeaponCatalogEntry {
  const name = swordName(sword)
  const entry = nameToEntryMap[name]
  if (!entry) throw new Error(`武器图鉴缺少条目：${name}`)
  return entry
}
