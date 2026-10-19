# 第一批生成与上传清单

## 生成顺序

### 1. 大型锻造锤：优先

使用 `docs/assets/GENERATION-BRIEF.md` 的 **A. 大型锻造锤**。

生成 4 张，放入：

```text
assets/incoming/hammer/hammer-candidate-01.png
assets/incoming/hammer/hammer-candidate-02.png
assets/incoming/hammer/hammer-candidate-03.png
assets/incoming/hammer/hammer-candidate-04.png
```

重点：锤头要大；可见侧面必须有一个无遮挡的空圆槽。不要让模型生成彩虹概率环，圆环会由 PixiJS 按实时概率绘制。

### 2. 普通铁剑

使用 Brief 的 **B. 普通铁剑**。生成 4 张，放入：

```text
assets/incoming/sword/sword-candidate-01.png
...
sword-candidate-04.png
```

重点：基础剑应可信但有丰富锻造细节，必须保留后续进化空间。

### 3. 高细节火炉

锤与剑获得一组风格一致的候选后，再使用其中最接近目标的图片作为风格参考，结合 Brief 的 **C. 高细节火炉主体** 生成 4 张：

```text
assets/incoming/forge/forge-candidate-01.png
...
forge-candidate-04.png
```

第一版直接生成两张完整静态图：有火和无火。两张图保持同镜头、同坐标、同主体比例，只改变炉膛内的火焰状态，不生成独立火焰动画。

## 上传前自检

每张候选回答以下问题；任意一项“否”仍可上传，但请在 `batch-01.txt` 中注明：

- 主体是否完整，没有裁切？
- 是否只有一个主体？
- 是否没有文字、水印、UI 和装饰边框？
- 背景是否透明或单一纯色？
- 是否是真正清晰的像素簇，而非模糊的低清图片？
- 光源是否左下暖、右上冷？
- 是否为一致的浅三分之四正交视角？
- 缩小到目标尺寸后关键结构是否仍清楚？

## 上传后由开发代理执行

1. 读取全部候选尺寸、alpha、色数和边缘情况；
2. 生成统一 contact sheet；
3. 在 HD-2D 铁匠铺构图上按真实比例预览；
4. 对每张候选给出通过/拒绝及证据；
5. 选择一个方向或指出需重新生成的精确修改；
6. 去背景、最近邻缩放、色板规范化和像素边缘修复；
7. 将批准源稿写入 `assets/approved`，运行时稿写入 `public/assets/game`；
8. 接入 PixiJS，并在锤头上绘制动态概率圆环。
