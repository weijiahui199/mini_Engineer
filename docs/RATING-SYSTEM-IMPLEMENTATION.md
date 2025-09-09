# 评价系统实现方案

## 重要说明
- **项目类型**：纯微信小程序项目，无desktop端或桌面应用
- **当前状态**：评价功能已部分实现（约65%完成）
- **工单状态流**：
  - 正常流程：pending → processing → resolved（工程师）→ closed（用户评价后）
  - 取消流程：pending/processing → cancelled（用户取消）
- **特殊状态**：用户端当前使用 `rated` 状态，需统一改为 `closed`
- **通知集成**：评价系统需与通知系统同步开发，实现闭环管理

> 新增补充（通知集成一致性）：
- 统一以 Promise 适配层 `wxp.*` 调用小程序 API；
- 订阅请求需合规绑定交互，或在已确认“总是保持接受”时静默；
- 订阅配额按模板维度记录并用事务消费；
- 统一本地键名 `SUBSCRIBE_LAST_CHECK_AT`；
- 在发送前做能力探测（`getSetting().subscriptionsSetting.itemSettings`）。

## 项目路径
- **工程师端工单详情页面**：`/Users/weijiahui/Desktop/mini_Engineer/miniprogram/pages/ticket-detail`
- **工程师端工单列表页面**：`/Users/weijiahui/Desktop/mini_Engineer/miniprogram/pages/ticket-list`
- **用户端评价页面**：`/Users/weijiahui/Desktop/mini_program/miniprogram/pages/rating`（✅已实现UI）
- **用户端工单列表**：`/Users/weijiahui/Desktop/mini_program/miniprogram/pages/my-tickets`
- **云函数目录**：`/Users/weijiahui/Desktop/mini_Engineer/cloudfunctions/submitTicket`

## 一、工程师端修改

### 1.1 工单详情页面 (`/miniprogram/pages/ticket-detail/`)

#### 当前状态：
- **无closeTicket方法**：代码中不存在关闭工单功能
- **completeTicket方法**：存在，将工单标记为resolved
- **reopenTicket方法**：存在，允许重新处理

#### 需要修改的功能：
1. **确保工程师不能关闭工单**
   - 当前：已经没有关闭功能，无需移除
   - 保持：工程师只能标记为resolved

2. **优化完成工单提示**
   - 当前：`completeTicket()` 方法（第465-533行）将状态改为 `resolved`
   - 修改：更新提示文案，明确告知等待用户确认
   - 注意：solution字段已正确保存（第495行）

3. **界面调整**
   ```xml
   <!-- index.wxml 中需要添加的部分 -->
   <!-- 已解决状态时显示等待用户确认的提示 -->
   <view wx:if="{{ticketInfo.status === 'resolved' && isAssignee}}" class="action-group">
     <button class="custom-action-btn btn-reopen" bindtap="reopenTicket">
       重新处理
     </button>
     <view class="status-hint">
       <t-icon name="info-circle" size="32rpx" color="#faad14"/>
       <text>等待用户确认并评价</text>
     </view>
   </view>
   ```

4. **状态显示优化**
   - 修改`completeTicket`方法的Toast提示（第502-507行）
   - 从"工单已完成"改为"已标记解决"
   - 添加Modal提示等待用户确认

### 1.2 工单列表页面 (`/miniprogram/pages/ticket-list/`)

#### 当前状态映射：
```javascript
// 当前data中的statusText
statusText: {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
  paused: '已暂停'
}
```

#### 需要修改为：
```javascript
statusText: {
  pending: '待处理',
  processing: '处理中',
  resolved: '待用户确认',  // 修改文案
  closed: '已完成',        // 修改文案
  paused: '已暂停'
}
```

## 二、用户端修改

### 2.1 评价页面实现状态（✅已完成90%）

#### 已实现功能：
1. **评价页面** `/Users/weijiahui/Desktop/mini_program/miniprogram/pages/rating/`
   - ✅ 多维度评分（整体满意度、响应速度、服务质量、问题解决）
   - ✅ 文字评价输入（500字限制）
   - ✅ 完整的UI和交互设计
   - ✅ 提交成功页面展示

