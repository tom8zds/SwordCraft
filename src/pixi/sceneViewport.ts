import { SCENE_HEIGHT, SCENE_WIDTH } from './contracts'

export interface SceneViewport {
  compact: boolean
  scale: number
  x: number
  y: number
  worldWidth: number
  worldHeight: number
  worldTop: number
}

/** 手机按工位可操作的纵向区域放大，横向露出多少由实际屏宽决定。 */
export function sceneViewport(width: number, height: number, compact: boolean): SceneViewport {
  const safeWidth = Math.max(1, width), safeHeight = Math.max(1, height)
  if (compact) {
    const worldTop = 180, worldHeight = 840
    const scale = safeHeight / worldHeight
    return { compact, scale, x: 0, y: -worldTop * scale, worldWidth: safeWidth / scale, worldHeight, worldTop }
  }
  const scale = Math.min(safeWidth / SCENE_WIDTH, safeHeight / SCENE_HEIGHT)
  return { compact, scale, x: (safeWidth - SCENE_WIDTH * scale) / 2, y: (safeHeight - SCENE_HEIGHT * scale) / 2, worldWidth: SCENE_WIDTH, worldHeight: SCENE_HEIGHT, worldTop: 0 }
}
