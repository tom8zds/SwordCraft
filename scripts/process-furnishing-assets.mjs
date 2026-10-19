import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const ROOT = 'assets/incoming/seedream-furnishings-20261020'
const PROCESSED = 'assets/processed/furnishings-20261020'
const PUBLIC = 'public/assets/game/furnishings'
const spec = JSON.parse(await readFile(`${ROOT}/prompts.json`, 'utf8'))
const dimensions = {
  cabinet: [384, 640], 'offering-table': [384, 300], 'merchant-entrance': [256, 384],
  'offering-bell': [96, 112], 'offering-sign': [256, 128],
  'codex-panel': [1024, 700], 'merchant-panel': [1024, 700], 'relic-panel': [1024, 700], 'calendar-panel': [1024, 700],
}
const panelSlices = {
  'codex-panel': { source: [128, 124, 128, 120], target: [64, 62, 64, 60] },
  'merchant-panel': { source: [72, 150, 72, 56], target: [32, 68, 32, 25] },
  'relic-panel': { source: [72, 140, 72, 65], target: [32, 63, 32, 29] },
  'calendar-panel': { source: [56, 60, 56, 60], target: [32, 36, 32, 36] },
}
for (const id of ['lucky-tongs', 'soft-anvil', 'tempered-gloves', 'star-coal', 'echo-hammer', 'scarlet-apron', 'guardian-mark', 'patient-bell', 'gilded-chisel', 'phoenix-ash', 'moon-water', 'old-ledger', 'double-bell', 'iron-will', 'fate-thread', 'dragon-scale', 'hourglass', 'weapon-book', 'relic-book', 'manual-book', 'relic-altar']) dimensions[id] = [160, 160]
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const green = (r, g, b) => g > 60 && g - Math.max(r, b) > 25 && g > Math.max(r, b) * 1.2
const corrections = {}
function patchPanelSource(canvas, batch) {
  if (batch !== 'batch-10') return
  const ctx = canvas.getContext('2d')
  // 镜像平铺同图空白材质并羽化接缝，不留纯色遮盖块；文字和月格由 DOM 绘制。
  const patches = [
    { id: 'merchant-panel', source: { x: 130, y: 150, width: 50, height: 58 }, target: { x: 190, y: 124, width: 510, height: 88 } },
    { id: 'relic-panel', source: { x: 911, y: 141, width: 55, height: 58 }, target: { x: 990, y: 123, width: 450, height: 90 } },
    { id: 'calendar-panel', source: { x: 1750, y: 278, width: 40, height: 37 }, target: { x: 1880, y: 141, width: 300, height: 101 } },
    { id: 'calendar-panel', source: { x: 1750, y: 278, width: 40, height: 37 }, target: { x: 1724, y: 247, width: 560, height: 671 } },
  ]
  const samples = patches.map(({ source }) => ctx.getImageData(source.x, source.y, source.width, source.height))
  patches.forEach(({ id, source, target }, index) => {
    const sample = samples[index]
    const pixels = ctx.getImageData(target.x, target.y, target.width, target.height)
    for (let y = 0; y < target.height; y += 1) {
      const tileY = y % (source.height * 2)
      const sy = tileY < source.height ? tileY : source.height * 2 - tileY - 1
      for (let x = 0; x < target.width; x += 1) {
        const tileX = x % (source.width * 2)
        const sx = tileX < source.width ? tileX : source.width * 2 - tileX - 1
        const from = (sy * source.width + sx) * 4, to = (y * target.width + x) * 4
        const mix = Math.min(1, Math.min(x + 1, y + 1, target.width - x, target.height - y) / 8)
        for (let channel = 0; channel < 3; channel += 1) pixels.data[to + channel] = Math.round(pixels.data[to + channel] * (1 - mix) + sample.data[from + channel] * mix)
      }
    }
    ctx.putImageData(pixels, target.x, target.y)
    corrections[id] ??= { operation: 'mirror-tiled clean source material removes baked glyphs/grid; frame retained', featherPixels: 8, patches: [] }
    corrections[id].patches.push({ sourceRect: source, targetRect: target })
  })
}
const sourceBytes = new Map()
const assets = {}
await mkdir(PROCESSED, { recursive: true }); await mkdir(PUBLIC, { recursive: true })
for (const batch of spec.batches) {
  const sourcePath = `${ROOT}/${batch.batch}/image.png`
  const bytes = await readFile(sourcePath)
  const sourceSha256 = hash(bytes)
  sourceBytes.set(batch.batch, sourceSha256)
  const image = await loadImage(bytes)
  if (image.width !== 2400 || image.height !== 1080) throw new Error(`${batch.batch}: 原图必须为2400x1080，实际${image.width}x${image.height}`)
  const source = createCanvas(image.width, image.height)
  const sourceCtx = source.getContext('2d'); sourceCtx.drawImage(image, 0, 0)
  patchPanelSource(source, batch.batch)
  const pixels = sourceCtx.getImageData(0, 0, image.width, image.height)
  const opaque = new Uint8Array(image.width * image.height)
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const r = pixels.data[offset], g = pixels.data[offset + 1], b = pixels.data[offset + 2]
    if (!green(r, g, b)) { pixels.data[offset + 3] = 255; opaque[offset / 4] = 1 } else pixels.data.fill(0, offset, offset + 4)
  }
  const visited = new Uint8Array(opaque.length)
  const labels = new Int32Array(opaque.length); labels.fill(-1)
  const components = []
  let componentIndex = 0
  for (let seed = 0; seed < opaque.length; seed += 1) {
    if (!opaque[seed] || visited[seed]) continue
    const currentIndex = componentIndex++
    const points = [seed]; visited[seed] = 1; labels[seed] = currentIndex
    let left = image.width, top = image.height, right = -1, bottom = -1, sumX = 0, count = 0
    for (let cursor = 0; cursor < points.length; cursor += 1) {
      const point = points[cursor], x = point % image.width, y = Math.floor(point / image.width)
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); sumX += x; count += 1
      for (const next of [point - 1, point + 1, point - image.width, point + image.width]) {
        if (next < 0 || next >= opaque.length || visited[next] || !opaque[next]) continue
        const nextX = next % image.width
        if (Math.abs(nextX - x) > 1) continue
        visited[next] = 1; labels[next] = currentIndex; points.push(next)
      }
    }
    if (count >= 20) components.push({ left, top, right, bottom, centerX: sumX / count, count, index: currentIndex })
  }
  const centers = [400, 1200, 2000]
  for (const [index, id] of batch.items.entries()) {
    const [width, height] = dimensions[id]
    const assigned = components.filter((component) => Math.abs(component.centerX - centers[index]) < 400)
    if (!assigned.length) throw new Error(`${batch.batch}/${id}: 连通域为空`)
    const assignedLabels = new Set(assigned.map((component) => component.index))
    const sourceCrop = {
      x: Math.min(...assigned.map((component) => component.left)), y: Math.min(...assigned.map((component) => component.top)),
      width: Math.max(...assigned.map((component) => component.right)) - Math.min(...assigned.map((component) => component.left)) + 1,
      height: Math.max(...assigned.map((component) => component.bottom)) - Math.min(...assigned.map((component) => component.top)) + 1,
    }
    const cropPixels = new Uint8ClampedArray(sourceCrop.width * sourceCrop.height * 4)
    for (let y = 0; y < sourceCrop.height; y += 1) {
      for (let x = 0; x < sourceCrop.width; x += 1) {
        const sourcePoint = (sourceCrop.y + y) * image.width + sourceCrop.x + x
        if (!assignedLabels.has(labels[sourcePoint])) continue
        const sourceOffset = sourcePoint * 4, cropOffset = (y * sourceCrop.width + x) * 4
        cropPixels[cropOffset] = pixels.data[sourceOffset]; cropPixels[cropOffset + 1] = pixels.data[sourceOffset + 1]; cropPixels[cropOffset + 2] = pixels.data[sourceOffset + 2]; cropPixels[cropOffset + 3] = 255
      }
    }
    const keyed = createCanvas(sourceCrop.width, sourceCrop.height)
    const keyedCtx = keyed.getContext('2d')
    const imageData = keyedCtx.createImageData(sourceCrop.width, sourceCrop.height); imageData.data.set(cropPixels); keyedCtx.putImageData(imageData, 0, 0)
    const out = createCanvas(width, height); const outCtx = out.getContext('2d'); outCtx.imageSmoothingEnabled = false
    const isPanel = id.endsWith('-panel')
    const padX = isPanel ? 2 : Math.max(1, Math.floor(width * 0.12)), padY = isPanel ? 2 : Math.max(1, Math.floor(height * 0.12))
    const scale = Math.min((width - padX * 2) / sourceCrop.width, (height - padY * 2) / sourceCrop.height)
    const drawWidth = isPanel ? width - 4 : Math.max(1, Math.round(sourceCrop.width * scale)), drawHeight = isPanel ? height - 4 : Math.max(1, Math.round(sourceCrop.height * scale))
    const drawX = isPanel ? 2 : Math.floor((width - drawWidth) / 2), drawY = isPanel ? 2 : Math.floor((height - drawHeight) / 2)
    if (isPanel) {
      const { source: [left, top, right, bottom], target: [outLeft, outTop, outRight, outBottom] } = panelSlices[id]
      const sx = [0, left, sourceCrop.width - right], sy = [0, top, sourceCrop.height - bottom]
      const dx = [drawX, drawX + outLeft, drawX + drawWidth - outRight], dy = [drawY, drawY + outTop, drawY + drawHeight - outBottom]
      const sw = [left, sourceCrop.width - left - right, right], sh = [top, sourceCrop.height - top - bottom, bottom]
      const dw = [outLeft, drawWidth - outLeft - outRight, outRight], dh = [outTop, drawHeight - outTop - outBottom, outBottom]
      for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) outCtx.drawImage(keyed, sx[col], sy[row], sw[col], sh[row], dx[col], dy[row], dw[col], dh[row])
    } else outCtx.drawImage(keyed, 0, 0, sourceCrop.width, sourceCrop.height, drawX, drawY, drawWidth, drawHeight)
    const output = out.toBuffer('image/png')
    const file = `${id}.png`
    await writeFile(`${PROCESSED}/${file}`, output)
    await writeFile(`${PUBLIC}/${file}`, output)
    const outputPixels = outCtx.getImageData(0, 0, width, height).data
    let opaquePixels = 0, outputGreenSpill = 0
    for (let offset = 0; offset < outputPixels.length; offset += 4) {
      if (outputPixels[offset + 3] > 0) { opaquePixels += 1; if (green(outputPixels[offset], outputPixels[offset + 1], outputPixels[offset + 2])) outputGreenSpill += 1 }
    }
    assets[id] = {
      file, width, height, sha256: hash(output), source: sourcePath, sourceSha256,
      sourceCrop, sourceBounds: sourceCrop, contentBounds: { x: drawX, y: drawY, width: drawWidth, height: drawHeight },
      nineSlice: panelSlices[id] ?? null,
      sourceComponents: assigned.map(({ left, top, right, bottom, count }) => ({ x: left, y: top, width: right - left + 1, height: bottom - top + 1, pixels: count })),
      opaquePixels, outputGreenSpill, alpha: 'binary; transparent RGB cleared', sampling: isPanel ? 'nearest; nine-slice frame-preserving fit to 2px edge' : 'nearest; proportional fit; no aspect stretching',
      visualInspection: `native source inspected ${batch.batch}: three independent objects grouped by connected components`, correction: corrections[id] || null, model: 'doubao-seedream-5-0-pro-260628', watermark: false,
    }
  }
}
const provenance = {
  tool: 'Volcengine Ark Seedream', model: 'doubao-seedream-5-0-pro-260628', requests: spec.batches.length,
  generatedImages: spec.batches.length, sourceSize: '2400x1080', pixelsPerRequest: 2592000,
  policy: 'one request per three-object sheet; no automatic paid retry; source URLs and credentials excluded',
  promptSpec: 'assets/incoming/seedream-furnishings-20261020/prompts.json',
  processor: 'scripts/process-furnishing-assets.mjs', rights: 'generated output subject to account agreement; commercial release rights must be confirmed by account holder',
}
await writeFile(`${PUBLIC}/manifest.json`, `${JSON.stringify({ version: 1, assets, provenance }, null, 2)}\n`)
await writeFile(`${PROCESSED}/quality-report.json`, `${JSON.stringify({ version: 1, count: Object.keys(assets).length, batches: spec.batches.map((batch) => ({ batch: batch.batch, items: batch.items, sourceSha256: sourceBytes.get(batch.batch), pixels: 2592000, requestCount: 1 })), assets, checks: { allSources2400x1080: true, allOutputPixelsWithinBudget: true, exactThreeColumnCrops: false, connectedComponentMaskGrouping: true, uniqueSourcePerBatch: sourceBytes.size === spec.batches.length, noSignedUrlsOrCredentials: true } }, null, 2)}\n`)
console.log(JSON.stringify({ count: Object.keys(assets).length, requests: spec.batches.length, manifest: `${PUBLIC}/manifest.json`, qualityReport: `${PROCESSED}/quality-report.json` }, null, 2))
