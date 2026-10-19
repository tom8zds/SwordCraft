import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const inputDirectory = 'assets/incoming/seedream-evolved-weapons-v1-20261019'
const processedDirectory = 'assets/processed/smithy-evolved-weapons-v1-20261019'
const targetDirectory = 'public/assets/game/smithy'
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const json = async (path) => JSON.parse(await readFile(path, 'utf8'))
const save = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
const rectangle = (x, y, width, height) => ({ x, y, width, height })

function measure(canvas) {
  const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1
  let opaque = 0, transparent = 0, partial = 0, greenSpill = 0, dirtyTransparent = 0
  for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
    const i = (y * canvas.width + x) * 4
    const [r, g, b, a] = data.subarray(i, i + 4)
    if (!a) { transparent += 1; if (r || g || b) dirtyTransparent += 1; continue }
    if (a === 255) opaque += 1; else partial += 1
    if (g > Math.max(r, b) + 8) greenSpill += 1
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (right < left) throw new Error('No visible weapon pixels remain')
  return { size: { width: canvas.width, height: canvas.height }, bounds: rectangle(left, top, right - left + 1, bottom - top + 1), alpha: { opaque, transparent, partial, dirtyTransparent }, greenSpill }
}

function key(image) {
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, image.width, image.height)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b, a] = pixels.data.subarray(i, i + 4)
    if (a < 128 || (g > 60 && g - Math.max(r, b) > 25 && g > Math.max(r, b) * 1.2)) {
      pixels.data.fill(0, i, i + 4)
    } else {
      pixels.data[i + 1] = Math.min(g, Math.max(r, b))
      // 参照铁剑是中性冷灰钢铁，去掉生成素材轻微的紫色偏色。
      // 保留以红色为主的皮革与木材，不改变实际生成结构。
      if (b >= r * 0.95 && b > g + 3) {
        const steel = Math.round(r * 0.2126 + Math.min(g, Math.max(r, b)) * 0.7152 + b * 0.0722)
        pixels.data[i] = steel
        pixels.data[i + 1] = steel
        pixels.data[i + 2] = Math.min(255, steel + 2)
      }
      pixels.data[i + 3] = 255
    }
  }
  ctx.putImageData(pixels, 0, 0)
  return canvas
}

function regionsFor(id, bounds) {
  const { x, y, width, height } = bounds
  if (id === 'swordGreatsword') return {
    blade: rectangle(42, 8, 44, 154), guard: rectangle(x, 162, width, 12),
    grip: rectangle(57, 174, 14, 60), pommel: rectangle(53, 234, 22, 14),
    segmentation: 'Visual approximate occupied regions; segment strip mappings below are exact. Full-width strips include transparent pixels.',
  }
  if (id === 'swordShield') return {
    blade: rectangle(x + 18, y, 20, 178), guard: rectangle(x, y + 176, 53, 13),
    grip: rectangle(x + 21, y + 188, 14, 41), pommel: rectangle(x + 19, y + 226, 18, 14),
    shield: rectangle(x + 33, y + 94, width - 33, height - 94),
    segmentation: 'Visual approximate overlapping regions, not independent cutouts. Shield sits behind sword and overlaps blade/guard/grip rectangles; do not translate rectangular shield slices independently.',
  }
  return {
    blade: rectangle(54, y, 20, 180), guard: rectangle(x, y + 174, width, 15),
    grip: rectangle(57, y + 188, 14, 41), pommel: rectangle(55, y + 226, 18, 14),
    segmentation: 'Visual approximate occupied regions, not guaranteed disjoint masks; use alpha and preserve material edges.',
  }
}

