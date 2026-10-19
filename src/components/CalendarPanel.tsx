import { useMemo, useState } from 'react'
import { formatCoins } from '../game/content'
import { divineDate, formatDivineDate, monthCalendar, shiftDivineMonth } from '../game/divineCalendar'
import type { GameState } from '../game/types'
import { furnishingUrl } from '../game/furnishingAssets'

interface CalendarPanelProps {
  state: GameState
  onClose: () => void
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const STATUS_LABELS = { met: '已达标', missed: '未达标', current: '今日', future: '未来', unknown: '记录未知', ineligible: '开局之前' }

export function CalendarPanel({ state, onClose }: CalendarPanelProps) {
  const today = divineDate(state.day)
  const [month, setMonth] = useState({ year: today.year, month: today.month })
  const cells = useMemo(() => monthCalendar(state, month.year, month.month), [state, month])

  return <div className="overlay calendar-overlay" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="calendar-panel" role="dialog" aria-modal="true" aria-label="神历日历">
      <img className="calendar-backdrop" src={furnishingUrl('calendar-panel')} alt="" aria-hidden="true" />
      <button className="corner-close icon-button" onClick={onClose} aria-label="合上日历">×</button>
      <header className="calendar-header">
        <button type="button" onClick={() => setMonth((current) => shiftDivineMonth(current.year, current.month, -1))} aria-label="上一个月">‹</button>
        <h2 aria-live="polite">神历 {month.year} 年 {month.month} 月</h2>
        <button type="button" onClick={() => setMonth((current) => shiftDivineMonth(current.year, current.month, 1))} aria-label="下一个月">›</button>
      </header>
      <div className="calendar-today"><span>今日：{formatDivineDate(state.day)}</span><button type="button" onClick={() => setMonth({ year: today.year, month: today.month })}>回到本月</button></div>
      <div className="calendar-weekdays" aria-hidden="true">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div>
      <div className="calendar-grid" aria-label={`${month.year}年${month.month}月日历`}>
        {cells.map((cell, index) => {
          const target = cell.target === null ? null : formatCoins(cell.target)
          const label = `${cell.date.year}年${cell.date.month}月${cell.date.day}日，${STATUS_LABELS[cell.status]}${target ? `，上供需求 ${target}` : ''}${cell.merchant ? '，商人到访' : ''}`
          return <article key={`${cell.date.year}-${cell.date.month}-${cell.date.day}-${index}`} className={`calendar-cell ${cell.status} ${cell.inMonth ? '' : 'outside-month'}`} aria-label={label} title={label} aria-current={cell.status === 'current' ? 'date' : undefined}>
            <strong>{cell.date.day}</strong>
            {cell.target !== null && <span>◆ {target}</span>}
            {cell.merchant && <i title="商人到访">♜</i>}
          </article>
        })}
      </div>
      <p className="calendar-legend"><span>✓ 达标</span><span>× 未达标</span><span>· 记录未知</span><span>♜ 每四日商人</span><span>淡色：邻月 / 开局前</span></p>
    </section>
  </div>
}
