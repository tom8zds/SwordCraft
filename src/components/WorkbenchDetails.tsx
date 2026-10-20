import { useEffect, useState } from 'react'
import { KIND_ECONOMY, PATH_LABELS, formatCoins, swordName, swordValue } from '../game/content'
import { compactWeaponValue, weaponRarity } from '../game/rarity'
import type { Sword } from '../game/types'
import { getWeaponCatalogEntry } from '../game/weaponCatalog'

interface WorkbenchDetailsProps {
  sword: Sword
  style?: React.CSSProperties
  compact?: boolean
}


export function WorkbenchDetails({ sword, style, compact = false }: WorkbenchDetailsProps) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!sword.invincibleUntil || sword.invincibleUntil <= Date.now()) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [sword.invincibleUntil])
  const remaining = sword.invincibleUntil ? Math.max(0, sword.invincibleUntil - now) : 0
  const rarity = weaponRarity(sword.level)
  return (
    <aside className={`workbench-details${compact ? ' workbench-details-compact' : ''}`} style={style} aria-label={compact ? '选中武器详情' : '工作台剑详情'}>
      <div className="workbench-title weapon-rarity" style={{ color: rarity.cssColor }}><strong>{swordName(sword)}</strong><b>Lv.{sword.level}</b><span>{rarity.name}</span></div>
      <p className="workbench-description">{getWeaponCatalogEntry(sword).description}</p>
      <dl>
        <div><dt>价值</dt><dd title={formatCoins(swordValue(sword))} aria-label={`价值 ${formatCoins(swordValue(sword))} 金币`}>◆ {compact ? compactWeaponValue(swordValue(sword)) : formatCoins(swordValue(sword))}</dd></div>
        <div><dt>类型</dt><dd>{sword.path && sword.evolutionStage >= 3 ? PATH_LABELS[sword.path] : KIND_ECONOMY[sword.kind].label}</dd></div>
        <div><dt>锻造补偿</dt><dd>{sword.forgeRelief}/5 层</dd></div>
      </dl>
      <p className="blade-status"><span>{sword.heated ? '♨ 已加热' : '未加热 · 先送炭炉'}</span>{sword.level === 0 && <span>0级不会破坏</span>}{sword.dragonScaleArmed && <span>◈ 龙鳞</span>}{remaining > 0 && <span className="ascension-status">✦ 登神 {(remaining / 1000).toFixed(1)}s</span>}{sword.nextGreatBoost && <span>大成功强化</span>}</p>
      <div className="workbench-charge" aria-label={`登神充能 ${sword.charge} / 10`}>
        <span>登神 {sword.charge}/10</span><div>{Array.from({ length: 10 }, (_, index) => <i key={index} className={index < sword.charge ? 'charged' : ''} />)}</div>
      </div>
    </aside>
  )
}