export async function exportEvolvedWeapons() {
  await mkdir(processedDirectory, { recursive: true })
  await mkdir(targetDirectory, { recursive: true })
  const specification = await json(`${inputDirectory}/prompts.json`)
  const assets = {}, reports = {}, canvases = []
  for (const route of specification.assets) {
    const source = `${route.outputDirectory}/image.png`
    const sourceBytes = await readFile(source)
    const generation = await json(`${route.outputDirectory}/generation.json`)
    if (generation.status !== 'completed') throw new Error(`${route.id}: generation is not completed; never automatically retry`)
    const image = await loadImage(sourceBytes)
    const keyed = key(image)
    const keyedMetrics = measure(keyed)
    const bounds = keyedMetrics.bounds
    if (!bounds.x || !bounds.y || bounds.x + bounds.width === image.width || bounds.y + bounds.height === image.height) throw new Error(`${route.id}: clipped source requires inspection`)
    await writeFile(`${processedDirectory}/${route.file.replace('.png', '-keyed.png')}`, keyed.toBuffer('image/png'))
    const output = createCanvas(128, 256)
    const ctx = output.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const mapping = []
    const draw = (sourceRect, destinationRect) => {
      const { x: sx, y: sy, width: sw, height: sh } = sourceRect
      const { x: dx, y: dy, width: dw, height: dh } = destinationRect
      ctx.drawImage(keyed, sx, sy, sw, sh, dx, dy, dw, dh)
      mapping.push({ source: sourceRect, destination: destinationRect })
    }
    if (route.id === 'swordGreatsword') {
      const width = Math.round(bounds.width * 240 / bounds.height)
      const x = Math.floor((128 - width) / 2)
      const sourceY = [bounds.y, 1460, 1540, 1870, bounds.y + bounds.height]
      const destinationY = [8, 162, 174, 234, 248]
      for (let i = 0; i < 4; i += 1) draw(rectangle(bounds.x, sourceY[i], bounds.width, sourceY[i + 1] - sourceY[i]), rectangle(x, destinationY[i], width, destinationY[i + 1] - destinationY[i]))
    } else if (route.id === 'swordShield') {
      // 保留左侧剑的像素比例，仅收窄生成素材中过宽的盾侧。
      const split = 570
      const leftWidth = Math.round((split - bounds.x) * 240 / bounds.height)
      draw(rectangle(bounds.x, bounds.y, split - bounds.x, bounds.height), rectangle(8, 8, leftWidth, 240))
      draw(rectangle(split, bounds.y, bounds.x + bounds.width - split, bounds.height), rectangle(8 + leftWidth, 8, 112 - leftWidth, 240))
    } else {
      const width = Math.round(bounds.width * 240 / bounds.height)
      draw(bounds, rectangle(Math.floor((128 - width) / 2), 8, width, 240))
    }
    // 导出二值 alpha，并显式清空所有透明像素的 RGB。
    const pixels = ctx.getImageData(0, 0, 128, 256)
    for (let i = 0; i < pixels.data.length; i += 4) if (!pixels.data[i + 3]) pixels.data.fill(0, i, i + 4)
    ctx.putImageData(pixels, 0, 0)
    const metrics = measure(output)
    const bytes = output.toBuffer('image/png')
    await writeFile(`${processedDirectory}/${route.file}`, bytes)
    await writeFile(`${targetDirectory}/${route.file}`, bytes)
    const regions = regionsFor(route.id, metrics.bounds)
    const bladeAxisX = route.id === 'swordShield' ? metrics.bounds.x + 27 : 64
    const aspectRatio = { source: bounds.width / bounds.height, normalized: metrics.bounds.width / metrics.bounds.height }
    assets[route.id] = {
      localSlot: route.id, textureUrl: `/assets/game/smithy/${route.file}`, file: route.file,
      width: 128, height: 256, pivot: { x: 0.5, y: 0.5 }, source, sourceSha256: hash(sourceBytes),
      sourceMetadata: `${route.outputDirectory}/generation.json`, sourceDimensions: { width: image.width, height: image.height },
      sourceBounds: bounds, contentBounds: metrics.bounds, sha256: hash(bytes), regions, mapping,
      bladeAxisX, aspectRatio,
      processing: 'binary green chroma key and RGB despill; neutral cool steel correction for blue-dominant metal only (brown materials unchanged); alpha trim; integer-coordinate nearest-neighbor raster segment normalization; centered 128x256 frame, nominal content height 240',
      proportionCorrection: route.id === 'swordGreatsword' ? 'Generated short grip extended to 60px using source raster bands; blade 154px, guard 12px, pommel 14px.' : route.id === 'swordShield' ? 'Sword side keeps uniform native scale; shield side condensed horizontally to fit 112px content width without shortening the complete sword or clipping the physical shield.' : 'Uniform proportional nearest-neighbor normalization (integer dimensions rounded).',
      model: generation.model, watermark: generation.watermark, provenance: 'generatedEvolvedWeapons',
      paletteNormalization: { mask: 'blue >= red*0.95 && blue > green+3', metalOutput: 'sRGB luma 0.2126R+0.7152G+0.0722B, output (luma,luma,luma+2)', reason: 'Remove slight violet generator cast to match approved neutral silver iron; geometry and brown materials preserved.' },
      nativeScaleInspection: 'Compared base and three routes at 1:1 texture scale on checkerboard and dark backgrounds; silhouettes remain distinct, shield physical materials readable, greatsword long grip distinct. Not in-engine acceptance.',
    }
    reports[route.id] = { ...metrics, source, sourceSha256: hash(sourceBytes), sha256: hash(bytes), sourceMetrics: keyedMetrics, mapping, regions, bladeAxisX, aspectRatio, paletteNormalization: assets[route.id].paletteNormalization, nativeScaleInspection: assets[route.id].nativeScaleInspection, requestCount: 1, usage: generation.usage, originalInspection: 'Opened and visually inspected generated original; complete orthographic weapon, hard stepped edges, silver/dark steel and worn brown leather, no magic glow.', gameAcceptance: 'not performed; integration owner must inspect in the real scene' }
    canvases.push({ id: route.id, canvas: output })
  }
  const baseImage = await loadImage(`${targetDirectory}/sword.png`)
  const base = createCanvas(128, 256)
  base.getContext('2d').drawImage(baseImage, Math.floor((128 - baseImage.width) / 2), 0)
  canvases.unshift({ id: 'sword (approved base)', canvas: base })
  const transparentSheet = createCanvas(512, 256)
  const preview = createCanvas(1024, 632)
  const pctx = preview.getContext('2d')
  pctx.imageSmoothingEnabled = false
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 4; column += 1) {
    const x = column * 256, y = row * 316
    if (row === 0) {
      for (let cy = 0; cy < 288; cy += 16) for (let cx = 0; cx < 256; cx += 16) {
        pctx.fillStyle = ((cx + cy) / 16) % 2 ? '#8a8a88' : '#a6a6a2'
        pctx.fillRect(x + cx, y + cy, 16, 16)
      }
    } else { pctx.fillStyle = '#292522'; pctx.fillRect(x, y, 256, 288) }
    pctx.drawImage(canvases[column].canvas, x + 64, y + 16)
    pctx.fillStyle = '#171411'; pctx.fillRect(x, y + 288, 256, 28)
    pctx.fillStyle = '#eee6d4'; pctx.font = '14px sans-serif'; pctx.fillText(canvases[column].id, x + 12, y + 307)
  }
  for (let i = 0; i < 4; i += 1) transparentSheet.getContext('2d').drawImage(canvases[i].canvas, i * 128, 0)
  await writeFile(`${processedDirectory}/family-transparent.png`, transparentSheet.toBuffer('image/png'))
  await writeFile(`${processedDirectory}/family-preview.png`, preview.toBuffer('image/png'))
  const provenance = {
    originals: inputDirectory, prompts: `${inputDirectory}/prompts.json`, reference: specification.references[0],
    generationScript: 'scripts/generate-evolved-weapons.mjs', processingScript: 'scripts/evolved-weapon-assets.mjs', processedSources: processedDirectory,
    license: 'generated output subject to user Volcengine Ark service/account terms; not claimed CC0 or independently licensed',
    rightsReview: 'commercial release rights must be confirmed by account holder',
    generationPolicy: specification.generationPolicy, paidRequests: 3, automaticRetries: 0,
    cost: 'API metadata reports image usage, not monetary billing; currency amount is unknown; consult account billing.',
    credentials: 'not included; signed download URLs remain local ignored files',
  }
  await save(`${processedDirectory}/quality-report.json`, { pipeline: 'scripts/evolved-weapon-assets.mjs', specification: `${inputDirectory}/prompts.json`, chromaKey: { minimumGreen: 60, minimumGreenExcess: 25, minimumGreenRatio: 1.2, despill: 'clamp green to max(red,blue)', alpha: 'binary 0 or 255; transparent RGB zero' }, provenance, assets: reports, base: { source: `${targetDirectory}/sword.png`, ...measure(base) }, previews: [`${processedDirectory}/family-transparent.png`, `${processedDirectory}/family-preview.png`], limitations: ['No in-game acceptance performed.', 'Regions are visually approximate; sword-shield parts overlap and cannot be split as independent rectangles.', 'Generated short greatsword grip is lengthened via recorded raster strips; shield-side width is condensed to preserve 240px sword height in fixed 128px frame.', 'Three family textures only; no unique generated asset is claimed for every high-stage evolution node.'] })
  return { assets, provenance }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const family = await exportEvolvedWeapons()
  const manifest = await json(`${targetDirectory}/manifest.json`)
  Object.assign(manifest.assets, family.assets)
  Object.assign(manifest.textures, Object.fromEntries(Object.entries(family.assets).map(([slot, asset]) => [slot, asset.textureUrl])))
  manifest.provenance.generatedEvolvedWeapons = family.provenance
  await save(`${targetDirectory}/manifest.json`, manifest)
  console.log(JSON.stringify({ exported: Object.keys(family.assets), qualityReport: `${processedDirectory}/quality-report.json`, preview: `${processedDirectory}/family-preview.png` }, null, 2))
}
