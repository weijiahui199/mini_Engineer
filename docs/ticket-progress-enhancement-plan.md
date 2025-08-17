# 工单处理进度追溯功能 - 精简实施方案

## 文档信息
- **创建日期**: 2025-08-17
- **更新日期**: 2025-08-17
- **设计目标**: 实现简单的处理过程追溯，突出显示退回原因
- **预计工期**: 2天

---

## 一、需求概述

### 1.1 核心需求
1. **处理过程追溯** - 记录工单的完整处理历史
2. **退回原因展示** - 突出显示退回原因，帮助下一位工程师快速了解
3. **简单直观** - 不增加系统复杂度，易于理解和使用

### 1.2 现状问题
- 工单被退回时，下一位工程师不知道原因
- 多人处理同一工单时，缺少历史记录
- 处理过程不透明，用户看不到进展

---

## 二、技术方案

### 2.1 数据结构设计

在现有 `tickets` 集合中新增 `processHistory` 字段：

```javascript
// tickets 集合中的工单数据
{
  _id: "xxx",
  ticketNo: "TK20250817001",
  status: "processing",
  // ... 其他现有字段
  
  // 新增：处理历史数组
  processHistory: [
    {
      id: "ph_1734567890123",
      action: "created",  // created/accepted/rejected/paused/processing/resolved/closed
      operator: "王小明",
      operatorId: "openid_xxx",
      timestamp: "2025-08-17 10:00:00",
      description: "提交工单",
      reason: null  // 仅在 rejected/paused 时有值
    },
    {
      id: "ph_1734567891234",
      action: "accepted",
      operator: "张工程师",
      operatorId: "openid_yyy",
      timestamp: "2025-08-17 10:15:00",
      description: "接单处理",
      reason: null
    },
    {
      id: "ph_1734567892345",
      action: "rejected",
      operator: "张工程师",
      operatorId: "openid_yyy",
      timestamp: "2025-08-17 10:45:00",
      description: "退回工单",
      reason: "需要网络管理员权限才能修改核心交换机配置"  // 重点：退回原因
    }
  ]
}
```

### 2.2 云函数修改

修改 `submitTicket` 云函数，在每次状态变更时记录历史：

```javascript
// 示例：退回工单时记录
async function rejectTicket(event, wxContext) {
  const { ticketId, reason } = event;
  
  // 构建历史记录
  const historyEntry = {
    id: `ph_${Date.now()}`,
    action: 'rejected',
    operator: userInfo.nickName || '工程师',
    operatorId: wxContext.OPENID,
    timestamp: new Date().toISOString(),
    description: '退回工单',
    reason: reason || '未说明原因'
  };
  
  // 更新工单，同时追加历史
  await db.collection('tickets').doc(ticketId).update({
    data: {
      status: 'pending',
      rejectReason: reason,
      processHistory: db.command.push(historyEntry)
    }
  });
}
```

需要修改的云函数方法：
- `submitTicket` - 创建时添加初始历史
- `acceptTicket` - 接单时记录
- `rejectTicket` - 退回时记录（含原因）
- `pauseTicket` - 暂停时记录
- `continueTicket` - 继续时记录
- `updateStatus` - 解决/关闭时记录

---

## 三、前端展示

### 3.1 工单详情页面展示

在 `ticket-detail` 页面中展示处理历史：

```html
<!-- 处理历史区域 -->
<view class="process-history">
  <view class="section-title">处理历史</view>
  
  <view class="history-timeline">
    <view class="history-item" wx:for="{{processHistory}}" wx:key="id">
      <!-- 时间线点 -->
      <view class="timeline-dot {{item.action}}"></view>
      
      <!-- 内容 -->
      <view class="history-content">
        <view class="history-header">
          <text class="history-action">{{item.description}}</text>
          <text class="history-time">{{item.timestamp}}</text>
        </view>
        
        <text class="history-operator">{{item.operator}}</text>
        
        <!-- 重点：退回原因突出显示 -->
        <view class="reject-reason" wx:if="{{item.action === 'rejected' && item.reason}}">
          <view class="reason-label">退回原因：</view>
          <text class="reason-text">{{item.reason}}</text>
        </view>
      </view>
    </view>
  </view>
</view>
```

### 3.2 样式设计（突出退回原因）

