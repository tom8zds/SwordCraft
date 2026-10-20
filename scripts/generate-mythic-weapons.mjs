import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { assertImagePixelBudget } from './image-pixel-budget.mjs'
import { generateAsset } from './seedream.mjs'

const ROOT = 'assets/incoming/seedream-mythic-weapons-20261020'
const CATALOG = 'assets/incoming/seedream-catalog72-20261019/catalog.json'
const INFINITY_REFERENCE = `${ROOT}/references/infinity-blade-user-reference.jpg`
const MATERIAL_REFERENCE = 'assets/incoming/seedream-gameplay-heroes-20261019/sword/image.png'
const SIZE = '2400x1080'
assertImagePixelBudget(SIZE)
const infinity = { index: 72, id: 'iron:one-hand:100', name: '无尽之剑', kind: 'iron', path: 'one-hand', level: 100, evolutionStage: 34, family: 'one-hand', familyLabel: '单手剑', slug: '72-iron-one-hand-100' }
const batches = [
  [['72-iron-one-hand-100'], ['无尽之剑：遵循用户指定参考，黑银厚边长刃、金色中脊、渐次收小的圆孔、镂空环形护手、黑色菱形缠柄与圆形柄首；正面竖直，无logo文字。']],
  [['07-iron-one-hand-45','08-iron-one-hand-54','09-iron-one-hand-63'], ['苍穹裁决：银铁长刃、青蓝星空光脊、分段护手装甲和短翼，实体层次清楚。','星界锋芒：星云蓝刃、金属光脊、星点铆钉与双翼护手，独立结构不只换色。','时光之刃：银蓝时环嵌入刃脊，分层刻度环与金色护手翼，主轴竖直。']],
  [['10-iron-one-hand-72','11-iron-one-hand-81','12-iron-one-hand-90'], ['天穹誓剑：深铁长刃、蓝金光脊、弧形护手装甲与贴身星环。','日冕圣剑：日冕金色中脊、银黑刃边、分层翼状护手与短光环。','万象剑：黑银刃体、金青多相光脊、环形护手和多层宝石铆接，实体复杂。']],
  [['13-iron-one-hand-99','18-iron-greatsword-45','19-iron-greatsword-54'], ['永昼神锋：银黑长刃、金色日核中脊、翼形装甲护手与青金光环。','末日重锋：宽厚黑铁巨刃、断层装甲脊、赤金裂地纹和沉重护手。','泰坦巨剑：宽重泰坦刃、银灰铆接护甲、蓝晶核心与厚重十字护手。']],
  [['20-iron-greatsword-63','21-iron-greatsword-72','22-iron-greatsword-81'], ['裂陆剑：巨刃中部裂陆断层、层叠岩铁装甲和金色熔脉，不能画成细剑。','陨星重锋：厚重陨铁刃、蓝黑星核铆件、陨晶护手和实体碎石装甲。','诸神黄昏：极宽黑银剑身、红金毁灭裂纹、多层天体护脊和巨大护手。']],
  [['23-iron-greatsword-90','29-iron-sword-shield-45','30-iron-sword-shield-54'], ['创世巨刃：创世宽刃、层层天体装甲、金蓝核心与尖角护手，最大实体结构。','永恒壁垒：长枪刃与窄长门板盾前后相叠，银铁枪尖、盾边铆钉、蓝宝石核心。','天国守门：骑士长枪与大型门盾紧凑相叠，盾面城门板、金属梁和青蓝宝石。']],
  [['31-iron-sword-shield-63','32-iron-sword-shield-72','33-iron-sword-shield-81'], ['曜日圣盾：长枪尖、金银门板盾、太阳宝石法阵和层层护缘，主轴竖直。','万民守护：超厚城门巨盾与更长骑士枪前后重叠，中央青金法阵和铆钉。','不可侵犯：超长枪刃穿出巨大窄长骑士门盾，蓝晶法阵、金属层板和尖角护缘。']],
  [['34-iron-sword-shield-90','41-branch-world-tree-45','42-branch-world-tree-54'], ['永世王庭：长枪尖与宫城门盾前后相叠，深铁城门分层、金色宝石阵和铆接侧翼。','世界根须：大木剑与树枝融合，粗壮神树躯干、根网护手、青蓝叶簇和小星环。','森罗神木：厚木质树干刃、分叉枝冠、金青星体环和根须护手，不是绿光柱。']],
  [['43-branch-world-tree-63','44-branch-world-tree-72','45-branch-world-tree-81'], ['四季王枝：粗实树干剑身、四季色叶冠、环绕星体和根网底座，蓝金红叶。','大地脉络：粗壮古树主干、根网护手、青金地脉环和分层枝冠，竖长。','万灵祖木：厚重神木躯干与多级枝冠，金蓝星体环、根须装甲紧贴主体。']],
  [['46-branch-world-tree-90','47-branch-world-tree-99','53-nail-meteor-45'], ['永生世界树：世界树躯干剑身、环形星轨、根网护手与金青叶冠。','星海神木：最厚神树躯干、枝冠包住星海圆环、根网与金青星体，竖直。','天坠流星：棱角星核锤头、粗链和小型陨晶环，锤头与链条紧凑竖直。']],
  [['54-nail-meteor-54','55-nail-meteor-63','56-nail-meteor-72'], ['星核镇锤：多棱蓝黑星核锤头、厚金属链、多层天体环和陨晶铆件。','银河摆锤：巨大多棱星核、粗重链节和贴近锤头的银河环。','碎月重星：碎月形多棱锤头、粗链、月环和天体碎片，不能画球形玩具。']],
  [['57-nail-meteor-81','58-nail-meteor-90','59-nail-meteor-99'], ['天体锁链：多层天体环围绕棱角星核，粗链逐节可见，陨晶贴近主体。','宇宙流星锤：超厚多棱星核锤头、复合粗链、三重天体环和陨晶装甲。','终极星核：最大多棱星核锤头、粗链、多层蓝金天体环与碎陨装甲。']],
  [['65-dagger-assassin-45','66-dagger-assassin-54','67-dagger-assassin-63'], ['无声死神：复合双短刃、镂空法阵护手、黑银虚空嵌刃和紫蓝毒晶，仍短于长剑。','命运终剪：交错复合短刃、金属镂空法阵、黑银虚空嵌刃和青紫晶体，宽而短。','虚空短刃：黑色空洞嵌刃、银边复合刃和环形镂空护手，短于长剑。']],
  [['68-dagger-assassin-72','69-dagger-assassin-81','70-dagger-assassin-90'], ['时隙獠牙：双侧弯曲獠牙、时间环镂空护手、蓝金嵌刃与铆接细节。','无形裁决：黑银虚空嵌刃、镂空法阵与外刃环层，复杂但短小。','绝命双星：双星核刃、交叉外刃、金蓝法阵护手与黑色镂空结构。']],
  [['71-dagger-assassin-99','35-iron-sword-shield-99','24-iron-greatsword-99'], ['因果断刃：最高阶复合双刃，黑银多层嵌刃、因果环形镂空护手与蓝金尖晶，短而宽。','世界壁垒：最长骑士长枪配巨型门板塔盾，层叠城墙结构、青金法阵与厚重铆钉，竖直长形。','终焉之剑：宽重巨刃、钛铁装甲脊、碎陆裂纹与赤金熔线，厚重正面竖直。']],
].map(([items, designs], index) => ({ batch: `batch-${String(index + 1).padStart(2, '0')}`, items, designs }))

