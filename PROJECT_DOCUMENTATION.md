# IT工程师工作站 - 项目文档

## 项目概览

IT工程师工作站是一个基于微信小程序的企业级工单管理和物料管理系统，专为IT运维团队设计。系统采用微信云开发架构，提供工单处理、物料管理、数据统计等核心功能。

## 技术架构

### 技术栈
- **前端框架**: 微信小程序原生框架
- **UI组件库**: TDesign MiniProgram v1.10.0
- **后端服务**: 微信云函数 (Node.js)
- **数据库**: 微信云数据库 (NoSQL文档数据库)
- **存储服务**: 微信云存储
- **开发工具**: 微信开发者工具

### 系统架构图
```
┌─────────────────────────────────────────────────┐
│             微信小程序客户端                      │
│  ┌──────────┬──────────┬──────────┬──────────┐ │
│  │ Dashboard│ Tickets  │Materials │ Profile  │ │
│  └──────────┴──────────┴──────────┴──────────┘ │
└─────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────┐
│              微信云开发平台                       │
│  ┌──────────────────────────────────────────┐  │
│  │            云函数层                        │  │
│  │  ├─ login (用户认证)                      │  │
│  │  ├─ userProfile (用户管理)                │  │
│  │  ├─ submitTicket (工单提交)               │  │
│  │  ├─ avatarUpload (头像上传)               │  │
│  │  └─ fileManager (文件管理)                │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │            云数据库                        │  │
│  │  ├─ users (用户信息)                      │  │
│  │  ├─ tickets (工单数据)                    │  │
│  │  ├─ materials (物料数据)                  │  │
│  │  └─ statistics (统计数据)                 │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │            云存储                          │  │
│  │  ├─ user-avatars/ (用户头像)              │  │
│  │  └─ attachments/ (附件文件)               │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## 项目结构

```
mini_Engineer/
├── miniprogram/                    # 小程序前端代码
│   ├── pages/                      # 页面组件
│   │   ├── dashboard/               # 工作台首页
│   │   ├── ticket-list/             # 工单列表
│   │   ├── ticket-detail/           # 工单详情
│   │   ├── ticket-create/           # 创建工单
│   │   ├── material-manage/         # 物料管理
│   │   ├── material-cart/           # 物料购物车
│   │   ├── statistics/              # 数据统计
│   │   ├── profile/                 # 个人中心
│   │   └── login/                   # 登录认证
│   │       ├── index                # 登录页
│   │       └── user-setup           # 用户信息设置
│   ├── components/                  # 可复用组件
│   │   ├── ticket-card/             # 工单卡片
│   │   ├── material-item/           # 物料项
│   │   └── statistics-chart/        # 统计图表
│   ├── utils/                       # 工具函数
│   │   ├── error-handler.js         # 错误处理
│   │   ├── cache-manager.js         # 缓存管理
│   │   ├── format.js                # 格式化工具
│   │   └── auth.js                  # 认证工具
│   ├── assets/                      # 静态资源
│   │   └── icons/                   # 图标资源
│   ├── miniprogram_npm/             # NPM构建产物
│   ├── app.js                       # 小程序入口
│   ├── app.json                     # 小程序配置
│   └── app.wxss                     # 全局样式
│
├── cloudfunctions/                  # 云函数目录
│   ├── login/                       # 用户登录认证
│   ├── userProfile/                 # 用户信息管理
│   ├── submitTicket/                # 工单提交处理
│   ├── avatarUpload/                # 头像上传处理
│   └── fileManager/                 # 文件管理服务
│
├── docs/                            # 项目文档
│   ├── AI-HANDOVER.md               # AI交接文档
│   ├── material-development-plan.md # 物料系统开发计划
│   └── material-management-design.md# 物料管理设计文档
│
└── engineer-prototype/              # HTML原型文件
```

## 数据库设计

### 1. users 集合 (用户表)
```javascript
{
  _id: String,              // 文档ID
  openid: String,           // 微信openid (唯一标识)
  nickName: String,         // 用户昵称
  avatarUrl: String,        // 头像URL
  role: String,             // 角色: 'user' | 'engineer' | 'manager'
  department: String,       // 部门
  phone: String,            // 联系电话
  email: String,            // 邮箱
  token: String,            // 认证令牌 (SHA256)
  status: String,           // 状态: 'active' | 'inactive'
  createdAt: Date,          // 创建时间
  updatedAt: Date,          // 更新时间
  lastLoginAt: Date         // 最后登录时间
}
```

### 2. tickets 集合 (工单表)
```javascript
{
  _id: String,              // 文档ID
  ticketId: String,         // 工单编号 (如: IT202412250001)
  title: String,            // 工单标题
  description: String,      // 问题描述
  category: String,         // 分类: 'hardware' | 'software' | 'network' | 'other'
  priority: String,         // 优先级: 'low' | 'medium' | 'high' | 'urgent'
  status: String,           // 状态: 'pending' | 'processing' | 'resolved' | 'closed'
  submitterId: String,      // 提交者openid
  submitterInfo: {          // 提交者信息快照
    nickName: String,
    department: String,
    phone: String
  },
  assigneeId: String,       // 处理人openid
  assigneeInfo: {           // 处理人信息快照
    nickName: String
  },
  attachments: [String],    // 附件URL数组
  resolution: String,       // 解决方案
  feedback: String,         // 用户反馈
  rating: Number,           // 评分 (1-5)
  createdAt: Date,          // 创建时间
  updatedAt: Date,          // 更新时间
  processedAt: Date,        // 开始处理时间
  resolvedAt: Date,         // 解决时间
  closedAt: Date            // 关闭时间
}
```

### 3. materials 集合 (物料表)
```javascript
{
  _id: String,              // 文档ID
  materialId: String,       // 物料编码
  name: String,             // 物料名称
  category: String,         // 分类: 'computer' | 'accessory' | 'consumable' | 'other'
  brand: String,            // 品牌
  model: String,            // 型号
  specifications: String,   // 规格参数
  unit: String,             // 单位 (个/台/件)
  price: Number,            // 单价
  quantity: Number,         // 库存数量
  minStock: Number,         // 最低库存
  location: String,         // 存放位置
  supplier: String,         // 供应商
  imageUrl: String,         // 物料图片
  status: String,           // 状态: 'available' | 'low_stock' | 'out_of_stock'
  tags: [String],           // 标签数组
  createdAt: Date,          // 创建时间
  updatedAt: Date,          // 更新时间
  lastCheckAt: Date         // 最后盘点时间
}
```

### 4. material_records 集合 (物料记录表)
```javascript
{
  _id: String,              // 文档ID
  recordId: String,         // 记录编号
  materialId: String,       // 物料ID
  type: String,             // 类型: 'in' | 'out' | 'adjust'
  quantity: Number,         // 数量 (正数入库，负数出库)
  beforeQuantity: Number,   // 操作前数量
  afterQuantity: Number,    // 操作后数量
  reason: String,           // 原因/用途
  relatedTicketId: String,  // 关联工单ID
  operatorId: String,       // 操作人openid
  operatorName: String,     // 操作人姓名
  remark: String,           // 备注
  createdAt: Date           // 操作时间
}
```

### 5. statistics 集合 (统计数据表)
```javascript
{
  _id: String,              // 文档ID
  type: String,             // 统计类型: 'daily' | 'weekly' | 'monthly'
  date: String,             // 统计日期 (YYYY-MM-DD)
  ticketStats: {            // 工单统计
    total: Number,          // 总数
    pending: Number,        // 待处理
    processing: Number,     // 处理中
    resolved: Number,       // 已解决
    closed: Number,         // 已关闭
    avgProcessTime: Number, // 平均处理时长(小时)
    satisfaction: Number    // 满意度评分
  },
  materialStats: {          // 物料统计
    totalValue: Number,     // 库存总值
    inCount: Number,        // 入库次数
    outCount: Number,       // 出库次数
    lowStockItems: Number   // 低库存物料数
  },
  userStats: {              // 用户统计
    activeUsers: Number,    // 活跃用户数
    newUsers: Number,       // 新增用户数
    engineerWorkload: {     // 工程师工作量
      [engineerId]: Number  // 各工程师处理工单数
    }
  },
  createdAt: Date           // 创建时间
}
```

## 云函数说明

### 1. login 云函数
**功能**: 用户登录认证，生成访问令牌
```javascript
// 请求参数
{
  code: String  // wx.login获取的临时code
}