#### 需要修复的问题（统一到 closed，无 rated）：
1. **状态更新错误**（第112-124行）
   ```javascript
   // 当前错误：更新状态为 'rated'
   await wx.cloud.callFunction({
     name: 'submitTicket',
     data: {
       action: 'updateStatus',
       ticketId: ticketId,
       status: 'rated' // ❌ 应该改为 'closed'
     }
   });
   ```

2. **评价数据存储不完整**
   ```javascript
   // 需要添加专门的 addRating action
   // 先存储评价，再关闭工单
   ```

### 2.2 用户端工单列表优化（已部分实现）

#### 已实现功能：
1. **my-tickets页面**（`/Users/weijiahui/Desktop/mini_program/miniprogram/pages/my-tickets/`）
   - ✅ 支持 `rated` 状态显示（需改为 `closed`）
   - ✅ `navigateToRating()` 方法（第201-208行）
   - ✅ 工单详情弹窗已有"服务评价"按钮

#### 需要优化：
1. **统一状态命名**
   ```javascript
   // 将所有 'rated' 状态改为 'closed'
   statusMap: {
     'pending': '待处理',
     'processing': '处理中',
     'resolved': '待确认',
     'closed': '已完成',  // 原为 'rated': '已评价'
     'cancelled': '已取消' // 🆕 新增取消状态
   }
   ```

2. **添加取消工单功能** 🆕
   ```javascript
   // 在pending或processing状态时显示取消按钮
   async cancelTicket() {
     const res = await wx.showModal({
       title: '确认取消',
       content: '确定要取消这个工单吗？',
       confirmText: '确认取消'
     });
     
     if (res.confirm) {
       await wx.cloud.callFunction({
         name: 'submitTicket',
         data: {
           action: 'cancelTicket',
           ticketId: this.data.ticketId,
           reason: '用户取消'
         }
       });
       // 触发取消通知给工程师
     }
   }
   ```

3. **完善评价后的关闭流程**
   ```javascript
   // 用户确认解决并评价
   async confirmAndRate() {
     // 1. 提交评价
     const ratingResult = await this.submitRating();
     if (!ratingResult) return;
     
     // 2. 关闭工单
     await this.closeTicketByUser();
   }
   
   // 提交评价
   async submitRating() {
     const { rating, ticketId } = this.data;
     
     try {
       const result = await wx.cloud.callFunction({
         name: 'submitTicket',
         data: {
           action: 'addRating',
           ticketId: ticketId,
           rating: {
             ...rating,
             ratedAt: new Date()
           }
         }
       });
       
       if (result.result.code === 200) {
         wx.showToast({ title: '评价成功', icon: 'success' });
         return true;
       }
     } catch (error) {
       wx.showToast({ title: '评价失败', icon: 'error' });
       return false;
     }
   }
   
   // 用户关闭工单
   async closeTicketByUser() {
     try {
       const result = await wx.cloud.callFunction({
         name: 'submitTicket',
         data: {
           action: 'closeByUser',
           ticketId: this.data.ticketId
         }
       });
       
       if (result.result.code === 200) {
         wx.showToast({ title: '工单已关闭', icon: 'success' });
         setTimeout(() => wx.navigateBack(), 1500);
       }
     } catch (error) {
       wx.showToast({ title: '关闭失败', icon: 'error' });
     }
   }
   ```

### 2.3 用户端工单列表修改

1. **显示评价状态**
   ```xml
   <!-- 在工单卡片中显示评价状态 -->
   <view class="ticket-card">
     <!-- 已有内容 -->
     
     <!-- 添加评价提示 -->
     <view wx:if="{{item.status === 'resolved' && !item.rating}}" class="rating-prompt">
       <t-icon name="notification" size="16px"/>
       <text>待评价</text>
     </view>
     
     <!-- 显示已评价 -->
     <view wx:if="{{item.rating}}" class="rating-display">
       <t-rate value="{{item.rating.overall}}" disabled size="16px"/>
     </view>
   </view>
   ```

## 三、云函数修改（关键实现）

### 3.1 submitTicket 云函数增强

**当前支持的actions**：
- ✅ submit, list, detail, update
- ✅ updateStatus（但缺少评价数据存储）
- ✅ acceptTicket, rejectTicket, pauseTicket, continueTicket
- ❌ **缺失：addRating, closeByUser, cancelTicket**

