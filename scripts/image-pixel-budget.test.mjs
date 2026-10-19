import { describe, expect, it } from 'vitest'
import { assertImagePixelBudget } from './image-pixel-budget.mjs'
import { generateAsset } from './seedream.mjs'

describe('付费生图像素上限', () => {
  it.each(['1344x1792', '1920x1080', '1800x1450'])('%s在261万像素以内可请求', (size) => {
    expect(assertImagePixelBudget(size)).toBe(size)
  })

  it.each(['1536x2048', '1800x1451', '2610001x1', '9007199254740992x1', '2K', '4K', 'auto', '0x1000', '1x0', '-1x100', '100.5x100', undefined])('%s超限或无法证明像素数时拒绝', (size) => {
    expect(() => assertImagePixelBudget(size)).toThrow(/2,610,000/)
  })

  it('实际生成入口在读取凭据和发请求前拒绝超限尺寸', async () => {
    await expect(generateAsset({ prompt: '测试超限拦截，不应发起请求', outputDirectory: 'unused-pixel-budget-test', size: '1536x2048' })).rejects.toThrow(/超过 2,610,000/)
  })
})