```css
/* 退回原因突出显示 */
.reject-reason {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #fef2f2;  /* 浅红色背景 */
  border-left: 4rpx solid #ef4444;  /* 红色边框 */
  border-radius: 8rpx;
}

.reason-label {
  font-weight: 600;
  color: #dc2626;
  margin-bottom: 10rpx;
}

.reason-text {
  color: #7f1d1d;
  line-height: 1.6;
}

/* 时间线样式 */
.timeline-dot {
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  border: 2rpx solid #e5e7eb;
}

.timeline-dot.rejected {
  background: #ef4444;
  border-color: #ef4444;
}

.timeline-dot.accepted {
  background: #3b82f6;
  border-color: #3b82f6;
}
```

---

## 四、实施步骤

### 第一天：后端实现
1. **上午**：修改云函数，添加历史记录功能
   - 修改 `submitTicket` 函数 - 2小时
   - 修改其他状态操作函数 - 2小时
   
2. **下午**：测试和数据迁移
   - 测试各种状态变更的历史记录 - 2小时
   - 为现有工单生成历史记录（兼容旧数据）- 2小时

### 第二天：前端实现
1. **上午**：修改工单详情页
   - 添加历史记录展示组件 - 2小时
   - 实现退回原因突出显示 - 1小时
   - 优化时间线样式 - 1小时
   
2. **下午**：测试和优化
   - 完整流程测试 - 2小时
   - 界面优化调整 - 1小时
   - 文档更新 - 1小时

---

## 五、兼容性处理

### 5.1 旧数据兼容

为没有 `processHistory` 的旧工单生成基础历史：

```javascript
// 在加载工单详情时检查
if (!ticket.processHistory || !ticket.processHistory.length) {
  ticket.processHistory = buildHistoryFromLegacy(ticket);
}

// 根据现有字段构建历史
function buildHistoryFromLegacy(ticket) {
  const history = [];
  
  // 创建记录
  if (ticket.createTime) {
    history.push({
      id: 'legacy_create',
      action: 'created',
      operator: ticket.submitterName || '用户',
      timestamp: formatDateTime(ticket.createTime),
      description: '提交工单'
    });
  }
  
  // 接单记录
  if (ticket.acceptTime) {
    history.push({
      id: 'legacy_accept',
      action: 'accepted',
      operator: ticket.assigneeName,
      timestamp: formatDateTime(ticket.acceptTime),
      description: '接单处理'
    });
  }
  
  // 退回记录（如果有）
  if (ticket.rejectReason) {
    history.push({
      id: 'legacy_reject',
      action: 'rejected',
      operator: ticket.assigneeName,
      timestamp: formatDateTime(ticket.rejectTime),
      description: '退回工单',
      reason: ticket.rejectReason
    });
  }
  
  return history;
}
```

---

## 六、预期效果

### 6.1 用户体验提升
- ✅ **清晰的处理过程** - 一目了然看到工单经历
- ✅ **醒目的退回原因** - 红色背景框突出显示
- ✅ **快速了解问题** - 新接手工程师立即明白原因

### 6.2 实际价值
- 减少重复沟通 - 不用问"为什么退回"
- 提高处理效率 - 直接解决核心问题
- 知识沉淀 - 每次处理都有记录

### 6.3 效果示例

工单详情页将显示：
```
处理历史
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
● 提交工单                 10:00
  王小明
  
● 接单处理                 10:15
  张工程师
  
● 退回工单                 10:45
  张工程师
  ┌─────────────────────────────┐
  │ 退回原因：                   │
  │ 需要网络管理员权限才能修改      │
  │ 核心交换机配置                │
  └─────────────────────────────┘
  
● 重新接单                 11:00
  李工程师（高级）
  
● 问题已解决               11:30
  李工程师（高级）
```

---

## 七、注意事项

1. **性能考虑**
   - processHistory 数组不会无限增长（工单生命周期有限）
   - 使用 `db.command.push` 避免全量更新

2. **数据安全**
   - 历史记录只追加，不删除
   - 保留原有字段，确保向后兼容

3. **用户隐私**
   - 不记录敏感操作细节
   - 仅记录必要的状态变更

---

## 八、总结

本方案专注于最核心的需求：
1. **简单追溯** - 通过 processHistory 数组记录
2. **突出原因** - 红色背景框显示退回原因
3. **快速实施** - 2天完成全部开发

不做复杂功能：
- ❌ 不做实时推送
- ❌ 不做复杂缓存
- ❌ 不做交接系统

只解决实际问题：让每个接手工单的人快速了解情况，特别是退回原因。