import { readFile, mkdir } from 'node:fs/promises'
import { generateAsset } from './seedream.mjs'
const spec = JSON.parse(await readFile('assets/incoming/seedream-furnishings-20261020/prompts.json', 'utf8'))
const batchArg = process.argv[2]
if (!batchArg) throw new Error('用法：node scripts/generate-furnishing-assets.mjs batch-01')
const batch = spec.batches.find((candidate) => candidate.batch === batchArg)
if (!batch) throw new Error(`未知素材批次：${batchArg}`)
const outputDirectory = `assets/incoming/seedream-furnishings-20261020/${batch.batch}`
try {
  const metadata = JSON.parse(await readFile(`${outputDirectory}/generation.json`, 'utf8'))
  if (metadata.status !== 'completed') throw new Error(`${batch.batch}: 已有未确认请求，停止以免重复付费`)
  console.log(`复用已完成独立原图 ${batch.batch}`)
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  await mkdir('assets/incoming/seedream-furnishings-20261020', { recursive: true })
  const prompt = `${spec.sharedPrompt}\n本批次固定三件物件，必须按左、中、右顺序分别对应：\n左格：${batch.items[0]}，${batch.designs[0]}\n中格：${batch.items[1]}，${batch.designs[1]}\n右格：${batch.items[2]}，${batch.designs[2]}\n输出一张2400x1080图像，三格均为独立真实物件。`
  await generateAsset({ prompt, references: [spec.reference], outputDirectory, size: spec.size })
}
