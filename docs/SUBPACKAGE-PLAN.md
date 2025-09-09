# 小程序分包拆分计划（主包 ≤ 1.5MB）

本文给出工程内分包拆分的目标、分组方案、落地步骤与注意事项，确保主包体积控制在 1.5MB 以下，同时保持核心路径不变更或影响最小。

## 目标与现状
- 目标：主包（不含插件）≤ 1.5MB，首屏可用，核心场景流畅。
- 当前主要体积来源（已压缩图标后）：
  - `miniprogram/miniprogram_npm/tdesign-miniprogram` ≈ 3.9MB（组件库）
  - `miniprogram/assets/icons` ≈ 388KB（已由 ~912KB 压缩到 ~388KB）
  - `miniprogram/pages` ≈ 576KB
  - 说明：即使图标压缩，若所有 TDesign 组件都在主包内，仍很难低于 1.5MB，需分包+按页声明组件。

## 拆分原则
- 主包仅保留“最常用、首屏必需”的页面与依赖。
- 业务模块按功能分包，减少一次性打包组件资源。
- 组件“按页声明”，避免在 `app.json` 全局声明过多组件导致主包膨胀。
- 静态资源：通用小图标留主包；较大素材尽量只被分包页面引用。

## 推荐分组
- 主包（core，首屏）：
  - 页面：`pages/login/index`、`pages/login/user-setup`、`pages/dashboard/index`、`pages/ticket-list/index`、`pages/ticket-detail/index`
  - 依赖：仅这些页面用到的 TDesign 组件（改为按页声明）
- 分包 A（materials，耗材功能）：
  - `packages/materials/` 下新建页面目录：
    - `packages/materials/material-list/index`
    - `packages/materials/material-detail/index`
    - `packages/materials/material-cart/index`
- 分包 B（profile，个人中心）：
  - `packages/profile/` 下新建页面目录：
    - `packages/profile/profile/index`（原 `pages/profile/index`）
    - `packages/profile/user-info/index`（原 `pages/user-info/index`）
- 开发/示例（可移除或独立 dev 包）：
  - `pages/example/*`（建议不打包或移到 `packages/dev/example/*` 并默认不预加载）

> 注：微信分包要求分包页面必须位于该分包 `root` 目录下，需物理移动文件。

## app.json 变更示例
1) 在 `app.json` 添加分包声明，并保留主包页面：

```
{
  "pages": [
    "pages/login/index",
    "pages/login/user-setup",
    "pages/dashboard/index",
    "pages/ticket-list/index",
    "pages/ticket-detail/index"
  ],
  "subpackages": [
    {
      "root": "packages/materials",
      "pages": [
        "material-list/index",
        "material-detail/index",
        "material-cart/index"
      ]
    },
    {
      "root": "packages/profile",
      "pages": [
        "profile/index",
        "user-info/index"
      ]
    }
  ],
  "preloadRule": {
    "pages/dashboard/index": {
      "packages": ["packages/materials", "packages/profile"],
      "network": "all"
    }
  }
}
```

2) 组件按页声明：
- 移除 `app.json` 中非必要的 `usingComponents`（已部分精简）。
- 在各页面对应的 `index.json` 中仅声明该页实际使用的 TDesign 组件。
- 示例（`pages/ticket-list/index.json`）：

```
{
  "navigationBarTitleText": "工单列表",
  "enablePullDownRefresh": false,
  "usingComponents": {
    "t-search": "tdesign-miniprogram/search/search",
    "t-swipe-cell": "tdesign-miniprogram/swipe-cell/swipe-cell",
    "t-tag": "tdesign-miniprogram/tag/tag",
    "t-empty": "tdesign-miniprogram/empty/empty",
    "t-loading": "tdesign-miniprogram/loading/loading",
    "t-button": "tdesign-miniprogram/button/button"
  }
}
```

## 物理移动与引用更新
- 将分包页面目录从 `miniprogram/pages/*` 移动到 `miniprogram/packages/<pkg>/*`。
- 更新跳转路径：
  - 例如：
    - 从 `/pages/material-list/index` → `/packages/materials/material-list/index`
    - 从 `/pages/profile/index` → `/packages/profile/profile/index`
- 更新相对引用：页面 JS 内部相对路径可能变化（如 `../../utils/...` → `../../../utils/...`）。
- 建议用搜索（VSCode/`rg`）检查 `navigateTo`/`redirectTo`/`switchTab` 及 `require('../../..')` 的相对路径并批量修正。

## NPM 构建与体积控制
- 构建 npm：开发者工具菜单 “工具 → 构建 npm”。
- `project.config.json` 已设置：
  - `packNpmManually: true` 与根 `package.json`，并忽略 `miniprogram/node_modules/**`。
  - 上传忽略了 `pages/example/**` 与 `miniprogram_npm/**/.wechatide.ib.json`。
- 若仍接近 1.5MB：
  - 进一步将 `<t-icon>` 改为 `<image>` 使用本地 PNG，去除 `t-icon` 依赖（可分阶段）。
  - 确保每个页面的 `usingComponents` 只包含该页使用的组件。

## 预加载与体验
- 可使用 `preloadRule` 在进入首屏后预加载某个分包，降低首次进入分包的白屏时间。
- 也可按需移除 `preloadRule` 以最小化首包下载量。

## 回滚与验证
- 回滚：保留分支或提交点，若出现路径错乱可一键回退。
- 验证清单：
  - [ ] 主包 < 1.5MB（上传前工具会提示）
  - [ ] 首屏功能：登录、Dashboard、工单列表/详情正常
  - [ ] 分包页面：耗材/个人中心能正常打开与返回
  - [ ] 路由跳转 & 相对引用均已修正
  - [ ] 构建 npm 后无丢失组件报错

## 建议实施顺序（可分两次提交）
1) 按页声明组件 + 构建 npm（不移动文件，先瘦身主包）。
2) 移动页面到分包目录 + 更新 `app.json` 的 `subpackages` + 路由与引用修正 + 构建 npm。
3) 视情况添加 `preloadRule` 优化体验。

## 需要我执行的具体改动（可选）
- 我可以直接提交一版 `app.json` 分包配置与页面 `*.json` 的组件按页声明，并迁移 `materials/profile` 页面到 `packages/`，同时修复所有跳转与相对路径。若你确认，就让我继续实施。

