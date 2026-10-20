import { useEffect, useId, useRef } from 'react'
import { dailyTarget, formatCoins, swordName, swordValue } from '../game/content'
import type { GameState, Sword, SwordLocation } from '../game/types'
import { compactWeaponValue } from '../game/rarity'
import type { ConsumableKind } from '../pixi/contracts'
import type { BookPage } from './BookPanel'
import { BookScroll } from './BookScroll'
import { WorkbenchDetails } from './WorkbenchDetails'

interface MobileGamePanelProps {
  state: GameState
  sword?: Sword
  enabled: boolean
  saveFailed: boolean
  onSelect: (id: string) => void
  onMove: (id: string, location: SwordLocation) => void
  onHammer: () => void
  onBell: () => void
  onItem: (kind: ConsumableKind) => void
  onDisarmScale: (id: string) => void
  onBook: (page: BookPage) => void
  onRelic: () => void
  onMerchant: () => void
}

const LOCATIONS: { location: SwordLocation; label: string }[] = [
  { location: 'forge', label: '炭炉' },
  { location: 'anvil', label: '工作台' },
  { location: 'rack', label: '挂剑墙' },
  { location: 'submission', label: '上供台' },
]

export function MobileGamePanel({ state, sword, enabled, saveFailed, onSelect, onMove, onHammer, onBell, onItem, onDisarmScale, onBook, onRelic, onMerchant }: MobileGamePanelProps) {
  const selectorId = useId()
  const viewportRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (viewportRef.current) viewportRef.current.scrollTop = 0 }, [sword?.id])
  const anvilSword = state.swords.find((candidate) => candidate.location === 'anvil')
  const submissionSword = state.swords.find((candidate) => candidate.location === 'submission')
  const baseOffering = submissionSword ? swordValue(submissionSword) : 0n
  const offering = state.relics.includes('gilded-chisel') ? baseOffering + baseOffering / 10n : baseOffering
  const target = dailyTarget(state.day)

  return (
    <section className="mobile-game-panel" aria-label="武器详情与触屏操作" inert={!enabled}>
      <BookScroll ref={viewportRef} className="mobile-game-scroll" viewportClassName="mobile-game-viewport" ariaLabel="武器详情和操作，可上下滚动">
        <div className="mobile-sword-picker">
          <label htmlFor={selectorId}>选中武器</label>
          <select id={selectorId} value={sword?.id ?? ''} onChange={(event) => onSelect(event.target.value)} disabled={!enabled || state.swords.length === 0}>
            <option value="" disabled>点击场景里的剑或在此选择</option>
            {state.swords.map((candidate) => <option key={candidate.id} value={candidate.id}>{swordName(candidate)} · Lv.{candidate.level} · {LOCATIONS.find((entry) => entry.location === candidate.location)!.label}</option>)}
          </select>
        </div>
        {sword ? <>
          <WorkbenchDetails sword={sword} compact />
          <div className="mobile-sword-actions" role="group" aria-label="移动选中的武器">
            {LOCATIONS.map(({ location, label }) => {
              const occupied = location !== 'rack' && state.swords.some((candidate) => candidate.id !== sword.id && candidate.location === location)
              const reason = location === sword.location ? '已在此处' : occupied ? '已有武器' : location === 'forge' && sword.heated ? '已加热' : location === 'anvil' && !sword.heated ? '先送炭炉' : ''
              return <button key={location} disabled={!enabled || Boolean(reason)} onClick={() => onMove(sword.id, location)} aria-label={`移往${label}${reason ? `，${reason}` : ''}`}>移往{label}{reason && <span>{reason}</span>}</button>
            })}
          </div>
        </> : <p className="mobile-selection-hint">先点选一把剑，再送进炭炉加热、移往工作台。点击场景里的实体锤即可锻打。</p>}
        <div className="mobile-offering-readout" aria-label="今日上供金额">
          <span title={`需求 ${formatCoins(target)} 金币`}>需求 ◆ {compactWeaponValue(target)}</span>
          <span title={`当前 ${formatCoins(offering)} 金币`}>当前 ◆ {compactWeaponValue(offering)}</span>
        </div>
        <button className="mobile-submit-bell" disabled={!enabled} onClick={onBell}>{submissionSword ? '敲响上供铃 · 交剑过日' : '敲响上供铃 · 空交过日'}</button>
        {!submissionSword && <p className="mobile-action-note">空交会扣 1 点生命；按提示在三秒内再敲一次确认。</p>}
        <details className="mobile-extra-actions">
          <summary>道具与操作</summary>
          <div className="mobile-item-actions">
            <button disabled={!enabled || !anvilSword || state.dragonScales === 0 || anvilSword.dragonScaleArmed} onClick={() => onItem('dragon-scale')}>工作台使用龙鳞 · {state.dragonScales}</button>
            <button disabled={!enabled || state.hourglasses === 0 || !state.lastHammer} onClick={() => onItem('hourglass')}>使用沙漏 · {state.hourglasses}</button>
            {sword?.dragonScaleArmed && <button disabled={!enabled} onClick={() => onDisarmScale(sword.id)}>卸下选中剑的龙鳞</button>}
            <button disabled={!enabled || !anvilSword?.heated} onClick={onHammer}>锤打工作台上的剑</button>
          </div>
          <p className="mobile-action-note">龙鳞用于工作台上的剑；沙漏撤回最近一次仍可回溯的锻打。工位占用时，先将原来的剑移往挂剑墙。</p>
        </details>
        <nav className="mobile-library-nav" aria-label="手记与商店">
          <button onClick={() => onBook('bestiary')}>武器图鉴</button>
          <button onClick={() => onBook('relics')}>遗物图鉴</button>
          <button onClick={() => onBook('manual')}>锻造手册</button>
          <button onClick={() => onBook('records')}>锻造记录</button>
          <button onClick={onRelic}>遗物祭台</button>
          <button onClick={onMerchant}>旅行商人</button>
        </nav>
        {saveFailed && <p className="mobile-save-warning" role="alert">本地存档不可写，请勿关闭页面。</p>}
      </BookScroll>
    </section>
  )
}