const shared = '为《铸剑录》制作一张且只有一张高细节HD-2D硬边像素武器三件套素材图。必须同时画出左、中、右三件不同的完整武器，不能只画第一件、不能空出第二第三件，不是三选一。画布2400x1080，三个物件中心分别x=400、1200、2000；每件完整置于自己的800x1080区域，主轴竖直，尖端或锤头向上，握柄向下，整体留白至少10%，不画网格线。固定正面正交投影，左上中性光，金属、宝石、古木和铆接结构清楚，硬边阶梯像素簇，不是摄影或塑料3D。三件均为40级以后的奇幻神兵，越高等级越庞大繁复、层层装甲和晶核、浮动刃片、实体星轨法环等装饰越多；不能只是把普通铁剑涂色。大盾必须如城门般高且有大宝石和清晰圆形法阵，长骑枪贴在盾前侧，不水平远离。背景纯绿#00FF00，武器不能带绿色或绿反光，能量用青蓝/紫/金/红。禁止人物、手、地面、场景、阴影、文字、数字、logo、水印、边框、UI；悬浮部件必须贴近所属主体。参考图仅锁定像素材质与照明，不模仿其低阶造型。'
const entries = (JSON.parse(await readFile(CATALOG, 'utf8'))).entries.concat(infinity)
const bySlug = new Map(entries.map((entry) => [entry.slug, entry]))
const jobs = batches.flatMap(({ batch, items, designs }) => items.map((slug, index) => {
  const entry = bySlug.get(slug)
  if (!entry) throw new Error(`目录没有 ${slug}`)
  return { ...entry, batch, design: designs[index] }
}))
if (jobs.length !== 43 || new Set(jobs.map((job) => job.id)).size !== 43) throw new Error('必须恰好43件独立新设计')
if (batches.slice(1).some((batch) => batch.items.length !== 3)) throw new Error('剩余14批必须每批完整三件')
const requestedBatch01 = ['72-iron-one-hand-100','35-iron-sword-shield-99','24-iron-greatsword-99']
const requestedBatch01Designs = ['无尽之剑：遵循用户指定参考，黑银厚边长刃、金色中脊、四个渐小圆孔、镂空环形护手、黑色菱形缠柄与圆形柄首；正面竖直，无logo文字。','世界壁垒：剑盾紧凑前后相叠，竖直长枪刺刃从巨大窄长门板塔盾侧上伸，盾有城门层板、青金宝石法阵和铆钉，不横向并排。','终焉之剑：宽重巨刃，钛铁装甲脊、碎陆裂纹、赤金熔线、厚十字护手和重柄，明显比单手剑宽，正面竖直。']
const infinityGeneration = JSON.parse(await readFile(`${ROOT}/batch-01/generation.json`, 'utf8'))
const referenceSource = {
  file: INFINITY_REFERENCE,
  url: 'https://preview.redd.it/infinity-blade-design-v0-brithfiini8d1.jpg?width=640&crop=smart&auto=webp&s=bd410c379e73b2b71d61c364740bc83073e977b2',
  sha256: infinityGeneration.references.find((reference) => reference.file === INFINITY_REFERENCE).sha256,
  attribution: '用户指定《无尽之剑》武器造型参考，第三方原件仅本地保存，不随仓库公开。',
}
const spec = { version: 1, date: '2026-10-20', size: SIZE, columns: 3, cellWidth: 800, cellHeight: 1080, sourceCatalog: CATALOG, references: [MATERIAL_REFERENCE, INFINITY_REFERENCE], referenceRights: '用户指定第三方游戏武器造型参考，仅本地输入；不宣称原创、CC0或自有许可。生成素材权利受用户Volcengine Ark账户协议约束，商业发布授权需账户持有人确认。', policy: '15次独立原图请求；首张实际仅无尽之剑，原计划缺失两件重排入后续14张三件，共43件。不重发首批、不自动付费重试；request-outcome-unknown必须停止并恢复下载。', sharedPrompt: shared, requestedBatch01: { items: requestedBatch01, designs: requestedBatch01Designs }, batches, jobs }
spec.referenceSources = [referenceSource]
await mkdir(ROOT, { recursive: true })
await writeFile(`${ROOT}/prompts.json`, `${JSON.stringify(spec, null, 2)}\n`)
const batchArg = process.argv.find((arg) => arg.startsWith('--batch='))?.slice(8)
const remaining = process.argv.includes('--remaining')
if (!batchArg && !remaining) {
  console.log(`已写入${ROOT}/prompts.json；使用--batch=batch-02逐批生成，或--remaining生成后续14批。`)
  process.exit(0)
}
const selected = remaining ? batches.slice(1) : batches.filter((batch) => batch.batch === batchArg)
if (!selected.length) throw new Error(`未知批次 ${batchArg}`)
for (const batch of selected) {
  const outputDirectory = `${ROOT}/${batch.batch}`
  let completed = false
  try {
    const metadata = JSON.parse(await readFile(`${outputDirectory}/generation.json`, 'utf8'))
    if (metadata.status !== 'completed') throw new Error(`${batch.batch}: 已有未确认请求，停止以免重复付费`)
    completed = true
    console.log(`复用已完成原图 ${batch.batch}`)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  if (completed) continue
  if (batch.batch === 'batch-01') throw new Error('首批为已确认单件原图，禁止自动补发')
  const descriptions = batch.items.map((slug, index) => `${['左','中','右'][index]}侧：${bySlug.get(slug).name}（等级${bySlug.get(slug).level}），${batch.designs[index]}`).join('\n')
  await generateAsset({ prompt: `${shared}\n本张必须全部完成的三件如下：\n${descriptions}\n完成检查：左一件、中一件、右一件，共三件，均不裁断。`, references: [MATERIAL_REFERENCE], outputDirectory, size: SIZE })
}
