import { Container, Graphics, Polygon, Rectangle, Sprite, Text, type FederatedPointerEvent, type Ticker } from 'pixi.js'
import { formatCoins, swordName, swordValue } from '../game/content'
import { effectiveOdds } from '../game/engine'
import { normalizeOdds } from '../game/probability'
import { compactWeaponValue, weaponRarity } from '../game/rarity'
import type { GameState, Sword, SwordLocation } from '../game/types'
import { getWeaponCatalogEntry } from '../game/weaponCatalog'
import { createConsumable, createSceneObjects } from './stationArt'
import { HOOK_SPACING, HOOK_X, HOOK_Y, MIN_WORLD_WIDTH, SCENE_HEIGHT, SCENE_WIDTH, type ConsumableKind, type HammerArtwork, type SceneFocus, type SmithySceneCallbacks, type SmithyTextures, type SwordArtwork, type WeaponTextures } from './contracts'
import { ASCENSION_GOLD, WeaponFeedback, type WeaponAura } from './WeaponFeedback'

interface SwordView {
  root: Container
  art: Sprite
  label: Container
  labelText: Text
  labelBacking: Graphics
  labelKey: string
  aura: WeaponAura
  sword: Sword
  bounds: Rectangle
}

interface SwordFeedbackState {
  stage: number
  deadline: number | null
  startedAt: number
  active: boolean
  highlightUntil: number
  color: number
  x: number
  y: number
  rotation: number
  scale: number
}

type Gesture =
  | { kind: 'camera'; pointerId: number; startX: number; cameraX: number }
  | { kind: 'sword'; pointerId: number; id: string; root: Container; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean; pointerX: number; pointerY: number }
  | { kind: 'item'; pointerId: number; type: ConsumableKind; root: Container; originX: number; originY: number; startX: number; startY: number; disarmSwordId?: string }
  | { kind: 'hammer'; pointerId: number; nextAt: number }

const FORGE_ZONE = new Rectangle(172, 445, 445, 300)
const ANVIL_ZONE = new Rectangle(720, 500, 550, 260)
const SUBMISSION_ZONE = new Rectangle(1470, 715, 370, 255)
const ITEM_HOME = new Rectangle(620, 710, 132, 210)
const TARGET_POSITIONS = {
  forge: { x: 392, y: 635, rotation: Math.PI / 2, scale: 0.78 },
  anvil: { x: 972, y: 610, rotation: Math.PI / 2, scale: 1.08 },
  submission: { x: 1615, y: 777, rotation: Math.PI / 2, scale: 0.93 },
}
const RESULT_COLORS = { destroyed: 0xe84d5b, damaged: 0xf08a45, steady: 0x45b8d8, success: 0x68c96d, great: 0xa978e8 }

export class SmithyScene {
  readonly root = new Container({ label: 'smithy-frame' })
  readonly world = new Container({ label: 'smithy-world' })
  private readonly callbacks: SmithySceneCallbacks
  private readonly textures: SmithyTextures
  private readonly weapons: WeaponTextures
  private readonly hammerMetadata: HammerArtwork
  private readonly backdrop = new Container({ label: 'world-wall-extension' })
  private readonly hooks = new Container({ label: 'world-hook-row' })
  private readonly swordLayer = new Container({ label: 'world-swords' })
  private readonly dragLayer = new Container({ label: 'world-drag' })
  private readonly feedback = new Graphics()
  private readonly weaponFeedback = new WeaponFeedback()
  private readonly swordFeedback = new Map<string, SwordFeedbackState>()
  private readonly targetOutline = new Graphics()
  private readonly hammer = new Container({ label: 'forging-hammer' })
  private readonly probabilityRing = new Graphics()
  private readonly ringCore = new Text({ text: '✦', style: { fontFamily: 'monospace', fontSize: 18, fill: 0xd9bc78 } })
  private readonly objects = createSceneObjects()
  private readonly submissionValue = new Text({ text: '', style: { fontFamily: 'monospace', fontSize: 20, fill: 0xd7c5a2 } })
  private readonly scaleItem = createConsumable('dragon-scale')
  private readonly hourglassItem = createConsumable('hourglass')
  private readonly equippedScale = createConsumable('dragon-scale')
  private readonly scaleCount = new Text({ text: '0', style: { fontFamily: 'monospace', fontSize: 17, fill: 0xddd3bc } })
  private readonly hourglassCount = new Text({ text: '0', style: { fontFamily: 'monospace', fontSize: 17, fill: 0xddd3bc } })
  private readonly shards = new Graphics()
  private readonly swordViews = new Map<string, SwordView>()
  private readonly hookViews = new Map<number, Sprite>()
  private state: GameState | null = null
  private gesture: Gesture | null = null
  private cameraX = 0
  private worldWidth = MIN_WORLD_WIDTH
  private lastVisibleFirst = -1
  private lastVisibleLast = -1
  private enabled = true
  private disposed = false
  private lastRecord = ''
  private swingTime = 0
  private sparkTime = 0
  private sparkColor = 0xc99556
  private now = 0
  private pulseStep = -1
  private lastOdds = ''

