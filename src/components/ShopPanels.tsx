import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { formatCoins, RELIC_BY_ID, swordName } from '../game/content'
import { furnishingUrl } from '../game/furnishingAssets'
import { WEAPON_CATALOG } from '../game/weaponCatalog'
import { WEAPON_ASSET_BASE } from '../pixi/contracts'
import { weaponRarity } from '../game/rarity'
import type { GameState, MerchantItem, RelicId } from '../game/types'
import { BookScroll } from './BookScroll'
import './shop-panels.css'
import './furnishing-panels.css'

const WEAPON_IMAGES_BY_NAME: Readonly<Record<string, string>> = Object.fromEntries(WEAPON_CATALOG.map((entry, index) => [entry.name, `${WEAPON_ASSET_BASE}${String(index).padStart(2, '0')}-${entry.id.replaceAll(':', '-')}.png`]))
// 文件名沿用武器目录的稳定索引与 ID，新形态只在目录末尾追加。
const BASE_WEAPON_IMAGES = Object.fromEntries(WEAPON_CATALOG.flatMap((entry, index) => entry.level === 0
  ? [[entry.kind, `${WEAPON_ASSET_BASE}${String(index).padStart(2, '0')}-${entry.id.replaceAll(':', '-')}.png`]]
  : [])) as Record<'iron' | 'branch' | 'nail' | 'dagger', string>

function merchantImage(item: MerchantItem): string {
  return item.type === 'dragon-scale' || item.type === 'hourglass'
    ? furnishingUrl(item.type) : BASE_WEAPON_IMAGES[item.type]
}

function ShopImage({ src, weapon = false }: { src: string; weapon?: boolean }) {
  return <span className={`shop-item-image${weapon ? ' is-weapon' : ''}`} aria-hidden="true"><img src={src} alt="" draggable={false} /></span>
}

type DragOrigin = 'wares' | 'checkout' | 'swords' | 'slots'
interface ShopDragItem {
  id: string
  imageUrl: string
  weapon?: boolean
  label: string
  origin: DragOrigin
}
interface ShopDrag extends ShopDragItem {
  pointerId: number
  source: HTMLElement
  startX: number
  startY: number
  x: number
  y: number
  moved: boolean
}

// Only a pointer that began on a real item in this panel may stage a transaction.
function useShopDrag(onDrop: (item: ShopDragItem, x: number, y: number) => void) {
  const active = useRef<ShopDrag | null>(null)
  const drop = useRef(onDrop)
  const suppressClick = useRef(false)
  const [preview, setPreview] = useState<ShopDrag | null>(null)
  drop.current = onDrop

  const cancel = useCallback(() => {
    const current = active.current
    if (current) suppressClick.current = true
    active.current = null
    setPreview(null)
    if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId)
  }, [])

  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && active.current) {
        suppressClick.current = true
        cancel()
      }
    }
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', escape)
    return () => {
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', escape)
      const current = active.current
      active.current = null
      if (current?.source.hasPointerCapture(current.pointerId)) current.source.releasePointerCapture(current.pointerId)
    }
  }, [cancel])

  const bind = (item: ShopDragItem, enabled = true) => ({
    onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || !event.isPrimary || event.button !== 0 || active.current) return
      suppressClick.current = false
      event.currentTarget.focus({ preventScroll: true })
      event.currentTarget.setPointerCapture(event.pointerId)
      active.current = {
        ...item, pointerId: event.pointerId, source: event.currentTarget,
        startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false,
      }
    },
    onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
      const current = active.current
      if (!current || current.pointerId !== event.pointerId) return
      const moved = current.moved || Math.hypot(event.clientX - current.startX, event.clientY - current.startY) >= 6
      active.current = { ...current, x: event.clientX, y: event.clientY, moved }
      if (moved) setPreview(active.current)
    },
    onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
      const current = active.current
      if (!current || current.pointerId !== event.pointerId) return
      cancel()
      suppressClick.current = current.moved
      if (current.moved) drop.current(current, event.clientX, event.clientY)
    },
    onPointerCancel: () => {
      suppressClick.current = true
      cancel()
    },
    onLostPointerCapture: () => {
      if (active.current) {
        suppressClick.current = true
        cancel()
      }
    },
  })

  return { bind, preview, suppressClick, cancel }
}

