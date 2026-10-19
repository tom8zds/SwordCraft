import { readFile, mkdir, writeFile, stat } from 'node:fs/promises'
import { resolve, extname, basename } from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { assertImagePixelBudget, DEFAULT_LANDSCAPE_SIZE } from './image-pixel-budget.mjs'

export const SEEDREAM_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
export const SEEDREAM_MODEL = 'doubao-seedream-5-0-pro-260628'

export async function readApiKey() {
  if (process.env.ARK_API_KEY?.trim()) return process.env.ARK_API_KEY.trim()
  let raw
  try {
    raw = (await readFile('.token', 'utf8')).trim()
  } catch {
    throw new Error('未找到 ARK_API_KEY 或本地 .token 凭据文件。')
  }
  if (raw.startsWith('{')) {
    try {
      const value = JSON.parse(raw)
      raw = value.ARK_API_KEY ?? value.api_key ?? value.token ?? ''
    } catch {
      throw new Error('.token 不是有效 JSON；也可以只保存纯 API Key。')
    }
  } else {
    const assignment = raw.match(/^(?:export\s+)?(?:ARK_API_KEY|api_key|token)\s*[:=]\s*([\s\S]+)$/i)
    if (assignment) raw = assignment[1].trim()
    raw = raw.replace(/^Bearer\s+/i, '').replace(/^(['"])(.*)\1$/, '$2')
  }
  if (typeof raw !== 'string' || !raw || /\s/.test(raw) || raw === '<YOUR_API_KEY>') throw new Error('.token 必须包含单个有效 API Key，不会输出凭据内容。')
  return raw
}

export async function generateAsset({ prompt, references = [], outputDirectory, size = DEFAULT_LANDSCAPE_SIZE, decompose = false }) {
  if (!prompt?.trim()) throw new Error('生成素材需要中文提示词。')
  if (decompose && references.length !== 1) throw new Error('图层拆分只允许输入一张图片。')
  assertImagePixelBudget(size)
  const apiKey = await readApiKey()
  const images = []
  const referenceMetadata = []
  for (const reference of references) {
    const bytes = await readFile(reference)
    const format = extname(reference).slice(1).toLowerCase().replace('jpg', 'jpeg')
    if (!['png', 'jpeg', 'webp'].includes(format)) throw new Error('参考图只使用本地 PNG、JPEG 或 WebP。')
    images.push(`data:image/${format};base64,${bytes.toString('base64')}`)
    referenceMetadata.push({ file: reference, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
  const body = {
    model: SEEDREAM_MODEL,
    prompt,
    size,
    output_format: 'png',
    response_format: 'url',
    watermark: false,
    ...(images.length ? { image: images.length === 1 ? images[0] : images } : {}),
    ...(decompose ? { layer_decomposition: true } : {}),
  }
  await mkdir(outputDirectory, { recursive: false })
  const metadata = {
    status: 'requesting',
    startedAt: new Date().toISOString(),
    endpoint: SEEDREAM_ENDPOINT,
    model: SEEDREAM_MODEL,
    prompt,
    size: body.size,
    watermark: false,
    mode: decompose ? 'layer-decomposition' : 'generation',
    references: referenceMetadata,
  }
  const metadataPath = resolve(outputDirectory, 'generation.json')
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  console.log(`提交 ${basename(outputDirectory)}，${decompose ? '图层拆分' : size}，关闭水印；不自动重试付费请求。`)
  let response
  try {
    response = await fetch(SEEDREAM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(600_000),
      redirect: 'error',
    })
  } catch {
    metadata.status = 'request-outcome-unknown'
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
    throw new Error('请求未返回可确认结果；请检查平台记录，避免重复付费。凭据与请求图像未写入日志。')
  }
  let result
  try {
    result = await response.json()
  } catch {
    throw new Error(`接口返回非 JSON，HTTP ${response.status}。`)
  }
  if (!response.ok || result.error || !Array.isArray(result.data) || !result.data.length) {
    metadata.status = 'failed'
    metadata.httpStatus = response.status
    metadata.errorCode = typeof result.error?.code === 'string' ? result.error.code.replaceAll(apiKey, '<REDACTED>') : 'invalid-image-response'
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
    throw new Error(`生成失败：HTTP ${response.status}，${metadata.errorCode}。`)
  }
  const downloadManifest = result.data.map((item, index) => ({
    file: decompose ? `layer-${String(item.z_index ?? index).padStart(2, '0')}.png` : 'image.png',
    size: item.size,
    z_index: item.z_index,
    bounding_box: item.bounding_box,
    name: item.name,
    description: item.description,
    url: item.url,
  }))
  // 下载链接仅有 24 小时有效期，且可能携带签名；只保存在忽略提交的本地文件。
  await writeFile(resolve(outputDirectory, '.download-urls.json'), JSON.stringify(downloadManifest), { mode: 0o600 })
  metadata.status = 'generated-downloading'
  metadata.created = result.created
  metadata.usage = result.usage
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  const outputs = []
  for (let index = 0; index < result.data.length; index += 1) {
    const item = result.data[index]
    if (item.error) throw new Error('服务返回图像错误，已保留生成元数据。')
    const filename = downloadManifest[index].file
    let bytes
    if (typeof item.b64_json === 'string') bytes = Buffer.from(item.b64_json, 'base64')
    else if (typeof item.url === 'string' && new URL(item.url).protocol === 'https:') {
      const downloaded = await fetch(item.url, { signal: AbortSignal.timeout(120_000) })
      if (!downloaded.ok) throw new Error(`生成成功，但图片下载失败：HTTP ${downloaded.status}。本地 .download-urls.json 可用于恢复下载。`)
      bytes = Buffer.from(await downloaded.arrayBuffer())
    } else throw new Error('图像响应缺少有效的 HTTPS 下载链接。')
    const filenamePath = resolve(outputDirectory, filename)
    await writeFile(filenamePath, bytes, { flag: 'wx' })
    outputs.push({ file: filename, size: item.size, z_index: item.z_index, bounding_box: item.bounding_box, name: item.name, description: item.description, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length })
  }
  metadata.status = 'completed'
  metadata.completedAt = new Date().toISOString()
  metadata.outputs = outputs
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
  console.log(`已保存 ${outputs.length} 张原图：${outputDirectory}`)
  return { outputDirectory, outputs }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [promptFile, outputDirectory, ...references] = process.argv.slice(2)
    if (!promptFile || !outputDirectory) throw new Error('用法：node scripts/seedream.mjs <中文提示词.txt> <新输出目录> [参考图.png ...]')
    await stat(promptFile)
    await generateAsset({ prompt: (await readFile(promptFile, 'utf8')).trim(), references, outputDirectory })
  } catch (error) {
    console.error(error instanceof Error ? error.message : '生成失败；未输出内部请求。')
    process.exitCode = 1
  }
}
