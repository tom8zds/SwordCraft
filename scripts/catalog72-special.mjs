import { createCatalogContactSheet, readJson, runCatalogBatch, saveJson } from './catalog72-assets.mjs'

const designs = [
  // 树枝 36-47：真实木枝到星海神木，逐件改变木纹、枝冠、根与环
  '真实粗糙铁褐木树枝，不是剑：单根弯曲主枝带三处断面年轮、两根短侧芽和纵向树皮裂纹；下端是自然削断木茬握持端，枝冠稀疏，青蓝小叶，木纹清楚。',
  '萌芽枝杖是天然分叉幼枝：细长主干上有三个鼓起芽苞、左右不对称嫩枝冠和一圈藤皮握环；断面可见浅金年轮，叶片用青蓝与赤褐，不是绿剑或金属剑。',
  '古木剑仍是木制古枝实体：宽厚弯曲树干形成钝木刃轮廓，表面有深色千年年轮、树瘤和纵裂；顶部保留两根枯枝冠，下端为根瘤握柄与木环，禁止金属剑刃。',
  '生命之枝是活木长枝：三股不对称枝杈从粗主干伸出，木纹内有青金色生命脉络但不遮盖纹理；枝端各有细小赤褐叶簇，根须缠成下端护握环，断面年轮可见。',
  '生命之树是一件小型实体树杖：粗树干中段分出左右高低不同的枝冠，冠部由青蓝和金色叶片组成；底部三条根脚盘成天然握座，树皮层、孔洞、同心年轮和树瘤各自清晰。',
  '世界根须突出根系而非剑：中央老树根柱向上分成偏斜双枝，向下展开五条有粗细差异的根须并形成环状握柄；深褐根纹、截面年轮、青金树液线和少量枯赤叶清晰。',
  '森罗神木是多层森林实体木柱：扭转主干上有四种粗细不同的侧枝，枝冠呈阶梯层次并嵌着青蓝、金、赤褐非绿叶簇；底端根板与木环互锁，树皮鳞片和深年轮不可被光遮。',
  '四季王枝必须展示四季组织差异：一根弯曲老枝分四个不对称枝冠区，分别是金色芽、青蓝叶、赤褐枫叶、枯棕空枝；主干有四圈不同纹理年轮和四条根须护握，绝非绿色剑。',
  '大地脉络是沉重地脉木根：粗短主根纵向贯穿，左右伸出岩土状木根和天然环扣，表面裂缝中有克制青金地脉线；顶部是低矮分叉冠，褐色年轮、根毛与树瘤立体分明。',
  '万灵祖木是古老巨木枝柱：主干上盘绕三圈不同粗细的根藤，顶部形成不对称多层枝冠，枝端悬着青蓝、金、赤褐三类小叶；树皮孔洞、树瘤、同心年轮和根须组织清楚，光线不能吞没结构。',
  '永生世界树是一件完整微型世界树实体：中央宽树干由可见多层年轮组成，上端展开对称但高低错落的巨冠，下端六条根须围成厚根环；青金生命纹嵌在木纹沟槽，叶片用青蓝金色，严禁绿。',
  '星海神木是星海尺度的木质神树：银褐主干内有同心年轮与深裂木纹，顶部三层不对称枝冠结出青蓝星叶和金色微星果，底部根须盘成双重环；少量星点光只沿木纹，不能遮挡真实木组织。',
  // 铁钉 48-59：铁钉到星核锤系，逐件不同锤头、链节、核心
  '真正的大铁钉而不是剑：粗短锻铁钉杆竖直，顶部宽扁圆钉帽有四道锤击凹痕，钉身纵向锻纹和锥形尖端完整；下端是小皮缠握套，钉帽与杆的连接清楚。',
  '铆钉锤是实体短柄铆钉工具：一端宽圆铆钉锤头、另一端小方形锤面，中心横向贯穿铆钉孔与金属箍；短木柄有皮缠和铜铆钉，铁锻纹与双面锤头不可画成长剑。',
  '锁链锤由短粗锤柄、三枚真实互扣椭圆铁链节和多面方锤头组成；锤头有两侧钝击面与中央铆接销，链节粗细不同且遮挡关系明确，皮握套在最下端，不能替换成刀刃。',
  '流星锤是单球锤头的实物：尖刺不规则铁球带六枚短锥钉和锻造凹槽，通过五节粗链连接到横向握柄；每节链环闭合可见，球体与链节连接铆环清楚，禁止长剑形。',
  '彗星锁链采用弯月彗核锤头：不规则椭圆铁核带一条分叉金属尾和四个短撞齿，由七节大小递变的链环连到双手短柄；核心凹坑、链环穿插和柄端护帽清楚，青蓝微光只在凹坑。',
  '天坠流星是沉重陨铁摆锤：梨形陨石锤头有熔蚀坑、断裂棱和三根钝凸锚齿，接一条粗重五链节和带护手的握柄；锤头与链节比例突出，不能做成尖剑或法杖。',
  '星核镇锤是方柱镇压锤：中央多面黑铁星核嵌入厚重八角锤框，四角有独立铆钉和短钝棱；框底接粗短柄并有双层皮箍，核心晶面、锤框和柄部三个层次完整，微弱金色内光不遮结构。',
  '银河摆锤是链端球锤而非刀：不对称椭圆陨铁球内嵌一圈蓝金星屑纹，外有两枚金属环耳，连接九节细密链环与长柄配重；链节逐枚可数，球面陨坑和柄端反重锤清楚。',
  '碎月重星由半月形断裂铁锤头和独立圆陨星副锤组成，二者用短链与中央转环连接到粗柄；月锤断口、星体坑洞、两个铆接轴和皮革握把明确，不能把月形拉成剑刃。',
  '天体锁链是三段实体天体锤组：小行星球、环状行星锤环、带坑球核依次以不同粗细闭合链节连接；最底端有横向握杆和护环，链节穿过转轴清晰，三个天体材质与大小不同。',
  '宇宙流星锤是多核心重锤：六边形暗铁锤框包着蓝金双星核心，四条不等长粗链连接四个微型陨星并汇入宽柄；锤框铆钉、核心切面、链环和下端皮握套均清楚，绝非单柄长剑。',
  '终极星核是最终实体核心锤：巨大多面星核被三道交错铁质环箍固定成锤头，环箍各有铆钉与缺口，底部接短粗柄和双重护手环；核心内部克制白金光沿切面，保留坑纹、铆件和真实重量感。',
  // 匕首 60-71：真实短刃到因果断刃，短刃、双刃、护手结构逐件变化
  '真正短匕首而非长剑：单刃短宽钢刃，尖端朝上，刃背有一道浅血槽和不对称缺口；小弧形护手、木芯皮缠握柄、金属柄首三件分离清楚，整把短而可握。',
  '淬毒短刃是窄身单刃：刃尖偏向一侧、刃面有两道毒液导槽与锯齿微缺口，护手为一侧下弯挡指片；深紫毒囊环在护手旁，短柄有三圈皮缠，不能变长剑。',
  '暗影刃是黑灰反曲短刃：刀尖与刃背呈不对称弧线，中央镂空暗槽，短护手两端高低不同；握柄有偏置护指环和菱形柄首，边缘蓝紫冷光克制，完整显示单刃与握持结构。',
  '刺客双刃是两把独立并列短刃：左右刃形镜像但一长一短，各有独立刃槽和尖端，中央以横向双刃护手与共同皮握柄连接；两侧刃间留明显空隙，双刃完整不重叠。',
  '夜幕獠牙是成对弯钩獠牙短刃：两刃不对称向外弯，刃背有獠牙状钝齿，中央黑铁握桥带双护指环；每把刃根有独立铆钉和深蓝刃脊，双短刃与握桥的穿插关系清楚。',
  '无声死神是窄长但仍为短匕首的单刃：镰状内弯刃尖、哑光黑刃面、背侧三段微齿；护手是半月形实体挡片，柄部有下垂短绳与骨质柄首，刃根铆接和握持比例明确。',
  '命运终剪是剪刀式双短刃：两片相对弧刃在中央铰轴交叉，刃尖朝上形成剪口，左右握柄是短皮环与金属指环；铰轴大铆钉、两条独立刃背和闭合结构可见，绝不画成普通双剑。',
  '虚空短刃是一对不接触的悬空短刃：左右一长一短的直刃各有断裂缺口与黑紫内凹刃槽，由中央实体护手架保持间距；双握片、两组铆接和不对称尖端完整，边缘微光不覆盖刃形。',
  '时隙獠牙是两把时间裂齿短匕首：一把反曲、一把直刃，均有阶梯状缺口和獠牙刃脊；中间错位护手含两个圆环转轴，下方为分叉短柄，双刃的前后层次、刃根铆钉和握法清楚。',
  '无形裁决是极简实体单刃：细窄透明感灰钢短刃仍有硬轮廓、偏心尖端和一条断续刃槽；不对称护手由一侧尖挡片和一侧圆护环组成，短握柄有可见金属芯与皮缠，不能只画光线。',
  '绝命双星是两枚独立星形短刃：左右一把直三角刃、一把弧背刃，各自有星芒切口与血槽，通过中央交叉护手和双指握环连接；两把短刃完整分离，铆轴、护手、柄首和刃尖方向明确。',
  '因果断刃是最终不对称双刃匕首：前侧长弧单刃与后侧反向短断刃围绕偏心圆铰盘相扣，刃面各有不同因果刻槽和断口；双层护手、双皮握环、铰盘铆钉与两种刃脊均清晰，保持短刃尺度而非长剑。'
]

