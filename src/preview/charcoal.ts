import { Application, Assets, Container, Graphics, Rectangle, Sprite, Text, Texture, type FederatedPointerEvent } from 'pixi.js'
import { createInitialState } from '../game/engine'
import { getWeaponCatalogEntry } from '../game/weaponCatalog'
import { loadWeaponTextures } from '../pixi/weaponAtlas'
import './preview.css'

interface PreviewManifest {
  canvas: { width: number; height: number }
  world: { width: number; height: number; background: string }
  camera: { minX: number; maxX: number; motion: 'entire-world'; hud: 'screen-fixed' }
  layers: Record<'background' | 'forge' | 'workbench' | 'hooks', { file: string; rectangle: number[]; name: string }>
  wallDisplay: {
    hook: { file: string; width: number; height: number; x: number; y: number; spacing: number }
    rows: number
    sampleCount: number
  }
}

const host = document.getElementById('art-stage')
const loading = document.getElementById('load-state')
const positionControl = document.getElementById('camera-position') as HTMLInputElement | null
const readout = document.getElementById('camera-readout') as HTMLOutputElement | null
const selection = document.getElementById('selection')
const showSwords = document.getElementById('show-swords') as HTMLInputElement | null
if (!host || !positionControl || !showSwords || !selection || !readout) throw new Error('预览页缺少必要控件。')

const app = new Application()
let initialized = false
let disposed = false
let resizeObserver: ResizeObserver | null = null
const cleanup = new AbortController()

