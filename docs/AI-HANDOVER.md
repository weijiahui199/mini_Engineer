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
- **数据库权限优先确认**：涉及数据库操作问题时，首先让用户确认数据库权限设置，再进行代码修改

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
  /submitTicket/      # 工单核心操作（重要⭐）
    - submit: 提交工单
    - updateStatus: 更新状态
    - acceptTicket: 接单（事务）
    - rejectTicket: 退回
    - pauseTicket: 暂停
    - continueTicket: 继续

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

#### 5. 工单系统核心功能（2025-08-16）
- ✅ 工单接单机制（使用云函数事务确保原子性）
- ✅ 工单退回功能（清空负责人信息）
- ✅ 工单暂停/继续功能（保留负责人信息）
- ✅ 暂停状态UI标识（pending + assigneeOpenid = paused）
- ✅ 时间更新策略优化（按updateTime排序）
- ✅ 附件查看功能（支持图片和文档）

## 🎯 当前状态

### 可以正常使用的功能
1. 用户登录和注册
2. 头像上传和昵称设置
3. Dashboard工作台显示（含暂停工单统计）
4. 个人中心信息展示
5. 完整的工单管理系统：
   - 工单创建和提交
   - 工单接单（防并发）
   - 工单处理状态转换
   - 工单暂停/继续
   - 工单退回/重新分配
   - 工单完成和关闭
   - 附件上传和查看

### 待开发/待完善
1. 材料管理模块
2. 统计报表功能（工作量统计、绩效分析）
3. 消息通知系统（新工单提醒、状态变更通知）
4. 工单评价和反馈系统
5. 批量操作功能（批量分配、批量关闭）
6. 数据导出功能（Excel导出）

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
- **数据库操作问题排查顺序**：
  1. 先确认数据库权限设置（集合权限、字段权限）
  2. 检查云函数权限和环境配置
  3. 验证数据格式和字段名称
  4. 最后才考虑修改代码逻辑

### 3. 代码风格
- 日志格式：`[模块名] 操作: 详情`
- 注释：只在必要时添加，不要过度注释
- 错误处理：always use try-catch for async operations

### 4. 数据库结构

**users集合**：
```javascript
{
  openid: String,      // 微信用户唯一标识
  nickName: String,    // 昵称
  avatar: String,      // 头像FileID
  roleGroup: String,   // 角色：用户/工程师/经理
  department: String,  // 部门
  createTime: Date,
  updateTime: Date
}
```

**tickets集合**（核心）：
```javascript
{
  _id: String,           // 工单ID
  ticketNo: String,      // 工单号 TK20250816xxxxx
  title: String,         // 问题标题
  category: String,      // 问题类型
  priority: String,      // 优先级: urgent/high/medium/low
  status: String,        // 状态: pending/processing/resolved/closed
  
  // 提交人信息
  openid: String,        // 提交人openid
  submitterName: String, // 提交人姓名
  company: String,       // 单位
  department: String,    // 部门
  phone: String,         // 联系电话
  location: String,      // 位置
  
  // 负责人信息（重要：暂停时保留这些字段）
  assigneeOpenid: String,  // 负责人openid
  assigneeName: String,    // 负责人姓名
  
  // 内容
  description: String,     // 问题描述
  attachments: Array,      // 附件列表
  solution: String,        // 解决方案
  
  // 时间字段（所有操作都更新updateTime）
  createTime: Date,        // 创建时间
  updateTime: Date,        // 最后更新时间⭐
  acceptTime: Date,        // 接单时间
  processTime: Date,       // 开始处理时间（只设置一次）
  pauseTime: Date,         // 暂停时间
  continueTime: Date,      // 继续时间
  resolveTime: Date,       // 解决时间
  closeTime: Date,         // 关闭时间
  rejectTime: Date,        // 退回时间
  
  // 其他
  rejectReason: String     // 退回原因
}
```

**重要状态说明**：
- `status='pending' && !assigneeOpenid` = 真正的待处理（工单池）
- `status='pending' && assigneeOpenid` = 暂停状态（UI显示为paused）
- `status='processing'` = 处理中

