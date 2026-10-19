import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const source = resolve(process.argv[2] ?? 'assets/incoming/seedream-samples-20261019')
const destination = resolve(process.argv[3] ?? 'assets/processed/seedream-samples-20261019')
const names = ['background', 'forge', 'workbench', 'rack']
const labels = { background: '背景 · 无功能设施', forge: '火炉 · 固定正面', workbench: '工作台 · 空铁砧', rack: '展示架 · 三层空槽' }
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'SampleChinese')
const sourceFolders = { background: 'background', forge: 'forge-complete', workbench: 'workbench', rack: 'rack' }
await mkdir(destination, { recursive: true })
const images = {}
const report = { generatedAt: new Date().toISOString(), model: 'doubao-seedream-5-0-pro-260628', status: 'candidate-for-user-review', assets: [] }

for (const name of names) {
  const folder = sourceFolders[name]
  const bytes = await readFile(resolve(source, folder, 'image.png'))
  const image = await loadImage(bytes)
  const metadata = JSON.parse(await readFile(resolve(source, folder, 'generation.json'), 'utf8'))
  const canvas = createCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  context.imageSmoothingEnabled = false
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, image.width, image.height)
  let removed = 0
  if (name !== 'background') {
    for (let index = 0; index < pixels.data.length; index += 4) {
      const red = pixels.data[index], green = pixels.data[index + 1], blue = pixels.data[index + 2]
      // 本批主体仅含砖石、金属和木材，不含绿色部件；键控也清理空槽背景。
      if (green > 70 && green - red > 28 && green - blue > 28 && green > red * 1.25 && green > blue * 1.25) {
        pixels.data[index + 3] = 0
        removed += 1
      }
    }
    context.putImageData(pixels, 0, 0)
  }
  let left = image.width, top = image.height, right = -1, bottom = -1
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (pixels.data[(y * image.width + x) * 4 + 3] < 16) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < left || bottom < top) throw new Error(`${name} 未检测到有效主体。`)
  const bounds = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 }
  let display = canvas
  if (name !== 'background') {
    const margin = 8
    display = createCanvas(bounds.width + margin * 2, bounds.height + margin * 2)
    display.getContext('2d').drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, margin, margin, bounds.width, bounds.height)
  }
  await writeFile(resolve(destination, `${name}.png`), display.toBuffer('image/png'))
  images[name] = display
  report.assets.push({ id: name, source: `${folder}/image.png`, width: image.width, height: image.height, previewWidth: display.width, previewHeight: display.height, bounds, chromaRemovedPixels: removed, watermark: metadata.watermark, sha256: createHash('sha256').update(bytes).digest('hex'), prompt: metadata.prompt, usage: metadata.usage })
}

const scene = createCanvas(1920, 1080)
const sceneContext = scene.getContext('2d')
sceneContext.imageSmoothingEnabled = false
sceneContext.drawImage(images.background, 0, 0, 1920, 1080)
const placements = {
  forge: { x: 55, y: 175, width: 500, height: 795 },
  workbench: { x: 660, y: 545, width: 690, height: 430 },
  rack: { x: 1410, y: 215, width: 430, height: 740 },
}
for (const name of ['forge', 'rack', 'workbench']) {
  const box = placements[name]
  const image = images[name]
  const scale = Math.min(box.width / image.width, box.height / image.height)
  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)
  const x = box.x + Math.floor((box.width - width) / 2)
  const y = box.y + box.height - height
  sceneContext.drawImage(image, x, y, width, height)
  report.assets.find((asset) => asset.id === name).placement = { x, y, width, height }
}
await writeFile(resolve(destination, 'scene-preview.png'), scene.toBuffer('image/png'))

const sheet = createCanvas(1920, 1240)
const sheetContext = sheet.getContext('2d')
sheetContext.fillStyle = '#161319'
sheetContext.fillRect(0, 0, sheet.width, sheet.height)
sheetContext.imageSmoothingEnabled = false
for (let index = 0; index < names.length; index += 1) {
  const name = names[index]
  const panelX = (index % 2) * 960
  const panelY = Math.floor(index / 2) * 620
  sheetContext.fillStyle = '#211b21'
  sheetContext.fillRect(panelX + 12, panelY + 12, 936, 596)
  sheetContext.fillStyle = '#ead9bd'
  sheetContext.font = '28px SampleChinese'
  sheetContext.fillText(labels[name], panelX + 34, panelY + 54)
  const image = images[name]
  const scale = Math.min(875 / image.width, 510 / image.height)
  const width = Math.round(image.width * scale)
  const height = Math.round(image.height * scale)
  const x = panelX + Math.floor((960 - width) / 2)
  const y = panelY + 80 + Math.floor((510 - height) / 2)
  sheetContext.drawImage(image, x, y, width, height)
}
await writeFile(resolve(destination, 'contact-sheet.png'), sheet.toBuffer('image/png'))
await writeFile(resolve(destination, 'asset-report.json'), `${JSON.stringify(report, null, 2)}\n`)
const cards = names.map((name) => `<figure><a href="${name}.png" target="_blank"><img src="${name}.png" alt="${labels[name]}"></a><figcaption>${labels[name]}</figcaption></figure>`).join('')
await writeFile(resolve(destination, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>铸剑录 · Seedream 首批素材</title><style>body{margin:0;padding:24px;background:#161319;color:#ead9bd;font-family:system-ui,sans-serif}main{max-width:1440px;margin:auto}h1{font-size:24px}p{color:#bca88b}img{max-width:100%;display:block;image-rendering:pixelated}.scene{width:100%;border:1px solid #4f4036}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}figure{margin:0;background:#211b21;border:1px solid #4f4036;padding:16px}figure a{display:flex;align-items:center;justify-content:center;min-height:280px}figure img{max-height:430px;object-fit:contain}figcaption{padding-top:14px}a{color:#e8bf71}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><main><h1>铸剑录 · 首批模型素材</h1><p>Seedream 5.0 pro · 四张独立原图 · 关闭水印 · 当前为待确认候选，不是已接入游戏的最终画面。</p><h2>布局合成预览</h2><a href="scene-preview.png" target="_blank"><img class="scene" src="scene-preview.png" alt="背景、火炉、工作台与展示架组合"></a><h2>独立素材</h2><div class="grid">${cards}</div><p><a href="contact-sheet.png">四图对照</a> · <a href="asset-report.json">参数与尺寸报告</a></p></main></html>`)
console.log(JSON.stringify({ output: destination, assets: report.assets.map(({ id, width, height, chromaRemovedPixels }) => ({ id, width, height, chromaRemovedPixels })), scene: '1920x1080', contactSheet: '1920x1240' }, null, 2))