async function startPreview() {
  if (!host || !positionControl || !showSwords || !selection || !readout) return
  const base = '/assets/art-preview/charcoal-single-row/'
  const response = await fetch(`${base}manifest.json`, { signal: cleanup.signal })
  if (!response.ok) throw new Error('无法读取样片素材清单。')
  const manifest = await response.json() as PreviewManifest
  const hookLayout = manifest.wallDisplay.hook
  const sampleCount = manifest.wallDisplay.sampleCount
  const maxCameraX = Math.max(0, manifest.world.width - manifest.canvas.width)
  const [assets, weaponTextures] = await Promise.all([
    Assets.load<Texture>([
      `${base}${manifest.world.background}`,
      ...(['forge', 'workbench'] as const).map((name) => `${base}${manifest.layers[name].file}`),
      `${base}${hookLayout.file}`,
    ]),
    loadWeaponTextures(cleanup.signal),
  ])
  if (disposed) return
  await app.init({
    width: host.clientWidth,
    height: host.clientHeight,
    background: '#11121a',
    antialias: false,
    resolution: Math.min(window.devicePixelRatio, 2),
    autoDensity: true,
    roundPixels: true,
    preference: 'webgl',
  })
  initialized = true
  if (disposed) {
    app.destroy({ removeView: true }, { children: true })
    return
  }
  app.canvas.setAttribute('aria-label', '可横向浏览的整个铁匠铺：砖墙、炭炉、工作台和单排挂剑随镜头一起移动')
  host.append(app.canvas)
  app.stage.eventMode = 'static'
  app.stage.hitArea = app.screen

  // frame 只负责缩放和屏幕裁切；world 是唯一由镜头平移的根节点。
  const frame = new Container({ label: 'screen-viewport' })
  frame.eventMode = 'static'
  frame.hitArea = new Rectangle(0, 0, manifest.canvas.width, manifest.canvas.height)
  frame.cursor = 'grab'
  const world = new Container({ label: 'pannable-smithy-world' })
  const clipping = new Graphics().rect(0, 0, manifest.canvas.width, manifest.canvas.height).fill(0xffffff)
  frame.addChild(world, clipping)
  world.mask = clipping
  app.stage.addChild(frame)

  const backgroundTexture = assets[`${base}${manifest.world.background}`]
  backgroundTexture.source.scaleMode = 'nearest'
  world.addChild(new Sprite({ texture: backgroundTexture, label: 'room-background' }))
  for (const role of ['forge', 'workbench'] as const) {
    const texture = assets[`${base}${manifest.layers[role].file}`]
    texture.source.scaleMode = 'nearest'
    world.addChild(new Sprite({ texture, label: role }))
  }
  const rail = new Container({ label: 'world-single-row-hooks-and-swords' })
  rail.position.set(hookLayout.x, hookLayout.y)
  world.addChild(rail)
  const swords: Container[] = []
  const template = createInitialState().swords[0]
  const entry = getWeaponCatalogEntry(template)
  const weaponTexture = weaponTextures[entry.id]
  if (!weaponTexture) throw new Error(`预览缺少独立武器素材：${entry.name}`)
  const hookTexture = assets[`${base}${hookLayout.file}`]
  hookTexture.source.scaleMode = 'nearest'
  let cameraX = 0
  let cameraDrag: { pointerId: number; startX: number; startCameraX: number } | null = null
  let swordDrag: { pointerId: number; object: Container; originX: number; originY: number; offsetX: number; offsetY: number } | null = null

  const moveCamera = (next: number) => {
    cameraX = Math.max(0, Math.min(maxCameraX, Math.round(next)))
    world.x = -cameraX
    positionControl.value = String(cameraX)
    host.dataset.cameraX = String(cameraX)
    host.dataset.worldX = String(world.x)
    readout.value = `${cameraX} / ${maxCameraX}`
  }

  for (let index = 0; index < sampleCount; index += 1) {
    const x = index * hookLayout.spacing
    const hook = new Sprite({ texture: hookTexture })
    hook.position.set(x, 0)
    rail.addChild(hook)
    const sword = new Sprite({ texture: weaponTexture, label: `preview-sword-${index}` })
    sword.anchor.set(0.5)
    sword.eventMode = 'static'
    sword.cursor = 'grab'
    sword.scale.set(0.85)
    sword.rotation = Math.PI
    sword.position.set(x + hookLayout.width / 2, 70)
    sword.on('pointerdown', (event: FederatedPointerEvent) => {
      if (swordDrag || cameraDrag || event.button !== 0) return
      event.stopPropagation()
      const local = rail.toLocal(event.global)
      swordDrag = { pointerId: event.pointerId, object: sword, originX: sword.x, originY: sword.y, offsetX: local.x - sword.x, offsetY: local.y - sword.y }
      sword.alpha = 0.75
      sword.zIndex = 10
      rail.sortableChildren = true
      selection.textContent = `正在取下第 ${index + 1} 把示意剑，镜头不移动`
    })
    rail.addChild(sword)
    swords.push(sword)
    const number = new Text({ text: String(index + 1).padStart(2, '0'), style: { fontFamily: 'monospace', fontSize: 15, fill: 0x8a8c92 }, label: `slot-${index}` })
    number.position.set(x + 15, 270)
    number.alpha = 0.65
    rail.addChild(number)
  }

  frame.on('pointerdown', (event: FederatedPointerEvent) => {
    if (cameraDrag || swordDrag || event.button !== 0) return
    cameraDrag = { pointerId: event.pointerId, startX: frame.toLocal(event.global).x, startCameraX: cameraX }
    frame.cursor = 'grabbing'
    selection.textContent = '镜头浏览整个房间，炭炉、砖墙、工作台和挂剑一起移动'
  })
  app.stage.on('globalpointermove', (event: FederatedPointerEvent) => {
    if (cameraDrag?.pointerId === event.pointerId) {
      // 使用不受镜头影响的 frame 坐标，避免 world.toLocal 造成拖动反馈循环。
      moveCamera(cameraDrag.startCameraX + cameraDrag.startX - frame.toLocal(event.global).x)
    }
    if (swordDrag?.pointerId === event.pointerId) {
      const local = rail.toLocal(event.global)
      swordDrag.object.position.set(local.x - swordDrag.offsetX, local.y - swordDrag.offsetY)
    }
  })
  const endGesture = (pointerId?: number) => {
    if (pointerId !== undefined && pointerId !== cameraDrag?.pointerId && pointerId !== swordDrag?.pointerId) return
    cameraDrag = null
    frame.cursor = 'grab'
    if (swordDrag) {
      swordDrag.object.position.set(swordDrag.originX, swordDrag.originY)
      swordDrag.object.alpha = 1
      swordDrag.object.zIndex = 0
      swordDrag = null
      selection.textContent = '示意剑已归回原钩位，镜头位置保持不变'
    }
  }
  app.stage.on('pointerup', (event: FederatedPointerEvent) => endGesture(event.pointerId))
  app.stage.on('pointerupoutside', (event: FederatedPointerEvent) => endGesture(event.pointerId))
  app.stage.on('pointercancel', (event: FederatedPointerEvent) => endGesture(event.pointerId))
  window.addEventListener('pointerup', (event) => endGesture(event.pointerId), { signal: cleanup.signal })
  window.addEventListener('pointercancel', (event) => endGesture(event.pointerId), { signal: cleanup.signal })
  window.addEventListener('blur', () => endGesture(), { signal: cleanup.signal })

  const resize = () => {
    if (!host) return
    endGesture()
    app.renderer.resize(host.clientWidth, host.clientHeight)
    const scale = Math.min(app.screen.width / manifest.canvas.width, app.screen.height / manifest.canvas.height)
    frame.scale.set(scale)
    frame.position.set(Math.round((app.screen.width - manifest.canvas.width * scale) / 2), Math.round((app.screen.height - manifest.canvas.height * scale) / 2))
    moveCamera(cameraX)
  }
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(host)
  resize()
  positionControl.max = String(maxCameraX)
  positionControl.addEventListener('input', () => moveCamera(Number(positionControl.value)), { signal: cleanup.signal })
  positionControl.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      moveCamera(cameraX + (event.key === 'ArrowRight' ? hookLayout.spacing : -hookLayout.spacing))
    }
  }, { signal: cleanup.signal })
  showSwords.addEventListener('change', () => {
    for (const sword of swords) sword.visible = showSwords.checked
  }, { signal: cleanup.signal })
  app.canvas.addEventListener('wheel', (event) => {
    const rectangle = app.canvas.getBoundingClientRect()
    const px = (event.clientX - rectangle.left) * app.screen.width / rectangle.width
    const py = (event.clientY - rectangle.top) * app.screen.height / rectangle.height
    const localX = (px - frame.x) / frame.scale.x
    const localY = (py - frame.y) / frame.scale.y
    if (localX < 0 || localX > manifest.canvas.width || localY < 0 || localY > manifest.canvas.height) return
    event.preventDefault()
    if (cameraDrag || swordDrag) return
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    const factor = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? manifest.canvas.width : 1
    moveCamera(cameraX + delta * factor / frame.scale.x)
  }, { passive: false, signal: cleanup.signal })
  moveCamera(0)
  host.dataset.ready = 'true'
  host.dataset.rows = '1'
  host.dataset.cameraMotion = manifest.camera.motion
  loading?.remove()
}

void startPreview().catch((error: unknown) => {
  if (loading) loading.textContent = error instanceof Error ? error.message : '素材载入失败'
})

const dispose = () => {
  if (disposed) return
  disposed = true
  cleanup.abort()
  resizeObserver?.disconnect()
  if (initialized) app.destroy({ removeView: true }, { children: true })
}
window.addEventListener('pagehide', dispose, { once: true })
const hot = (import.meta as ImportMeta & { hot?: { dispose: (callback: () => void) => void } }).hot
if (hot) hot.dispose(dispose)
