# 耗材管理系统开发计划

> 基于原型设计和需求文档的详细开发执行计划

## 📅 总体时间规划

**开发周期**：5周（25个工作日）
**开始日期**：2024-12-24
**预计完成**：2025-01-24

## 🎯 开发原则

1. **重用优先**：最大化复用现有组件和逻辑
2. **迭代开发**：每个阶段都可独立运行和测试
3. **简化流程**：无审批环节，提交即完成
4. **权限分明**：严格区分Engineer和Manager权限

## 📊 开发阶段划分

### 第一阶段：数据库与云函数基础（3天）

#### Day 1: 数据库设计与初始化
**任务清单**：
- [ ] 创建materials集合及索引
  - 主键索引：_id
  - 复合索引：category + status + updateTime
  - 文本索引：name, description（用于搜索）
- [ ] 创建requisitions集合及索引
  - 主键索引：_id
  - 复合索引：applicantOpenid + createTime
  - 单字段索引：ticketId（关联查询）
- [ ] 创建material_logs集合及索引
  - 复合索引：materialId + createTime
- [ ] 设置集合权限
  - materials：所有用户可读，仅管理端可写
  - requisitions：创建者可读，云函数可写
  - material_logs：仅云函数可写
- [ ] 创建初始测试数据（10-20个耗材样本）

**技术要点**：
```javascript
// 数据库初始化脚本结构
const initCollections = {
  materials: {
    indexes: [
      { keys: { category: 1, status: 1, updateTime: -1 } },
      { keys: { name: 'text', description: 'text' } }
    ],
    permissions: {
      read: "auth.openid != null",
      write: "false" // 仅通过云函数
    }
  }
}
```

#### Day 2: 核心云函数框架
**任务清单**：
- [ ] 创建materialManager云函数
  - list action（支持分页、搜索、筛选）
  - detail action（获取详情，价格过滤）
  - checkStock action（库存校验）
- [ ] 创建requisitionManager云函数
  - submit action（事务处理）
  - list action（分页查询）
  - detail action（详情获取）
- [ ] 实现权限中间件
  - roleGroup验证
  - 价格字段过滤（Engineer不可见）

**代码结构**：
```
/cloudfunctions/
  /materialManager/
    - index.js          # 主入口
    - actions/          # 各action实现
      - list.js
      - detail.js
      - checkStock.js
    - utils/
      - auth.js         # 权限验证
      - filter.js       # 数据过滤
```

#### Day 3: 事务处理与库存管理
**任务清单**：
- [ ] 实现申领提交事务
  - 批量库存检查
  - 原子性扣减
  - 申领单创建
  - 日志记录
- [ ] 实现库存管理功能
  - updateStock action（入库/出库）
  - 安全库存预警逻辑
- [ ] 错误处理与回滚机制
- [ ] 单元测试编写

**关键代码**：
```javascript
// 申领提交事务示例
async function submitRequisition(items, userInfo) {
  const transaction = await db.startTransaction()
  try {
    // 1. 批量检查库存
    // 2. 扣减库存
    // 3. 创建申领单
    // 4. 记录日志
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

// CSV导出示例
async function exportInventoryToCSV(filters) {
  const materials = await db.collection('materials')
    .where(filters)
    .get()
  
  const headers = ['耗材编号','耗材名称','类目','规格','单位','当前库存','安全库存','库存状态','成本价','销售价','更新时间']
  const rows = materials.data.map(m => [
    m.materialNo,
    m.name,
    m.category,
    m.variants[0].label,
    m.unit,
    m.totalStock,
    m.variants[0].safetyStock,
    m.totalStock > m.variants[0].safetyStock ? '正常' : '预警',
    m.variants[0].costPrice,
    m.variants[0].salePrice,
    formatDate(m.updateTime)
  ])
  
  return generateCSV(rows, headers)
}
```

---

### 第二阶段：前端基础页面（5天）

#### Day 4-5: 耗材列表页（首页）
**任务清单**：
- [ ] 页面结构搭建
  - **左侧固定类目导航栏**
    - 常用、纸张、书写、打印耗材、清洁/杂项
    - 底部"添加耗材类型"按钮（Manager可见）
    - 选中类目高亮标识
  - **右侧产品卡片区域**
    - 简洁卡片布局（名称、规格摘要、价格、库存状态）
    - 单规格：直接显示数量步进器
    - 多规格：显示"选规格"按钮
    - 底部"添加耗材产品"按钮（Manager可见）
- [ ] 搜索功能
  - 顶部搜索入口按钮
  - 点击进入独立搜索页（复用ticket-list搜索逻辑）
