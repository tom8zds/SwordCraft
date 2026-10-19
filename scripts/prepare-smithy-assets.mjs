import { createCanvas, loadImage } from '@napi-rs/canvas'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const sceneDirectory = 'public/assets/art-preview/charcoal-single-row'
const heroDirectory = 'assets/incoming/seedream-gameplay-heroes-20261019'
const processedDirectory = 'assets/processed/smithy-gameplay-20261019'
const target = 'public/assets/game/smithy'
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'))
const saveJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
const textureUrl = (file) => `/assets/game/smithy/${file}`
await mkdir(target, { recursive: true })
await mkdir(processedDirectory, { recursive: true })

const assets = {}
for (const [slot, width, height] of [
  ['background', 1920, 1080], ['forge', 1920, 1080],
  ['workbench', 1920, 1080], ['hook', 50, 34],
]) {
  const file = `${slot}.png`
  const source = `${sceneDirectory}/${file}`
  const bytes = await readFile(source)
  const image = await loadImage(bytes)
  if (image.width !== width || image.height !== height) throw new Error(`${slot}: unexpected approved scene dimensions`)
  await writeFile(`${target}/${file}`, bytes)
  assets[slot] = { localSlot: slot, textureUrl: textureUrl(file), file, width, height, pivot: { x: 0, y: 0 }, source, sourceSha256: sha256(bytes), processing: 'byte-identical copy of approved scene texture', provenance: 'approvedScene' }
}

const background = await loadImage(`${target}/background.png`)
const wall = createCanvas(544, 1080)
wall.getContext('2d').drawImage(background, 1376, 0, 544, 1080, 0, 0, 544, 1080)
await writeFile(`${target}/wall-extension.png`, wall.toBuffer('image/png'))
assets.wallExtension = { localSlot: 'wallExtension', textureUrl: textureUrl('wall-extension.png'), file: 'wall-extension.png', width: 544, height: 1080, pivot: { x: 0, y: 0 }, source: `${sceneDirectory}/background.png`, sourceSha256: assets.background.sourceSha256, sourceRectangle: { x: 1376, y: 0, width: 544, height: 1080 }, processing: 'crop only; alternate mirrored repeats at runtime, never repeat the complete forge scene', provenance: 'approvedScene' }

// 仅规范化已存在的原图；此脚本不会请求付费生成。
const measurements = await readJson(`${heroDirectory}/measurements.json`)
const heroReports = {}
for (const [slot, width, height, padding] of [['hammer', 320, 400, 12], ['sword', 96, 256, 8]]) {
  const source = `${heroDirectory}/${slot}/image.png`
  const sourceBytes = await readFile(source)
  const image = await loadImage(sourceBytes)
  const canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  let left = canvas.width, top = canvas.height, right = -1, bottom = -1
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const offset = (y * canvas.width + x) * 4
      const [r, g, b] = pixels.data.subarray(offset, offset + 3)
      const excessGreen = g - Math.max(r, b)
      if (g > 70 && excessGreen > 35 && g > Math.max(r, b) * 1.3) {
        pixels.data[offset + 3] = 0
      }
      if (pixels.data[offset + 3] > 0) {
        left = Math.min(left, x); top = Math.min(top, y)
        right = Math.max(right, x); bottom = Math.max(bottom, y)
      }
    }
  }
  if (right < left || bottom < top) throw new Error(`${slot}: chroma key removed the whole object`)
  if (left === 0 || top === 0 || right === image.width - 1 || bottom === image.height - 1) throw new Error(`${slot}: source object reaches the image edge; inspect before exporting`)
  context.putImageData(pixels, 0, 0)
  await writeFile(`${processedDirectory}/${slot}-keyed.png`, canvas.toBuffer('image/png'))
  const cropWidth = right - left + 1, cropHeight = bottom - top + 1
  const scale = Math.min((width - padding * 2) / cropWidth, (height - padding * 2) / cropHeight)
  const drawnWidth = cropWidth * scale, drawnHeight = cropHeight * scale
  const x = (width - drawnWidth) / 2, y = (height - drawnHeight) / 2
  const output = createCanvas(width, height)
  const outputContext = output.getContext('2d')
  outputContext.imageSmoothingEnabled = false
  outputContext.drawImage(canvas, left, top, cropWidth, cropHeight, x, y, drawnWidth, drawnHeight)
  const file = `${slot}.png`
  await writeFile(`${target}/${file}`, output.toBuffer('image/png'))
  const generation = await readJson(`${heroDirectory}/${slot}/generation.json`)
  assets[slot] = {
    localSlot: slot, textureUrl: textureUrl(file), file, width, height,
    pivot: slot === 'hammer' ? { x: 0.5, y: 0.88 } : { x: 0.5, y: 0.5 },
    source, sourceSha256: sha256(sourceBytes), sourceMetadata: `${heroDirectory}/${slot}/generation.json`,
    sourceDimensions: { width: image.width, height: image.height },
    sourceBounds: { x: left, y: top, width: cropWidth, height: cropHeight },
    contentBounds: { x, y, width: drawnWidth, height: drawnHeight }, scale,
    processing: 'green chroma key; alpha trim; uniform nearest-neighbor resize; centered transparent padded canvas',
    model: generation.model, watermark: generation.watermark, provenance: 'generatedHeroes',
  }
  heroReports[slot] = { ...assets[slot], visualInspection: measurements[slot].visualInspection }
  if (slot === 'hammer') {
    const ring = measurements.hammer.ring
    assets.hammer.ring = {
      center: { x: x + (ring.center.x - left) * scale, y: y + (ring.center.y - top) * scale },
      radius: ring.radius * scale, outerRadius: ring.outerRadius * scale,
      source: ring,
    }
  }
}

