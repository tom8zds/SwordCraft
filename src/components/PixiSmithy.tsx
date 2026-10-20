import { useEffect, useRef, useState } from 'react'
import { Application, Assets, Texture } from 'pixi.js'
import type { GameState } from '../game/types'
import { SmithyScene } from '../pixi/SmithyScene'
import { MIN_WORLD_X, type HammerArtwork, type SceneCamera, type SceneFocus, type SmithySceneCallbacks, type SmithyTextures, type WeaponAtlas } from '../pixi/contracts'
import { WorkbenchDetails } from './WorkbenchDetails'
import { createWeaponAtlas, loadWeaponTextures } from '../pixi/weaponAtlas'
import { loadFurnishingTextures } from '../pixi/furnishingAssets'
import { sceneViewport } from '../pixi/sceneViewport'
import './pixi-layout.css'

interface PixiSmithyProps extends SmithySceneCallbacks {
  state: GameState
  enabled: boolean
  compact: boolean
  onWeaponAtlas: (atlas: WeaponAtlas) => void
}

interface RuntimeManifest {
  textures: Record<keyof SmithyTextures, string>
  assets: { hammer: { pivot: { x: number; y: number } } }
  hammerRing: { center: { x: number; y: number }; radius: number }
}

const SCENE_TEXTURE_KEYS = ['background', 'forge', 'workbench', 'hook', 'wallExtension', 'hammer'] as const satisfies readonly (keyof SmithyTextures)[]
const STATIONS = [
  { id: 'cabinet', name: '物品柜' }, { id: 'forge', name: '炭炉' }, { id: 'anvil', name: '工作台' },
  { id: 'rack', name: '挂剑墙' }, { id: 'submission', name: '上供台' }, { id: 'merchant', name: '商人' },
] as const satisfies readonly { id: SceneFocus; name: string }[]