**必须新增的actions：**

```javascript
// 在 submitTicket/index.js 第65行后添加
case 'addRating':
  return await addRating(event, wxContext);

case 'closeByUser':
  return await closeTicketByUser(event, wxContext);

case 'cancelTicket':  // 🆕 新增取消功能
  return await cancelTicket(event, wxContext);

// 添加评价函数（重要：修正实现）
async function addRating(event, wxContext) {
  const { ticketId, rating } = event;
  const openid = wxContext.OPENID;
  
  try {
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get();
    const ticket = ticketRes.data;
    
    // 验证权限：必须是工单提交者
    if (ticket.submitterId !== openid) {
      return { code: 403, message: '只有工单提交者可以评价' };
    }
    
    // 验证工单状态
    if (ticket.status !== 'resolved') {
      return { code: 400, message: '只能评价已解决的工单' };
    }
    
    // 验证是否已评价
    if (ticket.rating && ticket.rating.ratedAt) {
      return { code: 400, message: '工单已评价，不能重复评价' };
    }
    
    // 构建评价数据
    const ratingData = {
      overall: rating.overall || 5,
      speed: rating.speed || 5,
      quality: rating.quality || 5,
      resolution: rating.resolution || 5,
      comment: rating.comment || '',
      ratedAt: new Date(),
      raterId: openid
    };
    
    // 更新工单评价信息
    await db.collection('tickets').doc(ticketId).update({
      data: {
        rating: ratingData,
        updatedAt: new Date()
      }
    });
    
    // 记录操作历史
    await db.collection('tickets').doc(ticketId).update({
      data: {
        processHistory: db.command.push({
          id: `ph_${Date.now()}`,
          action: 'rated',
          operator: '用户',
          operatorId: openid,
          description: `评分：${ratingData.overall}星`,
          timestamp: new Date().toISOString()
        })
      }
    });
    
    return { code: 200, message: '评价成功', data: ratingData };
  } catch (error) {
    console.error('评价失败:', error);
    return { code: 500, message: '评价失败', error: error.message };
  }
}

// 用户关闭工单函数（修正版）
async function closeTicketByUser(event, wxContext) {
  const { ticketId, skipRating = false } = event;
  const openid = wxContext.OPENID;
  
  try {
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get();
    const ticket = ticketRes.data;
    
    // 验证权限
    if (ticket.submitterId !== openid) {
      return { code: 403, message: '只有工单提交者可以关闭工单' };
    }
    
    // 验证工单状态
    if (ticket.status !== 'resolved') {
      return { code: 400, message: '只能关闭已解决的工单' };
    }
    
    // 如果未评价且不跳过评价，则提示先评价
    if (!ticket.rating && !skipRating) {
      return { code: 400, message: '请先评价后再关闭工单' };
    }
    
    // 更新工单状态
    const updateData = {
      status: 'closed',
      closedAt: new Date(),
      closedBy: openid,
      closedReason: skipRating ? '用户跳过评价' : '用户确认并评价',
      updatedAt: new Date()
    };
    
    // 如果跳过评价，添加默认评价
    if (skipRating && !ticket.rating) {
      updateData.rating = {
        overall: 5,
        speed: 5,
        quality: 5,
        resolution: 5,
        comment: '用户未评价',
        ratedAt: new Date(),
        isSkipped: true
      };
    }
    
    await db.collection('tickets').doc(ticketId).update({
      data: updateData
    });
    
    // 添加历史记录
    await db.collection('tickets').doc(ticketId).update({
      data: {
        processHistory: db.command.push({
          id: `ph_${Date.now()}`,
          action: 'closed',
          operator: '用户',
          operatorId: openid,
          description: skipRating ? '用户确认解决（未评价）' : '用户确认解决并已评价',
          timestamp: new Date().toISOString()
        })
      }
    });
    
    return { code: 200, message: '工单已关闭' };
  } catch (error) {
    console.error('关闭工单失败:', error);
    return { code: 500, message: '关闭失败', error: error.message };
  }
}

// 🆕 用户取消工单函数
async function cancelTicket(event, wxContext) {
  const { ticketId, reason } = event;
  const openid = wxContext.OPENID;
  
  try {
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get();
    const ticket = ticketRes.data;
    
    // 验证权限：必须是工单提交者
    if (ticket.submitterId !== openid) {
      return { code: 403, message: '只有工单提交者可以取消' };
    }
    
    // 验证工单状态：只能取消pending或processing状态
    if (!['pending', 'processing'].includes(ticket.status)) {
      return { code: 400, message: '该状态的工单不能取消' };
    }
    
    // 更新工单状态
    await db.collection('tickets').doc(ticketId).update({
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: openid,
        cancelReason: reason || '用户取消',
        updatedAt: new Date()
      }
    });
    
    // 记录操作历史
    await db.collection('tickets').doc(ticketId).update({
      data: {
        processHistory: db.command.push({
          id: `ph_${Date.now()}`,
          action: 'cancelled',
          operator: '用户',
          operatorId: openid,
          description: reason || '用户取消工单',
          timestamp: new Date().toISOString()
        })
      }
    });
    
    // 触发取消通知（如果有指派工程师）
    if (ticket.assigneeOpenid) {
      await cloud.callFunction({
        name: 'sendNotification',
        data: {
          type: 'ticket_cancelled',
          ticketData: {
            ticketNo: ticket.ticketNo,
            assigneeOpenid: ticket.assigneeOpenid,
            cancelReason: reason
          }
        }
      }).catch(err => {
        console.log('取消通知发送失败:', err);
      });
    }
    
    return { code: 200, message: '工单已取消' };
  } catch (error) {
    console.error('取消工单失败:', error);
    return { code: 500, message: '取消失败', error: error.message };
  }
}
```