- [ ] 底部吸底条
  - 左侧：当前仓库 + 库存策略显示
  - 右侧：申领车汇总按钮（显示数量和金额）
  - 渐变色按钮设计

**重用组件清单**：
- SearchBar组件（from ticket-list）
- ListView组件（下拉刷新/上拉加载）
- Empty组件（空状态）
- Loading组件

#### Day 6-7: 耗材详情页
**任务清单**：
- [ ] 页面布局实现
  - 复用ticket-detail导航栏
  - 图片展示区（支持上传）
  - 信息展示区
- [ ] 规格选择器开发
  - Chip组件样式
  - 规格切换逻辑
  - 库存显示（进度条）
- [ ] 数量选择与校验
  - t-stepper集成
  - 最大值限制
  - 实时库存检查
- [ ] 加入购物车功能
  - 本地存储管理
  - 动画效果
  - Toast提示

**技术要点**：
- 图片上传复用avatarUpload逻辑
- 价格显示根据roleGroup条件渲染

#### Day 8: 申领车页面
**任务清单**：
- [ ] 购物车列表实现
  - SwipeCell滑动删除
  - 行内数量修改
  - 实时小计计算
  - 库存不足警告提示
- [ ] **工单关联功能（重点）**
  - 主界面关联区域
    - "关联工单（可选）"标题 + "便于成本追踪"提示
    - 已选工单卡片展示（蓝色背景）
    - 快速选择按钮（显示3个最近处理的工单）
  - 工单选择器弹窗
    - 底部滑出式设计（70vh高度）
    - 搜索栏（工单号、客户、问题描述）
    - 三标签切换（我的工单/最近工单/全部工单）
    - 工单列表（显示状态、问题、客户、时间）
    - 支持"不关联工单"选项
- [ ] 备注信息填写
  - 文本域输入框
  - 字数限制提示
- [ ] 申领须知提醒
  - 黄色背景提示框
  - 关键信息展示
- [ ] 提交处理
  - 提交前库存批量校验
  - Loading状态
  - 成功/失败处理
  - 清空购物车

---

### 第三阶段：管理功能（5天）

#### Day 9-10: 耗材管理页面（Manager专用）
**任务清单**：
- [ ] 管理入口设置
  - 个人中心添加入口
  - 权限判断显示
- [ ] 耗材CRUD界面
  - 列表管理页
  - 新增/编辑表单
  - 删除确认
- [ ] 价格管理
  - 成本价设置
  - 销售价设置
  - 批量修改
- [ ] 图片管理
  - 上传/替换
  - 压缩处理

**权限控制**：
```javascript
// 页面级权限判断
onLoad() {
  const userInfo = wx.getStorageSync('userInfo')
  if (userInfo.roleGroup !== 'Manager') {
    wx.showToast({
      title: '无权限访问',
      icon: 'none'
    })
    wx.navigateBack()
  }
}
```

#### Day 11: 库存管理功能
**任务清单**：
- [ ] 库存调整界面
  - 入库操作
  - 盘点调整
  - 批量操作
- [ ] 库存预警设置
  - 安全库存配置
  - 预警规则设置
- [ ] 操作日志查看
  - 日志列表
  - 筛选功能

#### Day 12-13: 统计报表与导出功能
**任务清单**：
- [ ] 申领记录查询
  - 时间范围筛选
  - 人员筛选
  - CSV导出功能实现
- [ ] 库存导出功能
  - 导出按钮UI
  - 云函数实现CSV生成
  - 前端复制到剪贴板
  - 支持筛选条件导出
- [ ] 统计图表
  - 使用echarts-for-weixin
  - 耗材使用趋势
  - 部门消耗分析
- [ ] 成本分析
  - 总成本统计
  - 单项成本明细
  - 成本报表导出

---

### 第四阶段：集成优化（4天）

#### Day 14-15: 系统集成
**任务清单**：
- [ ] Dashboard集成
  - 添加耗材管理入口卡片
  - 快捷操作配置
- [ ] 工单关联功能
  - 申领时选择工单
  - 工单详情显示关联耗材
- [ ] 数据同步优化
  - 缓存策略实施
  - 实时更新机制

#### Day 16: 性能优化
**任务清单**：
- [ ] 列表虚拟滚动
- [ ] 图片懒加载
- [ ] 请求防抖节流
- [ ] 本地缓存优化
- [ ] 分包加载配置

#### Day 17: UI/UX优化
**任务清单**：
- [ ] 动画效果添加
- [ ] 加载状态优化
- [ ] 错误提示美化
- [ ] 空状态设计
- [ ] 操作反馈增强

---

### 第五阶段：测试部署（3天）

