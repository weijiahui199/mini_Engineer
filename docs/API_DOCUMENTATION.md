# 工程师端小程序 API 文档

## 📋 概述

本文档详细说明了工程师端小程序的所有云函数API接口，包括请求格式、响应格式、权限要求等。

## 🔧 通用规范

### 请求格式
```javascript
wx.cloud.callFunction({
  name: 'functionName',
  data: {
    action: 'actionName',
    // 其他参数...
  }
})
```

### 响应格式
```javascript
{
  success: true,           // 操作是否成功
  data: {},               // 返回数据
  message: 'Success',     // 消息说明
  code: 200              // 状态码
}
```

### 错误码说明
| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 200 | 成功 | - |
| 400 | 请求参数错误 | 检查请求参数格式和必填字段 |
| 401 | 用户未认证 | 重新登录获取用户信息 |
| 403 | 权限不足 | 联系管理员获取相应权限 |
| 404 | 资源不存在 | 检查资源ID是否正确 |
| 409 | 资源冲突 | 检查是否重复操作 |
| 500 | 服务器内部错误 | 联系技术支持 |

---

## 1️⃣ submitTicket - 工单管理

### 1.1 创建工单
```javascript
// 请求
{
  action: 'create',
  title: '工单标题',
  description: '问题描述',
  category: '问题分类',
  priority: 'medium',      // low, medium, high, urgent
  location: '问题地点',
  attachments: []         // 附件列表
}

// 响应
{
  success: true,
  data: {
    ticketId: 'ticket_xxx',
    ticketNumber: 'T202412001',
    status: 'pending'
  }
}
```

### 1.2 查询工单列表
```javascript
// 请求
{
  action: 'list',
  page: 1,
  pageSize: 10,
  status: 'pending',      // pending, assigned, processing, resolved, closed
  assignedTo: 'engineer_id'  // 可选，查询分配给特定工程师的工单
}

// 响应
{
  success: true,
  data: {
    tickets: [...],
    total: 100,
    page: 1,
    pageSize: 10
  }
}
```

### 1.3 获取工单详情
```javascript
// 请求
{
  action: 'detail',
  ticketId: 'ticket_xxx'
}

// 响应
{
  success: true,
  data: {
    // 完整的工单信息
  }
}
```

### 1.4 更新工单状态
```javascript
// 请求
{
  action: 'update',
  ticketId: 'ticket_xxx',
  updates: {
    status: 'processing',
    comment: '开始处理'
  }
}
```

---

## 2️⃣ ticketAssignment - 工单分配

### 2.1 接受工单
```javascript
// 请求
{
  action: 'acceptTicket',
  ticketId: 'ticket_xxx'
}

// 响应
{
  success: true,
  message: '工单接受成功'
}
```

### 2.2 退回工单
```javascript
// 请求
{
  action: 'rejectTicket',
  ticketId: 'ticket_xxx',
  reason: '退回原因'
}
```

### 2.3 转派工单
```javascript
// 请求
{
  action: 'transferTicket',
  ticketId: 'ticket_xxx',
  toEngineerId: 'engineer_xxx',
  reason: '转派原因'
}
```

### 2.4 分配工程师（经理权限）
```javascript
// 请求
{
  action: 'assignEngineer',
  ticketId: 'ticket_xxx',
  engineerId: 'engineer_xxx',
  reason: '分配原因'
}
```

### 2.5 获取可用工程师列表（经理权限）
```javascript
// 请求
{
  action: 'getAvailableEngineers'
}

// 响应
{
  success: true,
  data: [
    {
      openid: 'engineer_xxx',
      name: '张工程师',
      workload: 0.4,  // 当前负载率
      currentTasks: 2,
      maxTasks: 5,
      canAssign: true
    }
  ]
}
```

---

## 3️⃣ materialManager - 耗材管理

### 3.1 记录耗材使用
```javascript
// 请求
{
  action: 'recordUsage',
  ticketId: 'ticket_xxx',
  materials: [
    {
      materialId: 'material_xxx',
      materialName: '网线',
      quantity: 10,
      unit: '米'
    }
  ],
  description: '更换网线',
  timeSpent: 30  // 分钟
}
```

### 3.2 获取耗材列表
```javascript
// 请求
{
  action: 'listMaterials',
  category: 'network',  // network, computer, office, cable
  page: 1,
  pageSize: 20
}

// 响应
{
  success: true,
  data: {
    materials: [...],
    total: 50
  }
}
```

### 3.3 添加新耗材（经理权限）
```javascript
// 请求
{
  action: 'addMaterial',
  materialName: '耗材名称',
  spec: '规格型号',
  category: 'network',
  unit: '个',
  stock: 100,
  minStock: 10,
  maxStock: 500,
  photo: 'cloud://xxx.jpg'
}
```

### 3.4 更新库存（经理权限）
```javascript
// 请求
{
  action: 'updateStock',
  materialId: 'material_xxx',
  newStock: 150,
  reason: '采购入库'
}
```

### 3.5 获取库存情况
```javascript
// 请求
{
  action: 'getInventory',
  filterLowStock: true  // 只显示低库存
}

// 响应
{
  success: true,
  data: {
    materials: [...],
    stats: {
      totalTypes: 50,
      lowStockCount: 5,
      outOfStockCount: 2,
      adequateStockCount: 43
    }
  }
}
```

### 3.6 获取耗材统计
```javascript
// 请求
{
  action: 'getMaterialStatistics',
  timeRange: 'month',  // week, month, year
  materialId: 'material_xxx'  // 可选，特定耗材
}

// 响应
{
  success: true,
  data: {
    timeRange: 'month',
    topMaterials: [
      {
        materialName: '网线',
        totalQuantity: 100,
        unit: '米',
        usageCount: 15,
        engineerCount: 5,
        ticketCount: 12
      }
    ]
  }
}
```

