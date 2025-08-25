# 工程师端评价系统修改清单

## 需要修改的文件列表

### 1. `/miniprogram/pages/ticket-detail/index.wxml`

**修改位置：** 第228-241行

**当前代码：**
```xml
<!-- 已解决状态 -->
<view wx:elif="{{ticketInfo.status === 'resolved' && isAssignee}}" class="action-group">
  <button 
    class="custom-action-btn btn-reopen"
    bindtap="reopenTicket"
  >
    重新处理
  </button>
  <button 
    class="custom-action-btn btn-close"
    bindtap="closeTicket"
  >
    关闭工单
  </button>
</view>
```

**修改后：**
```xml
<!-- 已解决状态 -->
<view wx:elif="{{ticketInfo.status === 'resolved' && isAssignee}}" class="action-group">
  <button 
    class="custom-action-btn btn-reopen"
    bindtap="reopenTicket"
  >
    重新处理
  </button>
  <!-- 移除关闭工单按钮，工程师无权关闭 -->
  <view class="status-hint">
    <t-icon name="info-circle" size="32rpx" color="#faad14"/>
    <text>等待用户确认并评价</text>
  </view>
</view>
```

### 2. `/miniprogram/pages/ticket-detail/index.js`

**修改位置1：** 第550-564行 - 注释或删除closeTicket方法

**当前代码：**
```javascript
// 关闭工单
closeTicket() {
  wx.showModal({
    title: '关闭工单',
    content: '工单关闭后将无法再进行任何操作，确定要关闭吗？',
    confirmText: '确定关闭',
    cancelText: '取消',
    confirmColor: '#dc2626',
    success: (res) => {
      if (res.confirm) {
        this.updateTicketStatus('closed');
      }
    }
  });
},
```

**修改后：**
```javascript
// 关闭工单 - 工程师端禁用此功能
// closeTicket() {
//   // 工程师不能直接关闭工单，只能标记为已解决
//   // 工单只能由用户确认后关闭
//   wx.showToast({
//     title: '无权限关闭',
//     icon: 'none'
//   });
// },
```

**修改位置2：** 第465-533行 - 修改completeTicket方法的提示文案

**当前代码中的提示：**
```javascript
wx.showToast({
  title: '工单已完成',
  icon: 'success',
  duration: 2000
});
```

**修改后：**
```javascript
wx.showToast({
  title: '已标记解决',
  icon: 'success',
  duration: 2000
});

// 添加额外提示
wx.showModal({
  title: '操作成功',
  content: '工单已标记为解决状态，请等待用户确认和评价',
  showCancel: false,
  confirmText: '知道了'
});
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
  margin: 0 20rpx;
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

**修改位置：** 状态文本映射（约第20-30行）

**当前可能的代码：**
```javascript
statusText: {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭'
}
```

**修改后：**
```javascript
statusText: {
  pending: '待处理',
  processing: '处理中',
  resolved: '待用户确认',  // 修改显示文案
  closed: '已完成'
}
```

### 5. `/miniprogram/pages/ticket-list/index.wxml`

**需要检查的位置：** 工单卡片组件中的状态显示

如果有直接显示状态的地方，需要相应调整文案。

### 6. `/cloudfunctions/submitTicket/index.js`

**需要修改的action：** updateStatus

**添加权限检查：**
```javascript
case 'updateStatus':
  // 检查是否试图直接关闭工单
  if (event.status === 'closed') {
    // 获取用户角色
    const userResult = await db.collection('users')
      .where({ openid })
      .get();
    
    const userRole = userResult.data[0]?.role;
    
    // 只有用户角色为'user'（即提交者）才能关闭
    if (userRole === 'engineer' || userRole === 'manager') {
      return {
        code: 403,
        message: '工程师不能直接关闭工单'
      };
    }
  }
  // 继续原有逻辑...
  break;
```

## 修改步骤建议

1. **第一步：** 备份当前代码
2. **第二步：** 修改index.js，注释closeTicket方法
3. **第三步：** 修改index.wxml，移除关闭按钮
4. **第四步：** 添加状态提示样式
5. **第五步：** 修改状态文本显示
6. **第六步：** 更新云函数权限控制
7. **第七步：** 测试完整流程

## 测试要点

1. **工程师操作测试：**
   - 能正常标记工单为"已解决"
   - 不能将工单关闭
   - 已解决状态显示"等待用户确认"

2. **界面显示测试：**
   - 已解决状态不显示关闭按钮
   - 显示等待用户确认的提示
   - 状态文本正确显示

3. **权限测试：**
   - 尝试通过其他方式关闭工单应被拒绝
   - 云函数权限验证生效

## 影响分析

1. **对现有功能的影响：**
   - 工程师工作流程略有改变
   - 需要培训工程师新的操作流程

2. **对数据的影响：**
   - 不影响现有数据
   - 已关闭的工单保持不变

3. **对用户端的依赖：**
   - 需要用户端实现评价和关闭功能
   - 建议同步部署用户端更新

## 注意事项

1. **向后兼容：** 保留closeTicket方法的定义（注释掉），避免其他地方调用报错
2. **用户体验：** 清晰告知工程师状态变化，避免困惑
3. **数据一致性：** 确保resolved状态的工单都有解决方案字段
4. **错误处理：** 添加适当的错误提示和日志

---

*文档创建日期：2024-12-25*  
*预计修改时间：2-3小时*  
*风险等级：低*