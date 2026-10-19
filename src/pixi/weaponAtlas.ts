import { Assets, Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js'
import { WEAPON_CATALOG } from '../game/weaponCatalog'
import { WEAPON_ASSET_BASE, type WeaponAtlas, type WeaponManifest, type WeaponTextures } from './contracts'

const COLUMNS = 8
const CELL_WIDTH = 128
const CELL_HEIGHT = 256

export async function loadWeaponTextures(signal: AbortSignal): Promise<WeaponTextures> {
  const response = await fetch(`${WEAPON_ASSET_BASE}manifest.json`, { signal })
  if (!response.ok) throw new Error('无法加载独立武器素材清单。')
  const manifest = await response.json() as WeaponManifest
  const files = new Set<string>()
  const sources = WEAPON_CATALOG.map((entry) => {
    const source = manifest.weapons?.[entry.id]
    if (!source || source.width !== CELL_WIDTH || source.height !== CELL_HEIGHT || !/^[^/\\]+\.png$/.test(source.file)) {
      throw new Error(`独立武器素材缺失或尺寸错误：${entry.name}（${entry.id}）`)
    }
    if (files.has(source.file)) throw new Error(`独立武器素材重复：${entry.name}（${source.file}）`)
    files.add(source.file)
    return { entry, url: `${WEAPON_ASSET_BASE}${source.file}` }
  })
  const loaded = await Assets.load<Texture>(sources.map(({ url }) => url))
  return Object.fromEntries(sources.map(({ entry, url }) => {
    const texture = loaded[url]
    if (!texture || texture.width !== CELL_WIDTH || texture.height !== CELL_HEIGHT) throw new Error(`独立武器图片尺寸错误：${entry.name}`)
    texture.source.scaleMode = 'nearest'
    return [entry.id, texture]
  }))
}

export async function createWeaponAtlas(renderer: Renderer, weapons: WeaponTextures): Promise<WeaponAtlas> {
  const sheet = new Container({ label: 'weapon-catalog-atlas', eventMode: 'none' })
  try {
    for (const [index, entry] of WEAPON_CATALOG.entries()) {
      const texture = weapons[entry.id]
      if (!texture) throw new Error(`图鉴缺少独立武器素材：${entry.name}`)
      const art = new Sprite({ texture, label: entry.id, eventMode: 'none' })
      art.position.set(index % COLUMNS * CELL_WIDTH, Math.floor(index / COLUMNS) * CELL_HEIGHT)
      sheet.addChild(art)
    }
    // 共用主场景渲染器一次导出；书页仅引用同一 PNG，不为每件武器创建 canvas。
    const url = await renderer.extract.base64({
      target: sheet,
      frame: new Rectangle(0, 0, COLUMNS * CELL_WIDTH, Math.ceil(WEAPON_CATALOG.length / COLUMNS) * CELL_HEIGHT),
      resolution: 1,
      clearColor: [0, 0, 0, 0],
      antialias: false,
      format: 'png',
    })
    return { url, columns: COLUMNS, cellWidth: CELL_WIDTH, cellHeight: CELL_HEIGHT }
  } finally {
    // 临时精灵不拥有 Assets 缓存中的原图；提取器自行回收临时渲染纹理。
    sheet.destroy({ children: true })
  }
}
