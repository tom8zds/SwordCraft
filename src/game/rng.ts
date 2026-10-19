export interface RandomStep {
  value: number
  state: number
}

export function nextRandom(state: number): RandomStep {
  let value = state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  const nextState = value >>> 0 || 0x6d2b79f5
  return { value: nextState / 0x1_0000_0000, state: nextState }
}

export function randomIndex(state: number, length: number): { index: number; state: number } {
  if (length <= 0) {
    throw new RangeError('随机选择需要至少一个候选项')
  }
  const step = nextRandom(state)
  return { index: Math.floor(step.value * length), state: step.state }
}
