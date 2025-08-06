# 数据库设计文档

## 📊 数据库架构概览

本项目使用微信云开发数据库（基于MongoDB），采用NoSQL文档型数据库结构。

## 🗂️ 数据集合（Collections）

### 1. users - 用户集合
存储所有用户的基本信息和角色权限。

```javascript
{
  _id: "user_xxx",              // 文档ID
  openid: "wx_openid_xxx",      // 微信OpenID（唯一）
  unionid: "wx_unionid_xxx",    // 微信UnionID（可选）
  
  // 基本信息
  name: "张工程师",               // 姓名
  avatar: "cloud://xxx.jpg",     // 头像URL
  phone: "13800138000",          // 手机号
  email: "zhang@company.com",    // 邮箱
  department: "IT部门",          // 部门
  position: "高级工程师",         // 职位
  
  // 角色权限
  role: "engineer",              // 角色: engineer(工程师), manager(经理)
  permissions: ["ticket", "material"],  // 权限列表
  
  // 工程师专属信息
  engineerInfo: {
    employeeId: "EMP001",        // 工号
    skills: ["网络", "硬件", "软件"],  // 技能列表
    certifications: [],          // 认证列表
    workingStatus: "available",  // 工作状态: available, busy, offline
    currentTasks: 3,             // 当前任务数
    maxTasks: 5,                 // 最大任务数
    location: "上海总部"         // 工作地点
  },
  
  // 统计信息
  stats: {
    totalTickets: 256,           // 总处理工单数
    monthlyTickets: 23,          // 本月工单数
    avgRating: 4.8,              // 平均评分
    totalMaterialUsed: 1000      // 总耗材使用量
  },
  
  // 系统信息
  isActive: true,                // 账号是否激活
  lastLoginTime: Date,          // 最后登录时间
  createTime: Date,             // 创建时间
  updateTime: Date              // 更新时间
}
```

### 2. tickets - 工单集合
存储所有工单信息。

```javascript
{
  _id: "ticket_xxx",             // 文档ID
  ticketNumber: "T202412001",    // 工单编号（唯一）
  
  // 基本信息
  title: "网络故障",              // 工单标题
  description: "办公室网络无法连接", // 问题描述
  category: "network",           // 分类: network, hardware, software, other
  priority: "high",              // 优先级: low, medium, high, urgent
  
  // 位置信息
  location: "A栋3楼301室",        // 位置
  building: "A栋",               // 楼栋
  floor: "3楼",                  // 楼层
  room: "301",                   // 房间号
  
  // 提交者信息
  submitterId: "user_xxx",       // 提交者ID
  submitterName: "李经理",        // 提交者姓名
  submitterPhone: "13900139000", // 联系电话
  submitterDept: "财务部",        // 部门
  
  // 分配信息
  assignedTo: "engineer_xxx",    // 分配给（工程师ID）
  assignedBy: "manager_xxx",     // 分配者（经理ID）
  assignedTime: Date,            // 分配时间
  acceptedTime: Date,            // 接受时间
  
  // 状态信息
  status: "processing",          // 状态: pending, assigned, processing, resolved, closed
  statusHistory: [               // 状态历史
    {
      status: "pending",
      timestamp: Date,
      operator: "system",
      comment: "工单创建"
    }
  ],
  
  // 处理信息
  solution: "更换交换机解决",      // 解决方案
  materialsUsed: [               // 使用的耗材
    {
      materialId: "material_xxx",
      materialName: "交换机",
      quantity: 1,
      unit: "个"
    }
  ],
  timeSpent: 120,                // 耗时（分钟）
  
  // 评价信息
  rating: 5,                     // 评分(1-5)
  feedback: "处理及时，服务好",    // 评价内容
  ratedTime: Date,               // 评价时间
  
  // 附件
  attachments: [
    {
      fileId: "cloud://xxx.jpg",
      fileName: "故障截图.jpg",
      fileSize: 102400,
      uploadTime: Date
    }
  ],
  
  // 时间戳
  createTime: Date,              // 创建时间
  updateTime: Date,              // 更新时间
  completeTime: Date,            // 完成时间
  closeTime: Date                // 关闭时间
}
```

### 3. materials - 耗材集合
存储所有耗材的基本信息和库存。