// 返回结果
{
  success: Boolean,
  data: {
    openid: String,
    token: String,
    isNewUser: Boolean
  }
}
```

### 2. userProfile 云函数
**功能**: 用户信息管理（创建、更新、查询）
```javascript
// 请求参数
{
  action: 'create' | 'update' | 'get',
  token: String,
  data: {
    nickName: String,
    avatarUrl: String,
    department: String,
    phone: String,
    email: String
  }
}

// 返回结果
{
  success: Boolean,
  data: UserObject | null
}
```

### 3. submitTicket 云函数
**功能**: 提交和管理工单
```javascript
// 请求参数
{
  action: 'create' | 'update' | 'list' | 'get',
  token: String,
  data: TicketObject
}

// 返回结果
{
  success: Boolean,
  data: TicketObject | TicketArray
}
```

### 4. avatarUpload 云函数
**功能**: 处理用户头像上传
```javascript
// 请求参数
{
  token: String,
  tempFilePath: String  // 临时文件路径
}

// 返回结果
{
  success: Boolean,
  data: {
    avatarUrl: String  // 云存储URL
  }
}
```

### 5. fileManager 云函数
**功能**: 文件上传和管理
```javascript
// 请求参数
{
  action: 'upload' | 'delete' | 'list',
  token: String,
  fileData: Object
}

