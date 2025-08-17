# 工单处理进度追溯功能 - 简化实施方案

## 文档信息
- **创建日期**: 2025-08-17
- **设计目标**: 清晰展示工单处理过程，特别是退回原因
- **实施难度**: 低-中等

---

## 一、功能定位

### 核心目标
1. **清晰展示处理过程** - 让所有人了解工单经历了什么
2. **突出退回原因** - 帮助下一位工程师快速了解问题
3. **简单直观** - 不增加操作复杂度

---

## 二、数据结构设计（最小化改动）

### 2.1 在现有基础上增加字段

```javascript
// 在现有 tickets 集合中增加
{
  // ... 现有字段
  
  // 新增：处理历史数组
  processHistory: [
    {
      id: "ph_001",
      action: "created",  // created/accepted/processing/paused/rejected/resolved/closed
      operator: "王小明",
      operatorId: "openid_xxx",
      timestamp: "2025-08-17 10:00:00",
      description: "提交工单：网络无法连接",
      reason: null  // 仅在 rejected/paused 时有值
    },
    {
      id: "ph_002", 
      action: "accepted",
      operator: "张工程师",
      operatorId: "openid_yyy",
      timestamp: "2025-08-17 10:15:00",
      description: "接单处理",
      reason: null
    },
    {
      id: "ph_003",
      action: "rejected",
      operator: "张工程师",
      operatorId: "openid_yyy",
      timestamp: "2025-08-17 10:45:00",
      description: "退回工单",
      reason: "需要网络管理员权限才能修改核心交换机配置，建议分配给高级工程师处理"
    },
    {
      id: "ph_004",
      action: "accepted",
      operator: "李工程师",
      operatorId: "openid_zzz",
      timestamp: "2025-08-17 11:00:00",
      description: "重新接单",
      reason: null
    },
    {
      id: "ph_005",
      action: "resolved",
      operator: "李工程师",
      operatorId: "openid_zzz",
      timestamp: "2025-08-17 11:30:00",
      description: "问题已解决",
      reason: null,
      solution: "修改了交换机VLAN配置，端口24从VLAN20改为VLAN10"
    }
  ]
}
```

### 2.2 云函数修改点

只需要在现有的状态更新函数中，同时往 `processHistory` 数组追加记录：

```javascript
// 示例：退回工单时
async function rejectTicket(event, wxContext) {
  const { ticketId, reason } = event;
  
  // ... 现有的验证逻辑
  
  // 准备历史记录
  const historyEntry = {
    id: `ph_${Date.now()}`,
    action: 'rejected',
    operator: userInfo.nickName || '工程师',
    operatorId: wxContext.OPENID,
    timestamp: new Date().toISOString(),
    description: '退回工单',
    reason: reason || '未说明原因'
  };
  
  // 更新时同时追加历史
  await transaction.collection('tickets').doc(ticketId).update({
    data: {
      status: 'pending',
      assigneeOpenid: db.command.remove(),
      assigneeName: db.command.remove(),
      rejectTime: db.serverDate(),
      rejectReason: reason,  // 保留原有字段兼容
      processHistory: db.command.push(historyEntry)  // 追加历史
    }
  });
}
```

---

## 三、界面设计（简洁版）

### 3.1 处理进度时间线

```html
<!-- 处理进度区域 -->
<view class="process-section">
  <view class="section-title">处理进度</view>
  
  <!-- 简化的时间线 -->
  <view class="timeline-simple">
    <view class="timeline-item {{item.action}}" 
          wx:for="{{processHistory}}" 
          wx:key="id">
      
      <!-- 时间线点和线 -->
      <view class="timeline-left">
        <view class="timeline-dot {{item.action}}">
          <t-icon name="{{getActionIcon(item.action)}}" size="24rpx" />
        </view>
        <view class="timeline-line" wx:if="{{index < processHistory.length - 1}}"></view>
      </view>
      
      <!-- 内容区 -->
      <view class="timeline-content">
        <!-- 基本信息 -->
        <view class="timeline-header">
          <text class="timeline-title">{{item.description}}</text>
          <text class="timeline-time">{{item.timestamp}}</text>
        </view>
        
        <view class="timeline-operator">
          <text>{{item.operator}}</text>
        </view>
        
        <!-- 重点：退回原因高亮显示 -->
        <view class="reject-reason-box" wx:if="{{item.action === 'rejected' && item.reason}}">
          <view class="reason-header">
            <t-icon name="info-circle" size="28rpx" color="#ef4444" />
            <text class="reason-label">退回原因：</text>
          </view>
          <text class="reason-content">{{item.reason}}</text>
        </view>
        
        <!-- 暂停原因 -->
        <view class="pause-reason-box" wx:if="{{item.action === 'paused' && item.reason}}">
          <view class="reason-header">
            <t-icon name="pause-circle" size="28rpx" color="#f59e0b" />
            <text class="reason-label">暂停原因：</text>
          </view>
          <text class="reason-content">{{item.reason}}</text>
        </view>
        
        <!-- 解决方案 -->
        <view class="solution-box" wx:if="{{item.action === 'resolved' && item.solution}}">
          <view class="solution-header">
            <t-icon name="check-circle" size="28rpx" color="#10b981" />
            <text class="solution-label">解决方案：</text>
          </view>
          <text class="solution-content">{{item.solution}}</text>
        </view>
      </view>
    </view>
  </view>
</view>
```

### 3.2 样式设计（突出重点）

