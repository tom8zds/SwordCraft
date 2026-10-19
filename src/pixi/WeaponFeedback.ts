import { Container, Graphics, Sprite, Texture } from 'pixi.js'

export const ASCENSION_GOLD = 0xffd45e
const BURST_DURATION = 800
const MAX_BURSTS = 24
const PARTICLE_DIRECTIONS = Array.from({ length: 28 }, (_, index) => {
  const angle = index * Math.PI * (3 - Math.sqrt(5))
  return { x: Math.cos(angle), y: Math.sin(angle), along: (index % 7 / 6 - 0.5) * 190, speed: 55 + index % 5 * 19 }
})

interface Burst {
  active: boolean
  startedAt: number
  x: number
  y: number
  cos: number
  sin: number
  scale: number
  color: number
}

export interface WeaponAura {
  glow: Container
  overlay: Sprite
  innerGlow: Sprite
  outerGlow: Sprite
  source: Texture | null
}

export class WeaponFeedback {
  readonly particles = new Graphics({ label: 'weapon-feedback-particles', eventMode: 'none' })
  private readonly silhouettes = new Map<Texture, Texture>()
  private readonly bursts: Burst[] = Array.from({ length: MAX_BURSTS }, () => ({ active: false, startedAt: 0, x: 0, y: 0, cos: 1, sin: 0, scale: 1, color: ASCENSION_GOLD }))
  private readonly motionPreference = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  private nextBurst = 0
  private hadParticles = false

  get reducedMotion(): boolean {
    return this.motionPreference?.matches ?? false
  }

  createAura(): WeaponAura {
    const glow = new Container({ label: 'weapon-aura', eventMode: 'none' })
    const innerGlow = new Sprite({ eventMode: 'none' })
    const outerGlow = new Sprite({ eventMode: 'none' })
    const overlay = new Sprite({ label: 'weapon-color-silhouette', eventMode: 'none' })
    for (const sprite of [innerGlow, outerGlow, overlay]) sprite.anchor.set(0.5)
    innerGlow.scale.set(1.07)
    outerGlow.scale.set(1.15)
    glow.addChild(outerGlow, innerGlow)
    glow.visible = false
    overlay.visible = false
    return { glow, overlay, innerGlow, outerGlow, source: null }
  }

  updateAura(aura: WeaponAura, art: Sprite, gold: number, highlight: number, color: number): void {
    const visible = gold > 0 || highlight > 0
    aura.glow.visible = visible
    aura.overlay.visible = visible
    if (!visible) return
    if (aura.source !== art.texture) {
      const texture = this.silhouette(art.texture)
      aura.source = art.texture
      aura.overlay.texture = texture
      aura.innerGlow.texture = texture
      aura.outerGlow.texture = texture
    }
    aura.glow.position.copyFrom(art.position)
    aura.glow.rotation = art.rotation
    aura.glow.scale.copyFrom(art.scale)
    aura.overlay.position.copyFrom(art.position)
    aura.overlay.rotation = art.rotation
    aura.overlay.scale.copyFrom(art.scale)
    // 单色剪影使用原图透明度，深色剑纹也会真正变为纯金，而不是乘色变暗。
    aura.overlay.tint = gold > 0 ? ASCENSION_GOLD : color
    aura.overlay.alpha = gold > 0 ? gold : highlight * 0.32
    const glowColor = highlight > 0 ? color : ASCENSION_GOLD
    aura.innerGlow.tint = glowColor
    aura.outerGlow.tint = glowColor
    const strength = Math.max(gold, highlight)
    aura.innerGlow.alpha = strength * 0.38
    aura.outerGlow.alpha = strength * 0.17
  }

  burst(x: number, y: number, rotation: number, scale: number, color: number, now: number): void {
    const burst = this.bursts[this.nextBurst]
    this.nextBurst = (this.nextBurst + 1) % MAX_BURSTS
    burst.active = true
    burst.startedAt = now
    burst.x = x
    burst.y = y
    burst.cos = Math.cos(rotation)
    burst.sin = Math.sin(rotation)
    burst.scale = scale
    burst.color = color
  }

  tick(now: number): void {
    if (this.hadParticles) this.particles.clear()
    this.hadParticles = false
    const count = this.reducedMotion ? 4 : PARTICLE_DIRECTIONS.length
    for (const burst of this.bursts) {
      if (!burst.active) continue
      const progress = Math.max(0, (now - burst.startedAt) / BURST_DURATION)
      if (progress >= 1) { burst.active = false; continue }
      this.hadParticles = true
      const expansion = 1 - (1 - progress) ** 2
      for (let index = 0; index < count; index += 1) {
        const direction = PARTICLE_DIRECTIONS[index]
        const distance = expansion * direction.speed * (this.reducedMotion ? 0.2 : 1)
        const localX = direction.x * distance
        const localY = direction.along * burst.scale + direction.y * distance
        const x = burst.x + localX * burst.cos - localY * burst.sin
        const y = burst.y + localX * burst.sin + localY * burst.cos
        this.particles.circle(x, y, index % 4 === 0 ? 3.5 : 2).fill({ color: burst.color, alpha: (1 - progress) * 0.9 })
      }
    }
  }

  dispose(): void {
    this.particles.destroy()
    for (const texture of this.silhouettes.values()) texture.destroy(true)
    this.silhouettes.clear()
    for (const burst of this.bursts) burst.active = false
  }

  private silhouette(source: Texture): Texture {
    const cached = this.silhouettes.get(source)
    if (cached) return cached
    // 每张独立素材最多生成一次透明度剪影；不改动 Assets 中的原纹理。
    const canvas = document.createElement('canvas')
    canvas.width = source.width
    canvas.height = source.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建武器光效剪影。')
    const frame = source.frame
    context.drawImage(source.source.resource as CanvasImageSource, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height)
    context.globalCompositeOperation = 'source-in'
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    const texture = Texture.from(canvas)
    texture.source.scaleMode = 'nearest'
    this.silhouettes.set(source, texture)
    return texture
  }
}