```javascript
{
  _id: "material_xxx",           // 文档ID
  materialName: "网线",           // 耗材名称
  spec: "CAT6 超六类",            // 规格型号
  category: "network",           // 分类: network, computer, office, cable
  
  // 库存信息
  stock: 100,                    // 当前库存
  minStock: 20,                  // 最低库存
  maxStock: 500,                 // 最高库存
  unit: "米",                    // 单位
  
  // 图片信息
  photo: "cloud://xxx.jpg",      // 耗材照片
  thumbnail: "cloud://thumb.jpg", // 缩略图
  
  // 供应商信息（可选）
  supplier: {
    name: "XX科技公司",
    contact: "13800138000",
    price: 5.5                   // 单价（可选，仅管理员可见）
  },
  
  // 系统信息
  isActive: true,                // 是否可用
  createdBy: "manager_xxx",      // 创建者
  createTime: Date,              // 创建时间
  updateTime: Date               // 更新时间
}
```

### 4. materialUsage - 耗材使用记录
记录所有耗材使用情况。

```javascript
{
  _id: "usage_xxx",              // 文档ID
  
  // 关联信息
  ticketId: "ticket_xxx",        // 关联工单ID
  ticketNumber: "T202412001",    // 工单编号
  engineerId: "engineer_xxx",    // 使用者ID
  engineerName: "张工程师",       // 使用者姓名
  
  // 耗材信息
  materials: [
    {
      materialId: "material_xxx",
      materialName: "网线",
      quantity: 10,
      unit: "米",
      stockBefore: 100,          // 使用前库存
      stockAfter: 90             // 使用后库存
    }
  ],
  
  // 使用详情
  purpose: "更换办公室网线",       // 使用目的
  location: "A栋3楼",             // 使用地点
  
  // 时间信息
  usageTime: Date,               // 使用时间
  createTime: Date               // 记录时间
}
```

### 5. helpRequests - 求助记录
存储工程师之间的求助信息。

```javascript
{
  _id: "help_xxx",               // 文档ID
  
  // 求助信息
  requesterId: "engineer_xxx",   // 求助者ID
  requesterName: "张工程师",      // 求助者姓名
  requesterDepartment: "IT部",   // 部门
  
  // 关联信息
  ticketId: "ticket_xxx",        // 关联工单（可选）
  ticketNumber: "T202412001",    // 工单编号
  
  // 求助内容
  title: "需要网络专家协助",       // 求助标题
  description: "复杂的VLAN配置",  // 详细描述
  urgency: "high",               // 紧急程度: low, normal, high, urgent
  targetRole: "all",             // 目标群体: all, manager, engineer
  
  // 响应信息
  status: "responding",          // 状态: open, responding, resolved, closed
  responses: [
    {
      responderId: "engineer_yyy",
      responderName: "李工程师",
      responderRole: "engineer",
      content: "建议检查VLAN配置",
      attachments: [],
      createTime: Date
    }
  ],
  
  // 附件
  attachments: [],
  
  // 关闭信息
  closeReason: "问题已解决",
  closeTime: Date,
  
  // 时间戳
  createTime: Date,
  updateTime: Date
}
```

### 6. worklog - 工作日志
记录工程师的工作日志。

```javascript
{
  _id: "log_xxx",                // 文档ID
  _openid: "engineer_xxx",       // 工程师OpenID
  
  // 关联信息
  ticketId: "ticket_xxx",        // 关联工单
  ticketNumber: "T202412001",    // 工单编号
  
  // 工作内容
  action: "complete",            // 操作: complete, pause, record
  description: "更换交换机",      // 工作描述
  timeSpent: 120,                // 耗时（分钟）
  
  // 使用耗材
  materialsUsed: [
    {
      materialId: "material_xxx",
      materialName: "交换机",
      quantity: 1,
      unit: "个"
    }
  ],
  
  // 时间信息
  createTime: Date               // 创建时间
}
```

### 7. notifications - 通知消息
存储系统通知和消息。

```javascript
{
  _id: "notify_xxx",             // 文档ID
  
  // 接收者信息
  toUser: "user_xxx",            // 接收者ID
  toRole: "engineer",            // 接收者角色
  
  // 通知内容
  type: "ticket_assigned",       // 类型: ticket_assigned, help_request, system
  title: "新工单分配",            // 标题
  message: "您有新的工单需要处理", // 内容
  
  // 关联信息
  relatedId: "ticket_xxx",       // 关联ID（工单、求助等）
  relatedType: "ticket",         // 关联类型
  
  // 状态
  read: false,                   // 是否已读
  readTime: Date,                // 阅读时间
  
  // 优先级
  priority: "normal",            // 优先级: low, normal, high
  
  // 时间信息
  createTime: Date,              // 创建时间
  expireTime: Date               // 过期时间（可选）
}
```

### 8. stockHistory - 库存变更记录
记录所有库存变更历史。

