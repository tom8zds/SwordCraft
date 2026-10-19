import { dailyTarget } from './content'
import type { CalendarEntry, GameState } from './types'

export interface DivineDate {
  year: number
  month: number
  day: number
}

export interface DivineCalendarCell {
  date: DivineDate
  gameDay: number | null
  inMonth: boolean
  status: CalendarEntry['status'] | 'unknown' | 'ineligible'
  target: bigint | null
  merchant: boolean
}

const DAY_MS = 86_400_000

function dateTimestamp(year: number, month: number, day: number): number {
  const date = new Date(0)
  // setUTCFullYear 不会把神历 0–99 年隐式转换为 1900–1999 年。
  date.setUTCFullYear(year, month - 1, day)
  return date.getTime()
}

const START_TIMESTAMP = dateTimestamp(26, 3, 5)

function dateParts(timestamp: number): DivineDate {
  const date = new Date(timestamp)
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }
}

export function divineDate(gameDay: number): DivineDate {
  return dateParts(START_TIMESTAMP + (gameDay - 1) * DAY_MS)
}

export function formatDivineDate(gameDay: number): string {
  const date = divineDate(gameDay)
  return `神历${date.year}年${date.month}月${date.day}日`
}

export function monthDays(year: number, month: number): number {
  return new Date(dateTimestamp(year, month + 1, 0)).getUTCDate()
}

export function shiftDivineMonth(year: number, month: number, delta: number): Pick<DivineDate, 'year' | 'month'> {
  const date = dateParts(dateTimestamp(year, month + delta, 1))
  return { year: date.year, month: date.month }
}

export function buildCalendarEntries(day: number, history: readonly CalendarEntry[] = []): CalendarEntry[] {
  // 只保留有实际结果的过去记录；旧档已丢失的日期不能推断为未达标。
  const entries = history.filter((entry) => entry.day < day && (entry.status === 'met' || entry.status === 'missed'))
  for (let current = day; current <= day + 3; current += 1) {
    entries.push({ day: current, target: dailyTarget(current), status: current === day ? 'current' : 'future', merchant: current % 4 === 0 })
  }
  return entries
}

export function monthCalendar(state: Pick<GameState, 'day' | 'calendar'>, year: number, month: number): DivineCalendarCell[] {
  const firstTimestamp = dateTimestamp(year, month, 1)
  const mondayOffset = (new Date(firstTimestamp).getUTCDay() + 6) % 7
  const gridStart = firstTimestamp - mondayOffset * DAY_MS
  const history = new Map(state.calendar.map((entry) => [entry.day, entry]))
  return Array.from({ length: 42 }, (_, index): DivineCalendarCell => {
    const timestamp = gridStart + index * DAY_MS
    const date = dateParts(timestamp)
    const day = Math.round((timestamp - START_TIMESTAMP) / DAY_MS) + 1
    const inMonth = date.year === year && date.month === month
    if (day < 1) return { date, gameDay: null, inMonth, status: 'ineligible', target: null, merchant: false }
    const saved = history.get(day)
    const status = day === state.day ? 'current' : day > state.day ? 'future' : saved?.status === 'met' || saved?.status === 'missed' ? saved.status : 'unknown'
    return { date, gameDay: day, inMonth, status, target: saved?.target ?? dailyTarget(day), merchant: day % 4 === 0 }
  })
}
