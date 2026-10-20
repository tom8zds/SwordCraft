import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const green = (r, g, b) => g > 60 && g - Math.max(r, b) > 25 && g > Math.max(r, b) * 1.2
async function correctTimeFangs(job, sourceImage) {
  const historicalSource = 'assets/incoming/seedream-catalog72-20261019/68-dagger-assassin-72/image.png'
  const oldBytes = await readFile(historicalSource), oldImage = await loadImage(oldBytes), historical = createCanvas(oldImage.width, oldImage.height), oldCtx = historical.getContext('2d')
  oldCtx.drawImage(oldImage, 0, 0)
  const oldData = oldCtx.getImageData(0, 0, oldImage.width, oldImage.height)
  for (let i = 0; i < oldData.data.length; i += 4) if (green(oldData.data[i], oldData.data[i + 1], oldData.data[i + 2])) oldData.data.fill(0, i, i + 4)
  oldCtx.putImageData(oldData, 0, 0)
  const current = createCanvas(sourceImage.width, sourceImage.height), currentCtx = current.getContext('2d'); currentCtx.drawImage(sourceImage, 0, 0)
  const currentData = currentCtx.getImageData(0, 0, sourceImage.width, sourceImage.height).data
  const halo = createCanvas(380, 380), haloCtx = halo.getContext('2d'), haloData = haloCtx.createImageData(380, 380)
  let retainedPixels = 0
  for (let y = 0; y < 380; y += 1) for (let x = 0; x < 380; x += 1) {
    const sx = 748 + x, sy = 287 + y, sourceOffset = (sy * sourceImage.width + sx) * 4
    const r = currentData[sourceOffset], g = currentData[sourceOffset + 1], b = currentData[sourceOffset + 2]
    const radius = ((x - 190) / 185) ** 2 + ((y - 190) / 185) ** 2
    const runeColor = (r > 150 && g > 90 && b < r * 0.9) || (b > 115 && b > r * 1.1)
    if (radius < 1 && runeColor && !green(r, g, b)) { haloData.data.set([r, g, b, 255], (y * 380 + x) * 4); retainedPixels += 1 }
  }
  haloCtx.putImageData(haloData, 0, 0)
  const output = createCanvas(900, 1300), out = output.getContext('2d'); out.imageSmoothingEnabled = false
  // 两片真实弯刃适度外张形成复合双獠牙，保留刃柄材质，不绘制程序刃形。
  out.save(); out.translate(355, 620); out.rotate(-0.22); out.drawImage(historical, 503, 109, 497, 1848, -148, -548, 296, 1096); out.restore()
  out.save(); out.translate(545, 620); out.rotate(0.22); out.scale(-1, 1); out.drawImage(historical, 503, 109, 497, 1848, -148, -548, 296, 1096); out.restore()
  out.drawImage(halo, 0, 0, 380, 380, 180, 540, 540, 540)
  const data = out.getImageData(0, 0, 900, 1300).data, mask = new Uint8Array(900 * 1300)
  let left = 900, top = 1300, right = -1, bottom = -1
  for (let point = 0; point < mask.length; point += 1) if (data[point * 4 + 3]) { const x = point % 900, y = Math.floor(point / 900); mask[point] = 1; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  return { canvas: output, crop: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, correction: { reason: '本轮时隙獠牙误混入门盾和长枪，保留真实双刃栅格与本轮时轮符阵重新组装短刃武器', operation: 'two proportionally fitted mirrored historical blade rasters rotated +/-0.22rad, with new-source gold/cyan rune-color elliptical mask; no procedural blade geometry', paidRegenerations: 0, compositeMaskSha256: hash(mask), sourceParts: [{ source: historicalSource, sha256: hash(oldBytes), sourceRect: { x: 503, y: 109, width: 497, height: 1848 }, role: '真实弯曲獠牙、刃背与握柄栅格', transformedCopies: 2 }, { source: `assets/incoming/seedream-mythic-weapons-20261020/${job.batch}/image.png`, role: '本轮真实时轮与青金法阵', sourceRegion: { x: 748, y: 287, width: 380, height: 380 }, mask: { ellipseCenter: [190, 190], radii: [185, 185], colorFilter: 'gold or cyan-blue rune pixels only; shield plate and long spear excluded' }, retainedPixels }] } }
}

// 第10批神木被模型混入门盾和骑枪；只合成真实生成栅格，不绘制替代树形。
export async function correctMythicRaster(job, sourceImage) {
  if (job.id === 'dagger:assassin:72') return correctTimeFangs(job, sourceImage)
  if (job.id !== 'branch:world-tree:99') return null
  const historicalSource = 'assets/incoming/seedream-catalog72-20261019/47-branch-world-tree-99/image.png'
  const oldBytes = await readFile(historicalSource), oldImage = await loadImage(oldBytes)
  const historical = createCanvas(oldImage.width, oldImage.height), oldCtx = historical.getContext('2d'); oldCtx.drawImage(oldImage, 0, 0)
  const historicalPixels = oldCtx.getImageData(0, 0, oldImage.width, oldImage.height)
  for (let offset = 0; offset < historicalPixels.data.length; offset += 4) if (green(historicalPixels.data[offset], historicalPixels.data[offset + 1], historicalPixels.data[offset + 2])) historicalPixels.data.fill(0, offset, offset + 4)
  oldCtx.putImageData(historicalPixels, 0, 0)
  const current = createCanvas(sourceImage.width, sourceImage.height), ctx = current.getContext('2d'); ctx.drawImage(sourceImage, 0, 0)
  const pixels = ctx.getImageData(0, 0, sourceImage.width, sourceImage.height)
  const ring = createCanvas(900, 1000), ringCtx = ring.getContext('2d'), ringData = ringCtx.createImageData(900, 1000)
  const rune = createCanvas(330, 330), runeCtx = rune.getContext('2d'), runeData = runeCtx.createImageData(330, 330)
  let ringPixels = 0, runePixels = 0
  for (let y = 0; y < 1000; y += 1) for (let x = 0; x < 900; x += 1) {
    const sx = 750 + x, sy = 30 + y, offset = (sy * sourceImage.width + sx) * 4
    const r = pixels.data[offset], g = pixels.data[offset + 1], b = pixels.data[offset + 2]
    const ellipse = ((sx - 1197) / 407) ** 2 + ((sy - 484) / 407) ** 2
    // 只取真实外星环的青蓝/金像素，排除门板、木枝和右侧骑枪。
    const ringColor = (b > r * 1.14 && b > 100) || (r > 155 && g > 105 && b < r * 0.85)
    if (ellipse > 0.77 && ellipse < 1.08 && ringColor && !green(r, g, b) && !(sx > 1320 && sx < 1410)) {
      ringData.data.set([r, g, b, 255], (y * 900 + x) * 4); ringPixels += 1
    }
  }
  for (let y = 0; y < 330; y += 1) for (let x = 0; x < 330; x += 1) {
    const sx = 1029 + x, sy = 300 + y, offset = (sy * sourceImage.width + sx) * 4
    if (((x - 165) / 157) ** 2 + ((y - 165) / 157) ** 2 > 1) continue
    const r = pixels.data[offset], g = pixels.data[offset + 1], b = pixels.data[offset + 2]
    if (!green(r, g, b)) { runeData.data.set([r, g, b, 255], (y * 330 + x) * 4); runePixels += 1 }
  }
  ringCtx.putImageData(ringData, 0, 0); runeCtx.putImageData(runeData, 0, 0)
  const output = createCanvas(900, 1200), out = output.getContext('2d'); out.imageSmoothingEnabled = false
  // 主干与枝冠保持原始纵横比例，后景星环与前景法阵均来自本轮原图。
  out.drawImage(ring, 0, 0, 900, 1000, 0, 90, 900, 1000)
  out.drawImage(historical, 290, 88, 968, 1875, 169, 30, 562, 1089)
  out.drawImage(rune, 0, 0, 330, 330, 300, 660, 300, 300)
  const imageData = out.getImageData(0, 0, 900, 1200), mask = new Uint8Array(900 * 1200)
  let left = 900, top = 1200, right = -1, bottom = -1
  for (let point = 0; point < mask.length; point += 1) if (imageData.data[point * 4 + 3]) { const x = point % 900, y = Math.floor(point / 900); mask[point] = 1; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
  return { canvas: output, crop: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, correction: { reason: '本轮星海神木原图误混入完整门盾和骑枪，移除该误生结构；以既有真实神木主干和枝冠结合本轮真实星环、中心法阵，形成独立新神木武器', operation: 'historical source RGB/alpha proportional composition with manually selected new-source annular and elliptical raster masks; no procedural tree geometry', paidRegenerations: 0, compositeMaskSha256: hash(mask), sourceParts: [ { source: historicalSource, sha256: hash(oldBytes), sourceRect: { x: 290, y: 88, width: 968, height: 1875 }, destinationRect: { x: 169, y: 30, width: 562, height: 1089 }, role: '真实星叶枝冠、木纹主干与盘根握柄' }, { source: job.batch + '/image.png', role: '本轮外星环', sourceRegion: { x: 750, y: 30, width: 900, height: 1000 }, mask: { ellipseCenter: [1197, 484], radii: [407, 407], radiusSquaredRange: [0.77, 1.08], colorFilter: 'cyan-blue or gold; excludes green and spear vertical band x1320..1410' }, retainedPixels: ringPixels }, { source: job.batch + '/image.png', role: '本轮青金中心宝石与圆形法阵', sourceRegion: { x: 1029, y: 300, width: 330, height: 330 }, mask: { ellipseCenter: [165, 165], radii: [157, 157] }, retainedPixels: runePixels } ] } }
}
