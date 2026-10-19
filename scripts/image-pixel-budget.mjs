export const MAX_GENERATED_PIXELS = 2_610_000
export const DEFAULT_LANDSCAPE_SIZE = '1920x1080'
export const DEFAULT_PORTRAIT_SIZE = '1344x1792'

/** 付费请求前只接受能证明像素上限的明确宽高，禁止 2K/4K/auto 别名。 */
export function assertImagePixelBudget(size) {
  if (typeof size !== 'string' || !/^[1-9]\d*x[1-9]\d*$/.test(size)) {
    throw new Error('生图尺寸必须明确为宽x高，不接受 2K、4K 或 auto；每张最多 2,610,000 像素。')
  }
  const [width, height] = size.split('x').map(Number)
  const pixels = width * height
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || !Number.isSafeInteger(pixels) || pixels > MAX_GENERATED_PIXELS) {
    throw new Error(`生图尺寸 ${size} 超过 2,610,000 像素上限；请使用 ${DEFAULT_PORTRAIT_SIZE} 或 ${DEFAULT_LANDSCAPE_SIZE} 等明确尺寸。`)
  }
  return size
}
