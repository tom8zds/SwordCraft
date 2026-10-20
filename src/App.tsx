import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookPanel, type BookPage } from './components/BookPanel'
import { MerchantPanel, RelicPanel } from './components/ShopPanels'
import { PixiSmithy } from './components/PixiSmithy'
import { BookScroll } from './components/BookScroll'
import { CalendarPanel } from './components/CalendarPanel'
import { MobileGamePanel } from './components/MobileGamePanel'
import { useCompactLayout } from './components/useCompactLayout'
import { formatCoins, swordName, swordValue } from './game/content'
import { armDragonScale, buyMerchantItem, buyRelic, disarmDragonScale, hammerSword, moveSword, refreshRelicOffers, restartGame, ringSubmissionBell, useHourglass } from './game/engine'
import { formatDivineDate } from './game/divineCalendar'
import { compactWeaponValue, weaponRarity } from './game/rarity'
import { loadGame, saveGame } from './game/storage'
import type { GameEvent, GameState, RelicId, SwordLocation, Transition } from './game/types'
import { MIN_WORLD_X, type ConsumableKind, type WeaponAtlas } from './pixi/contracts'
import './styles.css'
import './components/hud-calendar.css'
import './components/mobile-game.css'
import './components/mobile-panels.css'

const RESULT_COPY = { destroyed: '破坏', damaged: '损伤', steady: '维持', success: '成功', great: '大成功' }
type Panel = 'book' | 'merchant' | 'relic' | 'calendar' | null