if (designs.length !== 36) throw new Error(`special设计数量错误：${designs.length}`)

const catalog = await readJson('assets/incoming/seedream-catalog72-20261019/catalog.json')
const selected = catalog.entries.filter((entry) => entry.index >= 36 && entry.index <= 71)
const jobs = selected.map((entry, index) => ({ ...entry, design: designs[index] }))
await saveJson('assets/incoming/seedream-catalog72-20261019/designs-special.json', {
  group: 'special', reference: 'assets/incoming/seedream-gameplay-heroes-20261019/sword/image.png',
  policy: 'one independent request per weapon; sequential within group; no automatic paid retries', jobs
})

const completed = []
const contactSheets = []
for (let batch = 0; batch < 3; batch += 1) {
  const offset = batch * 12
  const batchJobs = jobs.slice(offset, offset + 12)
  try {
    await runCatalogBatch({ group: `special-${batch + 1}`, first: batchJobs[0].index, last: batchJobs.at(-1).index, designs: batchJobs.map((job) => job.design) })
  } catch (error) {
    console.error(`特殊批次 ${batch + 1} 中止；不重试已提交请求，继续剩余批次：${error instanceof Error ? error.message : '未知错误'}`)
  }
  const ready = []
  for (const job of batchJobs) {
    try {
      const metadata = await readJson(`assets/incoming/seedream-catalog72-20261019/${job.slug}/generation.json`)
      if (metadata.status === 'completed') ready.push(job)
    } catch {
      // 未完成或未知结果保持缺失，不伪造成功记录。
    }
  }
  completed.push(...ready)
  if (ready.length) contactSheets.push(await createCatalogContactSheet(ready, `special-contact-${batch + 1}`))
  console.log(JSON.stringify({ group: `special-${batch + 1}`, requested: batchJobs.length, completed: ready.length, contactSheets }, null, 2))
}

