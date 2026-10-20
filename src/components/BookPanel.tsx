import { useState, type CSSProperties } from 'react'
import { formatCoins, swordName, swordValue } from '../game/content'
import { furnishingUrl } from '../game/furnishingAssets'
import { weaponRarity } from '../game/rarity'
import type { GameState, HammerResult } from '../game/types'
import { WEAPON_CATALOG } from '../game/weaponCatalog'
import type { WeaponAtlas } from '../pixi/contracts'
import { BookScroll } from './BookScroll'
import { RelicCodex } from './RelicCodex'
import './furnishing-panels.css'
export type BookPage = 'records' | 'bestiary' | 'manual' | 'relics'

const RESULT_LABEL: Record<HammerResult, string> = {
  destroyed: '破坏',
  damaged: '损伤',
  steady: '维持',
  success: '成功',
  great: '大成功',
}

interface BookPanelProps {
  state: GameState
  page: BookPage
  weaponAtlas: WeaponAtlas | null
  onPageChange: (page: BookPage) => void
  onClose: () => void
}

const INDEXED_WEAPONS = WEAPON_CATALOG.map((entry, index) => ({ entry, index }))
const WEAPON_FAMILIES = Array.from(new Set(WEAPON_CATALOG.map((entry) => entry.family)), (family) => {
  const entries = INDEXED_WEAPONS.filter(({ entry }) => entry.family === family)
  return { family, label: entries[0].entry.familyLabel, special: entries[0].entry.kind !== 'iron', entries }
})
const CODEX_PAGES = [
  { title: '普通剑形', special: false },
  { title: '特殊剑形', special: true },
]

