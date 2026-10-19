import { createCanvas } from '@napi-rs/canvas'
import { mkdir, writeFile } from 'node:fs/promises'

const canvas = createCanvas(1920, 1080)
const ctx = canvas.getContext('2d')
ctx.imageSmoothingEnabled = false
ctx.fillStyle = '#484348'
ctx.fillRect(0, 0, 1920, 1080)
ctx.fillStyle = '#676069'
ctx.fillRect(0, 0, 1920, 120)
ctx.fillStyle = '#29272b'
ctx.fillRect(0, 940, 1920, 140)
ctx.strokeStyle = '#6e6669'
ctx.lineWidth = 3
for (let row = 0; row < 16; row += 1) {
  const y = row * 60
  ctx.beginPath()
  ctx.moveTo(0, y)
  ctx.lineTo(1920, y)
  ctx.stroke()
  for (let x = row % 2 === 0 ? 0 : 70; x < 1920; x += 140) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + 60)
    ctx.stroke()
  }
}
// 正面炭炉：台面抬高，小拱形炭床与下方镂空拱座，非落地壁炉。
ctx.fillStyle = '#705b53'
ctx.fillRect(290, 80, 170, 420)
ctx.beginPath()
ctx.moveTo(150, 940)
ctx.lineTo(150, 550)
ctx.lineTo(205, 480)
ctx.lineTo(290, 435)
ctx.lineTo(460, 435)
ctx.lineTo(545, 480)
ctx.lineTo(600, 550)
ctx.lineTo(600, 940)
ctx.closePath()
ctx.fill()
ctx.fillStyle = '#1c1c21'
ctx.beginPath()
ctx.moveTo(255, 660)
ctx.lineTo(255, 585)
ctx.quadraticCurveTo(375, 455, 495, 585)
ctx.lineTo(495, 660)
ctx.closePath()
ctx.fill()
ctx.fillStyle = '#9c8880'
ctx.fillRect(215, 660, 320, 36)
ctx.fillStyle = '#ec783a'
for (let i = 0; i < 9; i += 1) ctx.fillRect(270 + i * 24, 625 - i % 3 * 5, 17, 12)
ctx.fillStyle = '#29272b'
ctx.beginPath()
ctx.moveTo(270, 940)
ctx.lineTo(270, 840)
ctx.quadraticCurveTo(375, 720, 480, 840)
ctx.lineTo(480, 940)
ctx.closePath()
ctx.fill()
ctx.fillStyle = '#806956'
ctx.fillRect(730, 705, 530, 52)
ctx.fillRect(770, 757, 48, 183)
ctx.fillRect(1172, 757, 48, 183)
ctx.fillRect(818, 885, 354, 25)
ctx.fillStyle = '#90969f'
ctx.beginPath()
ctx.moveTo(815, 615)
ctx.lineTo(1170, 615)
ctx.lineTo(1115, 655)
ctx.lineTo(1055, 655)
ctx.lineTo(1055, 685)
ctx.lineTo(1100, 705)
ctx.lineTo(870, 705)
ctx.lineTo(910, 680)
ctx.lineTo(910, 655)
ctx.lineTo(815, 645)
ctx.closePath()
ctx.fill()
// 唯一一排钩位，向右延伸出画面，不画木质承板。
ctx.strokeStyle = '#b3bac5'
ctx.lineWidth = 9
for (let x = 1390; x < 1980; x += 130) {
  ctx.beginPath()
  ctx.moveTo(x - 18, 360)
  ctx.lineTo(x - 18, 380)
  ctx.lineTo(x + 18, 380)
  ctx.lineTo(x + 18, 360)
  ctx.stroke()
}
const output = 'assets/incoming/seedream-charcoal-single-row-20261019'
await mkdir(output, { recursive: true })
await writeFile(`${output}/layout-guide.png`, canvas.toBuffer('image/png'))
console.log(`已生成正交炭炉与唯一单排挂钩布局：${output}/layout-guide.png`)
