import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assertImagePixelBudget, DEFAULT_LANDSCAPE_SIZE } from './image-pixel-budget.mjs'

const endpoint = process.env.ARK_ENDPOINT ?? 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
const model = process.env.ARK_MODEL ?? 'doubao-seedream-5-0-pro-260628'
const apiKey = process.env.VOLCENGINE_ARK_API_KEY ?? process.env.ARK_API_KEY

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : fallback
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

const inputPath = option('input', 'docs/assets/seedream-batch-01.jsonl')
const outputDir = option('out-dir', 'output/seedream')
const concurrency = Math.max(1, Number(option('concurrency', '2')) || 2)
const dryRun = hasFlag('dry-run')

function parseJobs(text) {
  return text.split(/\r?\n/).map((line, index) => ({ line, index: index + 1 })).filter(({ line }) => line.trim()).map(({ line, index }) => {
    try {
      const job = JSON.parse(line)
      if (!job.file || !job.prompt) throw new Error('需要 file 和 prompt')
      return job
    } catch (error) {
      throw new Error(`${inputPath}:${index}: ${error instanceof Error ? error.message : String(error)}`)
    }
  })
}

function payloadFor(job) {
  const payload = {
    model: job.model ?? model,
    prompt: job.prompt,
    response_format: job.response_format ?? 'url',
    size: assertImagePixelBudget(job.size ?? DEFAULT_LANDSCAPE_SIZE),
    stream: false,
    watermark: job.watermark ?? true,
  }
  if (job.image) payload.image = job.image
  if (job.layer_decomposition === true) payload.layer_decomposition = true
  return payload
}

async function download(url, target) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`下载失败 ${response.status}: ${url}`)
  await writeFile(target, Buffer.from(await response.arrayBuffer()))
}

async function generate(job) {
  const payload = payloadFor(job)
  const base = resolve(outputDir, job.file)
  await mkdir(resolve(base, '..'), { recursive: true })
  if (dryRun) {
    console.log(JSON.stringify({ file: job.file, payload }, null, 2))
    return
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`${job.file}: API ${response.status}: ${JSON.stringify(body)}`)
  await writeFile(`${base}.response.json`, JSON.stringify(body, null, 2) + '\n')

  const outputs = Array.isArray(body.data) ? body.data : []
  if (!outputs.length) throw new Error(`${job.file}: API 响应没有 data 图片`) 
  for (let index = 0; index < outputs.length; index += 1) {
    const item = outputs[index]
    if (!item.url) continue
    const suffix = payload.layer_decomposition ? `-layer-${item.z_index ?? index}` : index === 0 ? '' : `-${index + 1}`
    await download(item.url, `${base}${suffix}.png`)
  }
  console.log(`已生成 ${job.file}${payload.layer_decomposition ? '（含图层元数据）' : ''}`)
}

if (!dryRun && !apiKey) {
  throw new Error('缺少 VOLCENGINE_ARK_API_KEY 或 ARK_API_KEY。请先在本机设置火山引擎 API Key。')
}

const jobs = parseJobs(await readFile(inputPath, 'utf8'))
for (const job of jobs) payloadFor(job)
let cursor = 0
async function worker() {
  while (cursor < jobs.length) {
    const job = jobs[cursor]
    cursor += 1
    await generate(job)
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker))
console.log(`完成 ${jobs.length} 个 Seedream 任务，输出目录：${outputDir}`)
