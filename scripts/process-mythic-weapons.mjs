import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { correctMythicRaster } from './mythic-weapon-raster-corrections.mjs'

const ROOT = 'assets/incoming/seedream-mythic-weapons-20261020'
const PROCESSED = 'assets/processed/mythic-weapons-20261020'
const PUBLIC = 'public/assets/game/weapons'
const OLD_PROCESSED = 'assets/processed/catalog72-20261019'
const OLD_CATALOG = 'assets/incoming/seedream-catalog72-20261019/catalog.json'
const SPEC = JSON.parse(await readFile(`${ROOT}/prompts.json`, 'utf8'))
const OLD_ENTRIES = JSON.parse(await readFile(OLD_CATALOG, 'utf8')).entries
const HIGH_JOBS = SPEC.jobs
const LOW_ENTRIES = OLD_ENTRIES.filter((entry) => entry.level < 45)
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const green = (r, g, b) => g > 60 && g - Math.max(r, b) > 25 && g > Math.max(r, b) * 1.2
const exists = async (path) => stat(path).then(() => true).catch((error) => { if (error.code === 'ENOENT') return false; throw error })
if (HIGH_JOBS.length !== 43 || new Set(HIGH_JOBS.map((job) => job.id)).size !== 43) throw new Error('新高阶目录必须恰好43件独立条目')
if (LOW_ENTRIES.length !== 30) throw new Error('低阶复用目录必须恰好30件')
const previewFont = '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
if (await exists(previewFont)) GlobalFonts.registerFromPath(previewFont, 'MythicCjk')
await mkdir(PROCESSED, { recursive: true }); await mkdir(PUBLIC, { recursive: true })

