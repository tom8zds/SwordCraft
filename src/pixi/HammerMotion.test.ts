import { describe, expect, it } from 'vitest'
import { HAMMER_CONTACT_MS, HAMMER_CYCLE_MS, HammerMotion, sampleHammerPose, type HammerPose } from './HammerMotion'

const pose = (): HammerPose => ({ x: 0, y: 0, rotation: 0, phase: 'rest' })

describe('连续锤击呈现', () => {
  it('依次抬起蓄力、加速落锤、命中停顿、右抽离、抬回，周期不超过500毫秒', () => {
    expect(HAMMER_CYCLE_MS).toBeLessThanOrEqual(500)
    const rest = sampleHammerPose(-1, pose())
    const raised = sampleHammerPose(139.999, pose())
    expect(raised.phase).toBe('raise')
    expect(raised.x).toBeGreaterThan(rest.x)
    expect(raised.y).toBeLessThan(rest.y)
    expect(sampleHammerPose(195, pose()).phase).toBe('strike')
    for (const time of [HAMMER_CONTACT_MS, 270, 289.999]) {
      expect(sampleHammerPose(time, pose())).toEqual({ x: 972, y: 610, rotation: -1.35, phase: 'contact' })
    }
    const withdrawn = sampleHammerPose(379.999, pose())
    expect(withdrawn.phase).toBe('withdraw')
    expect(withdrawn.x).toBeGreaterThan(972)
    expect(withdrawn.y).toBeLessThan(610)
    expect(sampleHammerPose(420, pose()).phase).toBe('return')
    expect(sampleHammerPose(HAMMER_CYCLE_MS, pose())).toEqual(rest)
  })

  it('所有分段边界和连击连接点连续', () => {
    for (const boundary of [140, 250, 290, 380, 480]) {
      const before = sampleHammerPose(boundary - 0.0001, pose())
      const after = sampleHammerPose(boundary, pose())
      expect(Math.hypot(before.x - after.x, before.y - after.y)).toBeLessThan(0.01)
      expect(Math.abs(before.rotation - after.rotation)).toBeLessThan(0.001)
    }
  })

  it('新记录仅排队，不重置进行中的姿势；火花只在每次接触时触发一次', () => {
    const motion = new HammerMotion<string>()
    const contacts: string[] = []
    const hit = (record: string) => { contacts.push(record) }
    motion.enqueue('第一击')
    motion.advance(170, hit)
    const before = { ...motion.pose }
    motion.enqueue('第二击')
    expect(motion.pose).toEqual(before)
    motion.advance(79, hit)
    expect(contacts).toEqual([])
    motion.advance(1, hit)
    expect(contacts).toEqual(['第一击'])
    motion.advance(40, hit)
    expect(contacts).toEqual(['第一击'])
    motion.advance(HAMMER_CYCLE_MS - 290, hit)
    expect(motion.pose).toEqual(sampleHammerPose(0, pose()))
    motion.advance(HAMMER_CONTACT_MS, hit)
    expect(contacts).toEqual(['第一击', '第二击'])
    motion.advance(HAMMER_CYCLE_MS - HAMMER_CONTACT_MS, hit)
    expect(motion.pose.phase).toBe('rest')
  })

  it('取消清空未播放记录并安全还原，之后的敲击不继承旧计时', () => {
    const motion = new HammerMotion<number>()
    const contacts: number[] = []
    const hit = (record: number) => { contacts.push(record) }
    motion.enqueue(1)
    motion.enqueue(2)
    motion.advance(200, hit)
    expect(motion.cancel()).toEqual(sampleHammerPose(-1, pose()))
    motion.advance(1000, hit)
    expect(contacts).toEqual([])
    motion.enqueue(3)
    motion.advance(HAMMER_CONTACT_MS - 1, hit)
    expect(contacts).toEqual([])
    motion.advance(1, hit)
    expect(contacts).toEqual([3])
  })
})
