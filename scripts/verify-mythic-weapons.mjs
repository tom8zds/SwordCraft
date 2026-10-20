import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const root = 'public/assets/game/weapons'
const processed = 'assets/processed/mythic-weapons-20261020'
const spec = JSON.parse(await readFile('assets/incoming/seedream-mythic-weapons-20261020/prompts.json', 'utf8'))
const oldCatalog = JSON.parse(await readFile('assets/incoming/seedream-catalog72-20261019/catalog.json', 'utf8')).entries
const infinity = spec.jobs.find((entry) => entry.id === 'iron:one-hand:100')
const expected = [...oldCatalog, infinity]
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'))
const batchArg = process.argv.find((arg) => arg.startsWith('--batch='))?.slice(8)
const requested = batchArg ? spec.batches.find((batch) => batch.batch === batchArg) : null
if (batchArg && !requested) throw new Error(`未知批次 ${batchArg}`)
const catalog = batchArg ? expected.filter((entry) => requested.items.includes(entry.slug)) : expected
const hashes = new Set(), pixelHashes = new Set(), maskHashes = new Set(), sourceHashes = new Set(), results = []
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const green = (r, g, b) => g > 60 && g - Math.max(r, b) > 25 && g > Math.max(r, b) * 1.2
for (const entry of catalog) {
  const asset = manifest.weapons[entry.id]
  if (!asset || asset.name !== entry.name || asset.id !== entry.id || asset.file !== `${entry.slug}.png`) throw new Error(`素材映射错误：${entry.id}`)
  const bytes = await readFile(`${root}/${asset.file}`), sha256 = hash(bytes)
  if (sha256 !== asset.sha256) throw new Error(`素材哈希不一致：${entry.name}`)
  const image = await loadImage(bytes)
  if (image.width !== 128 || image.height !== 256) throw new Error(`素材尺寸错误：${entry.name}`)
  const canvas = createCanvas(128, 256), ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, 128, 256).data, mask = new Uint8Array(128 * 256)
  let opaque = 0, partial = 0, dirtyTransparent = 0, spill = 0, left = 128, top = 256, right = -1, bottom = -1
  for (let point = 0; point < mask.length; point += 1) {
    const offset = point * 4, alpha = pixels[offset + 3]
    if (!alpha) { if (pixels[offset] || pixels[offset + 1] || pixels[offset + 2]) dirtyTransparent += 1; continue }
    if (alpha !== 255) partial += 1
    opaque += 1; mask[point] = 1
    if (green(pixels[offset], pixels[offset + 1], pixels[offset + 2])) spill += 1
    const x = point % 128, y = Math.floor(point / 128)
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (opaque < 100 || partial || dirtyTransparent || spill || left < 8 || top < 8 || right > 119 || bottom > 247) throw new Error(`透明/留白异常：${entry.name} ${JSON.stringify({ opaque, partial, dirtyTransparent, spill, left, top, right, bottom })}`)
  const sourceHash = hash(await readFile(asset.source))
  if (sourceHash !== asset.sourceSha256) throw new Error(`原图哈希不一致：${entry.name}`)
  const pixelHash = hash(pixels), maskHash = hash(mask)
  if (asset.pixelSha256 !== pixelHash || asset.silhouetteSha256 !== maskHash) throw new Error(`像素或剪影哈希不一致：${entry.name}`)
  hashes.add(sha256); pixelHashes.add(pixelHash); maskHashes.add(maskHash); sourceHashes.add(sourceHash)
  if (entry.level >= 45) {
    const generation = JSON.parse(await readFile(asset.sourceMetadata, 'utf8'))
    if (generation.status !== 'completed' || generation.outputs?.length !== 1 || generation.outputs[0].sha256 !== sourceHash) throw new Error(`高阶生成原图记录异常：${entry.name}`)
    if (!asset.sourceCrop || !asset.sourceComponents?.length || !asset.design) throw new Error(`高阶缺少裁剪、连通域或独立设计：${entry.name}`)
    if (asset.acceptedSlot !== true || !Number.isInteger(asset.slotIndex) || !asset.sourceComponents?.length) throw new Error(`高阶缺少accepted slot或独立掩膜：${entry.name}`)
    if (JSON.stringify(asset.provenance.references) !== JSON.stringify(generation.references)) throw new Error(`高阶参考来源与实际生成记录不一致：${entry.name}`)
    if (asset.compositeSourceParts) for (const part of asset.compositeSourceParts) if (hash(await readFile(part.source)) !== part.sha256) throw new Error(`复合修正来源哈希不一致：${entry.name} ${part.source}`)
    if (asset.batch === 'batch-15' && (asset.actualObjectCount !== 4 || asset.actualObjectIndex === 1 || asset.rejectedGeneratedObjects?.length !== 1)) throw new Error(`末批额外单剑未明确排除：${entry.name}`)
  }
  results.push({ id: entry.id, name: entry.name, opaquePixels: opaque, bounds: { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }, sha256, pixelSha256: pixelHash, silhouetteSha256: maskHash, sourceSha256: sourceHash })
}
const expectedCount = batchArg ? requested.items.length : 73
if (catalog.length !== expectedCount || hashes.size !== expectedCount || pixelHashes.size !== expectedCount || maskHashes.size !== expectedCount) throw new Error('独立PNG、像素或剪影未完整覆盖')
if (!batchArg && (Object.keys(manifest.weapons).length !== 73 || manifest.total !== 73 || sourceHashes.size !== 45)) throw new Error('73件武器未完整覆盖30低阶原图+15批高阶原图')
if (!batchArg) {
  const sources = await Promise.all(spec.batches.map(async (batch) => JSON.parse(await readFile(`assets/incoming/seedream-mythic-weapons-20261020/${batch.batch}/generation.json`, 'utf8'))))
  if (spec.batches.length !== 15 || sources.some((source) => source.status !== 'completed' || source.size !== '2400x1080') || manifest.provenance.paidRequestCount !== 15 || manifest.provenance.completedOriginals !== 15) throw new Error('15次付费请求与已完成原图记录不一致')
  if (spec.jobs.length !== 43 || new Set(spec.jobs.map((job) => job.id)).size !== 43) throw new Error('高阶独立设计数量不为43')
}
const report = { count: results.length, batch: batchArg ?? null, uniqueFiles: hashes.size, uniquePixels: pixelHashes.size, uniqueSilhouettes: maskHashes.size, uniqueSources: sourceHashes.size, allAlphaBinary: true, allTransparentRgbClean: true, allGreenSpillZero: true, allPaddingAtLeast8: true, sourceUniquenessPolicy: '同批三件允许共享原图哈希；每件裁剪、像素和剪影必须独立', assets: results }
if (!batchArg) await writeFile(`${processed}/verification.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