export function PixiSmithy(props: PixiSmithyProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<SmithyScene | null>(null)
  const propsRef = useRef(props)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [camera, setCamera] = useState<SceneCamera>({ x: MIN_WORLD_X, minX: MIN_WORLD_X, maxX: 0 })
  const [size, setSize] = useState({ width: 1920, height: 1080 })
  const [station, setStation] = useState<SceneFocus>('anvil')
  propsRef.current = props

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const lifecycle = new AbortController()
    const app = new Application()
    let disposed = false
    let initialized = false
    let observer: ResizeObserver | null = null
    let scene: SmithyScene | null = null
    let atlasUrl: string | null = null
    setReady(false)
    setError(null)
    void (async () => {
      try {
        const [manifest, weapons, furnishings] = await Promise.all([
          (async () => {
            const result = await fetch('/assets/game/smithy/manifest.json', { signal: lifecycle.signal })
            if (!result.ok) throw new Error('无法加载铁匠铺素材清单。')
            return await result.json() as RuntimeManifest
          })(),
          loadWeaponTextures(lifecycle.signal),
          loadFurnishingTextures(lifecycle.signal),
        ])
        if (disposed) return
        const urls = SCENE_TEXTURE_KEYS.map((key) => {
          const url = manifest.textures[key]
          if (!url) throw new Error(`铁匠铺素材缺失：${key}`)
          return url
        })
        const loaded = await Assets.load<Texture>(urls)
        if (disposed) return
        const textures = Object.fromEntries(SCENE_TEXTURE_KEYS.map((key) => [key, loaded[manifest.textures[key]]])) as unknown as SmithyTextures
        await app.init({ background: '#11121a', width: host.clientWidth, height: host.clientHeight, antialias: false, resolution: Math.min(window.devicePixelRatio, 2), autoDensity: true, roundPixels: true, preference: 'webgl' })
        initialized = true
        if (disposed) { app.destroy({ removeView: true }, { children: true }); return }
        app.canvas.className = 'pixi-canvas'
        app.canvas.setAttribute('aria-label', '像素铁匠铺：拖动剑锻造，拖动空白区域浏览整个房间')
        app.canvas.tabIndex = 0
        host.appendChild(app.canvas)
        const artwork: HammerArtwork = { ring: { ...manifest.hammerRing.center, radius: manifest.hammerRing.radius }, pivot: { x: manifest.assets.hammer.pivot.x * textures.hammer.width, y: manifest.assets.hammer.pivot.y * textures.hammer.height } }
        scene = new SmithyScene(textures, weapons, furnishings, artwork, {
          onSwordDrop: (id, location) => propsRef.current.onSwordDrop(id, location),
          onSwordSelect: (id) => propsRef.current.onSwordSelect(id),
          onHammer: () => propsRef.current.onHammer(),
          onBell: () => propsRef.current.onBell(),
          onBook: (page) => propsRef.current.onBook(page),
          onRelic: () => propsRef.current.onRelic(),
          onMerchant: () => propsRef.current.onMerchant(),
          onItemDrop: (type) => propsRef.current.onItemDrop(type),
          onDisarmScale: (id) => propsRef.current.onDisarmScale(id),
          onCameraChange: (next) => {
            host.dataset.cameraX = String(next.x)
            host.dataset.cameraMin = String(next.minX)
            host.dataset.cameraMax = String(next.maxX)
            setCamera(next)
            propsRef.current.onCameraChange(next)
          },
        })
        sceneRef.current = scene
        app.stage.addChild(scene.root)
        scene.update(propsRef.current.state)
        scene.setEnabled(propsRef.current.enabled)
        const resize = () => {
          if (disposed || !scene) return
          app.renderer.resize(host.clientWidth, host.clientHeight)
          scene.setScale(app.screen.width, app.screen.height, propsRef.current.compact)
          setSize({ width: app.screen.width, height: app.screen.height })
        }
        resize()
        observer = new ResizeObserver(resize)
        observer.observe(host)
        app.ticker.add((ticker) => scene?.tick(ticker))
        app.canvas.addEventListener('wheel', (event) => {
          const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
          const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? app.screen.width : 1
          if (scene?.wheel(delta * multiplier, event.clientX, event.clientY, app.canvas)) event.preventDefault()
        }, { passive: false, signal: lifecycle.signal })
        window.addEventListener('pointerup', (event) => {
          if (!scene) return
          const rect = app.canvas.getBoundingClientRect()
          scene.release(event.pointerId, false, (event.clientX - rect.left) * app.screen.width / rect.width, (event.clientY - rect.top) * app.screen.height / rect.height)
        }, { signal: lifecycle.signal })
        window.addEventListener('pointercancel', () => scene?.cancelGesture(), { signal: lifecycle.signal })
        window.addEventListener('blur', () => scene?.cancelGesture(), { signal: lifecycle.signal })
        document.addEventListener('visibilitychange', () => { if (document.hidden) scene?.cancelGesture() }, { signal: lifecycle.signal })
        window.addEventListener('keydown', (event) => {
          if (!propsRef.current.enabled || !scene || event.altKey || event.ctrlKey || event.metaKey) return
          const target = event.target as HTMLElement | null
          if (target?.matches('input,textarea,select,a,[contenteditable="true"]')) return
          if (target?.matches('button') && !target.closest('.scene-a11y')) return
          const selected = propsRef.current.state.selectedSwordId
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault()
            scene.moveCamera(Number(host.dataset.cameraX ?? 0) + (event.key === 'ArrowRight' ? 160 : -160))
          } else if (event.code === 'Space') {
            event.preventDefault()
            if (!event.repeat) propsRef.current.onHammer()
          } else if (selected) {
            const key = event.key.toLowerCase()
            const destinations = { f: 'forge', a: 'anvil', r: 'rack', t: 'submission' } as const
            if (key in destinations && !event.repeat) {
              event.preventDefault()
              const location = destinations[key as keyof typeof destinations]
              scene.focus(location)
              propsRef.current.onSwordDrop(selected, location)
            }
          }
        }, { signal: lifecycle.signal })
        const atlas = await createWeaponAtlas(app.renderer, weapons)
        if (disposed) { URL.revokeObjectURL(atlas.url); return }
        atlasUrl = atlas.url
        propsRef.current.onWeaponAtlas(atlas)
        host.dataset.ready = 'true'
        setReady(true)
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error ? failure.message : '铁匠铺素材载入失败。')
      }
    })()
    return () => {
      disposed = true
      lifecycle.abort()
      observer?.disconnect()
      if (atlasUrl) URL.revokeObjectURL(atlasUrl)
      scene?.dispose()
      if (sceneRef.current === scene) sceneRef.current = null
      if (initialized) app.destroy({ removeView: true }, { children: true })
    }
  }, [])

  useEffect(() => { sceneRef.current?.update(props.state) }, [props.state])
  useEffect(() => { sceneRef.current?.setEnabled(props.enabled) }, [props.enabled])
  useEffect(() => { sceneRef.current?.setScale(size.width, size.height, props.compact) }, [props.compact, size.width, size.height])
  const selectedSword = props.state.swords.find((sword) => sword.id === props.state.selectedSwordId)
  useEffect(() => {
    if (!props.compact || !ready || !selectedSword) return
    sceneRef.current?.focus(selectedSword.location)
    setStation(selectedSword.location)
  }, [props.compact, ready, selectedSword?.id, selectedSword?.location])
  const anvilSword = props.state.swords.find((sword) => sword.location === 'anvil')
  const viewport = sceneViewport(size.width, size.height, props.compact)
  const scale = viewport.scale
  const panelX = viewport.x + (660 - camera.x) * scale
  const panelY = viewport.y + 175 * scale
  const panelWidth = Math.min(280, Math.max(170, 330 * scale))

  return (
    <div className={`pixi-layout${props.compact ? ' is-compact-scene' : ''}`}>
    <div ref={hostRef} className="pixi-host" data-camera-motion="entire-world" data-compact={props.compact}>
      {!ready && <div className="scene-loading" role="status">{error ?? '炉火点燃中…'}</div>}
      {!props.compact && ready && anvilSword && panelX > -panelWidth && panelX < size.width && <WorkbenchDetails sword={anvilSword} style={{ left: panelX, top: panelY, width: panelWidth, transform: panelX + panelWidth > size.width ? 'translateX(-100%)' : undefined }} />}
      {!props.compact && ready && <div className="camera-controls" aria-label="房间镜头">
        <button onClick={() => sceneRef.current?.moveCamera(camera.x - 500)} aria-label="向左浏览铁匠铺" disabled={!props.enabled || camera.x <= camera.minX}>‹</button>
        <input type="range" min={camera.minX} max={camera.maxX} step="1" value={camera.x} aria-label="房间镜头位置" disabled={!props.enabled} onChange={(event) => sceneRef.current?.moveCamera(Number(event.target.value))} />
        <button onClick={() => sceneRef.current?.moveCamera(camera.x + 500)} aria-label="向右浏览铁匠铺" disabled={!props.enabled || camera.x >= camera.maxX}>›</button>
      </div>}
      {!props.compact && <div className="scene-focus-controls">
        <button aria-label="查看四层物品柜" title="物品柜" onClick={() => sceneRef.current?.focus('cabinet')} disabled={!props.enabled}>▦</button>
        <button aria-label="查看炭炉" title="炭炉" onClick={() => sceneRef.current?.focus('forge')} disabled={!props.enabled}>♨</button>
        <button aria-label="查看工作台" title="工作台" onClick={() => sceneRef.current?.focus('anvil')} disabled={!props.enabled}>⚒</button>
        <button aria-label="查看挂剑墙" title="挂剑墙" onClick={() => sceneRef.current?.focus('rack')} disabled={!props.enabled}>†</button>
      </div>}
    </div>
    {props.compact && <nav className="compact-station-nav" aria-label="工位导航">
      {STATIONS.map(({ id, name }) => <button key={id} disabled={!props.enabled || !ready} aria-pressed={station === id}
        onClick={() => { sceneRef.current?.focus(id); setStation(id) }}>{name}</button>)}
    </nav>}
    </div>
  )
}