// 返回结果
{
  success: Boolean,
  data: FileObject | FileArray
}
```

## 核心功能模块

### 1. 用户认证系统
- **登录流程**: 微信授权 → 获取openid → 生成token → 存储用户信息
- **权限管理**: 基于角色的访问控制 (RBAC)
- **会话管理**: Token认证，本地缓存管理

### 2. 工单管理系统
- **工单生命周期**: 创建 → 分配 → 处理 → 解决 → 关闭
- **优先级管理**: 四级优先级体系
- **分类体系**: 硬件、软件、网络、其他
- **评价系统**: 5星评分 + 文字反馈

### 3. 物料管理系统
- **库存管理**: 实时库存监控，低库存预警
- **出入库记录**: 完整的物料流转记录
- **购物车功能**: 批量申请物料
- **分类管理**: 电脑设备、配件耗材等分类

### 4. 数据统计分析
- **工单统计**: 处理效率、满意度分析
- **物料统计**: 库存价值、使用频率分析
- **人员统计**: 工作量分析、绩效评估
- **趋势分析**: 日、周、月度数据对比

## 开发规范

### 命名规范
- **文件命名**: 小写字母，中划线分隔 (kebab-case)
- **变量命名**: 驼峰命名法 (camelCase)
- **常量命名**: 全大写，下划线分隔 (UPPER_SNAKE_CASE)
- **组件命名**: 小写字母，中划线分隔

### 代码规范
- **缩进**: 2空格
- **引号**: 单引号优先
- **分号**: 省略分号
- **注释**: 关键逻辑必须注释

### Git提交规范
```
feat: 新功能
fix: 修复bug
refactor: 重构代码
style: 样式调整
docs: 文档更新
test: 测试相关
chore: 构建/工具相关
```

## 部署说明

### 环境配置
1. **云开发环境ID**: 在 `envList.js` 中配置
2. **小程序AppID**: 在项目配置中设置
3. **云函数部署**: 使用微信开发者工具上传

### 部署步骤
1. 克隆项目代码
2. 安装依赖: `npm install`
3. 构建npm: 微信开发者工具 → 工具 → 构建npm
4. 部署云函数: 右键云函数文件夹 → 上传并部署
5. 初始化数据库: 创建集合并设置索引
6. 上传小程序代码: 微信开发者工具上传

### 数据库索引配置
```javascript
// users集合索引
- openid: 唯一索引
- token: 普通索引

// tickets集合索引  
- ticketId: 唯一索引
- status: 普通索引
- submitterId: 普通索引
- createdAt: 普通索引

// materials集合索引
- materialId: 唯一索引
- category: 普通索引
- status: 普通索引
```

## 安全考虑

### 数据安全
- Token使用SHA256加密存储
- 敏感信息不在前端存储
- 使用HTTPS传输数据

### 权限控制
- 基于角色的访问控制
- 云函数权限验证
- 数据库安全规则配置

### 隐私保护
- 遵循微信用户隐私协议
- 最小化数据收集原则
- 用户数据加密存储

## 性能优化

### 前端优化
- 图片懒加载
- 分页加载数据
- 本地缓存策略
- 组件按需加载

### 后端优化
- 数据库索引优化
- 云函数冷启动优化
- 批量操作优化
- 缓存策略实施

### 存储优化
- 图片自动压缩 (400x400)
- 文件分目录存储
- 定期清理无用文件
- CDN加速配置

## 监控与维护

### 错误监控
- 统一错误处理机制
- 错误日志收集
- 实时告警通知

### 性能监控
- API响应时间监控
- 页面加载性能监控
- 云函数执行时长监控

### 数据备份
- 定期数据库备份
- 关键数据冗余存储
- 灾难恢复预案

## 后续优化计划

### 功能增强
- [ ] 工单自动分配算法
- [ ] 智能库存预测
- [ ] 移动端推送通知
- [ ] 数据导出功能
- [ ] 批量操作优化

### 技术升级
- [ ] TypeScript重构
- [ ] 单元测试覆盖
- [ ] CI/CD流程建设
- [ ] 微服务架构改造

### 用户体验
- [ ] 界面响应式优化
- [ ] 操作引导优化
- [ ] 快捷操作支持
- [ ] 个性化配置

## 联系方式

- 项目负责人: [待补充]
- 技术支持: [待补充]
- 问题反馈: 通过小程序内反馈功能

---

*文档版本: v1.0.0*  
*更新日期: 2024-12-25*  
*下次更新: 根据项目进展适时更新*