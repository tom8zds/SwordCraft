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
    const eased = 1 - (1 - t) ** 3
    pose.x = curve(REST.x, 1138, 1192, RAISED.x, eased)
    pose.y = curve(REST.y, 366, 285, RAISED.y, eased)
    pose.rotation = REST.rotation + (RAISED.rotation - REST.rotation) * eased
    pose.phase = 'raise'
  } else if (elapsed < HAMMER_CONTACT_MS) {
    const t = ((elapsed - 140) / 110) ** 2
    pose.x = curve(RAISED.x, 1204, 1066, CONTACT.x, t)
    pose.y = curve(RAISED.y, 330, 482, CONTACT.y, t)
    pose.rotation = RAISED.rotation + (CONTACT.rotation - RAISED.rotation) * t
    pose.phase = 'strike'
  } else if (elapsed < 290) {
    pose.x = CONTACT.x; pose.y = CONTACT.y; pose.rotation = CONTACT.rotation; pose.phase = 'contact'
  } else if (elapsed < 380) {
    const t = (elapsed - 290) / 90
    const eased = t * t * (3 - 2 * t)
    pose.x = curve(CONTACT.x, 1020, 1108, WITHDRAWN.x, eased)
    pose.y = curve(CONTACT.y, 611, 573, WITHDRAWN.y, eased)
    pose.rotation = CONTACT.rotation + (WITHDRAWN.rotation - CONTACT.rotation) * eased
    pose.phase = 'withdraw'
  } else {
    const t = (elapsed - 380) / 100
    const eased = t * t * (3 - 2 * t)
    pose.x = curve(WITHDRAWN.x, 1153, 1100, REST.x, eased)
    pose.y = curve(WITHDRAWN.y, 476, 414, REST.y, eased)
    pose.rotation = WITHDRAWN.rotation + (REST.rotation - WITHDRAWN.rotation) * eased
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