#### Day 18: 功能测试
**测试清单**：
- [ ] 权限测试
  - User无法访问
  - Engineer可申领不可管理
  - Manager全权限
- [ ] 流程测试
  - 完整申领流程
  - 库存扣减验证
  - 并发申领测试
- [ ] 边界测试
  - 库存不足处理
  - 网络异常处理
  - 数据异常处理

#### Day 19: 修复与优化
**任务清单**：
- [ ] Bug修复
- [ ] 性能调优
- [ ] 代码审查
- [ ] 文档完善

#### Day 20: 上线部署
**部署清单**：
- [ ] 云函数部署
- [ ] 数据库权限配置
- [ ] 生产数据初始化
- [ ] 监控告警设置
- [ ] 用户培训材料

---

## 🔧 技术准备清单

### 环境准备
- [x] 微信开发者工具最新版
- [x] 云开发环境配置
- [ ] 测试数据准备
- [ ] 图标资源准备（购物车、库存等）

### 依赖安装
```bash
# 小程序端
npm install @miniprogram-component-plus/tabs
npm install echarts-for-weixin  # 图表组件

# 云函数端（每个云函数都需要）
npm install wx-server-sdk@latest
```

### 开发工具
- VSCode + 微信小程序插件
- Postman（云函数测试）
- Chrome DevTools（调试）

---

## 📝 开发规范

### 代码规范
1. **命名规范**
   - 页面文件：kebab-case（material-list）
   - 组件文件：kebab-case（quantity-stepper）
   - 云函数：camelCase（materialManager）
   - 变量/函数：camelCase

2. **注释规范**
   - 关键逻辑必须注释
   - 复杂算法需要说明
   - TODO标记未完成功能

3. **Git提交规范**
   ```
   feat: 新增耗材列表页
   fix: 修复库存扣减错误
   refactor: 重构申领提交逻辑
   docs: 更新开发文档
   ```

### 测试规范
1. 每个云函数必须有测试用例
2. 关键流程需要集成测试
3. UI交互需要真机测试

---

## 🚀 快速启动指南

### 1. 创建分支
```bash
git checkout -b feature/material-management
```

### 2. 初始化数据库
```javascript
// 运行 initMaterialDB 云函数
wx.cloud.callFunction({
  name: 'initMaterialDB'
})
```

### 3. 配置页面路由
```json
// app.json
{
  "pages": [
    // ... 现有页面
    "pages/material-list/index",
    "pages/material-detail/index",
    "pages/material-cart/index",
    "pages/material-requisitions/index",
    "pages/material-inventory/index",
    "pages/material-search/index"
  ]
}
```

### 4. 添加入口
在Dashboard或个人中心添加耗材管理入口

## 🎨 UI/UX设计要点

### 基于原型的关键设计决策

1. **左右分栏布局**（耗材列表页）
   - 左侧固定90px类目导航
   - 右侧内容区域自适应
   - 提升浏览效率和用户体验

2. **单/多规格区分处理**
   - 单规格：卡片内直接操作，减少跳转
   - 多规格：点击选规格进入详情页
   - 提高操作效率

3. **工单关联交互设计**
   - 可选但推荐的关联方式
   - 快速选择 + 完整选择器结合
   - 支持搜索和分类浏览
   - 明确的价值提示（成本追踪）

4. **底部吸底条信息展示**
   - 左侧：环境信息（仓库/策略）
   - 右侧：核心操作（申领车汇总）
   - 信息和操作分离，逻辑清晰

5. **库存状态可视化**
   - 颜色标识：绿色（充足）、橙色（库存少）、红色（缺货）
   - 标签展示：直观的文字提示
   - 进度条：详情页的库存量化展示

---

## 📊 进度跟踪

### 里程碑
- [ ] M1: 基础架构完成（Day 3）
- [ ] M2: 核心功能可用（Day 8）
- [ ] M3: 管理功能完成（Day 13）
- [ ] M4: 系统集成完成（Day 17）
- [ ] M5: 正式上线（Day 20）

### 风险管理
| 风险项 | 可能性 | 影响 | 缓解措施 |
|-------|--------|------|----------|
| 事务并发冲突 | 中 | 高 | 使用乐观锁+重试机制 |
| 库存数据不一致 | 低 | 高 | 定期对账+日志审计 |
| 性能瓶颈 | 中 | 中 | 分页+缓存+索引优化 |
| 权限泄露 | 低 | 高 | 双重验证+敏感字段过滤 |

---

## 📚 参考资源

