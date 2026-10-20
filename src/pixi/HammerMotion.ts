export type HammerPhase = 'rest' | 'raise' | 'strike' | 'contact' | 'withdraw' | 'return'

export interface HammerPose {
  x: number
  y: number
  rotation: number
  phase: HammerPhase
}

export const HAMMER_CYCLE_MS = 480
export const HAMMER_CONTACT_MS = 250
const MAX_PENDING_SWINGS = 12
const REST = { x: 1094, y: 397, rotation: -0.12 }
const RAISED = { x: 1192, y: 300, rotation: 0.48 }
const CONTACT = { x: 972, y: 610, rotation: -1.35 }
const WITHDRAWN = { x: 1144, y: 532, rotation: -0.64 }
// 中间节点共用切线；只有命中需要停顿，蓄力转下挥与抽回转抬起不驻留。
const RAISED_VELOCITY = { x: -0.25, y: 0.35 }
const WITHDRAWN_VELOCITY = { x: -0.35, y: -1.2, rotation: 0.008 }

function curve(start: number, controlA: number, controlB: number, end: number, t: number): number {
  const inverse = 1 - t
  return inverse ** 3 * start + 3 * inverse ** 2 * t * controlA + 3 * inverse * t ** 2 * controlB + t ** 3 * end
}

/** 接触点而非握柄沿曲线运动，命中姿势因此不依赖素材支点。 */
export function sampleHammerPose(elapsed: number, pose: HammerPose): HammerPose {
  if (elapsed < 0 || elapsed >= HAMMER_CYCLE_MS) {
    pose.x = REST.x; pose.y = REST.y; pose.rotation = REST.rotation; pose.phase = 'rest'
  } else if (elapsed < 140) {
    const t = elapsed / 140
    pose.x = curve(REST.x, REST.x, RAISED.x - RAISED_VELOCITY.x * 140 / 3, RAISED.x, t)
    pose.y = curve(REST.y, REST.y, RAISED.y - RAISED_VELOCITY.y * 140 / 3, RAISED.y, t)
    pose.rotation = curve(REST.rotation, REST.rotation, RAISED.rotation, RAISED.rotation, t)
    pose.phase = 'raise'
  } else if (elapsed < HAMMER_CONTACT_MS) {
    const t = (elapsed - 140) / 110
    pose.x = curve(RAISED.x, RAISED.x + RAISED_VELOCITY.x * 110 / 3, 1100, CONTACT.x, t)
    pose.y = curve(RAISED.y, RAISED.y + RAISED_VELOCITY.y * 110 / 3, 430, CONTACT.y, t)
    pose.rotation = curve(RAISED.rotation, RAISED.rotation, CONTACT.rotation + 0.55, CONTACT.rotation, t)
    pose.phase = 'strike'
  } else if (elapsed < 290) {
    pose.x = CONTACT.x; pose.y = CONTACT.y; pose.rotation = CONTACT.rotation; pose.phase = 'contact'
  } else if (elapsed < 380) {
    const t = (elapsed - 290) / 90
    pose.x = curve(CONTACT.x, CONTACT.x, WITHDRAWN.x - WITHDRAWN_VELOCITY.x * 90 / 3, WITHDRAWN.x, t)
    pose.y = curve(CONTACT.y, CONTACT.y, WITHDRAWN.y - WITHDRAWN_VELOCITY.y * 90 / 3, WITHDRAWN.y, t)
    pose.rotation = curve(CONTACT.rotation, CONTACT.rotation, WITHDRAWN.rotation - WITHDRAWN_VELOCITY.rotation * 90 / 3, WITHDRAWN.rotation, t)
    pose.phase = 'withdraw'
  } else {
    const t = (elapsed - 380) / 100
    pose.x = curve(WITHDRAWN.x, WITHDRAWN.x + WITHDRAWN_VELOCITY.x * 100 / 3, REST.x, REST.x, t)
    pose.y = curve(WITHDRAWN.y, WITHDRAWN.y + WITHDRAWN_VELOCITY.y * 100 / 3, REST.y, REST.y, t)
    pose.rotation = curve(WITHDRAWN.rotation, WITHDRAWN.rotation + WITHDRAWN_VELOCITY.rotation * 100 / 3, REST.rotation, REST.rotation, t)
    pose.phase = 'return'
  }
  return pose
}

/** 仅排队已成功结算记录的呈现，不缓存游戏输入；过量记录合并到末次接触。 */
export class HammerMotion<T> {
  readonly pose: HammerPose = { ...REST, phase: 'rest' }
  private readonly pending: T[] = []
  private elapsed = 0
  private contacted = false

  enqueue(payload: T): void {
    if (this.pending.length < MAX_PENDING_SWINGS) this.pending.push(payload)
    else this.pending[MAX_PENDING_SWINGS - 1] = payload
  }

  advance(deltaMS: number, contact: (payload: T) => void): HammerPose {
    let remaining = Math.max(0, deltaMS)
    while (this.pending.length > 0) {
      const step = Math.min(remaining, HAMMER_CYCLE_MS - this.elapsed)
      this.elapsed += step
      remaining -= step
      if (!this.contacted && this.elapsed >= HAMMER_CONTACT_MS) {
        this.contacted = true
        contact(this.pending[0])
      }
      if (this.elapsed < HAMMER_CYCLE_MS) return sampleHammerPose(this.elapsed, this.pose)
      this.pending.shift()
      this.elapsed = 0
      this.contacted = false
      if (remaining === 0) break
    }
    return sampleHammerPose(this.pending.length > 0 ? this.elapsed : -1, this.pose)
  }

  cancel(): HammerPose {
    this.pending.length = 0
    this.elapsed = 0
    this.contacted = false
    return sampleHammerPose(-1, this.pose)
  }
}
