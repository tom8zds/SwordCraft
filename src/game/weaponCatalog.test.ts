import { describe, expect, it } from 'vitest'
import { swordName } from './content'
import type { SwordKind, SwordPath } from './types'
import { getWeaponCatalogEntry, WEAPON_CATALOG } from './weaponCatalog'

const reachableFamilies: Array<{ kind: SwordKind; path: SwordPath | null; start: number; end: number; family: string }> = [
  { kind: 'iron', path: null, start: 0, end: 8, family: 'iron-base' },
  { kind: 'iron', path: 'one-hand', start: 9, end: 99, family: 'one-hand' },
  { kind: 'iron', path: 'greatsword', start: 9, end: 99, family: 'greatsword' },
  { kind: 'iron', path: 'sword-shield', start: 9, end: 99, family: 'sword-shield' },
  { kind: 'branch', path: 'world-tree', start: 0, end: 99, family: 'branch' },
  { kind: 'nail', path: 'meteor', start: 0, end: 99, family: 'nail' },
  { kind: 'dagger', path: 'assassin', start: 0, end: 99, family: 'dagger' },
]

describe('完整武器图鉴', () => {
  it.each(reachableFamilies)('$family覆盖每个可达等级并标记真正首次出现等级', ({ kind, path, start, end, family }) => {
    const firstLevels = new Map<string, number>()
    const entries = WEAPON_CATALOG.filter((entry) => entry.family === family)
    const labels = new Set<string>()
    for (let level = start; level <= end; level += 1) {
      const name = swordName({ kind, path, level })
      if (!firstLevels.has(name)) firstLevels.set(name, level)
      const matching = WEAPON_CATALOG.filter((entry) => entry.name === name)
      expect(matching).toHaveLength(1)
      const entry = matching[0]
      expect(entry).toMatchObject({ kind, path, name, family, level: firstLevels.get(name) })
      expect(entry.evolutionStage).toBe(Math.floor(entry.level / 3))
      labels.add(entry.familyLabel)
    }
    expect(entries.map((entry) => entry.name)).toEqual([...firstLevels.keys()])
    expect(labels.size).toBe(1)
  })

  it('完整72个真实形态无同名重复，不收录99级之外或虚构路线形态', () => {
    const reachableNames = new Set<string>()
    for (const { kind, path, start, end } of reachableFamilies) {
      for (let level = start; level <= end; level += 1) reachableNames.add(swordName({ kind, path, level }))
    }
    expect(WEAPON_CATALOG).toHaveLength(72)
    expect(new Set(WEAPON_CATALOG.map((entry) => entry.id)).size).toBe(WEAPON_CATALOG.length)
    expect(new Set(WEAPON_CATALOG.map((entry) => entry.name)).size).toBe(WEAPON_CATALOG.length)
    expect(new Set(WEAPON_CATALOG.map((entry) => entry.name))).toEqual(reachableNames)
    for (const entry of WEAPON_CATALOG) {
      expect(entry.level).toBeGreaterThanOrEqual(0)
      expect(entry.level).toBeLessThanOrEqual(99)
      expect(swordName(entry)).toBe(entry.name)
    }
  })

  it('降级保留的进化名仍对应原家族，不凭当前低等级新增形态', () => {
    for (const { kind, path, start, end, family } of reachableFamilies) {
      for (let evolvedLevel = start; evolvedLevel <= end; evolvedLevel += 1) {
        const evolutionStage = Math.floor(evolvedLevel / 3)
        const name = swordName({ kind, path, level: 0, evolutionStage })
        // 普通分支的低阶段基础名属于共同基础家族；已分支的阶段从9级起。
        const entry = WEAPON_CATALOG.find((candidate) => candidate.name === name)
        expect(entry?.family).toBe(family)
        expect(entry!.level).toBeLessThanOrEqual(evolvedLevel)
      }
    }
  })

  it('实际武器查找按已保留的进化形态取图，不因降级错用低级或其他路线素材', () => {
    for (const entry of WEAPON_CATALOG) {
      const unheated = getWeaponCatalogEntry({ kind: entry.kind, path: entry.path, level: entry.level, evolutionStage: entry.evolutionStage })
      const damaged = getWeaponCatalogEntry({ kind: entry.kind, path: entry.path, level: 0, evolutionStage: entry.evolutionStage })
      expect(unheated).toBe(entry)
      expect(damaged).toBe(entry)
    }
    const base = getWeaponCatalogEntry({ kind: 'iron', path: null, level: 8, evolutionStage: 2 })
    expect(base.name).toBe('骑士大剑')
    expect(base.path).toBeNull()
    const shield = getWeaponCatalogEntry({ kind: 'iron', path: 'sword-shield', level: 4, evolutionStage: 33 })
    const greatsword = getWeaponCatalogEntry({ kind: 'iron', path: 'greatsword', level: 4, evolutionStage: 33 })
    expect(shield.name).toBe('世界壁垒')
    expect(greatsword.name).toBe('终焉之剑')
    expect(shield.id).not.toBe(greatsword.id)
  })
})
