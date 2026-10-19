# 模型候选图上传区

请将图像模型输出按资产类型放入对应目录。这里存放未经处理的候选稿；不要直接放入 `public/assets/game`。

## 目录

```text
assets/incoming/
├── hammer/   # 大型锻造锤
├── sword/    # 普通铁剑
├── forge/    # 高细节火炉主体
└── fire/     # 后续动画实验素材；第一版火炉使用完整有火/无火静态图
```

## 命名

```text
<asset>-candidate-<两位序号>.<ext>
```

示例：

```text
hammer/hammer-candidate-01.png
hammer/hammer-candidate-02.webp
sword/sword-candidate-01.png
forge/forge-candidate-01.png
fire/fire-strip-candidate-01.png
```

## 可接受格式

- 首选：PNG，`1024×1024` 或更大。
- 可接受：WebP；JPEG 仅用于完整风格母图，不适合透明单体资产。
- 有真实 alpha 最好；否则必须是单一纯色背景。
- 不要预先缩小，不要人工锐化，不要添加阴影底板、文字、边框或 UI。
- 请保留模型原始输出，不要覆盖。后处理版本会写入 `assets/approved`。

## 同步提供的信息

每批图至少附带一个文本文件：

```text
batch-01.txt
```

内容：

```text
model: 使用的模型与版本
service: 使用的平台或工具
generated_at: YYYY-MM-DD
prompt: 完整提示词或指向 GENERATION-BRIEF.md 的段落
reference_images: 使用的参考图文件名；没有则写 none
license: 输出的授权条款或平台条款链接
notes: seed、采样参数、编辑说明等
```

## 第一批只需要

每类先生成 4 张：

- `hammer-candidate-01`～`04`
- `sword-candidate-01`～`04`
- `forge-candidate-01`～`04`

第一版不生成火焰动画。火炉直接生成完整的有火/无火两张静态图，保持同镜头和同锚点。
