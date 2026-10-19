// Legacy overlay preview for the abandoned body/fire layer experiment.
// The active first-version workflow is scripts/preview-forge-static.mjs.
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const input = 'assets/processed/forge-trial'
const output = `${input}/preview`
const WIDTH = 1280
const HEIGHT = 720
mkdirSync(output, { recursive: true })

const body = await loadImage(`${input}/forge-body-layer.png`)
const fire = await loadImage(`${input}/forge-fire-layer.png`)
const canvas = createCanvas(WIDTH, HEIGHT)
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false
ctx.drawImage(body, 0, 0, body.width, body.height, 0, 0, WIDTH, HEIGHT)
ctx.drawImage(fire, 0, 0, fire.width, fire.height, 0, 0, WIDTH, HEIGHT)
ctx.globalCompositeOperation = 'screen'
const glow = ctx.createRadialGradient(WIDTH * 0.47, HEIGHT * 0.57, 8, WIDTH * 0.47, HEIGHT * 0.57, 180)
glow.addColorStop(0, 'rgba(255,188,70,.24)')
glow.addColorStop(1, 'rgba(255,82,30,0)')
ctx.fillStyle = glow
ctx.fillRect(0, 0, WIDTH, HEIGHT)
ctx.globalCompositeOperation = 'source-over'
writeFileSync(`${output}/full-canvas-overlay.png`, canvas.toBuffer('image/png'))
console.log(`已使用相同左上角坐标叠加两张全画布图层：${output}/full-canvas-overlay.png`)
