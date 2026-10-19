import type { MerchantItem, RelicDefinition, RelicId, Sword, SwordKind, SwordPath } from './types'

export const BASE_ODDS = {
  destroyed: 0,
  damaged: 8,
  steady: 42,
  success: 45,
  great: 5,
} as const

export const IRON_PATHS = ['one-hand', 'greatsword', 'sword-shield'] as const satisfies readonly SwordPath[]

export const KIND_ECONOMY: Record<SwordKind, { base: bigint; numerator: bigint; denominator: bigint; label: string; glyph: string }> = {
  iron: { base: 1000n, numerator: 125n, denominator: 100n, label: '普通铁剑', glyph: '†' },
  branch: { base: 700n, numerator: 130n, denominator: 100n, label: '树枝', glyph: '⌇' },
  nail: { base: 600n, numerator: 135n, denominator: 100n, label: '铁钉', glyph: '↟' },
  dagger: { base: 800n, numerator: 128n, denominator: 100n, label: '匕首', glyph: '⟋' },
}

const IRON_NAMES: Record<SwordPath | 'base', string[]> = {
  base: ['普通铁剑', '精良铁剑', '骑士大剑'],
  'one-hand': ['御卫长剑', '银翼剑', '黎明之刃', '王者圣剑', '苍穹裁决', '星界锋芒', '时光之刃', '天穹誓剑', '日冕圣剑', '万象剑', '永昼神锋'],
  greatsword: ['骑士双手剑', '黑铁巨剑', '斩龙剑', '山岳断刃', '末日重锋', '泰坦巨剑', '裂陆剑', '陨星重锋', '诸神黄昏', '创世巨刃', '终焉之剑'],
  'sword-shield': ['壁垒剑盾', '狮心剑盾', '圣城守望', '不落王庭', '永恒壁垒', '天国守门', '曜日圣盾', '万民守护', '不可侵犯', '永世王庭', '世界壁垒'],
  'world-tree': [],
  meteor: [],
  assassin: [],
}

const SPECIAL_NAMES: Record<SwordKind, string[]> = {
  iron: [],
  branch: ['树枝', '萌芽枝杖', '古木剑', '生命之枝', '生命之树', '世界根须', '森罗神木', '四季王枝', '大地脉络', '万灵祖木', '永生世界树', '星海神木'],
  nail: ['铁钉', '铆钉锤', '锁链锤', '流星锤', '彗星锁链', '天坠流星', '星核镇锤', '银河摆锤', '碎月重星', '天体锁链', '宇宙流星锤', '终极星核'],
  dagger: ['匕首', '淬毒短刃', '暗影刃', '刺客双刃', '夜幕獠牙', '无声死神', '命运终剪', '虚空短刃', '时隙獠牙', '无形裁决', '绝命双星', '因果断刃'],
}

export const PATH_LABELS: Record<SwordPath, string> = {
  'one-hand': '单手剑',
  greatsword: '双手剑',
  'sword-shield': '剑盾',
  'world-tree': '生命之树',
  meteor: '流星锤',
  assassin: '刺客武器',
}

export function swordName(sword: Pick<Sword, 'kind' | 'level' | 'path'> & Partial<Pick<Sword, 'evolutionStage'>>): string {
  const stage = Math.max(Math.floor(sword.level / 3), sword.evolutionStage ?? 0)
  if (sword.kind !== 'iron') {
    const names = SPECIAL_NAMES[sword.kind]
    return names[Math.min(Math.floor(stage / 3), names.length - 1)]
  }
  if (!sword.path || stage < 3) {
    return IRON_NAMES.base[Math.min(stage, IRON_NAMES.base.length - 1)]
  }
  const names = IRON_NAMES[sword.path]
  return names[Math.min(Math.floor((stage - 3) / 3), names.length - 1)]
}

export function swordValue(sword: Pick<Sword, 'kind' | 'level'>): bigint {
  const config = KIND_ECONOMY[sword.kind]
  return config.base * config.numerator ** BigInt(sword.level) / config.denominator ** BigInt(sword.level)
}