function keyImage(image) {
  const pixels = image.getContext('2d').getImageData(0, 0, image.width, image.height)
  const opaque = new Uint8Array(image.width * image.height)
  for (let offset = 0; offset < pixels.data.length; offset += 4) {
    const r = pixels.data[offset], g = pixels.data[offset + 1], b = pixels.data[offset + 2]
    if (!green(r, g, b)) { pixels.data[offset + 3] = 255; opaque[offset / 4] = 1 } else pixels.data.fill(0, offset, offset + 4)
  }
  const labels = new Int32Array(opaque.length); labels.fill(-1)
  const visited = new Uint8Array(opaque.length), components = []
  let componentIndex = 0
  for (let seed = 0; seed < opaque.length; seed += 1) {
    if (!opaque[seed] || visited[seed]) continue
    const index = componentIndex++, points = [seed]; visited[seed] = 1; labels[seed] = index
    let left = image.width, top = image.height, right = -1, bottom = -1, sumX = 0, count = 0
    for (let cursor = 0; cursor < points.length; cursor += 1) {
      const point = points[cursor], x = point % image.width, y = Math.floor(point / image.width)
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); sumX += x; count += 1
      for (const next of [point - 1, point + 1, point - image.width, point + image.width]) {
        if (next < 0 || next >= opaque.length || visited[next] || !opaque[next]) continue
        if (Math.abs((next % image.width) - x) > 1) continue
        visited[next] = 1; labels[next] = index; points.push(next)
      }
    }
    if (count >= 12) components.push({ index, left, top, right, bottom, centerX: sumX / count, count })
  }
  return { pixels, labels, components }
}
async function processJob(job, batch, slot) {
  const directory = `${ROOT}/${batch.batch}`, metadataPath = `${directory}/generation.json`
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  if (metadata.status !== 'completed' || metadata.outputs?.length !== 1) throw new Error(`${batch.batch}: 原图未确认完成或输出数量异常，停止避免重复付费`)
  const source = `${directory}/image.png`, sourceBytes = await readFile(source), image = await loadImage(sourceBytes)
  if (image.width !== 2400 || image.height !== 1080) throw new Error(`${batch.batch}: 原图必须2400x1080，实际${image.width}x${image.height}`)
  const keyed = createCanvas(image.width, image.height); keyed.getContext('2d').drawImage(image, 0, 0)
  const analysis = keyImage(keyed)
  const actualObjectCount = batch.batch === 'batch-15' ? 4 : batch.items.length
  const primaryCenters = [...analysis.components].sort((a, b) => b.count - a.count).slice(0, actualObjectCount).map((part) => part.centerX).sort((a, b) => a - b)
  if (primaryCenters.length !== actualObjectCount) throw new Error(`${batch.batch}: 实际主体数量少于预期`)
  const actualObjectIndex = batch.batch === 'batch-15' ? [0, 2, 3][slot] : slot
  const assigned = analysis.components.filter((part) => {
    let nearest = 0
    for (let index = 1; index < primaryCenters.length; index += 1) if (Math.abs(part.centerX - primaryCenters[index]) < Math.abs(part.centerX - primaryCenters[nearest])) nearest = index
    return nearest === actualObjectIndex
  })
  if (!assigned.length) throw new Error(`${batch.batch}/${job.slug}: 目标格没有主体连通域，不能用空图或程序轮廓补齐`)
  const crop = { x: Math.min(...assigned.map((part) => part.left)), y: Math.min(...assigned.map((part) => part.top)), width: Math.max(...assigned.map((part) => part.right)) - Math.min(...assigned.map((part) => part.left)) + 1, height: Math.max(...assigned.map((part) => part.bottom)) - Math.min(...assigned.map((part) => part.top)) + 1 }
  if (crop.x <= 0 || crop.y <= 0 || crop.x + crop.width >= image.width || crop.y + crop.height >= image.height) throw new Error(`${job.slug}: 原图主体触边，必须查看后再处理`)
  const sourceOpaquePixels = assigned.reduce((sum, part) => sum + part.count, 0)
  if (sourceOpaquePixels < 500) throw new Error(`${job.slug}: 主体不足，不能把散点当作完整武器`)
  const selected = new Set(assigned.map((part) => part.index)), cropData = new Uint8ClampedArray(crop.width * crop.height * 4)
  for (let y = 0; y < crop.height; y += 1) for (let x = 0; x < crop.width; x += 1) {
    const sourcePoint = (crop.y + y) * image.width + crop.x + x
    if (selected.has(analysis.labels[sourcePoint])) cropData.set(analysis.pixels.data.subarray(sourcePoint * 4, sourcePoint * 4 + 4), (y * crop.width + x) * 4)
  }
  const cropCanvas = createCanvas(crop.width, crop.height), cropCtx = cropCanvas.getContext('2d'), cropImage = cropCtx.createImageData(crop.width, crop.height); cropImage.data.set(cropData); cropCtx.putImageData(cropImage, 0, 0)
  const output = createCanvas(128, 256), out = output.getContext('2d'); out.imageSmoothingEnabled = false
  const correction = await correctMythicRaster(job, image)
  if (correction?.correction?.sourceParts) {
    for (const part of correction.correction.sourceParts) {
      if (part.source.startsWith('batch-')) part.source = `${ROOT}/${part.source}`
      part.sha256 ??= hash(await readFile(part.source))
    }
  }
  let fittedCanvas = correction?.canvas ?? cropCanvas, fittedCrop = correction?.crop ?? { x: 0, y: 0, width: crop.width, height: crop.height }
  let rotationCorrection = null
  if (job.batch === 'batch-12') {
    const angle = -Math.PI / 6, side = Math.ceil(Math.hypot(crop.width, crop.height)) + 8
    const rotated = createCanvas(side, side), rotationCtx = rotated.getContext('2d'); rotationCtx.imageSmoothingEnabled = false
    rotationCtx.translate(side / 2, side / 2); rotationCtx.rotate(angle); rotationCtx.drawImage(cropCanvas, -crop.width / 2, -crop.height / 2); rotationCtx.resetTransform()
    const rgba = rotationCtx.getImageData(0, 0, side, side).data
    let left = side, top = side, right = -1, bottom = -1
    for (let point = 0; point < side * side; point += 1) if (rgba[point * 4 + 3]) { const x = point % side, y = Math.floor(point / side); left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y) }
    fittedCanvas = rotated; fittedCrop = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
    rotationCorrection = { reason: '本批三件完整武器主轴约向右倾30度，统一归为竖直挂钩武器', operation: 'rotate whole isolated RGB/alpha raster -30 degrees using nearest sampling; retain all slot components; trim transparent bounds', sourceAngleDegrees: 30, rotationDegrees: -30, inputBounds: crop, rotatedBounds: fittedCrop, paidRegenerations: 0 }
  }
  const maximumHeight = job.kind === 'dagger' ? 176 : 240, scale = Math.min(112 / fittedCrop.width, maximumHeight / fittedCrop.height), width = Math.max(1, Math.round(fittedCrop.width * scale)), height = Math.max(1, Math.round(fittedCrop.height * scale)), x = Math.floor((128 - width) / 2), y = Math.floor((256 - height) / 2)
  out.drawImage(fittedCanvas, fittedCrop.x, fittedCrop.y, fittedCrop.width, fittedCrop.height, x, y, width, height)
  const outputImage = out.getImageData(0, 0, 128, 256), mask = new Uint8Array(128 * 256); let opaquePixels = 0, greenSpill = 0
  for (let index = 0; index < mask.length; index += 1) { const offset = index * 4; if (!outputImage.data[offset + 3]) outputImage.data.fill(0, offset, offset + 4); else { outputImage.data[offset + 3] = 255; mask[index] = 1; opaquePixels += 1; if (green(outputImage.data[offset], outputImage.data[offset + 1], outputImage.data[offset + 2])) greenSpill += 1 } }
  out.putImageData(outputImage, 0, 0)
  const bytes = output.toBuffer('image/png'), file = `${job.slug}.png`
  const report = {
    ...job, file, width: 128, height: 256, sha256: hash(bytes), pixelSha256: hash(outputImage.data), silhouetteSha256: hash(mask), source, sourceSha256: hash(sourceBytes), sourceMetadata: metadataPath,
    sourceDimensions: { width: image.width, height: image.height }, sourceCrop: crop,
    sourceOpaquePixels, slotIndex: slot, slotBounds: { x: slot * 800, y: 0, width: 800, height: 1080 }, acceptedSlot: true,
    sourceComponents: assigned.map(({ left, top, right, bottom, count }) => ({ x: left, y: top, width: right - left + 1, height: bottom - top + 1, pixels: count })),
    contentBounds: { x, y, width, height }, opaquePixels, greenSpill, alpha: 'binary; transparent RGB cleared', sampling: 'nearest; proportional fit; no aspect stretching',
    provenance: { model: metadata.model, references: metadata.references, requestBatch: batch.batch, rights: job.id === 'iron:one-hand:100' ? SPEC.referenceRights : '生成素材受用户Volcengine Ark账户协议约束；仅参考既有铁剑像素材质，商业发布授权需账户持有人确认。' },
    correction: correction?.correction ?? rotationCorrection,
    actualObjectCount, actualObjectIndex,
    rejectedGeneratedObjects: batch.batch === 'batch-15' ? [{ sourceBounds: { x: 730, y: 70, width: 380, height: 960 }, actualObjectIndex: 1, reason: '付费原图额外生成第四件单剑，不属于任何本轮目录需求；仅保留原图，不进入runtime' }] : [],
    compositeSourceParts: correction?.correction?.sourceParts ?? null,
    visualAcceptance: 'pending native contact-sheet and in-game inspection',
  }
  await writeFile(`${PROCESSED}/${file}`, bytes); await writeFile(`${PUBLIC}/${file}`, bytes); await writeFile(`${PROCESSED}/${job.slug}.json`, `${JSON.stringify(report, null, 2)}\n`)
  return report
}
async function copyLow() { for (const entry of LOW_ENTRIES) { const source = `${OLD_PROCESSED}/${entry.slug}.png`; if (!await exists(source)) throw new Error(`旧低阶已处理素材缺失：${source}`); await copyFile(source, `${PUBLIC}/${entry.slug}.png`) } }
const requestedBatch = process.argv.find((arg) => arg.startsWith('--batch='))?.slice(8)
const selectedBatches = requestedBatch ? SPEC.batches.filter((batch) => batch.batch === requestedBatch) : SPEC.batches
if (requestedBatch && selectedBatches.length !== 1) throw new Error(`未知批次 ${requestedBatch}`)
const reports = []
for (const batch of selectedBatches) {
  const metadataPath = `${ROOT}/${batch.batch}/generation.json`
  if (!await exists(metadataPath)) { if (requestedBatch) throw new Error(`${batch.batch}: 尚未有原图，不会隐式请求付费生成`); continue }
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'))
  if (metadata.status !== 'completed') { if (requestedBatch) throw new Error(`${batch.batch}: 原图状态未确认，停止处理`); continue }
  for (const [slot, slug] of batch.items.entries()) { const job = HIGH_JOBS.find((candidate) => candidate.slug === slug); if (!job) throw new Error(`缺少作业 ${slug}`); reports.push(await processJob(job, batch, slot)) }
}
await copyLow()
const processedHigh = []
for (const job of HIGH_JOBS) if (await exists(`${PROCESSED}/${job.slug}.json`)) processedHigh.push(JSON.parse(await readFile(`${PROCESSED}/${job.slug}.json`, 'utf8')))
const historicalReports = new Map()
for (const entry of LOW_ENTRIES) {
  const reportPath = `${OLD_PROCESSED}/${entry.slug}.json`
  if (!await exists(reportPath)) throw new Error(`旧低阶处理报告缺失：${reportPath}`)
  const report = JSON.parse(await readFile(reportPath, 'utf8'))
  const runtimeBytes = await readFile(`${OLD_PROCESSED}/${entry.slug}.png`)
  historicalReports.set(entry.id, {
    ...report, ...entry, file: `${entry.slug}.png`, width: 128, height: 256, sha256: report.sha256 ?? hash(runtimeBytes), sourceReuse: true,
    reuseSource: `${OLD_PROCESSED}/${entry.slug}.png`, reuseMetadata: reportPath, sourceCrop: report.sourceBounds,
    sourceComponents: [{ ...report.sourceBounds, maskPolicy: '沿用既有单物件alpha掩膜，未重新分组或更改像素' }],
    design: '保留已确认低阶独立设计；本轮不重新生成、换色或改造型',
    provenance: { sourceDirectory: 'assets/incoming/seedream-catalog72-20261019', originalProcessingReport: reportPath, rights: '既有生成素材受用户Volcengine Ark账户协议约束，商业发布授权需账户持有人确认。' },
  })
}
const all = [...LOW_ENTRIES, ...processedHigh].sort((a, b) => a.index - b.index)
const weapons = Object.fromEntries(all.map((entry) => { const report = processedHigh.find((candidate) => candidate.id === entry.id) ?? historicalReports.get(entry.id); return [entry.id, report] }))
const complete = processedHigh.length === 43
if (!requestedBatch && !complete) throw new Error(`仍缺少${43 - processedHigh.length}件高阶原图，不能发布73件完整manifest`)
const generationStates = await Promise.all(SPEC.batches.map(async (batch) => await exists(`${ROOT}/${batch.batch}/generation.json`) ? JSON.parse(await readFile(`${ROOT}/${batch.batch}/generation.json`, 'utf8')) : null))
const paidRequestCount = generationStates.filter(Boolean).length, completedOriginals = generationStates.filter((generation) => generation?.status === 'completed').length
const provenance = { sourceDirectory: ROOT, sourceCatalog: SPEC.sourceCatalog, references: SPEC.references, referenceSources: SPEC.referenceSources, referenceRights: SPEC.referenceRights, model: 'doubao-seedream-5-0-pro-260628', requestPolicy: SPEC.policy, completedOriginals, paidRequestCount, processingScript: 'scripts/process-mythic-weapons.mjs', processing: 'green chroma key, connected-component slot grouping, binary alpha, transparent RGB clearing, proportional nearest-neighbor fit; no geometry replacement or aspect stretching', credentials: 'not included; signed URLs remain ignored local metadata' }
await writeFile(`${PUBLIC}/manifest.json`, `${JSON.stringify({ version: 1, status: complete ? '73 total: 30 historical low-tier reuse + 43 mythic replacements/Infinity' : `incremental: ${processedHigh.length}/43 high-tier originals`, total: complete ? 73 : all.length, weapons, provenance }, null, 2)}\n`)
const contact = createCanvas(6 * 192, Math.max(1, Math.ceil(all.length / 6)) * 296), contactCtx = contact.getContext('2d'); contactCtx.imageSmoothingEnabled = false
for (const [index, entry] of all.entries()) {
  const x = index % 6 * 192, y = Math.floor(index / 6) * 296
  contactCtx.fillStyle = '#252229'; contactCtx.fillRect(x, y, 192, 296)
  const image = await loadImage(`${PUBLIC}/${entry.slug}.png`)
  contactCtx.drawImage(image, x + 32, y + 2)
  contactCtx.fillStyle = '#eee0c7'; contactCtx.font = '14px MythicCjk, sans-serif'; contactCtx.textAlign = 'center'
  contactCtx.fillText(`${entry.index + 1}. ${entry.name}`, x + 96, y + 276, 182)
  contactCtx.fillStyle = '#b7ab98'; contactCtx.font = '10px MythicCjk, sans-serif'
  contactCtx.fillText(`Lv.${entry.level}  ${entry.id}`, x + 96, y + 291, 184)
}
await writeFile(`${PROCESSED}/mythic-contact-sheet.png`, contact.toBuffer('image/png'))
for (const batch of selectedBatches) {
  const entries = batch.items.map((slug) => processedHigh.find((entry) => entry.slug === slug)).filter(Boolean)
  if (!entries.length) continue
  const sheet = createCanvas(entries.length * 192, 296), ctx = sheet.getContext('2d'); ctx.imageSmoothingEnabled = false
  for (const [index, entry] of entries.entries()) {
    const x = index * 192
    ctx.fillStyle = '#252229'; ctx.fillRect(x, 0, 192, 296)
    ctx.drawImage(await loadImage(`${PUBLIC}/${entry.slug}.png`), x + 32, 2)
    ctx.fillStyle = '#eee0c7'; ctx.textAlign = 'center'; ctx.font = '14px MythicCjk, sans-serif'
    ctx.fillText(`${entry.index + 1}. ${entry.name}`, x + 96, 276, 182)
    ctx.fillStyle = '#b7ab98'; ctx.font = '10px MythicCjk, sans-serif'; ctx.fillText(`Lv.${entry.level} ${entry.id}`, x + 96, 291, 184)
  }
  await writeFile(`${PROCESSED}/${batch.batch}-contact.png`, sheet.toBuffer('image/png'))
}
const qualityAssets = all.map((entry) => weapons[entry.id])
const uniquePixels = new Set(qualityAssets.map((asset) => asset.pixelSha256)).size, uniqueSilhouettes = new Set(qualityAssets.map((asset) => asset.silhouetteSha256)).size
await writeFile(`${PROCESSED}/quality-report.json`, `${JSON.stringify({ version: 1, total: complete ? 73 : all.length, newArtwork: processedHigh.length, oldArtReused: LOW_ENTRIES.length, uniqueSources: new Set(qualityAssets.map((asset) => asset.sourceSha256)).size, uniquePixels, uniqueSilhouettes, completedOriginals, paidRequestCount, contactSheet: `${PROCESSED}/mythic-contact-sheet.png`, provenance, assets: qualityAssets, checks: { allRuntimeDimensions: '128x256', allNewSourcesCompleted: complete, connectedComponentMaskGrouping: true, independentPixels: uniquePixels === all.length, independentSilhouettes: uniqueSilhouettes === all.length, allBinaryAlpha: qualityAssets.every((asset) => asset.alpha === 'binary; transparent RGB cleared'), allGreenSpillZero: qualityAssets.every((asset) => asset.greenSpill === 0), noAutomaticPaidRetry: true, noSignedUrlsOrCredentials: true } }, null, 2)}\n`)
console.log(JSON.stringify({ total: complete ? 73 : all.length, newArtwork: processedHigh.length, oldArtReused: LOW_ENTRIES.length, manifest: `${PUBLIC}/manifest.json`, contactSheet: `${PROCESSED}/mythic-contact-sheet.png` }, null, 2))
