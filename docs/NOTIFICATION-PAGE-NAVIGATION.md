# 通知跳转页面配置说明

## 当前通知类型的跳转配置

### 1. 新工单通知
- **跳转页面**：`pages/ticket-detail/index?id=${ticketId}`
- **说明**：直接跳转到具体的工单详情页
- **用户体验**：工程师点击通知后可以立即查看工单详情并接单

### 2. 工单取消通知
- **跳转页面**：`pages/ticket-detail/index?id=${ticketId}`
- **说明**：跳转到被取消的工单详情页
- **用户体验**：工程师可以查看取消原因和工单历史

### 3. 经理通知（群发）
- **默认跳转页面**：`pages/dashboard/index`
- **支持自定义**：可以指定任意页面和参数
- **用户体验**：根据通知内容跳转到相关页面

## 经理通知的跳转页面选项

### 可选的跳转页面

#### 1. 首页/仪表板（默认）
```javascript
{
  page: 'pages/dashboard/index'
}
```
适用场景：一般公告、日常通知

#### 2. 工单列表页
```javascript
{
  page: 'pages/ticket-list/index',
  params: {
    filter: 'urgent'  // 可以带筛选参数
  }
}
```
适用场景：紧急工单提醒、工单统计通知

#### 3. 特定工单详情
```javascript
{
  page: 'pages/ticket-detail/index',
  params: {
    id: 'ticket_id_here'
  }
}
```
适用场景：重要工单指派、特定工单关注

#### 4. 个人中心
```javascript
{
  page: 'pages/profile/index'
}
```
适用场景：账号相关通知、权限变更通知

#### 5. 公告页面（如果有）
```javascript
{
  page: 'pages/announcement/index',
  params: {
    id: 'announcement_id'
  }
}
```
适用场景：重要公告、系统维护通知

## 发送经理通知的示例代码

### 示例1：发送紧急工单提醒
```javascript
await wx.cloud.callFunction({
  name: 'sendNotification',
  data: {
    type: 'manager_notice',
    broadcastData: {
      targetType: 'all_engineers',
      title: '紧急工单提醒',
      content: '有新的紧急工单需要处理',
      priority: 'high',
      page: 'pages/ticket-list/index',
      params: {
        filter: 'urgent'
      }
    }
  }
})
```

### 示例2：发送系统公告
```javascript
await wx.cloud.callFunction({
  name: 'sendNotification',
  data: {
    type: 'manager_notice',
    broadcastData: {
      targetType: 'all_engineers',
      title: '系统维护通知',
      content: '今晚10点系统维护',
      priority: 'normal',
      page: 'pages/dashboard/index'  // 跳转到首页
    }
  }
})
```

### 示例3：指定工单关注
```javascript
await wx.cloud.callFunction({
  name: 'sendNotification',
  data: {
    type: 'manager_notice',
    broadcastData: {
      targets: ['engineer_openid_1', 'engineer_openid_2'],  // 指定工程师
      title: 'VIP客户工单',
      content: '请优先处理此工单',
      priority: 'high',
      page: 'pages/ticket-detail/index',
      params: {
        id: 'specific_ticket_id'
      }
    }
  }
})
```

## 实现经理发送界面（建议）

### 创建经理群发页面
```javascript
// pages/manager/broadcast/index.js
Page({
  data: {
    // 页面跳转选项
    pageOptions: [
      { label: '首页', value: 'pages/dashboard/index' },
      { label: '工单列表', value: 'pages/ticket-list/index' },
      { label: '个人中心', value: 'pages/profile/index' },
      { label: '自定义', value: 'custom' }
    ],
    selectedPage: 'pages/dashboard/index',
    customPage: '',
    
    // 目标选项
    targetOptions: [
      { label: '所有工程师', value: 'all_engineers' },
      { label: '指定人员', value: 'specific' }
    ],
    selectedTarget: 'all_engineers',
    
    // 通知内容
    title: '',
    content: '',
    priority: 'normal'
  },
  
  // 发送通知
  async sendBroadcast() {
    const { selectedPage, customPage, selectedTarget, title, content, priority } = this.data
    
    // 确定跳转页面
    const page = selectedPage === 'custom' ? customPage : selectedPage
    
    // 构建通知数据
    const broadcastData = {
      targetType: selectedTarget,
      title,
      content,
      priority,
      page
    }
    
    // 调用云函数发送
    const result = await wx.cloud.callFunction({
      name: 'sendNotification',
      data: {
        type: 'manager_notice',
        broadcastData
      }
    })
    
    if (result.result.success) {
      wx.showToast({
        title: `发送成功(${result.result.successCount}人)`,
        icon: 'success'
      })
    }
  }
})
```

## 页面跳转的注意事项

1. **页面路径必须存在**
   - 确保指定的页面路径在小程序中存在
   - 错误的路径会导致跳转失败

2. **参数传递**
   - 参数通过URL query string传递
   - 接收页面需要在 `onLoad` 中获取参数

3. **Tab页面限制**
   - 如果跳转到tab页面，需要使用 `wx.switchTab`
   - 模板消息跳转会自动处理

4. **权限控制**
   - 某些页面可能需要特定权限
   - 确保目标用户有访问权限

## 最佳实践

1. **根据内容选择页面**
   - 工单相关 → 工单列表或详情
   - 公告通知 → 首页或公告页
   - 个人相关 → 个人中心

2. **提供上下文**
   - 通过参数传递必要的上下文信息
   - 让用户快速理解通知内容

3. **避免深层跳转**
   - 不要跳转到需要多步操作才能到达的页面
   - 优先选择直接相关的页面

4. **测试跳转**
   - 发送前测试跳转路径是否正确
   - 确保参数能正确传递和解析

---

*更新时间：2024-12-29*
*版本：1.0.0*