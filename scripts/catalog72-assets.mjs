import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { generateAsset } from './seedream.mjs'
import { DEFAULT_PORTRAIT_SIZE } from './image-pixel-budget.mjs'

export const CATALOG72_SOURCE = 'assets/incoming/seedream-catalog72-20261019'
export const CATALOG72_PROCESSED = 'assets/processed/catalog72-20261019'
const reference = 'assets/incoming/seedream-gameplay-heroes-20261019/sword/image.png'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
export const saveJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`)

const previewFont = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
if (await stat(previewFont).catch(() => null)) GlobalFonts.registerFromPath(previewFont, 'Catalog72Cjk')

const style = '为同一款中世纪铁匠铺游戏绘制一件全新独立武器生产素材，参考图只锁定像素画材质与照明，不照抄其形状。高细节硬边像素簇、阶梯轮廓、可信铁钢锻打纹、清楚刃口高光和暗部层次，旧棕皮革与真实部件连接。固定正面正交投影，无透视倾斜，武器主轴竖直，尖端或头部朝上、握持末端朝下，左上方中性主光。轮廓、刃形、护手、柄首和实物结构必须清楚，能在小图辨认，不能只换颜色，不能绘制一个大色块。高阶可有克制的异质金属、宝石、雕刻、实物环和复合部件，但不要泛光云雾遮盖结构。只能画描述的这一件完整武器或组装武器套装，整件居中，剑尖、柄尾与两侧结构距离四边至少12%，不能裁切。背景必须完全均匀的纯绿色#00FF00用于抠图，没有地面、阴影、场景、人物、手臂、展架、文字、数字、标签、边框、UI或水印。武器任何部分不得使用绿色或绿色反光；植物使用青蓝叶、金叶、赤叶或枯棕木，生命光纹用青金色。禁止圆滑矢量插画、塑料3D渲染或摄影，不得输出多格图集或多件候选。'

async function exists(path) {
  try { await stat(path); return true } catch (error) { if (error.code === 'ENOENT') return false; throw error }
}

export async function normalizeCatalogWeapon(entry) {
  const directory = `${CATALOG72_SOURCE}/${entry.slug}`
  const metadata = await readJson(`${directory}/generation.json`)
  if (metadata.status !== 'completed') throw new Error(`${entry.slug}: 生成未完成，不能自动重试付费请求`)
  const source = `${directory}/image.png`
  const sourceBytes = await readFile(source)
  const image = await loadImage(sourceBytes)
  const keyed = createCanvas(image.width, image.height)
  const ctx = keyed.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, image.width, image.height)
  let left = image.width, top = image.height, right = -1, bottom = -1
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b, a] = pixels.data.subarray(i, i + 4)
    if (a < 128 || (g > 60 && g - Math.max(r, b) > 25 && g > Math.max(r, b) * 1.2)) pixels.data.fill(0, i, i + 4)
    else {
      pixels.data[i + 1] = Math.min(g, Math.max(r, b))
      pixels.data[i + 3] = 255
      const pixel = i / 4, x = pixel % image.width, y = Math.floor(pixel / image.width)
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) throw new Error(`${entry.slug}: 去底后没有武器`)
  if (left === 0 || top === 0 || right === image.width - 1 || bottom === image.height - 1) throw new Error(`${entry.slug}: 原图主体触边，必须查看后再处理`)
  let correction = null
  if (entry.id === 'iron:sword-shield:27' || entry.id === 'iron:sword-shield:36') {
    // 两件原图的右侧配剑倒置；剑与盾的矩形边界重叠，只处理已测定的剑连通域。
    const region = entry.id === 'iron:sword-shield:27'
      ? { x: 896, y: 140, width: 476, height: 1796 }
      : { x: 868, y: 136, width: 471, height: 1754 }
    const expectedPixels = entry.id === 'iron:sword-shield:27' ? 252115 : 253189
    let seed = -1
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const point = region.y * image.width + x
      if (pixels.data[point * 4 + 3]) { seed = point; break }
    }
    if (seed < 0) throw new Error(`${entry.name}配剑连通域种子失效`)
    const visited = new Uint8Array(image.width * image.height)
    const points = [seed]
    visited[seed] = 1
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index], px = point % image.width
      for (const next of [point - image.width, point + image.width, px > 0 ? point - 1 : -1, px < image.width - 1 ? point + 1 : -1]) {
        if (next >= 0 && next < visited.length && !visited[next] && pixels.data[next * 4 + 3]) { visited[next] = 1; points.push(next) }
      }
    }
    if (points.length !== expectedPixels) throw new Error(`${entry.name}配剑掩膜与已检查原图不一致`)
    const colors = new Uint8ClampedArray(points.length * 4)
    for (const [index, point] of points.entries()) {
      colors.set(pixels.data.subarray(point * 4, point * 4 + 4), index * 4)
      pixels.data.fill(0, point * 4, point * 4 + 4)
    }
    for (const [index, point] of points.entries()) {
      const px = point % image.width, py = Math.floor(point / image.width)
      const targetX = region.x * 2 + region.width - 1 - px
      const targetY = region.y * 2 + region.height - 1 - py
      const targetOffset = (targetY * image.width + targetX) * 4
      // 剑柄旋转后与盾右缘轻微重叠，盾体保留在前景，不覆盖已存在的盾像素。
      if (!pixels.data[targetOffset + 3]) pixels.data.set(colors.subarray(index * 4, index * 4 + 4), targetOffset)
    }
    correction = { operation: 'rotate only the source sword connected-component RGB and alpha 180 degrees; shield unchanged', sourceRegion: region, connectedPixels: points.length, paidRegenerations: 0 }
  }
  ctx.putImageData(pixels, 0, 0)
  if (entry.id === 'nail:meteor:0') {
    // 已逐像素行检查：1336 以下为误生成的皮握柄，保留原图钉帽与锥形钢杆。
    // 将真实金属段整体翻转，使钉帽成为末端帽、钉尖朝下，不添加程序轮廓。
    bottom = 1335
    correction = { operation: 'crop generated leather grip and rotate metal raster 180 degrees', metalSourceRectangle: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, originalRejectedTrait: 'leather grip below nail head made the source look like a dagger', orientation: 'nail head up, pointed shank down', paidRegenerations: 0 }
  }
  const sw = right - left + 1, sh = bottom - top + 1
  const maximumHeight = entry.kind === 'dagger' ? 176 : 240
  const scale = Math.min(112 / sw, maximumHeight / sh)
  const width = Math.max(1, Math.round(sw * scale)), height = Math.max(1, Math.round(sh * scale))
  const x = Math.floor((128 - width) / 2), y = Math.floor((256 - height) / 2)
  const output = createCanvas(128, 256)
  const out = output.getContext('2d')
  out.imageSmoothingEnabled = false
  if (entry.id === 'nail:meteor:0') {
    out.translate(x + width, y + height)
    out.rotate(Math.PI)
    out.drawImage(keyed, left, top, sw, sh, 0, 0, width, height)
    out.resetTransform()
  } else out.drawImage(keyed, left, top, sw, sh, x, y, width, height)
  const data = out.getImageData(0, 0, 128, 256)
  let opaque = 0, greenSpill = 0
  const mask = new Uint8Array(128 * 256)
  for (let i = 0; i < data.data.length; i += 4) {
    if (!data.data[i + 3]) data.data.fill(0, i, i + 4)
    else {
      opaque += 1; mask[i / 4] = 1
      if (data.data[i + 1] > Math.max(data.data[i], data.data[i + 2]) + 8) greenSpill += 1
    }
  }
  out.putImageData(data, 0, 0)
  const bytes = output.toBuffer('image/png')
  const file = `${entry.slug}.png`
  await mkdir(CATALOG72_PROCESSED, { recursive: true })
  await writeFile(`${CATALOG72_PROCESSED}/${file}`, bytes)
  const report = {
    ...entry, file, width: 128, height: 256, sha256: hash(bytes), pixelSha256: hash(data.data), silhouetteSha256: hash(mask),
    source, sourceSha256: hash(sourceBytes), sourceMetadata: `${directory}/generation.json`,
    sourceDimensions: { width: image.width, height: image.height }, sourceBounds: { x: left, y: top, width: sw, height: sh },
    contentBounds: { x, y, width, height }, opaquePixels: opaque, greenSpill,
    alpha: 'binary; transparent RGB cleared', sampling: 'nearest; proportional fit; no geometry replacement or aspect stretching',
    scalePolicy: entry.kind === 'dagger' ? 'short dagger family fitted proportionally within 112x176, centered in 128x256; source blade-to-grip ratio preserved' : 'proportional fit within 112x240',
    sourceVariance: entry.id === 'dagger:assassin:9' ? 'small green guard ring in generated source keyed out with the green background; blade, grip and violet poison capsule retained' : null,
    model: metadata.model, watermark: metadata.watermark, usage: metadata.usage,
    correction,
    visualAcceptance: 'pending human/model contact-sheet and in-game inspection',
  }
  await saveJson(`${CATALOG72_PROCESSED}/${entry.slug}.json`, report)
  return report
}

export async function createCatalogContactSheet(entries, name) {
  const columns = 6, rows = Math.ceil(entries.length / columns)
  const sheet = createCanvas(columns * 192, rows * 296)
  const ctx = sheet.getContext('2d')
  ctx.imageSmoothingEnabled = false
  for (const [index, entry] of entries.entries()) {
    const x = index % columns * 192, y = Math.floor(index / columns) * 296
    ctx.fillStyle = '#252229'; ctx.fillRect(x, y, 192, 296)
    ctx.fillStyle = '#463f43'; ctx.fillRect(x + 1, y + 1, 190, 1)
    const image = await loadImage(`${CATALOG72_PROCESSED}/${entry.slug}.png`)
    ctx.drawImage(image, x + 32, y + 2)
    ctx.fillStyle = '#eee0c7'; ctx.font = '14px Catalog72Cjk, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(`${entry.index + 1}. ${entry.name}`, x + 96, y + 276, 182)
    ctx.fillStyle = '#b7ab98'; ctx.font = '10px sans-serif'
    ctx.fillText(`Lv.${entry.level}  ${entry.id}`, x + 96, y + 291, 184)
  }
  const path = `${CATALOG72_PROCESSED}/${name}.png`
  await writeFile(path, sheet.toBuffer('image/png'))
  return path
}

export async function runCatalogBatch({ group, first, last, designs }) {
  const { entries } = await readJson(`${CATALOG72_SOURCE}/catalog.json`)
  const selected = entries.filter((entry) => entry.index >= first && entry.index <= last)
  if (selected.length !== designs.length) throw new Error(`${group}: 独立设计数量与目录不一致`)
  await mkdir(CATALOG72_SOURCE, { recursive: true })
  await mkdir(CATALOG72_PROCESSED, { recursive: true })
  const jobs = selected.map((entry, index) => ({ ...entry, design: designs[index], prompt: `${style}\n作品名称：${entry.name}。独立造型要求：${designs[index]}` }))
  await saveJson(`${CATALOG72_SOURCE}/designs-${group}.json`, { group, reference, policy: 'one independent request per weapon; sequential within group; no automatic paid retries', jobs })
  const reports = []
  for (const job of jobs) {
    const outputDirectory = `${CATALOG72_SOURCE}/${job.slug}`
    if (await exists(outputDirectory)) {
      const metadata = await readJson(`${outputDirectory}/generation.json`)
      if (metadata.status !== 'completed') throw new Error(`${job.slug}: 已有未确认请求，停止以免重复付费`)
      console.log(`复用已完成独立原图 ${job.slug}`)
    } else await generateAsset({ prompt: job.prompt, references: [reference], outputDirectory, size: DEFAULT_PORTRAIT_SIZE })
    reports.push(await normalizeCatalogWeapon(job))
    console.log(`已规范化 ${job.index + 1}/72 ${job.name}`)
  }
  const contactSheets = []
  for (let offset = 0; offset < jobs.length; offset += 12) contactSheets.push(await createCatalogContactSheet(jobs.slice(offset, offset + 12), `${group}-contact-${Math.floor(offset / 12) + 1}`))
  await saveJson(`${CATALOG72_PROCESSED}/quality-${group}.json`, { group, count: reports.length, contactSheets, assets: reports, visualAcceptance: 'pending contact-sheet inspection by production owner' })
  console.log(JSON.stringify({ group, count: reports.length, contactSheets }, null, 2))
}