---

## 4️⃣ helpRequest - 求助管理

### 4.1 创建求助
```javascript
// 请求
{
  action: 'createHelp',
  ticketId: 'ticket_xxx',  // 关联工单
  title: '需要网络专家协助',
  description: '遇到复杂的网络配置问题',
  urgency: 'high',  // low, normal, high, urgent
  targetRole: 'all',  // all, manager, engineer
  attachments: []
}

// 响应
{
  success: true,
  data: {
    helpId: 'help_xxx'
  }
}
```

### 4.2 获取求助列表
```javascript
// 请求
{
  action: 'listHelps',
  page: 1,
  pageSize: 10,
  status: 'open',  // open, responding, resolved, closed
  urgency: 'high',
  onlyMine: false
}
```

### 4.3 响应求助
```javascript
// 请求
{
  action: 'respondHelp',
  helpId: 'help_xxx',
  content: '建议尝试以下方法...',
  attachments: []
}
```

### 4.4 关闭求助
```javascript
// 请求
{
  action: 'closeHelp',
  helpId: 'help_xxx',
  reason: '问题已解决',
  resolved: true  // true=已解决, false=关闭
}
```

---

## 5️⃣ userProfile - 用户管理

### 5.1 获取用户资料
```javascript
// 请求
{
  action: 'getUserProfile'
}

// 响应
{
  success: true,
  data: {
    openid: 'user_xxx',
    name: '张工程师',
    role: 'engineer',  // engineer, manager
    department: 'IT部门',
    phone: '13800138000',
    avatar: 'cloud://xxx.jpg',
    engineerInfo: {
      employeeId: 'EMP001',
      skills: ['网络', '硬件'],
      workingStatus: 'available',
      currentTasks: 3,
      maxTasks: 5
    }
  }
}
```

### 5.2 更新用户资料
```javascript
// 请求
{
  action: 'updateUserProfile',
  profile: {
    name: '新名字',
    phone: '13900139000',
    skills: ['网络', '软件'],
    workingStatus: 'busy'
  }
}
```

---

## 6️⃣ fileManager - 文件管理

### 6.1 获取文件列表
```javascript
// 请求
{
  action: 'list',
  ticketId: 'ticket_xxx',  // 可选，按工单筛选
  fileType: 'image',        // 可选，按类型筛选
  page: 1,
  pageSize: 20
}
```

### 6.2 删除文件
```javascript
// 请求
{
  action: 'delete',
  fileId: 'cloud://xxx/file.jpg',
  reason: '删除原因'
}
```

---

## 7️⃣ uploadFile - 文件上传

### 7.1 获取上传凭证
```javascript
// 请求
{
  action: 'getUploadUrl',
  fileName: 'screenshot.jpg',
  fileSize: 1024000,
  fileType: 'image',
  ticketId: 'ticket_xxx'  // 可选，关联工单
}

// 响应
{
  success: true,
  data: {
    uploadUrl: 'https://xxx.com/upload',
    fileId: 'cloud://xxx/file.jpg',
    uploadToken: 'token_xxx'
  }
}
```

### 7.2 确认上传完成
```javascript
// 请求
{
  action: 'confirmUpload',
  fileId: 'cloud://xxx/file.jpg',
  fileName: 'screenshot.jpg',
  fileSize: 1024000,
  ticketId: 'ticket_xxx'
}
```

---

## 🔒 权限说明

### 工程师权限
- ✅ 创建、查看、更新自己的工单
- ✅ 接受、退回、转派分配给自己的工单
- ✅ 记录耗材使用
- ✅ 查看耗材库存
- ✅ 创建和响应求助
- ✅ 上传文件和更新个人资料

### 经理权限（包含所有工程师权限）
- ✅ 查看所有工单
- ✅ 分配工单给工程师
- ✅ 添加、编辑、删除耗材
- ✅ 调整库存数量
- ✅ 查看团队统计数据
- ✅ 管理所有求助请求

---

## 📝 调用示例

### 完整的工单处理流程
```javascript
// 1. 工程师接受工单
wx.cloud.callFunction({
  name: 'ticketAssignment',
  data: {
    action: 'acceptTicket',
    ticketId: 'ticket_001'
  }
}).then(res => {
  console.log('工单已接受')
  
  // 2. 记录耗材使用
  return wx.cloud.callFunction({
    name: 'materialManager',
    data: {
      action: 'recordUsage',
      ticketId: 'ticket_001',
      materials: [
        { materialName: '网线', quantity: 10, unit: '米' }
      ],
      description: '更换办公室网线',
      timeSpent: 45
    }
  })
}).then(res => {
  console.log('耗材使用已记录')
  
  // 3. 更新工单状态为已解决
  return wx.cloud.callFunction({
    name: 'submitTicket',
    data: {
      action: 'update',
      ticketId: 'ticket_001',
      updates: {
        status: 'resolved',
        comment: '问题已解决'
      }
    }
  })
}).then(res => {
  console.log('工单已完成')
})
```

---

## 🚀 部署说明

1. 在微信开发者工具中打开项目
2. 右键点击 cloudfunctions 文件夹下的各云函数
3. 选择"上传并部署：云端安装依赖"
4. 等待部署完成

## 📌 注意事项

1. 所有API调用都需要用户登录认证
2. 敏感操作会记录操作日志
3. 文件上传有大小限制（单文件最大10MB）
4. 批量操作建议分批进行，避免超时
5. 生产环境建议配置云函数并发限制和监控告警