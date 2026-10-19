// Legacy splitter for the abandoned body/fire layer experiment.
// The active first-version workflow is scripts/process-forge-static.mjs.
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = 'assets/incoming/forge-trial'
const output = 'assets/processed/forge-trial'
const chroma = { r: 0, g: 255, b: 0 }

function removeChroma(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height)
  for (let index = 0; index < image.data.length; index += 4) {
    const red = image.data[index], green = image.data[index + 1], blue = image.data[index + 2]
    const distance = Math.sqrt((red - chroma.r) ** 2 + (green - chroma.g) ** 2 + (blue - chroma.b) ** 2)
    if (distance < 105 || (green > red * 1.18 && green > blue * 1.18 && green > 70)) image.data[index + 3] = 0
  }
  ctx.putImageData(image, 0, 0)
}

function watermarkPixels(ctx, width, height) {
  const image = ctx.getImageData(0, 0, width, height)
  let count = 0
  const startX = Math.floor(width * 0.78)
  const startY = Math.floor(height * 0.84)
  for (let y = startY; y < height; y += 1) for (let x = startX; x < width; x += 1) {
    const index = (y * width + x) * 4
    const red = image.data[index], green = image.data[index + 1], blue = image.data[index + 2]
    const greenBackground = green > red * 1.18 && green > blue * 1.18 && green > 70
    if (!greenBackground) count += 1
  }
  return count
}

function checkDimensions(image, name, width, height) {
  if (image.width !== width || image.height !== height) throw new Error(`${name} 必须是 ${width}x${height}，实际为 ${image.width}x${image.height}`)
}

function processLayer(image, name) {
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, 0, 0)
  const watermarkCount = watermarkPixels(ctx, image.width, image.height)
  if (watermarkCount > 80) throw new Error(`${name} 疑似包含右下角水印（检测像素 ${watermarkCount}），拒绝进入处理稿；请重新导出无水印原图。`)
  removeChroma(ctx, image.width, image.height)
  return canvas
}

mkdirSync(output, { recursive: true })
const manifest = JSON.parse(readFileSync(`${root}/manifest.json`, 'utf8'))
const body = await loadImage(`${root}/${manifest.files.body}`)
const fire = await loadImage(`${root}/${manifest.files.fire}`)
checkDimensions(body, manifest.files.body, manifest.canvas.width, manifest.canvas.height)
checkDimensions(fire, manifest.files.fire, manifest.canvas.width, manifest.canvas.height)
const bodyCanvas = processLayer(body, manifest.files.body)
const fireCanvas = processLayer(fire, manifest.files.fire)
writeFileSync(`${output}/forge-body-layer.png`, bodyCanvas.toBuffer('image/png'))
writeFileSync(`${output}/forge-fire-layer.png`, fireCanvas.toBuffer('image/png'))
console.log('已按相同 1920x1080 画布处理两张全画布叠层，未裁剪、未猜坐标、未遮罩水印。')
