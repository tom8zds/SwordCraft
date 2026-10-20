import type { Texture } from 'pixi.js'
import type { Sword, SwordLocation } from '../game/types'

export type ConsumableKind = 'dragon-scale' | 'hourglass'
export type SceneBookPage = 'bestiary' | 'relics' | 'manual'
export type SceneFocus = 'cabinet' | 'forge' | 'anvil' | 'rack' | 'submission'

export interface SceneCamera {
  x: number
  minX: number
  maxX: number
}

export interface SmithySceneCallbacks {
  onSwordDrop: (swordId: string, location: SwordLocation) => void
  onSwordSelect: (swordId: string) => void
  onHammer: () => void
  onBell: () => void
  onBook: (page: SceneBookPage) => void
  onRelic: () => void
  onMerchant: () => void
  onItemDrop: (type: ConsumableKind) => void
  onDisarmScale: (swordId: string) => void
  onCameraChange: (camera: SceneCamera) => void
}

export interface SmithyTextures {
  background: Texture
  wallExtension: Texture
  forge: Texture
  workbench: Texture
  hook: Texture
  hammer: Texture
}

export type SwordArtwork = Pick<Sword, 'kind' | 'path' | 'level' | 'evolutionStage' | 'heated' | 'dragonScaleArmed'>
export interface WeaponTexture {
  texture: Texture
  contentBounds: { x: number; y: number; width: number; height: number }
}

export type WeaponTextures = Readonly<Record<string, WeaponTexture>>

export interface WeaponManifest {
  version: 1
  weapons: Record<string, { file: string; width: number; height: number; contentBounds: WeaponTexture['contentBounds'] }>
}

export const WEAPON_ASSET_BASE = '/assets/game/weapons/'

export interface WeaponAtlas {
  url: string
  columns: number
  cellWidth: number
  cellHeight: number
}

export interface HammerArtwork {
  ring: { x: number; y: number; radius: number }
  pivot: { x: number; y: number }
}

export const SCENE_WIDTH = 1920
export const SCENE_HEIGHT = 1080
export const MIN_WORLD_X = -720
export const HOOK_X = 1376
export const HOOK_Y = 354
export const HOOK_SPACING = 300
export const MIN_WORLD_WIDTH = 4056
