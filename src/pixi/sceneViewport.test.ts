import { describe, expect, it } from 'vitest'
import { sceneViewport } from './sceneViewport'

describe('手机工位视口', () => {
  it.each([[375, 330], [390, 360], [430, 400], [520, 290]])('在%ix%i画布完整显示工位纵区而不缩进整个1920宽房间', (width, height) => {
    const viewport = sceneViewport(width, height, true)
    expect(viewport.y + viewport.worldTop * viewport.scale).toBeCloseTo(0)
    expect(viewport.y + (viewport.worldTop + viewport.worldHeight) * viewport.scale).toBeCloseTo(height)
    expect(viewport.worldWidth * viewport.scale).toBeCloseTo(width)
    expect(viewport.scale).toBeGreaterThan(width / 1920)
    for (const worldY of [300, 610, 840, 950]) {
      const screenY = viewport.y + worldY * viewport.scale
      expect(screenY).toBeGreaterThanOrEqual(0)
      expect(screenY).toBeLessThanOrEqual(height)
    }
  })

  it('桌面仍等比显示完整房间并在多余纵向空间居中', () => {
    const viewport = sceneViewport(1440, 900, false)
    expect(viewport.worldWidth).toBe(1920)
    expect(viewport.x).toBe(0)
    expect(viewport.y).toBe(45)
    expect(viewport.worldWidth * viewport.scale).toBe(1440)
    expect(viewport.worldHeight * viewport.scale).toBe(810)
  })

  it('尚未布局的零尺寸不会产生NaN或无限镜头边界', () => {
    const viewport = sceneViewport(0, 0, true)
    expect(Number.isFinite(viewport.scale)).toBe(true)
    expect(Number.isFinite(viewport.worldWidth)).toBe(true)
    expect(viewport.scale).toBeGreaterThan(0)
  })
})