### 5. 关键文件说明
- `/docs/debug-solutions.md` - **必须维护**，记录所有解决方案
- `/CLAUDE.md` - 项目说明文档
- `/miniprogram/app.json` - 全局配置，页面路由
- `/miniprogram/pages/login/` - 包含2个页面（index和user-setup）

### 6. 关键技术实现

#### 暂停/继续功能的实现逻辑
```javascript
// 判断暂停状态（前端）
if (ticket.status === 'pending' && ticket.assigneeOpenid) {
  displayStatus = 'paused';  // UI显示为暂停
}

// 暂停时不清空负责人（云函数）
if (status === 'pending' && currentStatus === 'processing') {
  updateData.pauseTime = db.serverDate()
  // 注意：保留assigneeOpenid和assigneeName
}
```

#### 工单排序策略
```javascript
// 优先级 + 更新时间排序
.orderBy('priority', 'desc')   // 紧急优先
.orderBy('updateTime', 'desc')  // 最近更新优先
```

#### 防并发接单（事务）
```javascript
// submitTicket云函数的acceptTicket方法
const transaction = await db.startTransaction()
// 1. 查询当前状态
// 2. 检查是否已分配
// 3. 执行接单或回滚
```

### 7. 常见问题快速解决
| 问题 | 解决方法 |
|-----|---------|
| 图标不显示 | 检查路径，使用本地PNG |
| 头像上传失败 | 检查云存储权限和openid |
| 页面跳转失败 | 检查app.json中的页面注册 |
| 样式不生效 | 检查wxss文件和class名称 |
| 数据库更新失败 | 1.检查集合权限 2.确认字段是否存在 3.验证用户openid 4.改用云函数事务 |
| 接单状态未更新 | 使用云函数acceptTicket方法，利用事务确保原子性 |

## 📊 项目统计

- **总页面数**：7个主要页面
- **云函数数**：4个（包含多个action）
- **本地图标数**：20+个
- **解决的问题**：17个（见debug-solutions.md）
- **代码行数**：约8000行
- **数据库集合**：2个（users、tickets）
- **数据库索引建议**：
  - tickets集合：`priority(DESC) + updateTime(DESC)` 复合索引（非唯一）

---

## 最后的话

这是一个结构清晰、基础扎实的微信小程序项目。代码组织良好，遵循了小程序的最佳实践。用户是一个注重细节和文档记录的开发者，请保持这种工作方式。

**记住**：当用户说问题解决了，立即更新 `/docs/debug-solutions.md`！

---
*文档创建时间：2025-08-12*
*最后更新：2025-08-16*

## 📋 更新记录
- 2025-08-16 早期: 添加数据库权限确认原则和问题排查顺序
- 2025-08-16 晚期: 
  - 添加工单系统完整功能说明
  - 更新数据库结构（tickets集合）
  - 添加暂停状态的实现细节
  - 更新项目统计数据
  - 添加云函数submitTicket的详细说明
  - 强调updateTime字段的重要性
- 2024-12-24: 添加微信小程序scroll-view渲染问题和解决方案

### 1. 微信小程序布局陷阱

#### ❌ 避免使用 scroll-view 在复杂布局中
**问题**：scroll-view 组件在以下情况下容易出现内容不渲染的问题：
- 父容器使用 fixed 定位
- 多层 flex 布局嵌套
- 高度使用百分比计算

**错误示例**：
```xml
<!-- 不要这样做 -->
<view class="main-content" style="position: fixed;">
  <scroll-view class="product-list" scroll-y>
    <view class="product-container">
      <!-- 内容可能不显示 -->
    </view>
  </scroll-view>
</view>
```

**正确做法**：
```xml
<!-- 推荐方案 -->
<view class="main-content" style="position: fixed;">
  <view class="product-list" style="overflow-y: auto;">
    <view class="product-container">
      <!-- 内容正常显示 -->
    </view>
  </view>
</view>
```

#### ✅ 布局最佳实践
1. **优先使用简单方案**：普通 view + CSS overflow 比 scroll-view 更可靠
2. **避免过度嵌套**：DOM 层级越少越好
3. **明确高度定义**：使用 calc() 或固定值，避免百分比
4. **flex 布局要点**：
   - 固定元素设置 `flex-shrink: 0`
   - 可变元素设置 `flex: 1`
