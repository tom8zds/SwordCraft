import { IRON_PATHS, KIND_ECONOMY, PATH_LABELS, swordName } from './content'
import type { Sword, SwordKind, SwordPath } from './types'

export interface WeaponCatalogEntry {
  id: string
  name: string
  kind: SwordKind
  path: SwordPath | null
  level: number
  evolutionStage: number
  family: string
  familyLabel: string
}

function createWeaponCatalog(): WeaponCatalogEntry[] {
  const entries: WeaponCatalogEntry[] = []
  const appendFamily = (kind: SwordKind, path: SwordPath | null, firstLevel: number, lastLevel: number) => {
    const names = new Set<string>()
    const family = kind === 'iron' ? path ?? 'iron-base' : kind
    const familyLabel = kind === 'iron' && path ? PATH_LABELS[path] : KIND_ECONOMY[kind].label
    for (let level = firstLevel; level <= lastLevel; level += 1) {
      const evolutionStage = Math.floor(level / 3)
      const name = swordName({ kind, path, level, evolutionStage })
      if (names.has(name)) continue
      names.add(name)
      entries.push({ id: `${kind}:${path ?? 'base'}:${level}`, name, kind, path, level, evolutionStage, family, familyLabel })
    }
  }

  // 只枚举实际可达的命名区间，不生成游戏状态，也不消耗随机命运。
  appendFamily('iron', null, 0, 8)
  for (const path of IRON_PATHS) appendFamily('iron', path, 9, 99)
  appendFamily('branch', 'world-tree', 0, 99)
  appendFamily('nail', 'meteor', 0, 99)
  appendFamily('dagger', 'assassin', 0, 99)
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
