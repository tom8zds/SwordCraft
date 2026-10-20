import { useMemo, useState } from 'react'
import { formatCoins } from '../game/content'
import { divineDate, formatDivineDate, monthCalendar, shiftDivineMonth } from '../game/divineCalendar'
import type { GameState } from '../game/types'
import { furnishingUrl } from '../game/furnishingAssets'
import { BookScroll } from './BookScroll'

interface CalendarPanelProps {
  state: GameState
  onClose: () => void
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const STATUS_LABELS = { met: '已达标', missed: '未达标', current: '今日', future: '未来', unknown: '记录未知', ineligible: '开局之前' }

const CELL_STATUS_LABELS = { met: '达标', missed: '未达', current: '今日', future: '未来', unknown: '未知', ineligible: '未始' }
export function CalendarPanel({ state, onClose }: CalendarPanelProps) {
  const today = divineDate(state.day)
  const [month, setMonth] = useState({ year: today.year, month: today.month })
  const [selectedDate, setSelectedDate] = useState(today)
  const cells = useMemo(() => monthCalendar(state, month.year, month.month), [state, month])
  const selected = cells.find((cell) => cell.date.year === selectedDate.year && cell.date.month === selectedDate.month && cell.date.day === selectedDate.day)
    ?? cells.find((cell) => cell.inMonth && cell.status === 'current')
    ?? cells.find((cell) => cell.inMonth)!

  return <div className="overlay calendar-overlay" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="calendar-panel" role="dialog" aria-modal="true" aria-label="神历日历">
      <img className="calendar-backdrop" src={furnishingUrl('calendar-panel')} alt="" aria-hidden="true" />
      <button className="corner-close icon-button" onClick={onClose} aria-label="合上日历">×</button>
      <BookScroll className="calendar-scroll" viewportClassName="calendar-content" ariaLabel="整月日历与日期详情">
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
          const isSelected = selected.date.year === cell.date.year && selected.date.month === cell.date.month && selected.date.day === cell.date.day
          return <button type="button" key={`${cell.date.year}-${cell.date.month}-${cell.date.day}-${index}`} className={`calendar-cell ${cell.status} ${cell.inMonth ? '' : 'outside-month'}${isSelected ? ' is-selected' : ''}`} aria-label={label} title={label} aria-current={cell.status === 'current' ? 'date' : undefined} aria-pressed={isSelected} onClick={() => setSelectedDate(cell.date)}>
            <strong>{cell.date.day}</strong>
            {cell.target !== null && <span className="calendar-cell-target">◆ {target}</span>}
            <span className="calendar-cell-status">{CELL_STATUS_LABELS[cell.status]}</span>
            {cell.merchant && <i title="商人到访">♜</i>}
          </button>
        })}
      </div>
      <section className="calendar-day-details" aria-label="所选日期详情" aria-live="polite">
        <strong>神历 {selected.date.year} 年 {selected.date.month} 月 {selected.date.day} 日 · {STATUS_LABELS[selected.status]}</strong>
        <p>{selected.target === null ? '开局之前，无上供需求。' : `上供需求：◆ ${formatCoins(selected.target)}${selected.status === 'future' ? '（尚未到来）' : ''}`}</p>
        <p>{selected.merchant ? '商人到访日' : selected.status === 'ineligible' ? '尚未开局，无商人记录' : '本日无商人到访'}</p>
      </section>
      <p className="calendar-legend"><span>✓ 达标</span><span>× 未达标</span><span>· 记录未知</span><span>♜ 每四日商人</span><span>淡色：邻月 / 开局前</span></p>
      </BookScroll>
    </section>
  </div>
}