function isOver(element: HTMLElement | null, x: number, y: number) {
  const hit = document.elementFromPoint(x, y)
  return !!element && !!hit && element.contains(hit)
}

function selectWithKey(event: KeyboardEvent<HTMLElement>, select: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (!event.repeat) select()
  }
}

function DragPreview({ drag }: { drag: ShopDrag | null }) {
  return drag ? createPortal(
    <div className="shop-drag-preview" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
      <ShopImage src={drag.imageUrl} weapon={drag.weapon} /><small>{drag.label}</small>
    </div>, document.body,
  ) : null
}

function merchantPrice(state: GameState, item: MerchantItem) {
  return state.relics.includes('double-bell') && ['iron', 'branch', 'nail', 'dagger'].includes(item.type)
    ? item.price * 4n / 5n : item.price
}

interface MerchantPanelProps {
  state: GameState
  onBuy: (itemId: string) => void
  onClose: () => void
}

export function MerchantPanel({ state, onBuy, onClose }: MerchantPanelProps) {
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const checkout = useRef<HTMLDivElement>(null)
  const wares = useRef<HTMLDivElement>(null)
  const available = (item: MerchantItem) => state.day % 4 === 0 && item.stock > 0 && state.coins >= merchantPrice(state, item)
  const pendingItem = state.merchantItems.find((item) => item.id === pendingItemId && available(item))
  const drag = useShopDrag((item, x, y) => {
    const ware = state.merchantItems.find((candidate) => candidate.id === item.id)
    if (!ware || !available(ware)) return
    if (item.origin === 'wares' && isOver(checkout.current, x, y)) setPendingItemId(ware.id)
    else if (item.origin === 'checkout' && isOver(wares.current, x, y)) setPendingItemId(null)
  })

  useEffect(() => {
    if (!pendingItem) setPendingItemId(null)
  }, [pendingItem])

  return (
    <div className="overlay" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="shop-panel merchant-panel furnishing-panel" style={{ '--furnishing-panel-image': `url("${furnishingUrl('merchant-panel')}")` } as CSSProperties} role="dialog" aria-modal="true" aria-label="旅行商人" onDragStart={(event) => event.preventDefault()}>
        <button className="corner-close icon-button" onClick={onClose} aria-label="离开商人">×</button>
        <BookScroll className="shop-scroll" viewportClassName="shop-content" ariaLabel="旅行商人货架与结算">
        <header><img className="merchant-face shop-header-image" src={furnishingUrl('merchant-entrance')} alt="" /><div><h2>旅行商人</h2><p id="merchant-help">货物拖上结算垫，敲铃逐件成交，有库存可再次购买；成交前可取回。也可 Tab 选中货物，Enter / 空格放上垫子。普通铁剑、龙鳞和沙漏每次到访补货3～5件。</p></div><strong className="coin-readout">◆ {formatCoins(state.coins)}</strong></header>
        <div className="wares-grid" ref={wares}>
          {state.merchantItems.map((item) => {
            const price = merchantPrice(state, item)
            const enabled = available(item)
            const stage = () => enabled && setPendingItemId((current) => current === item.id ? null : item.id)
            return (
              <article
                key={item.id}
                className={`pointer-ware ${item.stock <= 0 ? 'sold-out' : ''} ${pendingItem?.id === item.id ? 'on-checkout' : ''}`}
                role="button" tabIndex={0} aria-pressed={pendingItem?.id === item.id} aria-disabled={!enabled}
                aria-describedby="merchant-help"
                {...drag.bind({ id: item.id, imageUrl: merchantImage(item), weapon: item.type in BASE_WEAPON_IMAGES, label: item.name, origin: 'wares' }, enabled)}
                onClick={() => !drag.suppressClick.current && stage()}
                onKeyDown={(event) => selectWithKey(event, stage)}
                aria-label={`${item.name}，价格 ${formatCoins(price)} 金币，库存 ${item.stock}${!enabled && item.stock > 0 ? '，金币不足或商人尚未到访' : ''}`}
                title={enabled ? '拖上结算垫，或按 Enter / 空格选择' : '售罄、金币不足或商人尚未到访'}
              >
                <ShopImage src={merchantImage(item)} weapon={item.type in BASE_WEAPON_IMAGES} />
                <h3>{item.name}</h3><p>{item.description}</p>
                <strong className="ware-price">{item.stock <= 0 ? '售罄' : `◆ ${formatCoins(price)}`}</strong>
                {price !== item.price && <small className="ware-discount">双响铃 · 八折</small>}
                <small className="ware-stock">库存 {item.stock}</small>
              </article>
            )
          })}
        </div>
        <div ref={checkout} className={`merchant-checkout ${drag.preview?.origin === 'wares' ? 'awaiting-drop' : ''}`} aria-label="商人结算垫">
          <button
            className="checkout-item pointer-ware" disabled={!pendingItem}
            {...drag.bind({ id: pendingItem?.id ?? '', imageUrl: pendingItem ? merchantImage(pendingItem) : '', weapon: !!pendingItem && pendingItem.type in BASE_WEAPON_IMAGES, label: pendingItem?.name ?? '', origin: 'checkout' }, !!pendingItem)}
            onClick={(event) => (event.detail === 0 || !drag.suppressClick.current) && setPendingItemId(null)}
            aria-label={pendingItem ? `把 ${pendingItem.name} 放回货架` : '空结算垫'} title="点击取回，或拖回货架"
          >{pendingItem ? <ShopImage src={merchantImage(pendingItem)} weapon={pendingItem.type in BASE_WEAPON_IMAGES} /> : <small>待选货物</small>}</button>
          <button disabled={!pendingItem} onClick={() => {
            if (!pendingItem || !available(pendingItem)) return
            onBuy(pendingItem.id)
            setPendingItemId(null)
            drag.cancel()
          }} aria-label={pendingItem ? `敲商人铃，支付 ${formatCoins(merchantPrice(state, pendingItem))} 金币购买 ${pendingItem.name}` : '敲商人铃完成交易'} title="敲铃成交"><img className="shop-bell-image" src={furnishingUrl('offering-bell')} alt="" /></button>
        </div>
        </BookScroll>
        <DragPreview drag={drag.preview} />
      </section>
    </div>
  )
}