export function dailyTarget(day: number): bigint {
  const exponent = BigInt(Math.max(0, day - 1))
  return 1000n * 11n ** exponent / 10n ** exponent
}

export const RELICS: RelicDefinition[] = [
  { id: 'lucky-tongs', name: '幸运火钳', description: '成功权重 +5。', cost: 1, glyph: '⌁' },
  { id: 'soft-anvil', name: '软响铁砧', description: '损伤权重 -5。', cost: 1, glyph: '▰' },
  { id: 'tempered-gloves', name: '淬火手套', description: '破坏权重 -3。', cost: 2, glyph: '♨' },
  { id: 'star-coal', name: '星火煤', description: '大成功权重 +3。', cost: 2, glyph: '✦' },
  { id: 'echo-hammer', name: '回声锤', description: '连续两次维持时，额外获得 1 点登神充能。', cost: 2, glyph: '♪' },
  { id: 'scarlet-apron', name: '猩红围裙', description: '连续两次损伤后，下一锤大成功权重 +25。', cost: 2, glyph: '≋' },
  { id: 'guardian-mark', name: '守炉印', description: '每把剑每天第一次破坏会被抵挡。', cost: 3, glyph: '◇' },
  { id: 'patient-bell', name: '耐心铃', description: '维持结果额外获得 1 点登神充能。', cost: 2, glyph: '♢' },
  { id: 'gilded-chisel', name: '鎏金凿', description: '所有剑的提交价值提高 10%。', cost: 3, glyph: '▱' },
  { id: 'phoenix-ash', name: '凤凰余烬', description: '每一天第一次破坏被抵挡，不消耗剑的遗物护盾。', cost: 3, glyph: '♧' },
  { id: 'moon-water', name: '月井水', description: '登神无敌延长至 7 秒。', cost: 2, glyph: '◔' },
  { id: 'old-ledger', name: '旧账本', description: '低于要求提交时仍多获得 20% 金币。', cost: 1, glyph: '▤' },
  { id: 'double-bell', name: '双响铃', description: '商人出售的基础剑价格降低 20%。', cost: 2, glyph: '♬' },
  { id: 'iron-will', name: '铁之意志', description: '等级 0 的损伤转为维持。', cost: 2, glyph: '⬙' },
  { id: 'fate-thread', name: '命运丝线', description: '大成功权重 +2，破坏权重 +2（0 级仍不会破坏）。', cost: 1, glyph: '⌁' },
]

export const RELIC_BY_ID = Object.fromEntries(RELICS.map((relic) => [relic.id, relic])) as Record<RelicId, RelicDefinition>

export function merchantInventory(): MerchantItem[] {
  return [
    { id: 'merchant-iron', type: 'iron', name: '普通铁剑', price: 1300n, stock: 1, glyph: '†', description: '未经加热的普通铁剑。' },
    { id: 'merchant-branch', type: 'branch', name: '树枝', price: 2800n, stock: 1, glyph: '⌇', description: '可成长为生命之树。' },
    { id: 'merchant-nail', type: 'nail', name: '铁钉', price: 3200n, stock: 1, glyph: '↟', description: '可成长为流星锤。' },
    { id: 'merchant-dagger', type: 'dagger', name: '匕首', price: 3600n, stock: 1, glyph: '⟋', description: '可成长为刺客武器。' },
    { id: 'merchant-scale', type: 'dragon-scale', name: '龙鳞', price: 2200n, stock: 1, glyph: '◈', description: '装备后，下一锤必定消耗并能抵挡破坏。' },
    { id: 'merchant-hourglass', type: 'hourglass', name: '沙漏', price: 4200n, stock: 1, glyph: '⌛', description: '撤销最近一锤，可救回破坏的剑；剑离台或工作台换剑后失效，不回退随机命运。' },
  ]
}

export function formatCoins(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  const groups = absolute.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${sign}${groups}`
}
