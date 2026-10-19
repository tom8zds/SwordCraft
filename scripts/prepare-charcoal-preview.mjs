import { createCanvas, loadImage } from '@napi-rs/canvas'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const source = 'assets/processed/seedream-charcoal-single-row-20261019'
const target = 'public/assets/art-preview/charcoal-single-row'
const report = JSON.parse(await readFile(`${source}/layers.json`, 'utf8'))
const roles = { background: 0, forge: 1, workbench: 2, hooks: 3 }
await mkdir(target, { recursive: true })
const exported = {}
for (const [role, zIndex] of Object.entries(roles)) {
  const layer = report.layers.find((entry) => entry.z_index === zIndex)
  if (!layer) throw new Error(`缺少 ${role} 图层。`)
  const bytes = await readFile(`${source}/${layer.file}`)
  await writeFile(`${target}/${role}.png`, bytes)
  exported[role] = { file: `${role}.png`, rectangle: layer.rectangle, name: layer.name }
}
await writeFile(`${target}/original.png`, await readFile(`${source}/original.png`))
await writeFile(`${target}/reconstructed.png`, await readFile(`${source}/reconstructed.png`))
await writeFile(`${target}/layers-contact-sheet.png`, await readFile(`${source}/layers-contact-sheet.png`))

// 选取完整钩位，避免把原图最右侧半个钩重复铺设。
const hookSource = await loadImage(await readFile('assets/incoming/seedream-charcoal-single-row-20261019/layers/layer-03.png'))
const hook = createCanvas(50, 34)
const hookContext = hook.getContext('2d')
hookContext.imageSmoothingEnabled = false
hookContext.drawImage(hookSource, 312, 0, 128, 86, 0, 0, 50, 34)
await writeFile(`${target}/hook.png`, hook.toBuffer('image/png'))

const hookLayout = { file: 'hook.png', width: 50, height: 34, x: 1376, y: 354, spacing: 130 }
const sampleCount = 20
const worldWidth = hookLayout.x + (sampleCount - 1) * hookLayout.spacing + hookLayout.width + 160
const background = await loadImage(await readFile(`${source}/background.png`))
const extended = createCanvas(worldWidth, report.canvas.height)
const context = extended.getContext('2d')
context.imageSmoothingEnabled = false
context.drawImage(background, 0, 0)
// 镜像交替铺设无设施的右侧砖墙条；接缝取同一列边缘像素。
// 不重复完整背景，防止再次出现炉体、桌子或左侧暖光。
const strip = { x: 1376, width: report.canvas.width - 1376 }
let reversed = true
for (let x = report.canvas.width; x < worldWidth; x += strip.width) {
  context.save()
  if (reversed) {
    context.translate(x + strip.width, 0)
    context.scale(-1, 1)
    context.drawImage(background, strip.x, 0, strip.width, report.canvas.height, 0, 0, strip.width, report.canvas.height)
  } else {
    context.drawImage(background, strip.x, 0, strip.width, report.canvas.height, x, 0, strip.width, report.canvas.height)
  }
  context.restore()
  reversed = !reversed
}
await writeFile(`${target}/background-wide.png`, extended.toBuffer('image/png'))

const manifest = {
  version: 2,
  status: 'visual-review-sample',
  canvas: report.canvas,
  world: { width: worldWidth, height: report.canvas.height, background: 'background-wide.png' },
  camera: { minX: 0, maxX: worldWidth - report.canvas.width, motion: 'entire-world', hud: 'screen-fixed' },
  layers: exported,
  wallDisplay: {
    hook: hookLayout,
    rows: 1,
    sampleCount,
    swordArt: 'existing-procedural-preview-only',
  },
  extension: { method: 'alternating-mirrored-clean-wall-strip', source: 'background.png', sourceRectangle: [strip.x, 0, report.canvas.width, report.canvas.height] },
  reference: 'https://preview.free3d.com/img/2020/07/2202370631066977695/bzv3iy4g.jpg',
  provenance: 'Seedream 5.0 pro generation and layer decomposition; original inputs retained, watermark disabled.',
}
await writeFile(`${target}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ directory: resolve(target), viewport: manifest.canvas, world: manifest.world, camera: manifest.camera, rows: 1, sampleCount }, null, 2))