interface RelicPanelProps {
  state: GameState
  sacrifices: string[]
  onToggleSacrifice: (swordId: string) => void
  onBuy: (relicId: RelicId) => void
  onRefresh: () => void
  onClose: () => void
}

export function RelicPanel({ state, sacrifices, onToggleSacrifice, onBuy, onRefresh, onClose }: RelicPanelProps) {
  const [stagedSwordIds, setStagedSwordIds] = useState<string[]>([])
  const [chosenRelicId, setChosenRelicId] = useState<RelicId | null>(null)
  const [confirming, setConfirming] = useState(false)
  const confirmation = useRef<{ relicId: RelicId; swordIds: string[] } | null>(null)
  const slots = useRef<HTMLDivElement>(null)
  const swordList = useRef<HTMLDivElement>(null)
  const ironSwords = state.swords.filter((sword) => sword.kind === 'iron')
  const validSwordIds = stagedSwordIds.filter((id) => ironSwords.some((sword) => sword.id === id))
  const atLimit = state.relics.length >= 10
  const chosenRelic = chosenRelicId && !atLimit && state.relicOffers.includes(chosenRelicId) && !state.relics.includes(chosenRelicId) ? RELIC_BY_ID[chosenRelicId] : null
  const canConfirm = !!chosenRelic && validSwordIds.length === chosenRelic.cost && !confirming
  const stage = (id: string) => {
    if (atLimit || confirming || !ironSwords.some((sword) => sword.id === id)) return
    setStagedSwordIds((current) => current.includes(id) ? current : [...current, id])
  }
  const retrieve = (id: string) => {
    if (!confirming) setStagedSwordIds((current) => current.filter((candidate) => candidate !== id))
  }
  const drag = useShopDrag((item, x, y) => {
    if (item.origin === 'swords' && isOver(slots.current, x, y)) stage(item.id)
    else if (item.origin === 'slots' && isOver(swordList.current, x, y)) retrieve(item.id)
  })

  useEffect(() => {
    setStagedSwordIds((current) => current.filter((id) => state.swords.some((sword) => sword.id === id && sword.kind === 'iron')))
  }, [state.swords])

  useEffect(() => {
    setChosenRelicId(null)
    setStagedSwordIds([])
    drag.cancel()
  }, [state.relicOffers, drag.cancel])

  // The public callback contract accepts only a relic ID. Publish the staged IDs
  // only after the bell, then wait for the parent callback's fresh closure.
  useEffect(() => {
    const request = confirmation.current
    if (!request || !confirming) return
    if (state.relics.length >= 10 || !state.relicOffers.includes(request.relicId) || state.relics.includes(request.relicId)
      || request.swordIds.length !== RELIC_BY_ID[request.relicId].cost
      || request.swordIds.some((id) => !state.swords.some((sword) => sword.id === id && sword.kind === 'iron'))) {
      confirmation.current = null
      setConfirming(false)
      return
    }
    if (sacrifices.length !== request.swordIds.length || sacrifices.some((id) => !request.swordIds.includes(id))) return
    confirmation.current = null
    setConfirming(false)
    setChosenRelicId(null)
    setStagedSwordIds([])
    onBuy(request.relicId)
  }, [confirming, sacrifices, state.relics, state.relicOffers, state.swords, onBuy])

  const ringBell = () => {
    if (!canConfirm || !chosenRelic || confirmation.current) return
    const swordIds = [...validSwordIds]
    confirmation.current = { relicId: chosenRelic.id, swordIds }
    setConfirming(true)
    drag.cancel()
    for (const id of new Set(sacrifices)) if (!swordIds.includes(id)) onToggleSacrifice(id)
    for (const id of swordIds) if (!sacrifices.includes(id)) onToggleSacrifice(id)
  }

  return (
    <div className="overlay" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && !confirming && onClose()}>
      <section className="shop-panel relic-panel furnishing-panel" style={{ '--furnishing-panel-image': `url("${furnishingUrl('relic-panel')}")` } as CSSProperties} role="dialog" aria-modal="true" aria-label="遗物祭台" onDragStart={(event) => event.preventDefault()}>
        <button className="corner-close icon-button" onClick={onClose} disabled={confirming} aria-label="离开遗物祭台">×</button>
        <BookScroll className="shop-scroll" viewportClassName="shop-content" ariaLabel="遗物祭台与兑换">
        <header><img className="relic-orb shop-header-image" src={furnishingUrl('relic-altar')} alt="" /><div><h2>遗物祭台</h2><p id="relic-help">选择遗物，把普通铁剑拖进祭槽，敲小钟兑换；成交前可取回。Tab 后 Enter / 空格也可选择。</p></div><strong aria-label={`已持有 ${state.relics.length} 件遗物，上限十件`}>{state.relics.length} / 10</strong></header>
        {atLimit && <p className="shop-notice" role="status">遗物架已满，十件珍宝已全部安放。</p>}
        <div className="relic-layout">
          <div className="relic-offers">
            {state.relicOffers.map((id) => {
              const relic = RELIC_BY_ID[id]
              const disabled = atLimit || state.relics.includes(id) || confirming
              const choose = () => !disabled && setChosenRelicId((current) => current === id ? null : id)
              return (
                <article key={id} className={chosenRelic?.id === id ? 'chosen' : ''}
                  role="button" tabIndex={0} aria-pressed={chosenRelic?.id === id} aria-disabled={disabled} aria-describedby="relic-help"
                  onClick={choose} onKeyDown={(event) => selectWithKey(event, choose)}
                  aria-label={`${relic.name}，需要 ${relic.cost} 把普通铁剑${state.relics.includes(id) ? '，已拥有' : ''}`}>
                  <ShopImage src={furnishingUrl(relic.id)} /><h3>{relic.name}</h3><p>{relic.description}</p>
                  <div className="sword-cost" aria-label={`需要 ${relic.cost} 把普通铁剑`}><ShopImage src={BASE_WEAPON_IMAGES.iron} weapon /><strong>× {relic.cost}</strong><small>普通铁剑</small></div>
                </article>
              )
            })}
          </div>
          <aside className="sacrifice-tray">
            {chosenRelic && <div className="chosen-relic-preview"><ShopImage src={furnishingUrl(chosenRelic.id)} /><span>{chosenRelic.name}<br />祭品 {chosenRelic.cost} 把普通铁剑</span></div>}
            <div ref={slots} className={`sacrifice-slots ${drag.preview?.origin === 'swords' ? 'awaiting-drop' : ''}`} aria-label="祭剑槽">
              {validSwordIds.length === 0 && <span className="empty-slot"><ShopImage src={BASE_WEAPON_IMAGES.iron} weapon /><small>将普通铁剑放入祭槽</small></span>}
              {validSwordIds.map((id) => {
                const sword = ironSwords.find((candidate) => candidate.id === id)!
                const rarity = weaponRarity(sword.level)
                const imageUrl = WEAPON_IMAGES_BY_NAME[swordName(sword)]
                return <button key={id} className="pointer-ware sacrifice-sword" disabled={confirming}
                  {...drag.bind({ id, imageUrl, weapon: true, label: `${swordName(sword)} · Lv.${sword.level} · ${rarity.name}`, origin: 'slots' }, !confirming)}
                  onClick={(event) => (event.detail === 0 || !drag.suppressClick.current) && retrieve(id)} aria-label={`从祭剑槽取回等级 ${sword.level} 铁剑，${swordName(sword)}，${rarity.name}`} title="点击取回，或拖回藏剑区"><ShopImage src={imageUrl} weapon /><small className="weapon-rarity" style={{ color: rarity.cssColor }}>{swordName(sword)} · Lv.{sword.level} · {rarity.name}</small></button>
              })}
            </div>
            <p role="status">{chosenRelic ? `${chosenRelic.name} · ${validSwordIds.length} / ${chosenRelic.cost} 把` : atLimit ? '已达十件上限' : '先选一件遗物'}</p>
            <button className="relic-bell" disabled={!canConfirm} onClick={ringBell} aria-label={chosenRelic ? `敲祭台小钟，献祭 ${chosenRelic.cost} 把普通铁剑换取 ${chosenRelic.name}` : '敲祭台小钟完成兑换'} title="敲铃兑换"><img className="shop-bell-image" src={furnishingUrl('offering-bell')} alt="" /></button>
            <BookScroll className="sacrifice-scroll" viewportClassName="sacrifice-list rarity-sword-list" ref={swordList} ariaLabel="可献祭的普通铁剑">
              {ironSwords.filter((sword) => !validSwordIds.includes(sword.id)).map((sword) => {
                const rarity = weaponRarity(sword.level)
                const imageUrl = WEAPON_IMAGES_BY_NAME[swordName(sword)]
                return <button key={sword.id} className="pointer-ware sacrifice-sword" disabled={atLimit || confirming}
                  {...drag.bind({ id: sword.id, imageUrl, weapon: true, label: `${swordName(sword)} · Lv.${sword.level} · ${rarity.name}`, origin: 'swords' }, !atLimit && !confirming)}
                  onClick={(event) => (event.detail === 0 || !drag.suppressClick.current) && stage(sword.id)}
                  aria-label={`将等级 ${sword.level} 普通铁剑放入祭槽，${swordName(sword)}，${rarity.name}`} title="拖入祭槽，或按 Enter / 空格选择"><ShopImage src={imageUrl} weapon /><small className="weapon-rarity" style={{ color: rarity.cssColor }}>{swordName(sword)} · Lv.{sword.level} · {rarity.name}</small></button>
              })}
              {ironSwords.length === 0 && <small className="shop-empty">没有可献祭的普通铁剑。</small>}
            </BookScroll>
            <button className="refresh-wheel" onClick={() => {
              drag.cancel()
              setStagedSwordIds([])
              setChosenRelicId(null)
              onRefresh()
            }} disabled={atLimit || confirming || state.coins < state.relicRefreshCost} aria-label={`拨动命运轮盘，花费 ${formatCoins(state.relicRefreshCost)} 金币刷新遗物`} title="拨动命运轮盘">
              ↻ <span>◆ {formatCoins(state.relicRefreshCost)}</span>
            </button>
          </aside>
        </div>
        </BookScroll>
        <DragPreview drag={drag.preview} />
      </section>
    </div>
  )
}
