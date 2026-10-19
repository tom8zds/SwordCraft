import { readFile } from 'node:fs/promises'
import { generateAsset } from './seedream.mjs'
import { DEFAULT_PORTRAIT_SIZE } from './image-pixel-budget.mjs'

const specification = JSON.parse(await readFile('assets/incoming/seedream-evolved-weapons-v1-20261019/prompts.json', 'utf8'))
const asset = specification.assets.find(({ id }) => id === process.argv[2])
if (!asset) throw new Error('Choose exactly one route: swordOneHand, swordGreatsword, or swordShield. Each invocation makes one paid request; inspect its output before continuing.')
await generateAsset({
  prompt: `${specification.sharedPrompt}\n${asset.prompt}`,
  references: specification.references,
  outputDirectory: asset.outputDirectory,
  size: DEFAULT_PORTRAIT_SIZE,
})