// 若某批因单件异常提前中止，仅补发从未创建generation.json的项目；已有failed/unknown目录绝不重试。
for (const job of jobs) {
  try {
    await readJson(`assets/incoming/seedream-catalog72-20261019/${job.slug}/generation.json`)
  } catch {
    try {
      await runCatalogBatch({ group: `special-recovery-${job.index}`, first: job.index, last: job.index, designs: [job.design] })
      const metadata = await readJson(`assets/incoming/seedream-catalog72-20261019/${job.slug}/generation.json`)
      if (metadata.status === 'completed') {
        completed.push(job)
        contactSheets.push(await createCatalogContactSheet([job], `special-contact-recovery-${job.index}`))
      }
    } catch (error) {
      console.error(`特殊项目 ${job.index} ${job.name} 未提交或未完成；不自动重试：${error instanceof Error ? error.message : '未知错误'}`)
    }
  }
}

const uniqueCompleted = [...new Map(completed.map((job) => [job.slug, job])).values()]
const assets = []
for (const job of uniqueCompleted) {
  try { assets.push(await readJson(`assets/processed/catalog72-20261019/${job.slug}.json`)) } catch { /* normalize报告缺失，交由父审阅 */ }
}
await saveJson('assets/processed/catalog72-20261019/quality-special.json', {
  group: 'special', count: uniqueCompleted.length, requested: jobs.length, contactSheets,
  assets, visualAcceptance: 'pending human/model contact-sheet and in-game inspection'
})
console.log(JSON.stringify({ group: 'special', requested: jobs.length, count: uniqueCompleted.length, contactSheets }, null, 2))
