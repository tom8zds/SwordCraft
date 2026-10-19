import { createCanvas, loadImage } from '@napi-rs/canvas'
import { mkdirSync, writeFileSync } from 'node:fs'

const input = 'assets/processed/forge-trial'
const output = `${input}/preview`
const width = 1280
const height = 720
mkdirSync(output, { recursive: true })

const withFire = await loadImage(`${input}/forge-with-fire.png`)
const withoutFire = await loadImage(`${input}/forge-without-fire.png`)
const canvas = createCanvas(width, height)
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false
ctx.fillStyle = '#19351f'
ctx.fillRect(0, 0, width, height)
ctx.fillStyle = '#2d241d'
ctx.fillRect(0, 0, width / 2, height)
ctx.fillStyle = '#17130f'
ctx.fillRect(width / 2, 0, width / 2, height)
ctx.drawImage(withFire, 40, 70, width / 2 - 80, height - 140)
ctx.drawImage(withoutFire, width / 2 + 40, 70, width / 2 - 80, height - 140)
ctx.fillStyle = '#ead5a6'
ctx.font = '20px monospace'
ctx.fillText('有火', 40, 38)
ctx.fillText('无火', width / 2 + 40, 38)
writeFileSync(`${output}/forge-static-side-by-side.png`, canvas.toBuffer('image/png'))
console.log(`已生成静态火炉并排预览：${output}/forge-static-side-by-side.png`)
