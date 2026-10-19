import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = 'assets/incoming/forge-trial'
const output = 'assets/processed/forge-trial'
const chroma = { r: 0, g: 255, b: 0 }

function isGreen(pixel) {
  const [red, green, blue] = pixel
  const distance = Math.sqrt((red - chroma.r) ** 2 + (green - chroma.g) ** 2 + (blue - chroma.b) ** 2)
  return distance < 105 || (green > red * 1.18 && green > blue * 1.18 && green > 70)
}

function removeGreen(canvas) {
  const ctx = canvas.getContext('2d')
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < image.data.length; index += 4) {
    if (isGreen(image.data.slice(index, index + 3))) image.data[index + 3] = 0
  }
  ctx.putImageData(image, 0, 0)
  return image
}

function findCenterBounds(images) {
  const width = images[0].width
  const height = images[0].height
  const minX = Math.floor(width * 0.1)
  const maxX = Math.ceil(width * 0.9)
  const minY = Math.floor(height * 0.03)
  const maxY = Math.ceil(height * 0.97)
  let left = maxX, top = maxY, right = minX, bottom = minY

  for (const image of images) {
    for (let y = minY; y < maxY; y += 1) for (let x = minX; x < maxX; x += 1) {
      const alpha = image.data[(y * width + x) * 4 + 3]
      if (alpha < 16) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x + 1)
      bottom = Math.max(bottom, y + 1)
    }
  }

  if (left >= right || top >= bottom) throw new Error('中央区域没有检测到火炉物件')
  const padding = Math.round(Math.max(width, height) * 0.025)
  return {
    x: Math.max(0, left - padding),
    y: Math.max(0, top - padding),
    width: Math.min(width, right + padding) - Math.max(0, left - padding),
    height: Math.min(height, bottom + padding) - Math.max(0, top - padding),
  }
}

function crop(canvas, bounds) {
  const result = createCanvas(bounds.width, bounds.height)
  const ctx = result.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height)
  return result
}

const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'))
const withFire = await loadImage(`${root}/${manifest.files.withFire}`)
const withoutFire = await loadImage(`${root}/${manifest.files.withoutFire}`)
if (withFire.width !== withoutFire.width || withFire.height !== withoutFire.height) throw new Error('有火图和无火图尺寸必须一致')
if (withFire.width !== manifest.canvas.width || withFire.height !== manifest.canvas.height) {
  throw new Error(`输入尺寸必须是 ${manifest.canvas.width}x${manifest.canvas.height}，实际为 ${withFire.width}x${withFire.height}`)
}

const canvases = [withFire, withoutFire].map((image) => {
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0)
  return canvas
})
const keyedImages = canvases.map(removeGreen)
const bounds = findCenterBounds(keyedImages)
const processed = canvases.map((canvas) => crop(canvas, bounds))
mkdirSync(output, { recursive: true })
writeFileSync(`${output}/forge-with-fire.png`, processed[0].toBuffer('image/png'))
writeFileSync(`${output}/forge-without-fire.png`, processed[1].toBuffer('image/png'))
writeFileSync(`${output}/forge-static-bounds.json`, JSON.stringify(bounds, null, 2) + '\n')
console.log(`已提取中央火炉物件：${bounds.width}x${bounds.height}，输出两张静态图到 ${output}`)