### 3.2 新增定时任务云函数

创建 `autoCloseTickets` 云函数，用于自动关闭超时未评价的工单：

```javascript
// cloudfunctions/autoCloseTickets/index.js
const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  // 获取7天前的时间
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  // 查询需要自动关闭的工单
  const tickets = await db.collection('tickets')
    .where({
      status: 'resolved',
      resolvedAt: db.command.lt(sevenDaysAgo),
      rating: db.command.exists(false)
    })
    .get();
  
  // 批量关闭工单
  const closePromises = tickets.data.map(ticket => {
    return db.collection('tickets').doc(ticket._id).update({
      data: {
        status: 'closed',
        closedAt: new Date(),
        closedBy: 'system',
        autoClose: true,
        rating: {
          overall: 5,  // 默认好评
          comment: '系统自动好评',
          ratedAt: new Date(),
          isAuto: true
        },
        updatedAt: new Date()
      }
    });
  });
  
  await Promise.all(closePromises);
  
  return {
    code: 200,
    message: `自动关闭了${tickets.data.length}个工单`
  };
};
```

## 四、数据库结构调整

### 当前 tickets 集合结构：
- submitterId: 提交者openid
- assigneeOpenid: 负责工程师openid
- processHistory: 操作历史数组
- solution: 解决方案（已存在）
- status: 工单状态（pending/processing/resolved/closed/cancelled）

### 需要新增的字段：

```javascript
{
  // 评价相关字段
  rating: {
    overall: Number,      // 整体满意度 1-5
    speed: Number,        // 响应速度 1-5
    quality: Number,      // 服务质量 1-5
    resolution: Number,   // 问题解决 1-5
    comment: String,      // 文字评价
    ratedAt: Date,        // 评价时间
    isAuto: Boolean       // 是否系统自动评价
  },
  
  // 关闭相关字段
  closedBy: String,      // 关闭者ID（用户openid或'system'）
  closedAt: Date,        // 关闭时间
  autoClose: Boolean,    // 是否自动关闭
  
  // 取消相关字段 🆕
  cancelledBy: String,   // 取消者ID
  cancelledAt: Date,     // 取消时间
  cancelReason: String,  // 取消原因
  
  // 解决时间字段
  resolvedAt: Date       // 解决时间（工程师标记resolved时记录）
}
```

