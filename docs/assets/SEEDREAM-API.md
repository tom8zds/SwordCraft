# Seedream 素材生成工作流

仓库现在可以直接调用火山引擎 Ark 的 Seedream 5.0 Pro 生成素材。官方文档：

<https://console.volcengine.com/ark/region:cn-beijing/docs/seedream-5-0-pro>

## 分辨率与费用硬上限

- 后续每张生图必须满足 `宽 × 高 ≤ 2,610,000` 像素。竖图默认 `1344x1792`（2,408,448 像素），横图默认 `1920x1080`（2,073,600 像素）。
- `scripts/image-pixel-budget.mjs` 在读取密钥、创建输出目录和发起付费请求前校验明确尺寸；不接受无法证明像素上限的 `2K`、`4K` 或 `auto` 别名。批次在发出第一笔请求前先校验所有任务。
- `1536x2048` 的既有原图为本次成本规则之前的历史资产，保留来源，不重新生成。后续新资产不会沿用这个超限尺寸；不得为特效或界面调整追加生图费用。


## 配置 Key

不要把 Key 写入仓库、JSONL 或提示词文件。在当前 shell 设置：

```bash
export VOLCENGINE_ARK_API_KEY='你的火山引擎 API Key'
```

也支持 `ARK_API_KEY`。模型和接口地址可以通过 `ARK_MODEL`、`ARK_ENDPOINT` 覆盖；默认值是：

```text
模型：doubao-seedream-5-0-pro-260628
接口：https://ark.cn-beijing.volces.com/api/v3/images/generations
```

## 批量生成

批次提示词放在 [`seedream-batch-01.jsonl`](./seedream-batch-01.jsonl)。先做请求体检查，不会调用 API：

```bash
npm run assets:generate:seedream -- --dry-run
```

确认后生成并立即下载图片（接口返回的 URL 只保留 24 小时）：

```bash
npm run assets:generate:seedream -- --out-dir output/seedream/batch-01 --concurrency 2
```

每个任务会保存：

- `*.png`：实际图片；
- `*.response.json`：原始 API 响应，便于记录模型返回信息和图层坐标。

## 图层拆分

Seedream 5.0 Pro 支持在请求中加入：

```json
"layer_decomposition": true
```

此模式必须传入一张输入图，返回一张底图和最多 16 个带透明通道的图层。脚本会按 `z_index` 下载为 `*-layer-<z_index>.png`，并保留 `url`、`bounding_box.absolute`、`bounding_box.normalized`、`name` 和 `description` 等元数据。

图层拆分适合把完整背景、工作台或一张概念构图拆成可移动的对象；火炉第一版仍然使用“有火/无火”两张完整静态图，不需要对火炉做图层拆分。

## 参考图

JSONL 任务可加入 `image` 字段传入参考图 URL：

```json
{
  "file": "forge-without-fire-v2",
  "prompt": "保持参考图中的火炉轮廓、镜头和位置，只移除炉膛火焰……",
  "image": "https://example.com/forge-with-fire.png",
  "size": "1920x1080",
  "watermark": true
}
```

本地图片不能直接作为 URL 传给接口；如果要用本地参考图，先上传到对象存储并使用有效 URL，或继续使用仓库的本地抠图脚本处理。