  constructor(textures: SmithyTextures, weapons: WeaponTextures, hammerMetadata: HammerArtwork, callbacks: SmithySceneCallbacks) {
    this.callbacks = callbacks
    this.textures = textures
    this.weapons = weapons
    this.hammerMetadata = hammerMetadata
    for (const texture of Object.values(textures)) texture.source.scaleMode = 'nearest'
    this.root.eventMode = 'static'
    this.root.hitArea = new Rectangle(0, 0, SCENE_WIDTH, SCENE_HEIGHT)
    this.root.cursor = 'grab'
    const mask = new Graphics().rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT).fill(0xffffff)
    this.root.addChild(this.world, mask)
    this.world.mask = mask
    this.world.addChild(new Sprite({ texture: textures.background, label: 'brick-room-background' }), this.backdrop)
    this.world.addChild(new Sprite({ texture: textures.forge, label: 'charcoal-forge' }), new Sprite({ texture: textures.workbench, label: 'workbench-anvil' }))
    this.world.addChild(this.hooks)
    this.objects.counter.position.set(1640, 790)
    this.objects.bell.position.set(1760, 755)
    this.objects.book.position.set(682, 862)
    this.objects.relic.position.set(1315, 916)
    this.objects.merchant.position.set(1322, 700)
    this.objects.merchant.scale.set(0.82)
    this.world.addChild(this.objects.counter, this.swordLayer, this.shards)
    this.submissionValue.position.set(1510, 858)
    this.world.addChild(this.submissionValue, this.objects.bell, this.objects.book, this.objects.relic, this.objects.merchant)
    this.hammer.pivot.set(hammerMetadata.pivot.x, hammerMetadata.pivot.y)
    this.hammer.position.set(1185, 654)
    this.hammer.scale.set(1.13)
    this.hammer.rotation = -0.12
    this.hammer.eventMode = 'static'
    this.hammer.cursor = 'pointer'
    this.hammer.hitArea = new Polygon([30, 12, 290, 12, 290, 168, 195, 168, 195, 390, 135, 390, 135, 168, 30, 168])
    this.hammer.addChild(new Sprite(textures.hammer), this.probabilityRing, this.ringCore)
    this.ringCore.anchor.set(0.5)
    this.ringCore.position.set(hammerMetadata.ring.x, hammerMetadata.ring.y)
    this.world.addChild(this.hammer)
    this.scaleItem.position.set(654, 760)
    this.hourglassItem.position.set(706, 760)
    this.equippedScale.position.set(1050, 663)
    this.equippedScale.scale.set(0.64)
    this.scaleCount.position.set(644, 803)
    this.hourglassCount.position.set(696, 803)
    const itemBase = new Graphics().rect(624, 789, 115, 10).fill(0x4d4140).stroke({ color: 0x19171b, width: 3 })
    this.world.addChild(itemBase, this.scaleItem, this.hourglassItem, this.equippedScale, this.scaleCount, this.hourglassCount, this.targetOutline, this.feedback, this.dragLayer, this.weaponFeedback.particles)
    this.objects.bell.on('pointerdown', (event: FederatedPointerEvent) => { event.stopPropagation(); if (this.enabled) this.callbacks.onBell() })
    this.objects.book.on('pointerdown', (event: FederatedPointerEvent) => { event.stopPropagation(); if (this.enabled) this.callbacks.onBook() })
    this.objects.relic.on('pointerdown', (event: FederatedPointerEvent) => { event.stopPropagation(); if (this.enabled) this.callbacks.onRelic() })
    this.objects.merchant.on('pointerdown', (event: FederatedPointerEvent) => { event.stopPropagation(); if (this.enabled) this.callbacks.onMerchant() })
    this.hammer.on('pointerdown', (event: FederatedPointerEvent) => {
      event.stopPropagation()
      if (!this.enabled || this.gesture || event.button !== 0) return
      this.gesture = { kind: 'hammer', pointerId: event.pointerId, nextAt: Date.now() + 500 }
      this.callbacks.onHammer()
    })
    this.scaleItem.on('pointerdown', (event: FederatedPointerEvent) => this.startItem(event, 'dragon-scale'))
    this.hourglassItem.on('pointerdown', (event: FederatedPointerEvent) => this.startItem(event, 'hourglass'))
    this.equippedScale.on('pointerdown', (event: FederatedPointerEvent) => {
      const sword = this.state?.swords.find((candidate) => candidate.location === 'anvil' && candidate.dragonScaleArmed)
      if (sword) this.startItem(event, 'dragon-scale', sword.id)
    })
    this.root.on('pointerdown', (event: FederatedPointerEvent) => {
      if (!this.enabled || this.gesture || event.button !== 0) return
      this.gesture = { kind: 'camera', pointerId: event.pointerId, startX: this.root.toLocal(event.global).x, cameraX: this.cameraX }
      this.root.cursor = 'grabbing'
    })
    this.root.on('globalpointermove', this.pointerMove, this)
    this.root.on('pointerup', (event: FederatedPointerEvent) => this.release(event.pointerId, false, event.global.x, event.global.y))
    this.root.on('pointerupoutside', (event: FederatedPointerEvent) => this.release(event.pointerId, false, event.global.x, event.global.y))
    this.root.on('pointercancel', (event: FederatedPointerEvent) => this.release(event.pointerId, true))
    this.rebuildExtension()
  }

  update(state: GameState): void {
    if (this.disposed) return
    if (this.gesture?.kind === 'sword') {
      const heldId = this.gesture.id
      const held = this.swordViews.get(heldId)
      const next = state.swords.find((sword) => sword.id === heldId)
      if (held && next !== held.sword) this.cancelGesture()
    }
    const old = this.state
    this.state = state
    this.scaleCount.text = String(state.dragonScales)
    this.hourglassCount.text = String(state.hourglasses)
    this.scaleItem.alpha = state.dragonScales > 0 ? 1 : 0.3
    this.hourglassItem.alpha = state.hourglasses > 0 ? 1 : 0.3
    this.objects.merchant.alpha = state.day % 4 === 0 ? 1 : 0.45
    const anvilSword = state.swords.find((sword) => sword.location === 'anvil')
    this.equippedScale.visible = !!anvilSword?.dragonScaleArmed
    const submitted = state.swords.find((sword) => sword.location === 'submission')
    this.submissionValue.text = submitted ? `◆ ${formatCoins(swordValue(submitted))}` : ''
    this.shards.clear()
    if (!anvilSword && state.lastHammer && !state.swords.some((sword) => sword.id === state.lastHammer?.sword.id)) {
      this.shards.poly([928, 605, 956, 598, 948, 612]).fill(0x9ca5ac)
        .poly([967, 610, 987, 598, 985, 616]).fill(0x727c86)
        .poly([1008, 603, 1023, 612, 999, 616]).fill(0xa9aaa3)
    }
    const odds = normalizeOdds(effectiveOdds(state, anvilSword))
    const oddsKey = odds.map((entry) => entry.exact).join(',')
    if (oddsKey !== this.lastOdds) {
      this.lastOdds = oddsKey
      this.probabilityRing.clear()
      const { x, y, radius } = this.hammerMetadata.ring
      const inner = radius * 0.59
      this.probabilityRing.circle(x, y, radius + 1).fill(0x11131a)
      let angle = -Math.PI / 2
      for (const segment of odds) {
        if (segment.exact <= 0) continue
        const end = angle + Math.PI * 2 * segment.exact / 100
        this.probabilityRing.moveTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
          .arc(x, y, radius, angle, end)
          .lineTo(x + Math.cos(end) * inner, y + Math.sin(end) * inner)
          .arc(x, y, inner, end, angle, true)
          .closePath().fill(segment.color)
        this.probabilityRing.moveTo(x + Math.cos(angle) * inner, y + Math.sin(angle) * inner).lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius).stroke({ color: 0x15131c, width: 1.4 })
        angle = end
      }
    }
    const record = state.records[state.records.length - 1]
    if (record && record.id !== this.lastRecord && record.at > Date.now() - 2000) {
      this.lastRecord = record.id
      this.swingTime = 0.32
      this.sparkTime = record.result === 'great' ? 0.5 : 0.28
      this.sparkColor = RESULT_COLORS[record.result]
    }
    const rackCount = state.swords.filter((sword) => sword.location === 'rack').length
    const requiredWidth = Math.max(MIN_WORLD_WIDTH, HOOK_X + Math.max(20, rackCount + 2) * HOOK_SPACING + 150)
    if (requiredWidth !== this.worldWidth) {
      this.worldWidth = requiredWidth
      this.rebuildExtension()
      this.moveCamera(this.cameraX)
    }
    if (old?.swords !== state.swords || old?.selectedSwordId !== state.selectedSwordId) this.syncSwordViews()
    this.updateSwordFeedback(state)
    if (state.gameOver) this.cancelGesture()
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    this.root.eventMode = enabled ? 'static' : 'none'
    if (!enabled) this.cancelGesture()
  }

  setScale(width: number, height: number): void {
    this.cancelGesture()
    const scale = Math.min(width / SCENE_WIDTH, height / SCENE_HEIGHT)
    this.root.scale.set(scale)
    this.root.position.set(Math.round((width - SCENE_WIDTH * scale) / 2), Math.round((height - SCENE_HEIGHT * scale) / 2))
  }

  moveCamera(next: number): void {
    if (this.disposed) return
    this.cameraX = Math.max(0, Math.min(this.worldWidth - SCENE_WIDTH, Math.round(next)))
    this.world.x = -this.cameraX
    this.callbacks.onCameraChange({ x: this.cameraX, maxX: this.worldWidth - SCENE_WIDTH })
    this.syncSwordViews()
  }

  focus(location: SceneFocus): void {
    this.cancelGesture()
    this.moveCamera(location === 'rack' ? HOOK_X - 350 : 0)
  }

  wheel(delta: number, clientX: number, clientY: number, canvas: HTMLCanvasElement): boolean {
    if (!this.enabled || this.gesture) return false
    const rect = canvas.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return false
    this.moveCamera(this.cameraX + delta / this.root.scale.x)
    return true
  }

  tick(ticker: Ticker): void {
    if (this.disposed) return
    const delta = Math.min(ticker.deltaMS, 50) / 1000
    this.now = Date.now()
    if (this.enabled && this.gesture?.kind === 'hammer' && this.now >= this.gesture.nextAt) {
      this.gesture.nextAt = this.now + 500
      this.callbacks.onHammer()
    }
    if (this.enabled && this.gesture?.kind === 'sword' && this.gesture.moved) {
      const held = this.gesture
      const framePoint = this.root.toLocal({ x: held.pointerX, y: held.pointerY })
      const edge = framePoint.x < 85 ? -1 : framePoint.x > SCENE_WIDTH - 85 ? 1 : 0
      if (edge !== 0) {
        this.moveCamera(this.cameraX + edge * 980 * delta)
        const point = this.world.toLocal({ x: held.pointerX, y: held.pointerY })
        held.root.position.set(point.x - held.offsetX, point.y - held.offsetY)
      }
    }
    if (this.swingTime > 0) {
      this.swingTime = Math.max(0, this.swingTime - delta)
      const progress = 1 - this.swingTime / 0.32
      this.hammer.rotation = -0.12 - Math.sin(progress * Math.PI) * 1.28
    }
    this.feedback.clear()
    if (this.sparkTime > 0) {
      this.sparkTime = Math.max(0, this.sparkTime - delta)
      const age = (0.5 - this.sparkTime) * 1.8
      for (let index = 0; index < (this.weaponFeedback.reducedMotion ? 4 : 12); index += 1) {
        const angle = -Math.PI + index * Math.PI / 12
        const distance = age * (60 + index % 4 * 22)
        this.feedback.rect(950 + Math.cos(angle) * distance, 603 + Math.sin(angle) * distance + age * age * 50, index % 3 === 0 ? 5 : 3, 3).fill({ color: this.sparkColor, alpha: Math.min(1, this.sparkTime * 4) })
      }
    }
    for (const [id, effect] of this.swordFeedback) {
      const view = this.swordViews.get(id)
      if (view) {
        effect.x = view.root.x
        effect.y = view.root.y
        effect.rotation = view.art.rotation
        effect.scale = view.art.scale.x
      }
      if (effect.active && effect.deadline !== null && this.now >= effect.deadline) {
        effect.active = false
        this.weaponFeedback.burst(effect.x, effect.y, effect.rotation, effect.scale, ASCENSION_GOLD, effect.deadline)
      }
      if (view) {
        const progress = effect.active ? Math.max(0, Math.min(1, (this.now - effect.startedAt) / 1100)) : 0
        const highlight = Math.max(0, (effect.highlightUntil - this.now) / 750)
        this.weaponFeedback.updateAura(view.aura, view.art, progress * progress * (3 - 2 * progress), highlight, effect.color)
      }
    }
    this.weaponFeedback.tick(this.now)
    if (Math.floor(this.now / 200) !== this.pulseStep) {
      this.pulseStep = Math.floor(this.now / 200)
      const warning = this.state?.pendingLowSubmitUntil && this.state.pendingLowSubmitUntil > this.now
      this.objects.bell.tint = warning && !this.weaponFeedback.reducedMotion ? (this.pulseStep % 2 ? 0xf08373 : 0xffffff) : 0xffffff
    }
  }

  cancelGesture(): void {
    if (!this.gesture) return
    if (this.gesture.kind === 'sword') {
      const view = this.swordViews.get(this.gesture.id)
      if (view) this.placeSword(view)
    } else if (this.gesture.kind === 'item') {
      this.gesture.root.position.set(this.gesture.originX, this.gesture.originY)
    }
    this.gesture = null
    this.root.cursor = 'grab'
    this.targetOutline.clear()
  }

  release(pointerId: number, cancelled: boolean, screenX?: number, screenY?: number): void {
    const gesture = this.gesture
    if (!gesture || gesture.pointerId !== pointerId) return
    let location: SwordLocation | null = null
    if (!cancelled && screenX !== undefined && screenY !== undefined) {
      const point = this.world.toLocal({ x: screenX, y: screenY })
      if (FORGE_ZONE.contains(point.x, point.y)) location = 'forge'
      else if (ANVIL_ZONE.contains(point.x, point.y)) location = 'anvil'
      else if (SUBMISSION_ZONE.contains(point.x, point.y)) location = 'submission'
      else if (point.x >= HOOK_X - 45 && point.x <= this.worldWidth && point.y > HOOK_Y - 100 && point.y < HOOK_Y + 380) location = 'rack'
      if (gesture.kind === 'item') {
        const disarm = gesture.disarmSwordId && ITEM_HOME.contains(point.x, point.y)
        this.cancelGesture()
        if (disarm) this.callbacks.onDisarmScale(gesture.disarmSwordId!)
        else if (location === 'anvil' && !gesture.disarmSwordId) this.callbacks.onItemDrop(gesture.type)
        return
      }
    }
    this.cancelGesture()
    if (!cancelled && gesture.kind === 'sword') {
      if (gesture.moved && location) this.callbacks.onSwordDrop(gesture.id, location)
      else if (!gesture.moved) this.callbacks.onSwordSelect(gesture.id)
    }
  }

  dispose(): void {
    this.disposed = true
    this.cancelGesture()
    for (const view of this.swordViews.values()) view.root.destroy({ children: true })
    this.weaponFeedback.dispose()
    this.swordFeedback.clear()
    this.swordViews.clear()
    this.hookViews.clear()
  }

  createWeaponArt(sword: SwordArtwork): Sprite {
    const sprite = new Sprite({ eventMode: 'none' })
    sprite.anchor.set(0.5)
    this.updateWeaponArt(sprite, sword)
    return sprite
  }

  private updateWeaponArt(sprite: Sprite, sword: SwordArtwork): void {
    const entry = getWeaponCatalogEntry(sword)
    const texture = this.weapons[entry.id]
    if (!texture) throw new Error(`场景缺少独立武器素材：${entry.name}（${entry.id}）`)
    sprite.texture = texture
    sprite.label = entry.id
    sprite.tint = sword.heated ? 0xf2ac81 : 0xffffff
  }

  private rebuildExtension(): void {
    this.backdrop.removeChildren().forEach((child) => child.destroy())
    for (let x = SCENE_WIDTH, index = 0; x < this.worldWidth; x += this.textures.wallExtension.width, index += 1) {
      const sprite = new Sprite(this.textures.wallExtension)
      if (index % 2 === 0) {
        sprite.scale.x = -1
        sprite.position.x = x + this.textures.wallExtension.width
      } else sprite.x = x
      this.backdrop.addChild(sprite)
    }
  }

  private syncSwordViews(): void {
    if (!this.state) return
    const first = Math.max(0, Math.floor((this.cameraX - HOOK_X) / HOOK_SPACING) - 1)
    const last = Math.max(0, Math.ceil((this.cameraX + SCENE_WIDTH - HOOK_X) / HOOK_SPACING) + 1)
    if (first !== this.lastVisibleFirst || last !== this.lastVisibleLast) {
      this.lastVisibleFirst = first
      this.lastVisibleLast = last
      for (const [index, hook] of this.hookViews) {
        if (index < first || index > last) { hook.destroy(); this.hookViews.delete(index) }
      }
      for (let index = first; index <= last; index += 1) {
        if (HOOK_X + index * HOOK_SPACING > this.worldWidth - 100 || this.hookViews.has(index)) continue
        const hook = new Sprite(this.textures.hook)
        hook.position.set(HOOK_X + index * HOOK_SPACING, HOOK_Y)
        this.hooks.addChild(hook)
        this.hookViews.set(index, hook)
      }
    }
    let rackIndex = 0
    const visible = new Set<string>()
    for (const sword of this.state.swords) {
      const index = sword.location === 'rack' ? rackIndex++ : -1
      if (index >= 0 && (index < first || index > last) && !(this.gesture?.kind === 'sword' && this.gesture.id === sword.id)) continue
      visible.add(sword.id)
      const existing = this.swordViews.get(sword.id)
      if (existing) {
        if (existing.sword !== sword) {
          this.updateWeaponArt(existing.art, sword)
          existing.sword = sword
          this.updateSwordLabel(existing)
        }
        if (!(this.gesture?.kind === 'sword' && this.gesture.id === sword.id)) this.placeSword(existing, index)
        continue
      }
      const view = this.createSwordView(sword)
      this.swordViews.set(sword.id, view)
      this.swordLayer.addChild(view.root)
      this.placeSword(view, index)
    }
    for (const [id, view] of this.swordViews) {
      if (!visible.has(id) && !(this.gesture?.kind === 'sword' && this.gesture.id === id)) { view.root.destroy({ children: true }); this.swordViews.delete(id) }
    }
  }

  private createSwordView(sword: Sword): SwordView {
    const root = new Container({ label: sword.id })
    const art = this.createWeaponArt(sword)
    const label = new Container({ label: 'weapon-name-quality-value', eventMode: 'none' })
    const labelBacking = new Graphics({ eventMode: 'none' })
    const labelText = new Text({ text: '', eventMode: 'none', style: { fontFamily: 'monospace', fontSize: 14, lineHeight: 19, align: 'center', wordWrap: true, wordWrapWidth: 102, breakWords: true, fill: 0xe8e5df } })
    labelText.anchor.set(0.5, 0)
    labelText.y = 5
    label.addChild(labelBacking, labelText)
    const aura = this.weaponFeedback.createAura()
    root.addChild(aura.glow, art, aura.overlay, label)
    root.eventMode = 'static'
    root.interactiveChildren = false
    root.hitArea = new Rectangle()
    root.cursor = 'grab'
    const bounds = art.getLocalBounds()
    root.on('pointerdown', (event: FederatedPointerEvent) => {
      event.stopPropagation()
      if (!this.enabled || this.gesture || event.button !== 0) return
      const local = this.world.toLocal(event.global)
      this.gesture = { kind: 'sword', pointerId: event.pointerId, id: sword.id, root, startX: local.x, startY: local.y, offsetX: local.x - root.x, offsetY: local.y - root.y, moved: false, pointerX: event.global.x, pointerY: event.global.y }
      this.dragLayer.addChild(root)
      root.alpha = 0.82
    })
    const view = { root, art, label, labelText, labelBacking, labelKey: '', aura, sword, bounds: new Rectangle(bounds.minX, bounds.minY, bounds.width, bounds.height) }
    this.updateSwordLabel(view)
    return view
  }

  private placeSword(view: SwordView, explicitRackIndex?: number): void {
    if (!this.state) return
    if (view.root.parent !== this.swordLayer) this.swordLayer.addChild(view.root)
    view.root.alpha = 1
    if (view.sword.location === 'rack') {
      const index = explicitRackIndex ?? this.state.swords.filter((sword) => sword.location === 'rack').findIndex((sword) => sword.id === view.sword.id)
      view.root.position.set(HOOK_X + index * HOOK_SPACING + 25, HOOK_Y + 84)
      view.art.rotation = Math.PI
      view.art.scale.set(0.85)
      view.label.position.set(0, 126)
    } else {
      const pose = TARGET_POSITIONS[view.sword.location]
      view.root.position.set(pose.x, pose.y)
      view.art.rotation = pose.rotation
      view.art.scale.set(pose.scale)
      view.label.position.set(0, Math.max(50, view.bounds.width * pose.scale / 2 + 8))
    }
    const { bounds, art } = view
    const cos = Math.cos(art.rotation)
    const sin = Math.sin(art.rotation)
    const centerX = (bounds.x + bounds.width / 2) * art.scale.x
    const centerY = (bounds.y + bounds.height / 2) * art.scale.y
    const width = Math.abs(bounds.width * art.scale.x * cos) + Math.abs(bounds.height * art.scale.y * sin)
    const height = Math.abs(bounds.width * art.scale.x * sin) + Math.abs(bounds.height * art.scale.y * cos)
    const hitWidth = Math.min(view.sword.location === 'rack' ? HOOK_SPACING - 1 : 340, Math.max(52, width + 8))
    const hitHeight = Math.min(300, Math.max(60, height + 8))
    const hitArea = view.root.hitArea as Rectangle
    hitArea.x = centerX * cos - centerY * sin - hitWidth / 2
    hitArea.y = centerX * sin + centerY * cos - hitHeight / 2
    hitArea.width = hitWidth
    hitArea.height = hitHeight
  }

  private updateSwordLabel(view: SwordView): void {
    const rarity = weaponRarity(view.sword.level)
    const text = `${swordName(view.sword)}\nLv.${view.sword.level} · ${rarity.name}\n◆ ${compactWeaponValue(swordValue(view.sword))}`
    if (text === view.labelKey) return
    view.labelKey = text
    view.labelText.text = text
    view.labelText.style.fill = rarity.color
    const height = Math.max(65, view.labelText.height + 10)
    view.labelBacking.clear().roundRect(-56.4, 0, 112.8, height, 4).fill({ color: 0x17141c, alpha: 0.94 }).stroke({ color: rarity.color, width: 1.2, alpha: 0.8 })
  }

  private updateSwordFeedback(state: GameState): void {
    const now = Date.now()
    // 从绝对截止时间还原渐金进度；读档、换位和沙漏不会重新开始无敌时长。
    const duration = state.relics.includes('moon-water') ? 7000 : 5000
    const live = new Set<string>()
    let rackIndex = 0
    for (const sword of state.swords) {
      live.add(sword.id)
      const index = sword.location === 'rack' ? rackIndex++ : -1
      const view = this.swordViews.get(sword.id)
      const pose = sword.location === 'rack' ? null : TARGET_POSITIONS[sword.location]
      const x = view?.root.x ?? (pose?.x ?? HOOK_X + index * HOOK_SPACING + 25)
      const y = view?.root.y ?? (pose?.y ?? HOOK_Y + 84)
      const rotation = view?.art.rotation ?? (pose?.rotation ?? Math.PI)
      const scale = view?.art.scale.x ?? (pose?.scale ?? 0.85)
      let effect = this.swordFeedback.get(sword.id)
      if (!effect) {
        effect = { stage: sword.evolutionStage, deadline: sword.invincibleUntil, startedAt: (sword.invincibleUntil ?? now) - duration, active: sword.invincibleUntil !== null && sword.invincibleUntil > now, highlightUntil: 0, color: weaponRarity(sword.level).color, x, y, rotation, scale }
        this.swordFeedback.set(sword.id, effect)
      } else {
        if (effect.active && effect.deadline !== null && effect.deadline <= now) {
          this.weaponFeedback.burst(x, y, rotation, scale, ASCENSION_GOLD, effect.deadline)
          effect.active = false
        }
        if (sword.evolutionStage > effect.stage) {
          effect.highlightUntil = now + 750
          effect.color = weaponRarity(sword.level).color
          this.weaponFeedback.burst(x, y, rotation, scale, effect.color, now)
        }
        effect.stage = sword.evolutionStage
        if (effect.deadline !== sword.invincibleUntil) {
          effect.deadline = sword.invincibleUntil
          effect.startedAt = (sword.invincibleUntil ?? now) - duration
        }
        effect.active = sword.invincibleUntil !== null && sword.invincibleUntil > now
        effect.x = x
        effect.y = y
        effect.rotation = rotation
        effect.scale = scale
      }
      if (view) {
        const progress = effect.active ? Math.max(0, Math.min(1, (now - effect.startedAt) / 1100)) : 0
        this.weaponFeedback.updateAura(view.aura, view.art, progress * progress * (3 - 2 * progress), Math.max(0, (effect.highlightUntil - now) / 750), effect.color)
      }
    }
    for (const id of this.swordFeedback.keys()) if (!live.has(id)) this.swordFeedback.delete(id)
  }

  private pointerMove(event: FederatedPointerEvent): void {
    if (!this.enabled || !this.gesture || this.gesture.pointerId !== event.pointerId) return
    const gesture = this.gesture
    if (gesture.kind === 'camera') {
      this.moveCamera(gesture.cameraX + gesture.startX - this.root.toLocal(event.global).x)
      return
    }
    if (gesture.kind === 'hammer') return
    const point = this.world.toLocal(event.global)
    if (gesture.kind === 'sword') {
      gesture.moved ||= Math.abs(point.x - gesture.startX) + Math.abs(point.y - gesture.startY) > 10
      gesture.pointerX = event.global.x
      gesture.pointerY = event.global.y
      gesture.root.position.set(point.x - gesture.offsetX, point.y - gesture.offsetY)
    } else gesture.root.position.set(point.x, point.y)
    this.targetOutline.clear()
    for (const zone of [FORGE_ZONE, ANVIL_ZONE, SUBMISSION_ZONE]) {
      this.targetOutline.rect(zone.x, zone.y, zone.width, zone.height).stroke({ color: zone.contains(point.x, point.y) ? 0xe3c875 : 0x8b7958, width: 2, alpha: zone.contains(point.x, point.y) ? 0.85 : 0.22 })
    }
  }

  private startItem(event: FederatedPointerEvent, type: ConsumableKind, disarmSwordId?: string): void {
    event.stopPropagation()
    if (!this.enabled || this.gesture || event.button !== 0 || !this.state) return
    if (!disarmSwordId && (type === 'dragon-scale' ? this.state.dragonScales : this.state.hourglasses) <= 0) return
    const root = disarmSwordId ? this.equippedScale : type === 'dragon-scale' ? this.scaleItem : this.hourglassItem
    this.gesture = { kind: 'item', pointerId: event.pointerId, type, root, originX: root.x, originY: root.y, startX: root.x, startY: root.y, disarmSwordId }
  }
}
