import { createHash } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { loadImage } from '@napi-rs/canvas'
import {
  CATALOG72_SOURCE, CATALOG72_PROCESSED, CATALOG72_PUBLIC,
  normalizeCatalogWeapon, createCatalogContactSheet, readJson, saveJson,
} from './catalog72-assets.mjs'

const { entries } = await readJson(`${CATALOG72_SOURCE}/catalog.json`)
const reports = []
const normalized = process.argv.includes('--normalize')
for (const entry of entries) {
  const report = normalized
    ? await normalizeCatalogWeapon(entry)
    : await readJson(`${CATALOG72_PROCESSED}/${entry.slug}.json`)
  const bytes = await readFile(`${CATALOG72_PUBLIC}/${report.file}`)
  const image = await loadImage(bytes)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (report.id !== entry.id || report.name !== entry.name || sha256 !== report.sha256 || image.width !== 128 || image.height !== 256) {
    throw new Error(`${entry.id}: 武器素材映射、哈希或尺寸不一致`)
  }
  if (report.opaquePixels < 100 || report.greenSpill !== 0) throw new Error(`${entry.id}: alpha 或绿色残留需要人工检查`)
  reports.push(report)
}
const generations = await Promise.all(entries.map((entry) => readJson(`${CATALOG72_SOURCE}/${entry.slug}/generation.json`)))
if (generations.some((generation) => generation.status !== 'completed' || generation.outputs?.length !== 1)) throw new Error('每件武器必须有独立完成的单图生成记录')
if (reports.length !== 72 || new Set(reports.map((item) => item.id)).size !== 72) throw new Error('必须完整覆盖72种独立武器')
for (const field of ['file', 'sourceSha256', 'sha256', 'pixelSha256']) {
  if (new Set(reports.map((item) => item[field])).size !== reports.length) throw new Error(`发现重复${field}，不能用重复武器凑数`)
}
const silhouetteGroups = new Map()
for (const report of reports) {
  const group = silhouetteGroups.get(report.silhouetteSha256) ?? []
  group.push(report.id)
  silhouetteGroups.set(report.silhouetteSha256, group)
}
const repeatedSilhouettes = [...silhouetteGroups.values()].filter((group) => group.length > 1)
if (repeatedSilhouettes.length) throw new Error(`发现完全相同的武器剪影：${JSON.stringify(repeatedSilhouettes)}`)
const contactSheets = []
for (let first = 0; first < entries.length; first += 12) {
  contactSheets.push(await createCatalogContactSheet(entries.slice(first, first + 12), `all-weapons-${String(first / 12 + 1).padStart(2, '0')}`))
}
const provenance = {
  sourceDirectory: CATALOG72_SOURCE,
  catalog: `${CATALOG72_SOURCE}/catalog.json`,
  designSpecifications: [`${CATALOG72_SOURCE}/designs-iron.json`, `${CATALOG72_SOURCE}/designs-special.json`],
  reference: 'assets/incoming/seedream-gameplay-heroes-20261019/sword/image.png',
  model: 'doubao-seedream-5-0-pro-260628',
  requestPolicy: 'one independently prompted image per weapon; no automatic paid retries',
  completedOriginals: generations.reduce((sum, generation) => sum + generation.outputs.length, 0),
  paidRequestCount: generations.length,
  billingAmount: 'unknown; consult account billing, not estimated from image usage',
  watermark: false,
  processingScript: 'scripts/catalog72-assets.mjs',
  aggregationScript: 'scripts/prepare-catalog72.mjs',
  processing: 'green chroma key, binary alpha with clean transparent RGB, proportional nearest-neighbor fit; no shared-route shape, recolor-only variants or stretched placeholder geometry',
  rights: 'generated output remains subject to the user Volcengine Ark account agreement; commercial release rights must be confirmed by account holder',
  credentials: 'not included; signed download manifests remain local ignored files',
}
await mkdir(CATALOG72_PUBLIC, { recursive: true })
await saveJson(`${CATALOG72_PUBLIC}/manifest.json`, {
  version: 1,
  status: '72 independent sources normalized; contact-sheet and game acceptance recorded in verification.json',
  weapons: Object.fromEntries(reports.map(({ id, name, file, width, height, sha256, source, sourceSha256, sourceMetadata }) => [id, { id, name, file, width, height, sha256, source, sourceSha256, sourceMetadata }])),
  provenance,
})
await saveJson(`${CATALOG72_PROCESSED}/quality-report.json`, {
  count: reports.length,
  uniqueSources: new Set(reports.map((item) => item.sourceSha256)).size,
  uniquePixels: new Set(reports.map((item) => item.pixelSha256)).size,
  uniqueSilhouettes: silhouetteGroups.size,
  contactSheets,
  provenance,
  assets: reports,
  verification: 'contact-sheet inspection and runtime acceptance recorded separately; uniqueness hashes do not by themselves prove visual quality',
})
console.log(JSON.stringify({ count: reports.length, uniqueSources: reports.length, uniquePixels: reports.length, uniqueSilhouettes: silhouetteGroups.size, contactSheets, manifest: `${CATALOG72_PUBLIC}/manifest.json` }, null, 2))
