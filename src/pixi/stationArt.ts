import { Container, NineSliceSprite, Rectangle, Sprite, Texture } from 'pixi.js'
import type { ConsumableKind, SceneBookPage } from './contracts'
import type { FurnishingTextures } from './furnishingAssets'

export interface SceneBook {
  root: Container
  page: SceneBookPage
  name: string
}

export interface SceneObjects {
  counter: Container
  bell: Container
  relic: Container
  merchant: Container
  cabinet: Container
  sign: Container
  signTexture: Texture
  books: SceneBook[]
}

export function createFurnishing(textures: FurnishingTextures, id: string, width: number, height: number, interactive = false): Container {
  const root = new Container({ label: id })
  const art = new Sprite(textures[id])
  art.anchor.set(0.5)
  art.width = width
  art.height = height
  art.eventMode = 'none'
  root.addChild(art)
  root.hitArea = new Rectangle(-width / 2, -height / 2, width, height)
  root.eventMode = interactive ? 'static' : 'none'
  if (interactive) root.cursor = 'pointer'
  return root
}

export function createSceneObjects(textures: FurnishingTextures): SceneObjects {
  const counter = createFurnishing(textures, 'offering-table', 384, 300)
  // 原生台面 y=58；保持上供剑世界 y=777，反算贴图中心偏移。
  counter.children[0].y = 79
  const bell = createFurnishing(textures, 'offering-bell', 72, 84, true)
  const relic = createFurnishing(textures, 'relic-altar', 58, 58, true)
  const merchant = createFurnishing(textures, 'merchant-entrance', 240, 360, true)
  const cabinet = createFurnishing(textures, 'cabinet', 384, 640)
  const sign = new Container({ label: 'offering-sign', eventMode: 'none' })
  // 裁去透明留白，以九宫格延展纸面，保留木框边角的原生比例。
  const signTexture = new Texture({ source: textures['offering-sign'].source, frame: new Rectangle(86, 15, 83, 98) })
  const signArt = new NineSliceSprite({ texture: signTexture, leftWidth: 12, rightWidth: 12, topHeight: 11, bottomHeight: 13, width: 300, height: 132, anchor: 0.5, eventMode: 'none' })
  sign.addChild(signArt)
  const books: SceneBook[] = [
    { root: createFurnishing(textures, 'weapon-book', 74, 74, true), page: 'bestiary', name: '武器图鉴' },
    { root: createFurnishing(textures, 'relic-book', 74, 74, true), page: 'relics', name: '遗物图鉴' },
    { root: createFurnishing(textures, 'manual-book', 74, 74, true), page: 'manual', name: '铁匠手册' },
  ]
  return { counter, bell, relic, merchant, cabinet, sign, signTexture, books }
}

export function createConsumable(type: ConsumableKind, textures: FurnishingTextures): Container {
  const root = createFurnishing(textures, type, 68, 68, true)
  root.cursor = 'grab'
  root.hitArea = new Rectangle(-38, -42, 76, 84)
  return root
}