```javascript
{
  _id: "stock_xxx",              // 文档ID
  
  // 耗材信息
  materialId: "material_xxx",    // 耗材ID
  materialName: "网线",          // 耗材名称
  
  // 变更信息
  oldStock: 100,                 // 原库存
  newStock: 150,                 // 新库存
  changeAmount: 50,              // 变化量（正数入库，负数出库）
  changeType: "purchase",        // 类型: purchase(采购), usage(使用), adjust(调整)
  
  // 操作信息
  reason: "月度采购入库",         // 变更原因
  operatedBy: "manager_xxx",     // 操作者
  operatorName: "王经理",         // 操作者姓名
  
  // 关联信息
  relatedId: "ticket_xxx",       // 关联ID（如工单ID）
  relatedType: "ticket",         // 关联类型
  
  // 时间信息
  createTime: Date               // 创建时间
}
```

### 9. statistics - 统计数据缓存
存储预计算的统计数据，提高查询性能。

```javascript
{
  _id: "stat_xxx",               // 文档ID
  type: "daily",                 // 类型: daily, weekly, monthly
  date: "2024-12-01",            // 统计日期
  
  // 工单统计
  ticketStats: {
    total: 50,                   // 总数
    pending: 10,                 // 待处理
    processing: 20,              // 处理中
    resolved: 15,                // 已解决
    closed: 5,                   // 已关闭
    avgResponseTime: 30,         // 平均响应时间（分钟）
    avgResolveTime: 120          // 平均解决时间（分钟）
  },
  
  // 耗材统计
  materialStats: {
    totalUsage: 100,             // 总使用量
    topMaterials: [              // 使用最多的耗材
      { name: "网线", quantity: 50 }
    ]
  },
  
  // 工程师统计
  engineerStats: {
    activeEngineers: 10,         // 活跃工程师数
    totalWorkHours: 800,         // 总工时
    avgTicketsPerEngineer: 5     // 人均工单数
  },
  
  // 生成信息
  generatedTime: Date            // 生成时间
}
```

## 🔑 索引设计

### 重要索引

1. **users集合**
   - openid (唯一索引)
   - role (普通索引)
   - engineerInfo.workingStatus (普通索引)

2. **tickets集合**
   - ticketNumber (唯一索引)
   - status (普通索引)
   - assignedTo (普通索引)
   - createTime (降序索引)
   - priority, createTime (复合索引)

3. **materials集合**
   - materialName, spec (复合唯一索引)
   - category (普通索引)
   - isActive (普通索引)

4. **materialUsage集合**
   - ticketId (普通索引)
   - engineerId (普通索引)
   - usageTime (降序索引)

5. **helpRequests集合**
   - requesterId (普通索引)
   - status (普通索引)
   - urgency, createTime (复合索引)

6. **notifications集合**
   - toUser, read (复合索引)
   - createTime (降序索引)

## 📈 数据关系图

```
users (用户)
  ├── tickets (工单) [1:N]
  ├── materialUsage (耗材使用) [1:N]
  ├── helpRequests (求助) [1:N]
  ├── worklog (工作日志) [1:N]
  └── notifications (通知) [1:N]

tickets (工单)
  ├── materialUsage (耗材使用) [1:N]
  ├── worklog (工作日志) [1:N]
  └── helpRequests (求助) [1:1]

materials (耗材)
  ├── materialUsage (使用记录) [1:N]
  └── stockHistory (库存变更) [1:N]
```

## 🔐 安全规则

### 数据库安全规则示例

```json
{
  "users": {
    "read": "auth.openid == doc._openid || get('database.users.${auth.openid}').role == 'manager'",
    "write": "auth.openid == doc._openid || get('database.users.${auth.openid}').role == 'manager'"
  },
  "tickets": {
    "read": "auth.openid == doc.submitterId || auth.openid == doc.assignedTo || get('database.users.${auth.openid}').role == 'manager'",
    "write": "auth.openid == doc.assignedTo || get('database.users.${auth.openid}').role == 'manager'"
  },
  "materials": {
    "read": true,
    "write": "get('database.users.${auth.openid}').role == 'manager'"
  }
}
```

## 🚀 性能优化建议

1. **分页查询**：所有列表查询都应实现分页，避免一次性加载大量数据
2. **字段投影**：只查询需要的字段，减少数据传输量
3. **缓存策略**：对于统计数据，使用statistics集合缓存，定期更新
4. **索引优化**：根据实际查询模式调整索引
5. **数据归档**：定期将历史数据归档，保持主集合性能

## 📝 数据迁移

如需从其他系统迁移数据，建议步骤：

1. 导出原系统数据为JSON格式
2. 编写数据转换脚本，匹配新的数据结构
3. 使用云函数批量导入，每批100条
4. 验证数据完整性和关联关系
5. 重建索引，优化查询性能