```css
/* 时间线基础样式 */
.timeline-simple {
  padding: 20rpx;
}

.timeline-item {
  display: flex;
  padding-bottom: 40rpx;
}

.timeline-dot {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 2rpx solid #e5e7eb;
}

/* 不同状态的颜色 */
.timeline-dot.created { border-color: #6b7280; }
.timeline-dot.accepted { border-color: #3b82f6; }
.timeline-dot.processing { border-color: #3b82f6; background: #3b82f6; }
.timeline-dot.rejected { border-color: #ef4444; background: #ef4444; }
.timeline-dot.paused { border-color: #f59e0b; background: #f59e0b; }
.timeline-dot.resolved { border-color: #10b981; background: #10b981; }
.timeline-dot.closed { border-color: #6b7280; background: #6b7280; }

/* 退回原因突出显示 */
.reject-reason-box {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #fef2f2;
  border-left: 4rpx solid #ef4444;
  border-radius: 8rpx;
}

.reason-header {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 10rpx;
}

.reason-label {
  font-weight: 600;
  color: #dc2626;
}

.reason-content {
  color: #7f1d1d;
  line-height: 1.6;
}

/* 暂停原因样式 */
.pause-reason-box {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #fffbeb;
  border-left: 4rpx solid #f59e0b;
  border-radius: 8rpx;
}

.pause-reason-box .reason-label {
  color: #d97706;
}

.pause-reason-box .reason-content {
  color: #78350f;
}

/* 解决方案样式 */
.solution-box {
  margin-top: 20rpx;
  padding: 20rpx;
  background: #f0fdf4;
  border-left: 4rpx solid #10b981;
  border-radius: 8rpx;
}
```

---

## 四、实施步骤

### 第一步：数据库更新（0.5天）
1. 为现有工单添加 `processHistory` 字段（初始为空数组）
2. 编写数据迁移脚本，将现有的时间字段转换为历史记录

### 第二步：云函数修改（1天）
1. 修改 `acceptTicket` - 添加接单历史
2. 修改 `rejectTicket` - 添加退回历史（含原因）
3. 修改 `pauseTicket` - 添加暂停历史（含原因）
4. 修改 `continueTicket` - 添加继续处理历史
5. 修改 `updateStatus` - 添加状态变更历史

### 第三步：前端展示（1天）
1. 修改 `ticket-detail` 页面，添加处理进度时间线
2. 实现退回原因的突出显示
3. 优化时间线的视觉效果

### 第四步：测试优化（0.5天）
1. 测试各种状态变更的历史记录
2. 验证退回原因的显示效果
3. 优化性能

---

## 五、代码示例

### 5.1 页面JS修改

```javascript
// pages/ticket-detail/index.js
Page({
  data: {
    // ... 现有数据
    processHistory: [],  // 处理历史
  },

  // 加载工单详情
  async loadTicketDetail(ticketId) {
    // ... 现有逻辑
    
    // 构建处理历史（如果旧数据没有，则根据现有字段生成）
    const history = ticket.processHistory || this.buildHistoryFromLegacy(ticket);
    
    this.setData({
      processHistory: history,
      // ... 其他数据
    });
  },
  
  // 兼容旧数据：根据现有字段构建历史
  buildHistoryFromLegacy(ticket) {
    const history = [];
    
    // 创建记录
    if (ticket.createTime) {
      history.push({
        id: 'legacy_create',
        action: 'created',
        operator: ticket.submitterName || '用户',
        timestamp: this.formatDateTime(ticket.createTime),
        description: '提交工单'
      });
    }
    
    // 接单记录
    if (ticket.acceptTime && ticket.assigneeName) {
      history.push({
        id: 'legacy_accept',
        action: 'accepted',
        operator: ticket.assigneeName,
        timestamp: this.formatDateTime(ticket.acceptTime),
        description: '接单处理'
      });
    }
    
    // 退回记录
    if (ticket.rejectTime && ticket.rejectReason) {
      history.push({
        id: 'legacy_reject',
        action: 'rejected',
        operator: ticket.assigneeName || '工程师',
        timestamp: this.formatDateTime(ticket.rejectTime),
        description: '退回工单',
        reason: ticket.rejectReason
      });
    }
    
    // ... 其他状态
    
    return history;
  },
  
  // 获取动作图标
  getActionIcon(action) {
    const icons = {
      created: 'add-circle',
      accepted: 'user-checked',
      processing: 'loading',
      rejected: 'rollback',
      paused: 'pause-circle',
      resolved: 'check-circle',
      closed: 'poweroff'
    };
    return icons[action] || 'time';
  }
});
```

---

## 六、预期效果

### 6.1 用户体验
- ✅ **一目了然的处理过程** - 清晰看到工单经历的每个步骤
- ✅ **醒目的退回原因** - 红色背景突出显示，不会错过
- ✅ **快速理解问题** - 新接手的工程师立即了解为什么被退回

### 6.2 实际价值
- **减少重复沟通** - 不用问前一个工程师"为什么退回"
- **提高处理效率** - 看到退回原因直接解决核心问题
- **知识沉淀** - 每次处理都留下记录，便于后续参考

### 6.3 成本控制
- **最小化改动** - 只增加一个历史数组字段
- **兼容旧数据** - 通过转换函数支持旧工单
- **渐进式更新** - 新工单使用新方式，旧工单保持兼容

---

## 七、总结

这个简化方案专注于最核心的需求：
1. **追溯处理过程** - 通过时间线清晰展示
2. **突出退回原因** - 用醒目的方式展示关键信息
3. **实施简单** - 3天内可以完成全部开发

不做复杂的交接系统，不做过度设计，只解决最实际的问题：**让每个接手工单的人都能快速了解情况，特别是为什么被退回**。

---

*文档版本: v1.0 (简化版)*
*创建日期: 2025-08-17*