// 武器完整目录由 prepare-catalog72.mjs 重建；旧路线素材只保留历史，不再进入主场景纹理槽。

const manifest = {
  version: 1,
  status: 'runtime-textures-exported; final in-game acceptance owned by integration',
  canvas: { width: 1920, height: 1080 },
  textures: Object.fromEntries(Object.entries(assets).filter(([slot]) => slot !== 'sword').map(([slot, asset]) => [slot, asset.textureUrl])),
  assets,
  hammerRing: { textureLocalPixels: true, ...assets.hammer.ring, spritePivot: assets.hammer.pivot, pivotUnits: 'normalized texture coordinates' },
  hooks: { x: 1376, y: 354, spacing: 130, rows: 1 },
  extension: { startX: 1920, width: 544, height: 1080, firstStripMirrored: true, alternateMirror: true },
  provenance: {
    approvedScene: {
      original: 'assets/incoming/seedream-charcoal-single-row-20261019/scene/image.png',
      generation: 'assets/incoming/seedream-charcoal-single-row-20261019/scene/generation.json',
      layers: 'assets/incoming/seedream-charcoal-single-row-20261019/layers/generation.json',
      previewManifest: `${sceneDirectory}/manifest.json`,
      model: 'doubao-seedream-5-0-pro-260628', watermark: false,
      referenceUrl: 'https://preview.free3d.com/img/2020/07/2202370631066977695/bzv3iy4g.jpg',
      referenceUse: 'user-provided structural reference only, not redistributed as a runtime texture',
      license: 'generated output subject to user Volcengine Ark service/account terms; no third-party reference redistribution rights asserted',
      termsSource: 'User Volcengine Ark account agreement; account-specific agreement was not supplied',
      rightsReview: 'commercial release rights must be confirmed by account holder; reference license not verified',
    },
    generatedHeroes: {
      originals: heroDirectory, prompts: 'docs/assets/gameplay-hero-prompts.json',
      reference: `${sceneDirectory}/original.png`,
      license: 'generated output subject to user Volcengine Ark service/account terms; not claimed CC0 or independently licensed',
      termsSource: 'User Volcengine Ark account agreement; account-specific agreement was not supplied',
      rightsReview: 'commercial release rights must be confirmed by account holder',
      processingScript: 'scripts/prepare-smithy-assets.mjs',
      processedSources: processedDirectory,
      credentials: 'not included; signed download URLs remain local ignored files',
    },
  },
}
await saveJson(`${target}/manifest.json`, manifest)
await saveJson(`${processedDirectory}/processing.json`, { script: 'scripts/prepare-smithy-assets.mjs', chromaKey: { minimumGreen: 70, minimumGreenExcess: 35, minimumGreenRatio: 1.3 }, heroes: heroReports, hammerRing: manifest.hammerRing })
console.log(JSON.stringify({ target, textures: manifest.textures, hammerRing: manifest.hammerRing }, null, 2))
