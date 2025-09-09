# 工程师端评价系统修改清单

## 重要说明
- **项目架构**：本项目为纯微信小程序，不存在desktop端或独立的桌面应用
- **当前状态**：工程师端目前可以将工单标记为`resolved`，但没有`closeTicket`功能实现
- **目标**：限制工程师权限，只允许用户在评价后关闭工单

## 需要修改的文件列表

### 1. `/miniprogram/pages/ticket-detail/index.wxml`

**需要查找并修改的内容：** 工单操作按钮部分

**搜索关键词：** `reopenTicket` 或 `completeTicket`

**修改建议：**
```xml
<!-- 已解决状态 - 工程师视角 -->
<view wx:if="{{ticketInfo.status === 'resolved' && isAssignee}}" class="action-group">
  <button 
    class="custom-action-btn btn-reopen"
    bindtap="reopenTicket"
  >
    重新处理
  </button>
  <!-- 添加等待用户确认的提示 -->
  <view class="status-hint">
    <t-icon name="info-circle" size="32rpx" color="#faad14"/>
    <text>等待用户确认并评价</text>
  </view>
</view>
```

### 2. `/miniprogram/pages/ticket-detail/index.js`

**当前实际情况：**
- 文件中存在`completeTicket`方法（第465-533行），将工单标记为`resolved`
- **不存在`closeTicket`方法**（已确认）
- 存在`reopenTicket`方法（第536-548行）

**修改位置：** 第502-507行 - 修改completeTicket方法的提示文案

**当前代码：**
```javascript
wx.showToast({
  title: '工单已完成',
  icon: 'success',
  duration: 2000
});
```

**修改为：**
```javascript
wx.showToast({
  title: '已标记解决',
  icon: 'success',
  duration: 2000
});

// 建议在showToast后添加提示
setTimeout(() => {
  wx.showModal({
    title: '提示',
    content: '工单已标记为解决状态，等待用户确认和评价',
    showCancel: false,
    confirmText: '知道了'
  });
}, 2000);
```

### 3. `/miniprogram/pages/ticket-detail/index.wxss`

**需要添加的样式：**
```css
/* 状态提示样式 */
.status-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  background: #fff8e6;
  border-radius: 8rpx;
  margin: 20rpx;
}

.status-hint text {
  margin-left: 10rpx;
  color: #faad14;
  font-size: 28rpx;
}

/* 已解决状态的特殊样式 */
.action-group .btn-reopen {
  flex: 1;
  margin-right: 20rpx;
}
```

### 4. `/miniprogram/pages/ticket-list/index.js`

**当前状态映射位置：** data对象中的statusText属性

**当前代码：**
```javascript
statusText: {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
  paused: '已暂停'
}
```

**修改为：**
```javascript
statusText: {
  pending: '待处理',
  processing: '处理中',
  resolved: '待用户确认',  // 修改显示文案
  closed: '已完成',
  paused: '已暂停'
}
```

### 5. `/cloudfunctions/submitTicket/index.js`

**当前情况：**
- 文件中有`updateStatus` action（第54-55行）
- 缺少对closed状态的权限控制

**需要在updateTicketStatus函数中添加权限检查：**

**位置：** updateTicketStatus函数内部（需要先找到该函数的具体位置）

**添加的逻辑：**
```javascript
async function updateTicketStatus(event, wxContext) {
  const { ticketId, status } = event;
  
  // 新增：检查是否试图关闭工单
  if (status === 'closed') {
    // 检查是否为工程师或经理
    const hasEngineerPermission = await checkEngineerPermission(wxContext.OPENID);
    if (hasEngineerPermission) {
      return {
        code: 403,
        message: '工程师不能直接关闭工单，请标记为已解决'
      };
    }
    
    // 验证是否为工单提交者
    const ticket = await db.collection('tickets').doc(ticketId).get();
    if (ticket.data.submitterId !== wxContext.OPENID) {
      return {
        code: 403,
        message: '只有提交者可以关闭工单'
      };
    }
  }
  
  // 继续原有的更新逻辑...
}

## 修改步骤建议

1. **第一步：** 备份当前代码
2. **第二步：** 修改completeTicket方法的提示文案
3. **第三步：** 修改index.wxml，添加等待用户确认的提示
4. **第四步：** 添加状态提示样式到wxss
5. **第五步：** 修改工单列表的状态文本显示
6. **第六步：** 更新云函数权限控制
7. **第七步：** 测试完整流程

## 测试要点

1. **工程师操作测试：**
   - 能正常标记工单为"已解决"
   - 已解决状态显示"等待用户确认"
   - 可以重新处理已解决的工单

2. **界面显示测试：**
   - 已解决状态显示等待确认提示
   - 状态文本正确显示为"待用户确认"
   - 样式显示正常

3. **云函数权限测试：**
   - 工程师不能通过API直接关闭工单
   - 权限验证正确返回错误信息

## 影响分析

1. **对现有功能的影响：**
   - 工程师工作流程基本不变
   - 只是明确了resolved和closed的区别

2. **对数据的影响：**
   - 不影响现有数据
   - resolved状态的工单等待用户操作

3. **对用户端的依赖：**
   - 需要用户端实现评价和关闭功能
   - 建议同步部署用户端更新

## 注意事项

1. **状态流转：** resolved → closed只能由用户触发
2. **用户体验：** 清晰告知工程师新的状态含义
3. **数据一致性：** 确保resolved状态的工单都有solution字段
4. **错误处理：** 添加适当的错误提示

---

*文档更新日期：2024-12-25*  
*预计修改时间：1-2小时*  
*风险等级：低*