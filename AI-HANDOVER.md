# AI Agent 交接文档

> 本文档记录了项目开发过程中的重要约定、工作流程和需要传递给下一个AI Agent的关键信息

## 📌 重要约定和记忆事项

### 1. Debug记录规范
**用户约定**：当用户说"成功解决了"或"这个解决方案很好，可以正常运行"时：
- 立即将问题和解决方案记录到 `/docs/debug-solutions.md`
- 使用标准模板记录（见debug-solutions.md中的模板）
- 包含：问题描述、原因分析、解决方案、相关文件、验证结果

### 2. 代码修改原则
- **尽量重用已存在的代码**，避免重复造轮子
- **优先编辑而非创建**：ALWAYS prefer editing existing files over creating new ones
- **不主动创建文档**：NEVER proactively create documentation files unless explicitly requested
- **调试时多加日志**：使用格式 `[模块名] 操作说明: 详细信息`

### 3. 图标使用规范
- **不使用TDesign图标**：因为字体文件CDN加载问题
- **使用本地PNG图标**：所有图标存放在 `/miniprogram/assets/icons/` 目录
- 图标已分类到：common/、system/、business/、user/ 文件夹，如果需要另外添加icon 请告知，我将手动添加。

## 🔧 技术栈和架构

### 项目基础信息
- **类型**：微信小程序（云开发）
- **名称**：IT工程师工作台
- **UI库**：TDesign MiniProgram v1.10.0（仅使用组件，不用图标）
- **后端**：微信云函数 + 云数据库

### 目录结构
```
/miniprogram/          # 小程序前端
  /pages/              # 页面文件
    /login/            # 登录页 + 用户设置页
    /dashboard/        # 工作台首页
    /profile/          # 个人中心
    /ticket-list/      # 工单列表
    /ticket-detail/    # 工单详情
  /assets/icons/       # 本地图标资源
    /common/           # 通用图标
    /system/           # 系统图标
    /business/         # 业务图标
    /user/            # 用户图标
  /utils/             # 工具函数
  /components/        # 自定义组件

/cloudfunctions/       # 云函数
  /login/             # 登录认证
  /userProfile/       # 用户信息管理
  /avatarUpload/      # 头像上传

/docs/                # 文档
  /debug-solutions.md # 问题解决记录⭐
```

## 📝 工作进程记录

### 已完成的主要工作

#### 1. 登录和用户系统
- ✅ 实现微信登录流程（wx.login → 云函数 → token）
- ✅ 用户信息设置页面（头像 + 昵称）
- ✅ 使用新的微信API：`open-type="chooseAvatar"`
- ✅ 头像上传到云存储

#### 2. UI统一和优化
- ✅ 统一三个页面的头像上传方式（登录设置、Dashboard、个人中心）
- ✅ 磨砂玻璃风格的登录界面
- ✅ 渐变背景动画效果
- ✅ 本地图标替代TDesign字体图标

#### 3. 图标系统建立
- ✅ 创建本地图标文件夹结构
- ✅ 整理分类18个PNG图标
- ✅ 统一图标尺寸规范（32-60rpx）
- ✅ 白色滤镜效果：`filter: brightness(0) invert(1)`

#### 4. 问题修复
- ✅ TDesign图标无法显示 → 改用本地PNG
- ✅ 头像边缘被裁剪 → 调整容器样式
- ✅ 图标尺寸过小 → 统一放大到44-60rpx
- ✅ 头像无背景 → 添加灰色背景#f0f0f0

## 🎯 当前状态

### 可以正常使用的功能
1. 用户登录和注册
2. 头像上传和昵称设置
3. Dashboard工作台显示
4. 个人中心信息展示
5. 基础的工单列表

### 待开发/待完善
1. 工单管理系统的完整功能
2. 材料管理模块
3. 统计报表功能
4. 消息通知系统
5. 权限管理（管理员/工程师/普通用户）

## ⚠️ 重要提醒给下一个Agent

### 1. 用户习惯
- 用户喜欢看到**具体的文件路径**和**代码位置**
- 用户期望**快速定位问题**，多加调试日志
- 用户要求**记录成功的解决方案**到文档

### 2. 技术注意事项
- **不要使用 wx.getUserProfile**：已废弃，使用新API
- **不要依赖TDesign图标**：CDN加载有问题
- **云函数更新后需要重新部署**：在开发工具中上传
- **图标使用本地PNG**：路径 `/assets/icons/分类/图标名.png`

### 3. 代码风格
- 日志格式：`[模块名] 操作: 详情`
- 注释：只在必要时添加，不要过度注释
- 错误处理：always use try-catch for async operations

### 4. 数据库结构
**users集合**（最重要）：
```javascript
{
  openid: String,      // 微信用户唯一标识
  nickName: String,    // 昵称
  avatar: String,      // 头像FileID
  roleGroup: String,   // 角色：用户/工程师/管理员
  department: String,  // 部门
  createTime: Date,
  updateTime: Date
}
```

### 5. 关键文件说明
- `/docs/debug-solutions.md` - **必须维护**，记录所有解决方案
- `/CLAUDE.md` - 项目说明文档
- `/miniprogram/app.json` - 全局配置，页面路由
- `/miniprogram/pages/login/` - 包含2个页面（index和user-setup）

### 6. 常见问题快速解决
| 问题 | 解决方法 |
|-----|---------|
| 图标不显示 | 检查路径，使用本地PNG |
| 头像上传失败 | 检查云存储权限和openid |
| 页面跳转失败 | 检查app.json中的页面注册 |
| 样式不生效 | 检查wxss文件和class名称 |

## 📊 项目统计

- **总页面数**：7个主要页面
- **云函数数**：5个
- **本地图标数**：20+个
- **解决的问题**：6个（见debug-solutions.md）
- **代码行数**：约5000行

---

## 最后的话

这是一个结构清晰、基础扎实的微信小程序项目。代码组织良好，遵循了小程序的最佳实践。用户是一个注重细节和文档记录的开发者，请保持这种工作方式。

**记住**：当用户说问题解决了，立即更新 `/docs/debug-solutions.md`！

---
*文档创建时间：2025-08-12*
*最后更新：2025-08-12*