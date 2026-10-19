import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, basename } from 'node:path'

const input = resolve(process.argv[2] ?? 'assets/incoming/seedream-orthographic-20261019/layers')
const output = resolve(process.argv[3] ?? 'assets/processed/seedream-orthographic-20261019')
const metadata = JSON.parse(await readFile(resolve(input, 'generation.json'), 'utf8'))
if (metadata.status !== 'completed' || metadata.mode !== 'layer-decomposition') throw new Error('输入必须是已成功下载的 Seedream 图层拆分结果。')
const ordered = [...metadata.outputs].sort((left, right) => left.z_index - right.z_index)
const baseEntry = ordered.find((entry) => entry.z_index === 0)
if (!baseEntry) throw new Error('拆分结果缺少 z_index=0 底图。')
if (new Set(ordered.map((entry) => entry.z_index)).size !== ordered.length) throw new Error('图层 z_index 重复，不能无歧义重组。')
await mkdir(output, { recursive: true })
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'LayerChinese')
const base = await loadImage(await readFile(resolve(input, baseEntry.file)))
const width = base.width
const height = base.height
const combined = createCanvas(width, height)
const combinedContext = combined.getContext('2d')
combinedContext.imageSmoothingEnabled = false
const report = {
  model: metadata.model,
  source: input,
  canvas: { width, height },
  origin: { x: 0, y: 0 },
  status: 'candidate-for-visual-review',
  layers: [],
}

for (const entry of ordered) {
  const image = await loadImage(await readFile(resolve(input, entry.file)))
  let rectangle = [0, 0, width, height]
  if (entry.z_index !== 0) {
    rectangle = entry.bounding_box?.absolute
    if (!Array.isArray(rectangle) || rectangle.length !== 4 || rectangle.some((value) => !Number.isInteger(value))) throw new Error(`${entry.file} 缺少有效 absolute 边界，拒绝猜测坐标。`)
    const [left, top, right, bottom] = rectangle
    if (left < 0 || top < 0 || right <= left || bottom <= top || right > width || bottom > height) throw new Error(`${entry.file} 的图层边界越出底图。`)
  }
  const [left, top, right, bottom] = rectangle
  const layer = createCanvas(width, height)
  const context = layer.getContext('2d')
  context.imageSmoothingEnabled = false
  context.drawImage(image, left, top, right - left, bottom - top)
  const filename = entry.z_index === 0 ? 'background.png' : `layer-${String(entry.z_index).padStart(2, '0')}.png`
  await writeFile(resolve(output, filename), layer.toBuffer('image/png'))
  combinedContext.drawImage(layer, 0, 0)
  const pixels = context.getImageData(0, 0, width, height).data
  let transparent = 0
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] === 0) transparent += 1
  report.layers.push({ file: filename, z_index: entry.z_index, name: entry.name ?? (entry.z_index === 0 ? '背景' : `图层 ${entry.z_index}`), description: entry.description, sourceSize: { width: image.width, height: image.height }, rectangle, canvasSize: { width, height }, transparentPixels: transparent })
}
await writeFile(resolve(output, 'reconstructed.png'), combined.toBuffer('image/png'))
await writeFile(resolve(output, 'layers.json'), `${JSON.stringify(report, null, 2)}\n`)

const contact = createCanvas(1920, Math.ceil(report.layers.length / 2) * 610)
const contactContext = contact.getContext('2d')
contactContext.imageSmoothingEnabled = false
contactContext.fillStyle = '#171418'
contactContext.fillRect(0, 0, contact.width, contact.height)
for (let index = 0; index < report.layers.length; index += 1) {
  const entry = report.layers[index]
  const image = await loadImage(await readFile(resolve(output, entry.file)))
  const x = index % 2 * 960
  const y = Math.floor(index / 2) * 610
  contactContext.fillStyle = '#28232a'
  contactContext.fillRect(x + 14, y + 12, 932, 586)
  contactContext.fillStyle = '#ead8bb'
  contactContext.font = '26px LayerChinese'
  contactContext.fillText(`${entry.z_index} · ${entry.name}`, x + 36, y + 51, 850)
  const scale = Math.min(900 / width, 510 / height)
  contactContext.drawImage(image, x + (960 - width * scale) / 2, y + 80 + (510 - height * scale) / 2, width * scale, height * scale)
}
await writeFile(resolve(output, 'layers-contact-sheet.png'), contact.toBuffer('image/png'))
const originalSource = metadata.references[0]?.file
if (originalSource) await writeFile(resolve(output, 'original.png'), await readFile(originalSource))
await writeFile(resolve(output, 'index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>铸剑录 · 正交砖房素材</title><style>body{margin:0;padding:24px;background:#181518;color:#e7d8bd;font:15px system-ui,sans-serif}main{max-width:1440px;margin:auto}h1{font-size:24px}p{color:#b9a991}img{width:100%;display:block;image-rendering:pixelated}.scene{position:relative;width:100%;aspect-ratio:${width}/${height};background:#211d24}.scene img{position:absolute;inset:0;height:100%}fieldset{display:flex;flex-wrap:wrap;gap:18px;margin:20px 0;border:1px solid #564739}input{margin-right:7px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;padding:14px;background:#28232a}figcaption{padding-top:10px}.links{display:flex;gap:20px}a{color:#e2bd79}@media(max-width:800px){.grid{grid-template-columns:1fr}}</style><main><h1>正面正交砖房 · 图层示例</h1><p>无木质建筑结构 · 烟道接天花板 · 砖墙挂剑 · 统一炉火主光。各层按官方 absolute 边界还原到同尺寸画布。</p><div class="links"><a href="original.png">生成原图</a><a href="reconstructed.png">图层重组原尺寸</a><a href="layers-contact-sheet.png">图层对照</a><a href="layers.json">坐标与尺寸</a></div><fieldset id="switches"><legend>图层开关</legend></fieldset><div class="scene" id="scene"></div><h2>生成原图</h2><img src="original.png" alt="正交砖房生成原图"><h2>独立全画布图层</h2><div id="gallery" class="grid"></div></main><script type="module">const report=await(await fetch('layers.json')).json();for(const layer of report.layers){const image=document.createElement('img');image.src=layer.file;image.alt=layer.name;image.dataset.z=layer.z_index;document.querySelector('#scene').append(image);const label=document.createElement('label');const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.addEventListener('change',()=>image.hidden=!checkbox.checked);label.append(checkbox,document.createTextNode(layer.name));document.querySelector('#switches').append(label);const figure=document.createElement('figure');const thumb=document.createElement('img');thumb.src=layer.file;thumb.alt=layer.name;const caption=document.createElement('figcaption');caption.textContent=layer.name;figure.append(thumb,caption);document.querySelector('#gallery').append(figure);}</script></html>`)
console.log(JSON.stringify({ directory: output, canvas: report.canvas, layers: report.layers.map(({ file, z_index, name, rectangle }) => ({ file, z_index, name, rectangle })) }, null, 2))