function App() {
  const compact = useCompactLayout()
  const loaded = useMemo(() => loadGame(), [])
  const [game, setGame] = useState<GameState>(loaded.state)
  const gameRef = useRef(game)
  const [panel, setPanel] = useState<Panel>(null)
  const [bookPage, setBookPage] = useState<BookPage>('records')
  const [toast, setToast] = useState<{ message: string; tone: string; id: number } | null>(loaded.recovered ? { message: '炉火仍温，上一局已恢复。', tone: 'neutral', id: Date.now() } : null)
  const [sacrifices, setSacrifices] = useState<string[]>([])
  const [saveFailed, setSaveFailed] = useState(false)
  const [cameraX, setCameraX] = useState(MIN_WORLD_X)
  const [weaponAtlas, setWeaponAtlas] = useState<WeaponAtlas | null>(null)
  const lastHammerAt = useRef(0)
  const eventsSequence = useRef(0)
  gameRef.current = game
  const sceneEnabled = panel === null && !game.gameOver

  useEffect(() => { setSaveFailed(!saveGame(game)) }, [game])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showEvents = useCallback((events: GameEvent[]) => {
    for (const event of events) {
      if (event.type === 'message') setToast({ message: event.message, tone: event.tone ?? 'neutral', id: ++eventsSequence.current })
      if (event.type === 'hammer') {
        const suffix = event.preventedBy ? ` · ${event.preventedBy === 'ascension' ? '登神' : event.preventedBy === 'dragon-scale' ? '龙鳞' : '遗物'}阻挡` : ''
        setToast({ message: RESULT_COPY[event.result] + suffix, tone: ['destroyed', 'damaged'].includes(event.result) && !event.preventedBy ? 'bad' : 'good', id: ++eventsSequence.current })
      }
      if (event.type === 'evolution') setToast({ message: `进化 · ${event.name}`, tone: 'good', id: ++eventsSequence.current })
      if (event.type === 'game-over') setToast(null)
    }
  }, [])

  const apply = useCallback((transition: Transition) => {
    gameRef.current = transition.state
    setGame(transition.state)
    showEvents(transition.events)
  }, [showEvents])
  const strike = useCallback(() => {
    const state = gameRef.current
    const timestamp = Date.now()
    if (timestamp - lastHammerAt.current < 500 || state.gameOver) return
    lastHammerAt.current = timestamp
    apply(hammerSword(state, timestamp))
  }, [apply])
  const dropSword = useCallback((id: string, location: SwordLocation) => apply(moveSword(gameRef.current, id, location)), [apply])
  const selectSword = useCallback((id: string) => {
    const state = gameRef.current
    if (state.swords.some((sword) => sword.id === id)) apply({ state: { ...state, selectedSwordId: id }, events: [] })
  }, [apply])
  const useSceneItem = useCallback((type: ConsumableKind) => {
    const state = gameRef.current
    if (state.gameOver) return
    const sword = state.swords.find((candidate) => candidate.location === 'anvil')
    if (type === 'hourglass') apply(useHourglass(state))
    else if (sword) apply(armDragonScale(state, sword.id))
    else setToast({ message: '工作台上没有可装备龙鳞的剑。', tone: 'bad', id: ++eventsSequence.current })
  }, [apply])
  const openMerchant = useCallback(() => {
    if (gameRef.current.day % 4 === 0) setPanel('merchant')
    else setToast({ message: `商人将在第 ${gameRef.current.day + 4 - gameRef.current.day % 4} 日到来。`, tone: 'neutral', id: ++eventsSequence.current })
  }, [])
  const ringBell = useCallback(() => apply(ringSubmissionBell(gameRef.current, Date.now())), [apply])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPanel(null); return }
      const target = event.target as HTMLElement | null
      if (target?.matches('input,textarea,select,[contenteditable="true"]') || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      if (target?.closest('[role="dialog"]') || panel || game.gameOver) return
      if (event.key.toLowerCase() === 'b') { setBookPage('records'); setPanel('book') }
      if (event.key.toLowerCase() === 'c') setPanel('calendar')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [panel, game.gameOver])
  useEffect(() => {
    if (!panel) return
    const previous = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[role="dialog"] button')?.focus())
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
      const controls = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"],input:not(:disabled),a[href]')) : []
      if (controls.length === 0) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', trapFocus)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', trapFocus)
      const canvas = document.querySelector<HTMLElement>('canvas.pixi-canvas')
      if (previous?.closest('.scene-a11y')) canvas?.focus({ preventScroll: true })
      else previous?.focus({ preventScroll: true })
    }
  }, [panel])

  const sacrificeForRelic = (id: RelicId) => {
    const state = gameRef.current
    const transition = buyRelic(state, id, sacrifices)
    apply(transition)
    if (transition.state !== state) setSacrifices([])
  }
  const selectedSword = game.swords.find((sword) => sword.id === game.selectedSwordId)
  const selectedRarity = selectedSword ? weaponRarity(selectedSword.level) : null

  return (
    <main className={`game-shell${compact ? ' is-compact' : ''}`} data-day={game.day} data-health={game.health}>
      <header className="hud">
        <div className="life-meter" aria-label={`生命 ${game.health} / ${game.maxHealth}`}>{compact ? <><span className="alive" aria-hidden="true">♥</span><span className="life-count">{game.health}/{game.maxHealth}</span></> : Array.from({ length: game.maxHealth }, (_, index) => <span key={index} className={index < game.health ? 'alive' : ''}>♥</span>)}</div>
        <button className="day-plaque" onClick={() => setPanel('calendar')} aria-label={`${formatDivineDate(game.day)}，第 ${game.day} 日，打开日历`}><span>{formatDivineDate(game.day)}</span><small>第 {game.day} 日</small></button>
        <div className="hud-right"><div className="hud-coins" title={`金币 ${formatCoins(game.coins)}`} aria-label={`金币 ${formatCoins(game.coins)}`}>◆ {compact ? compactWeaponValue(game.coins) : formatCoins(game.coins)}</div><div className="hud-weapons" title="拥有的武器总数" aria-label={`拥有 ${game.swords.length} 把武器`}>⚔ {game.swords.length}</div></div>
      </header>
      <section className="smithy" aria-label="铁匠铺">
        <PixiSmithy state={game} compact={compact} enabled={sceneEnabled} onWeaponAtlas={setWeaponAtlas} onSwordDrop={dropSword} onSwordSelect={selectSword} onHammer={strike} onBell={ringBell} onBook={(page) => { setBookPage(page); setPanel('book') }} onRelic={() => setPanel('relic')} onMerchant={openMerchant} onItemDrop={useSceneItem} onDisarmScale={(id) => apply(disarmDragonScale(gameRef.current, id))} onCameraChange={(next) => setCameraX(next.x)} />
        {!compact && <div className="scene-a11y" aria-label="键盘场景操作" inert={!sceneEnabled}>
          <BookScroll ariaLabel="键盘场景操作列表" className="scene-a11y-scroll" viewportClassName="scene-a11y-content">
          {game.swords.map((sword) => {
            const rarity = weaponRarity(sword.level)
            return <button key={sword.id} className="weapon-rarity" style={{ color: rarity.cssColor }} onClick={() => selectSword(sword.id)}>{swordName(sword)} · Lv.{sword.level} · {rarity.name}</button>
          })}
          <button onClick={strike}>锤打工作台上的剑</button><button onClick={ringBell}>敲响上供铃</button><button onClick={() => { setBookPage('records'); setPanel('book') }}>打开铁匠手记</button><button onClick={() => { setBookPage('relics'); setPanel('book') }}>打开遗物图鉴</button><button onClick={openMerchant}>查看旅行商人</button>
          <button onClick={() => useSceneItem('dragon-scale')}>使用龙鳞，库存 {game.dragonScales}</button><button onClick={() => useSceneItem('hourglass')}>使用沙漏，库存 {game.hourglasses}</button><button onClick={() => setPanel('relic')}>打开遗物祭台</button>
          </BookScroll>
        </div>}
      </section>
      {compact ? <MobileGamePanel state={game} sword={selectedSword} enabled={sceneEnabled} saveFailed={saveFailed} onSelect={selectSword} onMove={dropSword} onHammer={strike} onBell={ringBell} onItem={useSceneItem} onDisarmScale={(id) => apply(disarmDragonScale(gameRef.current, id))} onBook={(page) => { setBookPage(page); setPanel('book') }} onRelic={() => setPanel('relic')} onMerchant={openMerchant} /> : <footer className="status-ledger"><span className="weapon-rarity" style={{ color: selectedRarity?.cssColor }}>{selectedSword ? `${swordName(selectedSword)} · Lv.${selectedSword.level} · ${selectedRarity!.name} · ◆ ${formatCoins(swordValue(selectedSword))}` : '铸剑录'}</span><span>{saveFailed ? '本地存档不可写，请勿关闭页面' : `${game.swords.length} 把藏剑 · ${game.relics.length} 件遗物`}<small>房间 {cameraX}</small></span></footer>}
      {toast && <div key={toast.id} className={`toast ${toast.tone}`} role="status">{toast.message}</div>}
      {panel === 'book' && <BookPanel state={game} page={bookPage} weaponAtlas={weaponAtlas} onPageChange={setBookPage} onClose={() => setPanel(null)} />}
      {panel === 'merchant' && <MerchantPanel state={game} onBuy={(id) => apply(buyMerchantItem(gameRef.current, id))} onClose={() => setPanel(null)} />}
      {panel === 'relic' && <RelicPanel state={game} sacrifices={sacrifices} onToggleSacrifice={(swordId) => setSacrifices((current) => current.includes(swordId) ? current.filter((id) => id !== swordId) : [...current, swordId])} onBuy={sacrificeForRelic} onRefresh={() => apply(refreshRelicOffers(gameRef.current))} onClose={() => setPanel(null)} />}
      {panel === 'calendar' && <CalendarPanel state={game} onClose={() => setPanel(null)} />}
      {game.gameOver && <div className="overlay game-over-overlay"><section className="game-over-panel" role="dialog" aria-modal="true" aria-label="游戏结束"><div className="cold-forge">♨</div><h1>炉火熄灭</h1><p>坚持到第 {game.day - 1} 日，留下 {game.discoveredNames.length} 种剑形。</p><button onClick={() => { lastHammerAt.current = 0; apply(restartGame(gameRef.current)); setPanel(null) }}>重新点火</button></section></div>}
    </main>
  )
}

export default App
