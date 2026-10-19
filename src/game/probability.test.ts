import { describe, expect, it } from 'vitest'
import { normalizeOdds } from './probability'

describe('概率圆环数据', () => {
  it('遗物改变权重后，圆环弧长保持精确比例且合计100%', () => {
    const values = normalizeOdds({ destroyed: 10, damaged: 17, steady: 45, success: 25, great: 7 })
    expect(values.find((entry) => entry.key === 'steady')?.exact).toBeCloseTo(45 / 104 * 100, 10)
    expect(values.find((entry) => entry.key === 'destroyed')?.exact).toBeCloseTo(10 / 104 * 100, 10)
    expect(values.reduce((sum, entry) => sum + entry.exact, 0)).toBeCloseTo(100, 10)
  })

  it('零权重不会产生虚构圆环弧段', () => {
    const values = normalizeOdds({ destroyed: 0, damaged: 1, steady: 1, success: 1, great: 0 })
    expect(values.find((entry) => entry.key === 'destroyed')?.exact).toBe(0)
    expect(values.find((entry) => entry.key === 'great')?.exact).toBe(0)
    expect(values.find((entry) => entry.key === 'success')?.exact).toBeCloseTo(100 / 3, 10)
  })
})
