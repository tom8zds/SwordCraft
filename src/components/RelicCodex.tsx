import { RELICS } from '../game/content'
import { furnishingUrl } from '../game/furnishingAssets'
import type { GameState } from '../game/types'
import { BookScroll } from './BookScroll'

interface RelicCodexProps {
  state: GameState
}

/** 全部遗物的材料图鉴；未拥有物仍展示真实素材，只降低透明度。 */
export function RelicCodex({ state }: RelicCodexProps) {
  const owned = new Set(state.relics)
  return (
    <BookScroll className="book-page relic-codex-page" ariaLabel="全部遗物图鉴">
      <h2>遗物图鉴</h2>
      <p className="codex-summary">已解锁 <strong>{RELICS.filter((relic) => owned.has(relic.id)).length} / {RELICS.length}</strong> 件遗物</p>
      <p className="codex-note">每件遗物均以独立实像展示；尚未获得的遗物仍可查看名称与效果。</p>
      <ul className="relic-codex-grid">
        {RELICS.map((relic) => {
          const isOwned = owned.has(relic.id)
          return (
            <li key={relic.id} className={`relic-codex-entry ${isOwned ? 'is-unlocked' : 'is-locked'}`}>
              <img className="relic-codex-image" src={furnishingUrl(relic.id)} alt="" aria-hidden="true" />
              <div className="relic-codex-copy">
                <strong>{relic.name}</strong>
                <p>{relic.description}</p>
                <small>{isOwned ? '已拥有' : '未解锁'} · 祭品 {relic.cost} 把普通铁剑</small>
              </div>
            </li>
          )
        })}
      </ul>
      <section className="relic-codex-rules" aria-label="祭台规则">
        <h3>祭台规则</h3>
        <p>遗物以普通铁剑为祭品。每件遗物只会出现一次，一局最多持有十件；目录仍可查阅全部十五件。</p>
        <p>命运轮盘每次固定消耗 750 金币刷新。</p>
        <p>概率遗物修改权重，再统一归一化。某种结果的权重可以降到零；0级剑不会被遗物增加破坏概率。</p>
      </section>
    </BookScroll>
  )
}
