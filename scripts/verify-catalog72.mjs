import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createCanvas, loadImage } from '@napi-rs/canvas'

const root = 'public/assets/game/weapons72'
const catalog = JSON.parse(await readFile('assets/incoming/seedream-catalog72-20261019/catalog.json', 'utf8')).entries
const manifest = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'))
const hashes = new Set(), pixelHashes = new Set(), maskHashes = new Set(), sourceHashes = new Set()
const results = []
for (const entry of catalog) {
  const asset = manifest.weapons[entry.id]
  if (!asset || asset.name !== entry.name || asset.id !== entry.id) throw new Error(`素材映射错误：${entry.id}`)
  const bytes = await readFile(`${root}/${asset.file}`)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (sha256 !== asset.sha256) throw new Error(`素材哈希不一致：${entry.name}`)
  const image = await loadImage(bytes)
  if (image.width !== 128 || image.height !== 256) throw new Error(`素材尺寸错误：${entry.name}`)
  const canvas = createCanvas(image.width, image.height), ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  const pixels = ctx.getImageData(0, 0, image.width, image.height).data
  const mask = new Uint8Array(image.width * image.height)
  let opaque = 0, partial = 0, dirtyTransparent = 0, green = 0
  let left = image.width, top = image.height, right = -1, bottom = -1
  for (let index = 0; index < mask.length; index += 1) {
    const i = index * 4, a = pixels[i + 3]
    if (!a) { if (pixels[i] || pixels[i + 1] || pixels[i + 2]) dirtyTransparent += 1; continue }
    if (a !== 255) partial += 1
    opaque += 1; mask[index] = 1
    if (pixels[i + 1] > Math.max(pixels[i], pixels[i + 2]) + 8) green += 1
    const x = index % image.width, y = Math.floor(index / image.width)
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  if (opaque < 100 || partial || dirtyTransparent || green || left < 8 || top < 8 || right > 119 || bottom > 247) {
    throw new Error(`透明/留白质量异常：${entry.name} ${JSON.stringify({opaque,partial,dirtyTransparent,green,left,top,right,bottom})}`)
  }
  const pixelHash = createHash('sha256').update(pixels).digest('hex')
  const maskHash = createHash('sha256').update(mask).digest('hex')
  const sourceHash = createHash('sha256').update(await readFile(asset.source)).digest('hex')
  if (sourceHash !== asset.sourceSha256) throw new Error(`原图哈希不一致：${entry.name}`)
  hashes.add(sha256); pixelHashes.add(pixelHash); maskHashes.add(maskHash); sourceHashes.add(sourceHash)
  results.push({id:entry.id,name:entry.name,opaquePixels:opaque,bounds:{x:left,y:top,width:right-left+1,height:bottom-top+1}})
}
if (catalog.length !== 72 || Object.keys(manifest.weapons).length !== 72 || [hashes,pixelHashes,maskHashes,sourceHashes].some(s=>s.size!==72)) throw new Error('72件武器未完整独立覆盖')
console.log(JSON.stringify({count:results.length,uniqueSources:sourceHashes.size,uniqueFiles:hashes.size,uniquePixels:pixelHashes.size,uniqueSilhouettes:maskHashes.size,allAlphaBinary:true,allTransparentRgbClean:true,allGreenSpillZero:true,allPaddingAtLeast8:true,assets:results},null,2))
