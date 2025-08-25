# 待完善功能清单

## 1. 工程师评价系统完善

### 1.1 评价功能需求
- **评价时机**: 工单状态为"已解决"(resolved)后，用户端可以进行评价
- **评价内容**:
  - 星级评分 (1-5星)
  - 文字评价
  - 服务态度、专业能力、响应速度等维度评分（可选）

### 1.2 评价展示
- **位置**: 已关闭工单详情页上方显著位置
- **内容**: 
  - 评分星级
  - 评价内容
  - 评价时间
  - 用户信息（脱敏显示）

### 1.3 工单关闭流程调整
- **当前问题**: 工程师可以直接关闭工单
- **改进方案**:
  1. 工程师只能将工单标记为"已解决"(resolved)
  2. 用户确认解决并评价后，工单自动转为"已关闭"(closed)
  3. 如果用户长时间未评价（如7天），系统自动关闭并默认好评

### 1.4 实现细节
```javascript
// 数据库tickets集合需要新增字段
{
  rating: {
    score: Number,        // 总体评分 1-5
    attitude: Number,     // 服务态度 1-5
    professional: Number, // 专业能力 1-5
    response: Number,     // 响应速度 1-5
    comment: String,      // 文字评价
    ratedAt: Date        // 评价时间
  },
  autoCloseAt: Date      // 自动关闭时间
}
```

## 2. 通知系统实现

### 2.1 通知类型
1. **群体通知** (经理发送)
   - 全体通知
   - 工程师群体通知
   - 用户群体通知

2. **系统通知** (自动触发)
   - 新工单通知 → 工程师群体
   - 工单完成通知 → 提交用户
   - 工单分配通知 → 指定工程师
   - 评价提醒通知 → 用户

### 2.2 数据库设计
```javascript
// 新增 notifications 集合
{
  _id: String,
  type: String,           // 'system' | 'broadcast' | 'personal'
  category: String,       // 'new_ticket' | 'ticket_resolved' | 'announcement' 等
  title: String,          // 通知标题
  content: String,        // 通知内容
  sender: {
    id: String,           // 发送者ID
    name: String,         // 发送者名称
    role: String          // 发送者角色
  },
  targetType: String,     // 'all' | 'engineers' | 'users' | 'individual'
  targetIds: [String],    // 目标用户ID列表（当targetType为individual时）
  relatedId: String,      // 关联ID（如工单ID）
  isRead: Boolean,        // 是否已读
  readBy: [{              // 已读用户列表
    userId: String,
    readAt: Date
  }],
  priority: String,       // 'low' | 'normal' | 'high'
  createdAt: Date,
  expiredAt: Date         // 过期时间
}
```

### 2.3 通知发送流程
1. **经理发送群体通知**
   - 通知管理页面（新增）
   - 选择接收群体
   - 编写通知内容
   - 设置优先级和过期时间

2. **系统自动通知**
   - 工单创建 → 触发新工单通知
   - 工单解决 → 触发完成通知
   - 定时任务检查未评价工单 → 发送评价提醒

### 2.4 通知接收与展示
- **小红点提示**: tabBar和页面内显示未读数量
- **通知中心页面**: 展示所有通知列表
- **推送策略**: 重要通知使用微信服务通知（需要用户授权）

### 2.5 云函数设计
```javascript
// notificationManager 云函数
{
  action: 'send' | 'list' | 'read' | 'delete',
  data: {
    // 根据action不同传递不同参数
  }
}
```

## 3. 用户端登录流程完善

### 3.1 当前问题
- 用户端登录流程不完整
- 缺少与工程师端相似的认证机制
- 用户信息管理不完善

### 3.2 改进方案
参照工程师端实现：
1. **登录页面** (`/pages/login/index.js`)
   - 调用 `wx.login` 获取code
   - 调用云函数换取token
   - 判断是否新用户

2. **用户信息设置** (`/pages/login/user-setup.js`)
   - 头像选择（使用button的chooseAvatar能力）
   - 昵称输入（使用input的nickname类型）
   - 部门、电话等信息填写
   - 提交到云函数保存

3. **认证状态管理**
   - 全局状态存储 (app.globalData)
   - 本地缓存 (wx.setStorageSync)
   - Token过期处理
   - 自动登录机制

### 3.3 需要复用的代码
- `/miniprogram/utils/auth.js` - 认证工具类
- `/cloudfunctions/login/` - 登录云函数
- `/cloudfunctions/userProfile/` - 用户信息云函数

## 4. 代码清理计划

### 4.1 清理范围
- 所有页面的console.log调试输出
- 注释掉的测试代码
- 模拟数据和硬编码数据
- 未使用的变量和函数
- 冗余的导入语句

### 4.2 清理顺序
1. **工具类文件** (`/miniprogram/utils/`)
   - error-handler.js
   - cache-manager.js
   - format.js
   - auth.js

2. **组件文件** (`/miniprogram/components/`)
   - ticket-card/
   - material-item/
   - statistics-chart/

3. **页面文件** (`/miniprogram/pages/`) - 按重要性排序
   - login/ (登录相关)
   - dashboard/ (首页)
   - ticket-list/ (工单列表)
   - ticket-detail/ (工单详情)
   - ticket-create/ (创建工单)
   - material-manage/ (物料管理)
   - material-cart/ (物料购物车)
   - statistics/ (统计)
   - profile/ (个人中心)

4. **云函数** (`/cloudfunctions/`)
   - 每个云函数的调试日志
   - 错误处理优化
   - 返回格式统一

5. **全局文件**
   - app.js
   - app.json
   - app.wxss

### 4.3 清理标准
- **保留**: 错误日志、关键业务日志
- **删除**: console.log、console.dir、debugger
- **优化**: 错误处理统一使用error-handler
- **规范**: 统一代码风格和格式

## 实施计划

### Phase 1: 评价系统 (预计2天)
- Day 1: 数据库结构调整，后端接口开发
- Day 2: 前端页面实现，测试验证

### Phase 2: 通知系统 (预计3天)
- Day 1: 数据库设计，云函数开发
- Day 2: 通知发送功能，经理端界面
- Day 3: 通知接收展示，测试优化

### Phase 3: 用户登录 (预计1天)
- 复用工程师端代码
- 调整用户端特定逻辑
- 测试登录流程

### Phase 4: 代码清理 (预计1天)
- 系统性清理所有调试代码
- 代码格式化和规范化
- 最终测试验证

## 注意事项

1. **数据迁移**: 修改数据库结构时注意现有数据的兼容性
2. **权限控制**: 确保通知系统的权限验证
3. **用户体验**: 评价系统要简单易用，避免强制评价影响体验
4. **性能优化**: 通知查询要考虑分页和缓存
5. **测试覆盖**: 每个功能完成后进行充分测试

## 技术债务记录

1. **缺少单元测试**: 建议后续增加测试覆盖
2. **错误处理不统一**: 需要统一错误码和错误信息格式
3. **缺少操作日志**: 重要操作需要记录审计日志
4. **配置管理**: 环境配置需要更好的管理方式
5. **文档不完整**: API文档需要更详细的说明

---

*创建日期: 2024-12-25*  
*最后更新: 2024-12-25*  
*状态: 待实施*