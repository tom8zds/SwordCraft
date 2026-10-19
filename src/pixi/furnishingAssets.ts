import { Assets, Texture } from 'pixi.js'
import { FURNISHING_BASE, FURNISHING_IDS } from '../game/furnishingAssets'

export type FurnishingTextures = Readonly<Record<string, Texture>>

interface FurnishingManifest {
  version: number
  assets: Record<string, { file: string; width: number; height: number }>
}

export async function loadFurnishingTextures(signal: AbortSignal): Promise<FurnishingTextures> {
  const response = await fetch(`${FURNISHING_BASE}manifest.json`, { signal })
  if (!response.ok) throw new Error('无法加载遗物与设施素材清单。')
  const manifest = await response.json() as FurnishingManifest
  const used = new Set<string>()
  const sources = FURNISHING_IDS.map((id) => {
    const asset = manifest.assets?.[id]
    if (!asset || !/^[a-z0-9-]+\.png$/.test(asset.file) || asset.width <= 0 || asset.height <= 0 || used.has(asset.file)) {
      throw new Error(`遗物或设施素材缺失、重复或尺寸错误：${id}`)
    }
    used.add(asset.file)
    return { id, asset, url: `${FURNISHING_BASE}${asset.file}` }
  })
  const loaded = await Assets.load<Texture>(sources.map((source) => source.url))
  return Object.fromEntries(sources.map(({ id, asset, url }) => {
    const texture = loaded[url]
    if (!texture || texture.width !== asset.width || texture.height !== asset.height) throw new Error(`遗物或设施图片尺寸错误：${id}`)
    texture.source.scaleMode = 'nearest'
    return [id, texture]
  }))
}