同时，订阅配额记录建议结构如下（模板维度）：
```javascript
// user_subscriptions
{
  openid: String,
  type: 'ticket_complete' | 'new_ticket' | 'ticket_cancelled' | 'manager_notice',
  templateId: String,   // 模板ID（逐模板入库）
  used: Boolean,
  subscribedAt: Date,
  usedAt: Date
}
```

## 五、优化后的实施步骤

### Phase 1：修复核心问题（0.5天）⚡️ 优先
1. **云函数补充**
   - ✅ 在submitTicket中添加addRating action
   - ✅ 在submitTicket中添加closeByUser action
   - ✅ 在submitTicket中添加cancelTicket action 🆕
   - ✅ 添加完整的错误处理和权限验证
   - ✅ 集成通知触发机制

2. **用户端评价流程修复（去除 rated）**
   - 修改rating页面的submitRating方法
   - 将状态 'rated' 统一改为 'closed'
   - 实现先评价后关闭的完整流程
   - 添加取消工单功能按钮 🆕

### Phase 2：工程师端体验优化（0.5天）
1. **状态文案调整**
   - ticket-list页面：resolved显示为"待用户确认"
   - ticket-detail页面：优化完成工单的提示文案
   - 统一closed状态显示为"已完成"

2. **界面优化**
   - 添加resolved状态的等待提示
   - 显示用户评价信息（如果有）

### Phase 3：数据完整性保障（0.5天）
1. **数据库字段补充**
   ```javascript
   // tickets集合新增字段
   {
     rating: {
       overall: Number,      // 整体满意度
       speed: Number,       // 响应速度
       quality: Number,     // 服务质量
       resolution: Number,  // 问题解决
       comment: String,     // 文字评价
       ratedAt: Date,      // 评价时间
       raterId: String,    // 评价者ID
       isSkipped: Boolean  // 是否跳过评价
     },
     closedBy: String,     // 关闭者ID
     closedAt: Date,       // 关闭时间
     closedReason: String  // 关闭原因
   }
   ```

2. **自动关闭机制**（可选）
   - 创建autoCloseTickets云函数
   - 配置定时触发器（7天无响应自动关闭）

### Phase 4：测试与验证（0.5天）
1. **功能测试清单**
   - ✅ 工程师标记resolved → 用户收到待评价提示
   - ✅ 用户评价 → 数据正确存储
   - ✅ 评价后关闭 → 状态变为closed
   - ✅ 跳过评价 → 默认好评并关闭
   - ✅ 权限验证 → 只有提交者能评价

2. **异常测试**
   - 网络异常处理
   - 重复评价拦截
   - 非法状态转换拦截

## 六、测试要点

### 1. 权限测试
- ✅ 工程师只能将工单标记为resolved，不能关闭
- ✅ 只有工单提交者（submitterId）能评价和关闭
- ✅ 只有工单提交者能取消工单 🆕
- ✅ 其他用户无法操作非自己的工单

### 2. 流程测试
- ✅ 正常流程：pending → processing → resolved → closed
- ✅ 取消流程：pending/processing → cancelled 🆕
- ✅ 暂不评价：resolved状态保持，等待后续评价
- ✅ 自动关闭：7天后无评价自动关闭并默认好评
- ✅ 取消通知：工程师及时收到取消通知 🆕

### 3. 数据完整性
- ✅ 评价数据正确存储在rating字段
- ✅ processHistory完整记录所有操作
- ✅ 状态转换符合业务逻辑

### 4. 界面交互
- ✅ 评价组件在resolved状态正确显示
- ✅ 状态文案准确（"待用户确认"、"已完成"）
- ✅ 评分和文字输入功能正常

## 七、关键问题与解决方案

### 1. 状态不一致问题 🔴
**问题**：用户端使用 `rated` 状态，与文档设计的 `closed` 不一致
**解决方案**：
- 统一将所有 `rated` 改为 `closed`
- 更新数据库中现有的 `rated` 状态记录
- 确保前后端状态映射一致
- 新增 `cancelled` 状态处理 🆕

### 2. 评价数据存储问题 🟡
**问题**：当前只更新状态，未保存具体评价数据
**解决方案**：
- 实现 `addRating` action 先保存评价
- 再调用 `closeByUser` 关闭工单
- 两步操作确保数据完整性

