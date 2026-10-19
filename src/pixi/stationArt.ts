import { Container, Graphics, Rectangle, Text } from 'pixi.js'

const INK = 0x17141a
const WOOD = 0x634432
const WOOD_LIGHT = 0x9d7452
const GOLD = 0xd4a95c

export function createSceneObjects() {
  const counter = new Container({ label: 'submission-counter' })
  const timber = new Graphics()
    .rect(-158, 0, 316, 36).fill(WOOD_LIGHT).stroke({ color: INK, width: 6 })
    .rect(-143, 36, 286, 155).fill(WOOD).stroke({ color: INK, width: 6 })
  for (let y = 57; y < 180; y += 31) timber.moveTo(-130, y).lineTo(128, y).stroke({ color: 0x3c2c25, width: 3 })
  for (const x of [-127, 127]) for (const y of [49, 176]) timber.circle(x, y, 4).fill(0x9c8a70)
  counter.addChild(timber)
  counter.hitArea = new Rectangle(-168, -95, 336, 285)

  const bell = new Container({ label: 'submission-bell' })
  bell.hitArea = new Rectangle(-52, -61, 104, 111)
  bell.cursor = 'pointer'
  bell.eventMode = 'static'
  bell.addChild(new Graphics()
    .poly([-33, 19, -30, -16, -21, -34, -8, -42, 9, -42, 23, -33, 31, -14, 34, 19]).fill(GOLD).stroke({ color: INK, width: 5 })
    .rect(-40, 17, 80, 11).fill(0xb78539).stroke({ color: INK, width: 4 })
    .rect(-45, 29, 90, 9).fill(0x55545b).stroke({ color: INK, width: 4 })
    .rect(-5, -51, 10, 9).fill(0xf0d88f)
    .poly([-22, 10, -21, -12, -13, -28, -7, -31, -11, 10]).fill(0xf0d88f))

  const book = new Container({ label: 'book-object' })
  book.hitArea = new Rectangle(-52, -47, 104, 94)
  book.eventMode = 'static'
  book.cursor = 'pointer'
  book.addChild(new Graphics()
    .rect(-42, -39, 84, 78).fill(0x54382d).stroke({ color: INK, width: 5 })
    .rect(-36, -33, 10, 64).fill(0x916644)
    .rect(-24, -30, 57, 59).stroke({ color: 0xa7804c, width: 2 })
    .rect(-39, 33, 78, 5).fill(0xcbba99)
    .poly([1, -20, 8, -8, 8, 11, 1, 17, -6, 11, -6, -8]).fill(0xb6bdbe)
    .rect(-12, 10, 26, 4).fill(GOLD)
    .rect(-1, 14, 5, 9).fill(0xb6bdbe))

  const relic = new Container({ label: 'relic-object' })
  relic.hitArea = new Rectangle(-65, -76, 130, 137)
  relic.eventMode = 'static'
  relic.cursor = 'pointer'
  relic.addChild(new Graphics()
    .rect(-52, 17, 104, 29).fill(0x45404e).stroke({ color: INK, width: 5 })
    .rect(-44, 3, 88, 20).fill(0x716675).stroke({ color: INK, width: 4 })
    .poly([0, -57, 29, -25, 0, 11, -29, -25]).fill(0x765597).stroke({ color: INK, width: 5 })
    .poly([0, -45, 16, -25, 0, -5, -7, -25]).fill(0xb18bd1)
    .rect(-33, 27, 66, 3).fill(0x968491))

  const merchant = new Container({ label: 'merchant-object' })
  merchant.hitArea = new Rectangle(-64, -105, 128, 161)
  merchant.eventMode = 'static'
  merchant.cursor = 'pointer'
  merchant.addChild(new Graphics()
    .rect(-44, -77, 88, 127).fill(0x3e322f).stroke({ color: INK, width: 6 })
    .rect(-34, -66, 68, 105).fill(0x685546)
    .rect(-41, -55, 82, 8).fill(0x3a373c)
    .rect(-41, 13, 82, 8).fill(0x3a373c)
    .rect(19, -7, 8, 8).fill(GOLD)
    .poly([-59, -77, 0, -103, 59, -77]).fill(0x4b3a39).stroke({ color: INK, width: 4 }))
  const merchantMark = new Text({ text: '◆', style: { fontFamily: 'monospace', fontSize: 23, fill: GOLD } })
  merchantMark.position.set(-11, -48)
  merchant.addChild(merchantMark)

  return { counter, bell, book, relic, merchant }
}

export function createConsumable(type: 'dragon-scale' | 'hourglass'): Container {
  const root = new Container({ label: type })
  root.hitArea = new Rectangle(-32, -38, 64, 76)
  root.eventMode = 'static'
  root.cursor = 'grab'
  const art = new Graphics()
  if (type === 'dragon-scale') {
    art.poly([0, -25, 22, -6, 16, 15, 0, 29, -16, 15, -22, -6]).fill(0x4b8196).stroke({ color: INK, width: 4 })
    art.poly([0, -18, 12, -4, 7, 14, 0, 19, -4, 5]).fill(0xabc9d2)
    art.moveTo(-12, 0).lineTo(0, 9).lineTo(13, -1).stroke({ color: 0x2c596a, width: 3 })
  } else {
    art.rect(-20, -29, 40, 8).fill(GOLD).stroke({ color: INK, width: 3 })
      .rect(-20, 23, 40, 8).fill(GOLD).stroke({ color: INK, width: 3 })
      .poly([-13, -21, 13, -21, 10, -8, 3, 0, 11, 11, 13, 23, -13, 23, -10, 11, -3, 0, -10, -8]).fill(0x87a5ab).stroke({ color: INK, width: 3 })
      .poly([-8, -16, 8, -16, 0, -5]).fill(0xe8ca8a)
      .poly([-9, 20, 9, 20, 0, 7]).fill(0xe8ca8a)
  }
  root.addChild(art)
  return root
}
