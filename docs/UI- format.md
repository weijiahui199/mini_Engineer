# 微信小程序 UI 设计规范（Prompt 版 · 精简数据化）

> 作为设计/生成器，请严格按下述**数据**与**规则**输出 Page / Component。单位默认 **rpx**（750 等宽栅格），必要时给出 px 对照。

---

## 0. 基础度量 & 栅格

* 画布：`width = 750`；内容最大宽：`≤ 750`
* 全局左右安全留白：`padding-x = 32`
* 间距体系（8 基数）：`[8, 12, 16, 20, 24] px → [16, 24, 32, 40, 48] rpx`
* 圆角：`xs=8 | sm=12 | md=16 | lg=24`
* 阴影（iOS/Android 统一弱化）：`y=4 blur=16 α=0.08`
* 触控热区最小：`88×88`
* Safe Area：底部附加 `env(safe-area-inset-bottom)`

---

## 1. 文字（WeUI 对齐）

| 语义      | 字号 | 行高 |  粗细 |
| ------- | -: | -: | --: |
| H1      | 40 | 56 | 600 |
| H2      | 36 | 52 | 600 |
| Title   | 32 | 48 | 600 |
| Body    | 28 | 44 | 400 |
| Caption | 24 | 36 | 400 |

> 文本最小不低于 24；编号/长串一律**中间省略**。

---

## 2. 颜色 Token

```yaml
brand.primary:   "#5B9FE6 / #4A8DD4"   # 主题蓝
text.primary:    "rgba(0,0,0,0.9)"
text.secondary:  "rgba(0,0,0,0.6)"
text.tertiary:   "rgba(0,0,0,0.4)"
line.divider:    "rgba(0,0,0,0.08)"
bg.page:         "#F7F8FA"
bg.card:         "#FFFFFF"
state.success:   "#07C160"
state.warning:   "#FAAD14"
state.error:     "#FA5151"
disabled.alpha:  0.4
```

* 暗色：将文字 α 提升 0.1，卡片背景 `#121212`，分割线 α=0.16。

---

## 3. 导航 & 基础框架

* **NavBar**：`height=88`，标题居中，右侧按钮触控区 `≥88×88`
* **TabBar**：`height=98`，图标 48，文案 22；选中高亮 `brand.primary`
* **页面内边距**：上下 `24–32`，左右 `32`
* **Section 标题**：上 `24`、下 `16`

---

## 4. 控件尺寸（统一高度）

| 控件                 |  高度 | 左右内边距 |
| ------------------ | --: | ----: |
| Button/Large       |  88 |    32 |
| Button/Medium      |  80 |    28 |
| Button/Small       |  64 |    24 |
| Input              |  88 |    28 |
| Stepper（±）         |  64 |     — |
| Tag/Chip           |  56 |    20 |
| Checkbox/Radio 命中区 | ≥88 |     — |

* 主要按钮：填充 `brand.primary`，文字白；禁用降 α 到 `disabled.alpha`。

---

## 5. 列表 / 卡片

* **列表行**：`min-height=96`；左右 `32`；主副文 `8` 间距
* **卡片**：外间距 `16`，内边距 `32`；卡与卡 `16–20`；分割线 `line.divider`
* 列表行右侧元素**与标题基线对齐**；辅助信息灰度 `text.secondary`

---

## 6. 弹层（ActionSheet / 抽屉 / Dialog）

* **Bottom Sheet**：顶部把手 `72×8`；圆角 `24`；最大高 `70vh`
* **Dialog**：宽 `min(86vw, 640)`；标题-正文 `16`；正文-按钮区 `24`
* 遮罩透明度：`0.4`；允许**下滑/点遮罩**关闭（有破坏性操作除外）

---

## 7. 反馈组件

* **Toast**：停留 `1.5–2.0s`；最大宽 `70vw`
* **Loading**：≥ `500ms` 再显示；骨架屏用于 `>800ms` 的列表
* **空态**：图 `200–240` 高，主文 `Body`，次文 `Caption`

---

## 8. 交互 & 动效

* 过渡时长：`进入 200–240ms` / `离开 160–200ms`
* Easing：`cubic-bezier(0.2,0,0,1)`（惯性减速）
* 左滑关闭 sheet、右滑返回页面遵循系统手势；长按触发菜单 `>350ms`

---

## 9. 可访问性

* 对比度：正文文本 ≥ **4.5:1**
* 动态字体：字号可增至 `+2 级` 不破版
* 图标需配合可读文案；表单控件必须有 `label`

---

## 10. 资源 & 性能

* 图片：列表缩略 `≤ 112×112`，封面 `≤ 686×386`；WebP 优先
* 图标：`iconfont/SVG`；同主题线性/填充风格统一
* 滚动列表使用 `recycle-view/分块渲染`；首屏可交互 `≤ 1s`

---

## 11. 组件参数示例（与你的“申领车”两页贴合）

```yaml
Page.PaddingX: 32
Card.Padding: 32
Card.Gap: 16
ListItem.MinHeight: 96
Chip.Height: 56
BottomBar.Height: 64
BottomBar.PaddingX: 32
NavBar.Height: 88
Search.Height: 80
Tab.IndicatorHeight: 4
Sheet.Radius: 24
Sheet.Handle: { width:72, height:8 }
```

---

> 按上述 Token/尺寸在 **750rpx 栅格**内排版；所有文本/控件左起 **X=32** 对齐；相邻组件使用 `[16/24/32/40/48]` 中最近的间距；触控目标 ≥ `88×88`；编号/ID 使用**中间省略**；底部与弹层均预留 **Safe Area**；按钮/选中态使用 `#07C160`；分割线使用 `rgba(0,0,0,0.08)`；列表行最小高度 96；NavBar=88、TabBar=98；Sheet 顶部有把手，支持下滑关闭；正文字号 28、标题 32–40，行高按表执行。输出组件需标注：`size/spacing/radius/state` 四项数据。

——以上即**精简版、小程序对齐**的设计规范，可直接落地或作为 Prompt 约束。