1. **现有代码参考**
   - `/pages/ticket-list/` - 列表页实现
   - `/pages/ticket-detail/` - 详情页布局
   - `/cloudfunctions/submitTicket/` - 云函数结构
   - `/cloudfunctions/avatarUpload/` - 图片上传逻辑

2. **设计文档**
   - `material-management-design.md` - 系统设计
   - `CLAUDE.md` - 项目规范
   - `AI-HANDOVER.md` - 技术要点

3. **外部资源**
   - [TDesign组件库文档](https://tdesign.tencent.com/miniprogram/components)
   - [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)

---

## ✅ 验收标准

### 功能验收
- [ ] 工程师可以浏览和申领耗材
- [ ] 申领后库存自动扣减
- [ ] 经理可以管理耗材和查看所有数据
- [ ] 价格信息对工程师不可见
- [ ] 申领可关联工单
- [ ] CSV导出功能正常工作
- [ ] 导出数据格式正确，中文无乱码

### 性能验收
- [ ] 列表加载时间 < 2秒
- [ ] 申领提交响应 < 3秒
- [ ] 并发10人申领无冲突

### 质量验收
- [ ] 无严重bug
- [ ] 权限控制无漏洞
- [ ] 用户体验流畅

## 📐 原型设计完成情况

### 已完成的HTML原型页面
- ✅ **material-manage.html** - 主入口页面（iframe展示所有界面）
- ✅ **material-list.html** - 耗材列表页（左侧类目+右侧卡片）
- ✅ **material-detail.html** - 耗材详情页（规格选择+库存展示）
- ✅ **material-cart.html** - 申领车页面（含工单关联功能）
- ✅ **material-requisitions.html** - 申领记录页
- ✅ **material-inventory.html** - 库存管理页（Manager专用）

### 原型特色
1. **真实感设计**：模拟iPhone 15 Pro屏幕（393x852px）
2. **TDesign风格**：遵循设计规范，保持一致性
3. **交互完整**：包含所有核心交互逻辑
4. **响应式布局**：适配不同屏幕尺寸

## 🔑 关键实现要点

### 工单关联功能实现策略
```javascript
// 获取可关联工单
async function getAvailableTickets(openid) {
  // 1. 获取用户处理中的工单（优先）
  const processingTickets = await db.collection('tickets')
    .where({
      assigneeOpenid: openid,
      status: 'processing'
    })
    .orderBy('updateTime', 'desc')
    .limit(3)
    .get()
  
  // 2. 获取最近的工单
  const recentTickets = await db.collection('tickets')
    .where({
      assigneeOpenid: openid
    })
    .orderBy('updateTime', 'desc')
    .limit(10)
    .get()
    
  return {
    quickSelect: processingTickets.data.slice(0, 3), // 快速选择
    myTickets: processingTickets.data,                // 我的工单
    recentTickets: recentTickets.data                 // 最近工单
  }
}

// 提交申领时的关联处理
async function submitRequisition(data) {
  const requisition = {
    ...data,
    ticketId: data.ticketId || null,
    ticketSnapshot: data.ticketId ? {
      ticketNo: ticket.ticketNo,
      title: ticket.title,
      department: ticket.department,
      status: ticket.status
    } : null,
    // 其他字段...
  }
  
  // 使用事务确保数据一致性
  await db.runTransaction(async transaction => {
    // 1. 扣减库存
    // 2. 创建申领单
    // 3. 记录日志
    // 4. 如果关联工单，更新工单相关信息
  })
}
```

### 库存实时扣减机制
```javascript
// 申领提交即扣减，无需审批
async function deductStock(items) {
  const transaction = await db.startTransaction()
  
  try {
    for (const item of items) {
      // 1. 获取当前库存（加锁）
      const material = await transaction.collection('materials')
        .doc(item.materialId)
        .get()
      
      // 2. 检查库存是否充足
      const variant = material.variants.find(v => v.variantId === item.variantId)
      if (variant.stock < item.quantity) {
        throw new Error(`${material.name} 库存不足`)
      }
      
      // 3. 扣减库存
      variant.stock -= item.quantity
      await transaction.collection('materials')
        .doc(item.materialId)
        .update({
          variants: material.variants,
          updateTime: db.serverDate()
        })
      
      // 4. 记录库存变动日志
      await transaction.collection('material_logs').add({
        materialId: item.materialId,
        variantId: item.variantId,
        type: 'out',
        quantity: -item.quantity,
        beforeStock: variant.stock + item.quantity,
        afterStock: variant.stock,
        createTime: db.serverDate()
      })
    }
    
    await transaction.commit()
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}
```

---

*计划版本：2.0*
*创建日期：2024-12-24*
*更新内容：基于原型设计和实现经验更新*
*负责人：开发团队*