function WeaponCodex({ state, weaponAtlas }: Pick<BookPanelProps, 'state' | 'weaponAtlas'>) {
  const discovered = new Set(state.discoveredNames)
  const unlockedCount = WEAPON_CATALOG.filter((entry) => discovered.has(entry.name)).length
  const atlasStyle = weaponAtlas ? {
    '--weapon-atlas-image': `url("${weaponAtlas.url}")`,
    '--weapon-atlas-size': `${weaponAtlas.columns * weaponAtlas.cellWidth}px ${Math.ceil(WEAPON_CATALOG.length / weaponAtlas.columns) * weaponAtlas.cellHeight}px`,
  } as CSSProperties : undefined

  return CODEX_PAGES.map(({ title, special }) => (
    <BookScroll key={title} className="book-page" viewportClassName="weapon-codex-page" ariaLabel={`${title}，可滚动查阅全部剑形`} style={atlasStyle}>
      <h2>{title}</h2>
      {!special ? (
        <>
          <p className="codex-summary">全图鉴已解锁 <strong>{unlockedCount} / {WEAPON_CATALOG.length}</strong> 种</p>
          <p className="codex-note" role="status">{weaponAtlas ? '已解锁显示实像，未解锁显示低透明度实像。' : '武器外观载入中，目录与解锁状态可先行查阅。'}</p>
        </>
      ) : <p className="codex-note">等级为该剑形首次出现的等级，名称与路线始终可查。每件武器均以独立横向实像展示。</p>}
      {WEAPON_FAMILIES.filter((family) => family.special === special).map(({ family, label, entries }) => (
        <section className="weapon-family" key={family} aria-labelledby={`weapon-family-${family}`}>
          <h3 id={`weapon-family-${family}`}><span>{label}</span><small>已解锁 {entries.filter(({ entry }) => discovered.has(entry.name)).length} / {entries.length}</small></h3>
          <ul className="weapon-grid">
            {entries.map(({ entry, index }) => {
              const unlocked = discovered.has(entry.name)
              const rarity = weaponRarity(entry.level)
              return (
                <li key={entry.id} className={`weapon-entry ${unlocked ? 'is-unlocked' : 'is-locked'}`}>
                  <div className="weapon-entry-copy">
                    <span className="weapon-rarity weapon-rarity-badge" style={{ color: rarity.cssColor }}><strong>{entry.name}</strong><small>初现 Lv.{entry.level} · {rarity.name}</small></span>
                    <span className="weapon-unlock-status">{unlocked ? '已解锁' : '未解锁'}</span>
                  </div>
                  <p className="weapon-description">{entry.description}</p>
                  {weaponAtlas ? (
                    <span className="weapon-thumbnail weapon-thumbnail-ready" aria-hidden="true">
                      <span className="weapon-thumbnail-image" style={{
                        width: `${weaponAtlas.cellWidth}px`,
                        height: `${weaponAtlas.cellHeight}px`,
                        backgroundPosition: `${-(index % weaponAtlas.columns) * weaponAtlas.cellWidth}px ${-Math.floor(index / weaponAtlas.columns) * weaponAtlas.cellHeight}px`,
                      }} />
                    </span>
                  ) : <span className="weapon-thumbnail weapon-thumbnail-loading" aria-hidden="true">载入中</span>}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </BookScroll>
  ))
}

export function BookPanel({ state, page, weaponAtlas, onPageChange, onClose }: BookPanelProps) {
  const [mobilePage, setMobilePage] = useState(0)
  const pageLabels = page === 'bestiary' ? ['普通剑形', '特殊剑形'] : page === 'records' ? ['最近锻打', '铺中藏剑'] : ['铁匠铺操作', '锤击与生存']
  const changePage = (next: BookPage) => {
    setMobilePage(0)
    onPageChange(next)
  }
  return (
    <div className="overlay" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`book-panel furnishing-panel${page === 'relics' ? ' is-relic-codex' : ''}`} style={{ '--furnishing-panel-image': `url("${furnishingUrl('codex-panel')}")` } as CSSProperties} role="dialog" aria-modal="true" aria-label="铁匠手记">
        <button className="corner-close icon-button" onClick={onClose} aria-label="合上书本">×</button>
        <nav className="book-tabs" aria-label="书本页签">
          <button className={page === 'records' ? 'active' : ''} onClick={() => changePage('records')}>锻造记录</button>
          <button className={page === 'bestiary' ? 'active' : ''} onClick={() => changePage('bestiary')}>武器图鉴</button>
          <button className={page === 'relics' ? 'active' : ''} onClick={() => changePage('relics')}>遗物图鉴</button>
          <button className={page === 'manual' ? 'active' : ''} onClick={() => changePage('manual')}>操作手册</button>
        </nav>
        {page !== 'relics' && <nav className="book-mobile-pages" aria-label="单页阅读切换">
          {pageLabels.map((label, index) => <button key={label} aria-pressed={mobilePage === index} onClick={() => setMobilePage(index)}>{label}</button>)}
        </nav>}
        <div className="book-spread" data-mobile-page={mobilePage}>
          {page === 'records' && (
            <>
              <BookScroll className="book-page" ariaLabel="最近锻打记录">
                <h2>最近锻打</h2>
                {state.records.length === 0 ? <p className="ink-muted">纸页上还没有锤痕。</p> : (
                  <ol className="record-list">
                    {[...state.records].reverse().slice(0, 10).map((record) => {
                      const level = record.afterLevel ?? record.beforeLevel
                      const rarity = weaponRarity(level)
                      return (
                        <li key={record.id}>
                          <span>第 {record.day} 日 · <span className="weapon-rarity weapon-rarity-badge" style={{ color: rarity.cssColor }}>{record.swordName} · Lv.{level} · {rarity.name}</span></span>
                          <strong className={`result-${record.result}`}>{RESULT_LABEL[record.result]}</strong>
                          <small>{record.afterLevel === null ? `Lv.${record.beforeLevel} → 粉碎` : `Lv.${record.beforeLevel} → ${record.afterLevel}`}</small>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </BookScroll>
              <BookScroll className="book-page" ariaLabel="铺中藏剑">
                <h2>铺中藏剑</h2>
                <p>现存 {state.swords.length} 把 · 金币 {formatCoins(state.coins)}</p>
                <ul className="ledger-list">
                  {[...state.swords].sort((a, b) => b.level - a.level).slice(0, 12).map((sword) => {
                    const rarity = weaponRarity(sword.level)
                    return <li key={sword.id}><span className="weapon-rarity weapon-rarity-badge" style={{ color: rarity.cssColor }}>{swordName(sword)} · Lv.{sword.level} · {rarity.name}</span><strong>{formatCoins(swordValue(sword))}</strong></li>
                  })}
                </ul>
              </BookScroll>
            </>
          )}
          {page === 'bestiary' && <WeaponCodex state={state} weaponAtlas={weaponAtlas} />}
          {page === 'relics' && <RelicCodex state={state} />}
          {page === 'manual' && (
            <>
              <BookScroll className="book-page manual-page" ariaLabel="铁匠铺操作手册">
                <h2>铁匠铺操作</h2>
                <ol>
                  <li><b>拖进炭炉</b>：每把新剑只需加热一次，之后永久有效。</li>
                  <li><b>拖上工作台</b>：点击或按住大锤头敲打，最快每秒两锤；锤头概率圆环反映当前等级、遗物和补偿后的下一锤概率。</li>
                  <li><b>挂回墙钩</b>：墙面只有单排挂钩，保存暂时不用的剑；藏剑增加时向右浏览更多挂钩。</li>
                  <li><b>敲响上供铃</b>：交付上供台上的剑。价值不足或台上无剑时，三秒内再敲一次确认扣1血过日；空交不消耗别处的剑、不加上供金币。</li>
                </ol>
                <p>拖动空白处可让整间铁匠铺横向移动，顶部状态栏保持固定。取下远端剑后，将指针停在屏幕左边缘可带剑回到工作区。拖拽取消或落在无效处，物件回到原位；炭炉、工作台和上供台各容纳一把剑。</p>
                <p>手机支持竖屏直接游玩：底部工位导航切换近景，点选剑后可用详情里的“移往”按钮完成搬运；详情和操作区可独立上下滚动。手机书本用“单页阅读切换”浏览两页内容，所有锻造与交易规则和桌面相同。</p>
                <p>柜子第四层分别放着武器图鉴、遗物图鉴和操作手册，点击对应书本可直接翻到该页。旅行商人的入口在柜子左侧，每四日到访一次；向左拖动房间即可找到。</p>
              </BookScroll>
              <BookScroll className="book-page manual-page" ariaLabel="锤击与生存手册">
                <h2>锤击与生存</h2>
                <p>普通铁剑的单手路线最高100级，其余路线与特殊素材最高99级。单手剑99级为永昼神锋，100级进化成无尽之剑；损伤不会退化外形，沙漏则恢复上一锤前的等级与形态。</p>
                <p>基础权重按当前等级 L（0～100）计算：破坏 min(4, 0.25L)，损伤 min(12, 8+0.25L)，维持42，大成功5，成功补足100。无遗物和补偿时，按破坏/损伤/维持/成功/大成功排列：0级 0/8/42/45/5%；1级 0.25/8.25/42/44.5/5%；16级起 4/12/42/37/5%。0级始终不会破坏。</p>
                <p>同一把剑每次维持或损伤后获得1层锻造补偿，最多5层；每层使破坏权重减0.5、损伤减2（最低0），实际减少量全部转给成功。成功或大成功后清零；被阻挡的破坏不改变层数。先算等级与遗物，再算补偿，最后应用大成功强化并统一归一化；损伤后按降低的等级计算下一锤。</p>
                <p>补偿不跨剑共享，存放、移动和换日保留；沙漏恢复锤前层数，但不回退随机序列。</p>
                <p>维持、成功和大成功积累登神充能。满 10 点后获得约 5 秒无敌，只阻挡破坏。</p>
                <p>把工作台下方的龙鳞拖上工作台，可为剑装备保护；沙漏拖上工作台可撤销最近一锤。也可用 Tab 聚焦键盘后备用品，再按 Enter 使用。</p>
                <p>每次上供或空交后进入下一天并获得三把铁剑，日历记录是否达标，商人与里程碑照常推进。空交按价值0未达标处理，即使别处有剑也可主动空交。未使用的剑永不自动消失，生命归零则本局结束。</p>
                <p><b>键盘后备</b>：Tab 聚焦藏剑，Enter 选中；F 移到炭炉，A 移到工作台，R 挂回墙钩，T 移到上供台；空格敲锤，左右方向键浏览房间。Tab 聚焦上供铃后 Enter 确认；Escape 关闭面板。</p>
                <p>商店与祭台中，点击物件或 Tab 聚焦后 Enter / 空格可选择或取回，再敲小钟确认。触屏可上下滑动货架，也可按住货物图像拖到结算垫或祭槽；鸣铃前不扣金币或祭品，拖拽取消与窗口失焦也不会成交。</p>
                <p>商人每次到访时，普通铁剑、龙鳞和沙漏各独立补货3～5件，可连续购买直到售罄；特殊基础剑每种1件。打开商店或读取存档不会重新补货。</p>
              </BookScroll>
            </>
          )}
        </div>
      </section>
    </div>
  )
}
