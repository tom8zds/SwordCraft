export type SwordKind = 'iron' | 'branch' | 'nail' | 'dagger'
export type SwordPath = 'one-hand' | 'greatsword' | 'sword-shield' | 'world-tree' | 'meteor' | 'assassin'
export type SwordLocation = 'rack' | 'forge' | 'anvil' | 'submission'
export type HammerResult = 'destroyed' | 'damaged' | 'steady' | 'success' | 'great'
export type RelicId =
  | 'lucky-tongs'
  | 'soft-anvil'
  | 'tempered-gloves'
  | 'star-coal'
  | 'echo-hammer'
  | 'scarlet-apron'
  | 'guardian-mark'
  | 'patient-bell'
  | 'gilded-chisel'
  | 'phoenix-ash'
  | 'moon-water'
  | 'old-ledger'
  | 'double-bell'
  | 'iron-will'
  | 'fate-thread'

export interface Sword {
  id: string
  kind: SwordKind
  level: number
  heated: boolean
  charge: number
  invincibleUntil: number | null
  path: SwordPath | null
  evolutionStage: number
  location: SwordLocation
  dragonScaleArmed: boolean
  relicShieldDay: number | null
  streakResult: HammerResult | null
  streakCount: number
  nextGreatBoost: boolean
  steadyChain: number
  negativeChain: number
  forgeRelief: number
  createdDay: number
}

export interface HammerRecord {
  id: string
  day: number
  swordId: string
  swordName: string
  beforeLevel: number
  afterLevel: number | null
  result: HammerResult
  preventedBy?: 'dragon-scale' | 'ascension' | 'relic'
  at: number
}

export interface HammerSnapshot {
  sword: Sword
  rngState: number
  recordCount: number
}

export interface RelicDefinition {
  id: RelicId
  name: string
  description: string
  cost: 1 | 2 | 3
  glyph: string
}

export interface MerchantItem {
  id: string
  type: SwordKind | 'dragon-scale' | 'hourglass'
  name: string
  price: bigint
  stock: number
  glyph: string
  description: string
}

export interface CalendarEntry {
  day: number
  target: bigint
  status: 'met' | 'missed' | 'current' | 'future'
  merchant: boolean
}

export interface GameState {
  version: 1
  day: number
  health: number
  maxHealth: number
  coins: bigint
  swords: Sword[]
  selectedSwordId: string | null
  dragonScales: number
  hourglasses: number
  relics: RelicId[]
  relicOffers: RelicId[]
  relicRefreshCost: bigint
  merchantItems: MerchantItem[]
  calendar: CalendarEntry[]
  records: HammerRecord[]
  discoveredNames: string[]
  rngState: number
  nextSwordSerial: number
  nextRecordSerial: number
  lastHammer: HammerSnapshot | null
  pendingLowSubmitUntil: number | null
  milestoneDays: number[]
  gameOver: boolean
  victorySeen: boolean
}

export type GameEvent =
  | { type: 'message'; message: string; tone?: 'good' | 'bad' | 'neutral' }
  | { type: 'hammer'; result: HammerResult; preventedBy?: HammerRecord['preventedBy'] }
  | { type: 'evolution'; swordId: string; name: string }
  | { type: 'day-advanced'; day: number }
  | { type: 'game-over' }

export interface Transition {
  state: GameState
  events: GameEvent[]
}

export interface EffectiveOdds {
  destroyed: number
  damaged: number
  steady: number
  success: number
  great: number
}
