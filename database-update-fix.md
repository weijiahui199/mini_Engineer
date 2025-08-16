# 数据库更新问题修复

## 问题描述
点击"开始处理"按钮后，日志显示更新成功，但数据库中工单状态仍然是 `pending`。

## 问题原因
1. **权限问题**：小程序端直接更新数据库可能受到权限限制
2. **异步问题**：数据库更新可能未完全提交
3. **事务一致性**：需要使用事务确保原子性操作

## 解决方案
改用云函数的事务机制来处理接单操作。

### 修改内容

#### 1. acceptTicketSafely 方法优化
```javascript
// 之前：尝试直接更新数据库，然后回退到云函数
// 现在：直接使用云函数事务处理

const cloudResult = await wx.cloud.callFunction({
  name: 'submitTicket',
  data: {
    action: 'acceptTicket',
    ticketId: ticketId
  }
});
```

#### 2. 云函数 acceptTicket 使用事务
```javascript
// 使用事务确保原子性
const transaction = await db.startTransaction()

// 查询并锁定工单
const ticket = await transaction.collection('tickets').doc(ticketId).get()

// 检查并更新
if (!ticket.data.assigneeOpenid) {
  await transaction.collection('tickets').doc(ticketId).update({
    data: {
      assigneeOpenid: wxContext.OPENID,
      assigneeName: userInfo.nickName,
      status: 'processing',
      acceptTime: db.serverDate()
    }
  })
  await transaction.commit()
}
```

## 优势
1. **原子性保证**：事务确保操作要么全部成功，要么全部失败
2. **并发安全**：防止多个工程师同时接单
3. **权限无忧**：云函数有完整的数据库操作权限
4. **数据一致性**：使用 serverDate() 确保时间戳一致

## 测试验证

### 测试步骤
1. 创建新工单（状态为 pending）
2. 工程师A点击"开始处理"
3. 查看日志输出
4. 验证数据库中的状态变化

### 预期结果
```
[acceptTicketSafely] 调用云函数执行接单操作
[acceptTicketSafely] 云函数返回结果: {code: 200, message: "接单成功"}
[acceptTicketSafely] 更新后的状态: processing
[acceptTicketSafely] 更新后的assigneeOpenid: oXXXX_actual_openid
```

### 并发测试
1. 两个工程师同时点击同一工单的"开始处理"
2. 只有一个工程师能成功接单
3. 另一个工程师收到"工单已被其他工程师处理"提示

## 错误处理
- **工单不存在**：返回 404 错误
- **已被接单**：返回 400 错误和友好提示
- **网络错误**：显示详细错误信息
- **其他错误**：记录日志并提示用户重试

## 状态流转
```
pending (待处理)
    ↓ [接单]
processing (处理中)
    ↓ [解决]
resolved (已解决)
    ↓ [关闭]
closed (已关闭)
```

## 注意事项
1. 确保云函数已部署最新版本
2. 检查云函数环境配置正确
3. 验证用户 openid 获取正常
4. 确认数据库集合权限设置

---

修复时间：2025-01-16
修复版本：v2.0.1