### 3. 权限控制问题 🟡
**问题**：需要严格控制评价和关闭权限
**解决方案**：
```javascript
// 权限验证逻辑
if (ticket.submitterId !== openid) {
  return { code: 403, message: '无权操作' };
}
```

## 八、实施建议

### 1. 快速修复方案（推荐）
**目标**：1天内完成核心功能
- 上午：修复云函数，添加三个关键action（addRating、closeByUser、cancelTicket）
- 下午：修正用户端评价流程，添加取消功能
- 晚上：测试验证，包括取消通知

### 2. 渐进优化方案
**目标**：分阶段上线
- 第1阶段：修复评价流程（0.5天）
- 第2阶段：优化显示文案（0.5天）
- 第3阶段：添加自动关闭（可选）

### 3. 数据迁移方案
```javascript
// 批量更新现有数据的状态
db.collection('tickets').where({
  status: 'rated'
}).update({
  data: {
    status: 'closed'
  }
});
```

同时，建议在后端移除对 `rated` 状态的允许转换：
```javascript
// validStatuses 建议移除 'rated'
const validStatuses = ['pending','processing','resolved','cancelled','closed']

// allowedTransitions 中移除 'resolved' -> 'rated'
const allowedTransitions = {
  'pending': ['processing','cancelled','resolved'],
  'processing': ['pending','resolved','cancelled'],
  'resolved': ['closed','processing'],
  'cancelled': ['pending'],
  'closed': []
}
```

## 九、风险评估

| 风险项 | 等级 | 影响 | 缓解措施 |
|--------|------|------|----------|
| 状态迁移失败 | 中 | 历史数据不一致 | 先备份，分批迁移 |
| 权限验证漏洞 | 高 | 非法评价/取消 | 严格校验submitterId |
| 评价数据丢失 | 中 | 用户体验差 | 两步操作，确保原子性 |
| 取消通知失败 | 中 | 工程师白跑 | 异步发送，记录日志 |
| 自动关闭误判 | 低 | 工单误关闭 | 设置合理的时间阈值 |

## 十、与通知系统集成要点 🔔

### 1. 订阅策略（利用"总是保持以上选择"）
- **用户端**：创建工单流程中请求订阅；若未确认可静默，需绑定在按钮点击或提交事件上。
- **工程师端**：仅在检测到可静默时于登录自动请求；否则提供“开启通知”按钮由用户主动触发。
- **关键**：引导用户首次勾选"总是保持以上选择"

### 2. 通知触发点与订阅管理
```javascript
// 用户创建工单时
async createTicket() {
  // 1. 请求订阅（用户勾选"总是保持"后不会弹窗）
  const res = await wxp.requestSubscribeMessage({ tmplIds: ['完成通知模板ID'] });
  
  // 2. 记录订阅次数
  const accepted = Object.entries(res)
    .filter(([,v]) => v === 'accept')
    .map(([k]) => k);
  if (accepted.length) {
    await recordSubscription({
      acceptedTemplateIds: accepted,
      typeMap: { '完成通知模板ID': 'ticket_complete' }
    });
  }
  
  // 3. 创建工单
  // ...
}

// 发送通知前检查次数
async sendNotification(userId, type) {
  // 检查可用次数
  const hasQuota = await checkSubscriptionQuota(userId, type);
  if (!hasQuota) return { success: false };
  
  // 发送通知
  await cloud.openapi.subscribeMessage.send({...});
  
  // 消耗一次订阅
  await consumeSubscription(userId, type);
}
```

### 3. 订阅次数数据库
```javascript
// user_subscriptions 集合
{
  openid: String,
  type: 'ticket_complete',  // 订阅类型
  templateId: String,       // 模板ID（新增）
  used: false,             // 是否已使用
  subscribedAt: Date,       // 订阅时间
  usedAt: Date             // 使用时间
}
```

补充：发送端建议使用数据库事务消费配额，避免并发下重复使用；本地统一键名 `SUBSCRIBE_LAST_CHECK_AT`，提醒逻辑与静默检查共用。

---

*文档更新时间：2024-12-28*  
*预计实施时间：1-2天*  
*风险等级：中低*
*完成度评估：65%*
*新增功能：工单取消、通知集成*
