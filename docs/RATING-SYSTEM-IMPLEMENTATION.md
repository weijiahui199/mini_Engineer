# 评价系统实现方案

## 一、工程师端修改

### 1.1 工单详情页面 (`/miniprogram/pages/ticket-detail/`)

#### 需要修改的功能：
1. **移除关闭工单按钮**
   - 位置：`index.js` 中的 `closeTicket()` 方法
   - 操作：在工程师端禁用或隐藏关闭按钮
   - 原因：工单只能由用户关闭

2. **修改完成工单逻辑**
   - 当前：`completeTicket()` 方法将状态改为 `resolved`
   - 保持：这个逻辑不变，工程师只能标记为"已解决"
   - 注意：确保解决方案(solution)字段被正确保存

3. **界面调整**
   ```javascript
   // index.wxml 中需要修改的部分
   <!-- 工程师端只显示"标记已解决"按钮，不显示"关闭工单"按钮 -->
   <t-button 
     wx:if="{{ticketInfo.status === 'processing'}}"
     theme="primary" 
     bindtap="completeTicket">
     标记已解决
   </t-button>
   
   <!-- 移除或隐藏关闭按钮 -->
   <!-- <t-button bindtap="closeTicket">关闭工单</t-button> -->
   ```

4. **状态显示优化**
   - 当工单状态为 `resolved` 时，显示"等待用户确认"提示
   - 当工单状态为 `closed` 时，显示评价信息（如果有）

### 1.2 工单列表页面 (`/miniprogram/pages/ticket-list/`)

#### 需要修改的功能：
1. **状态筛选增强**
   - 添加"待用户确认"筛选项（status = resolved）
   - 区分"已解决"和"已关闭"的显示

2. **列表项显示优化**
   ```javascript
   // 状态标签显示
   statusText: {
     pending: '待处理',
     processing: '处理中',
     resolved: '待用户确认',  // 修改文案
     closed: '已完成'         // 修改文案
   }
   ```

## 二、用户端修改

### 2.1 新增评价相关页面/组件

#### 需要创建的文件：
1. **评价组件** `/miniprogram/components/rating/`
   ```xml
   <!-- rating.wxml -->
   <view class="rating-container">
     <view class="rating-title">请对本次服务进行评价</view>
     
     <!-- 总体评分 -->
     <view class="rating-item">
       <text>总体评价</text>
       <t-rate 
         value="{{rating.score}}" 
         bind:change="onScoreChange"
         allow-half="{{false}}"
         size="24px"/>
     </view>
     
     <!-- 维度评分（可选） -->
     <view class="rating-dimensions">
       <view class="dimension-item">
         <text>服务态度</text>
         <t-rate value="{{rating.attitude}}" bind:change="onAttitudeChange"/>
       </view>
       <view class="dimension-item">
         <text>专业能力</text>
         <t-rate value="{{rating.professional}}" bind:change="onProfessionalChange"/>
       </view>
       <view class="dimension-item">
         <text>响应速度</text>
         <t-rate value="{{rating.response}}" bind:change="onResponseChange"/>
       </view>
     </view>
     
     <!-- 文字评价 -->
     <t-textarea 
       placeholder="请输入您的评价（选填）"
       value="{{rating.comment}}"
       bind:change="onCommentChange"
       maxlength="200"/>
     
     <!-- 提交按钮 -->
     <view class="rating-actions">
       <t-button theme="primary" bindtap="submitRating">提交评价并关闭工单</t-button>
       <t-button theme="light" bindtap="skipRating">暂不评价</t-button>
     </view>
   </view>
   ```

### 2.2 用户端工单详情页面修改

#### 需要添加的功能：

1. **评价入口**
   ```javascript
   // 在工单详情页面添加评价逻辑
   data: {
     showRating: false,  // 是否显示评价组件
     hasRated: false,    // 是否已评价
     rating: {
       score: 5,
       attitude: 5,
       professional: 5,
       response: 5,
       comment: ''
     }
   }
   ```

2. **评价触发条件**
   ```javascript
   // 当工单状态为resolved且当前用户是提交者时显示评价
   checkShowRating() {
     const ticket = this.data.ticketInfo;
     const isSubmitter = ticket.submitterId === this.app.globalData.openid;
     const canRate = ticket.status === 'resolved' && !ticket.rating;
     
     this.setData({
       showRating: isSubmitter && canRate
     });
   }
   ```

3. **关闭工单流程**
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
       <t-rate value="{{item.rating.score}}" disabled size="16px"/>
     </view>
   </view>
   ```

## 三、云函数修改

### 3.1 submitTicket 云函数增强

需要添加的action：

```javascript
// 在 submitTicket/index.js 中添加

// 添加评价
case 'addRating':
  return await addRating(event, openid);

// 用户关闭工单
case 'closeByUser':
  return await closeTicketByUser(event, openid);

// 添加评价函数
async function addRating(event, openid) {
  const { ticketId, rating } = event;
  
  // 验证是否为工单提交者
  const ticket = await db.collection('tickets').doc(ticketId).get();
  if (ticket.data.submitterId !== openid) {
    return { code: 403, message: '无权评价此工单' };
  }
  
  // 验证工单状态
  if (ticket.data.status !== 'resolved') {
    return { code: 400, message: '工单状态不正确' };
  }
  
  // 更新评价
  await db.collection('tickets').doc(ticketId).update({
    data: {
      rating: rating,
      updatedAt: new Date()
    }
  });
  
  return { code: 200, message: '评价成功' };
}

// 用户关闭工单函数
async function closeTicketByUser(event, openid) {
  const { ticketId } = event;
  
  // 验证是否为工单提交者
  const ticket = await db.collection('tickets').doc(ticketId).get();
  if (ticket.data.submitterId !== openid) {
    return { code: 403, message: '无权关闭此工单' };
  }
  
  // 验证工单状态
  if (ticket.data.status !== 'resolved') {
    return { code: 400, message: '只能关闭已解决的工单' };
  }
  
  // 更新状态为关闭
  await db.collection('tickets').doc(ticketId).update({
    data: {
      status: 'closed',
      closedAt: new Date(),
      closedBy: openid,
      updatedAt: new Date()
    }
  });
  
  // 添加历史记录
  if (ticket.data.processHistory) {
    await db.collection('tickets').doc(ticketId).update({
      data: {
        processHistory: db.command.push({
          id: generateId(),
          action: 'closed',
          operator: '用户',
          description: '确认解决并关闭工单',
          timestamp: new Date()
        })
      }
    });
  }
  
  return { code: 200, message: '工单已关闭' };
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
          score: 5,  // 默认好评
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

### tickets 集合新增字段：

```javascript
{
  // 现有字段...
  
  // 评价相关字段
  rating: {
    score: Number,        // 总体评分 1-5
    attitude: Number,     // 服务态度 1-5
    professional: Number, // 专业能力 1-5
    response: Number,     // 响应速度 1-5
    comment: String,      // 文字评价
    ratedAt: Date,       // 评价时间
    isAuto: Boolean      // 是否系统自动评价
  },
  
  // 关闭相关字段
  closedBy: String,      // 关闭者ID（用户ID或'system'）
  closedAt: Date,        // 关闭时间
  autoClose: Boolean,    // 是否自动关闭
  
  // 解决相关字段
  resolvedAt: Date,      // 解决时间（工程师标记）
  solution: String       // 解决方案描述
}
```

## 五、实施步骤

1. **第一步：数据库结构调整**
   - 更新tickets集合结构
   - 添加必要的索引

2. **第二步：云函数更新**
   - 修改submitTicket云函数
   - 创建autoCloseTickets云函数
   - 部署并测试

3. **第三步：工程师端修改**
   - 修改工单详情页面
   - 移除关闭权限
   - 测试工程师操作流程

4. **第四步：用户端实现**
   - 创建评价组件
   - 修改工单详情页
   - 实现评价和关闭流程
   - 测试完整流程

5. **第五步：定时任务配置**
   - 配置自动关闭定时触发器
   - 测试自动关闭功能

## 六、测试要点

1. **权限测试**
   - 工程师不能关闭工单
   - 只有提交者能评价和关闭
   - 其他用户不能操作

2. **流程测试**
   - 工单创建 → 处理 → 解决 → 评价 → 关闭
   - 暂不评价的处理
   - 自动关闭的触发

3. **数据一致性**
   - 评价数据正确保存
   - 历史记录完整
   - 状态转换正确

4. **界面测试**
   - 评价组件显示正常
   - 状态显示准确
   - 交互流畅

---

*文档创建时间：2024-12-25*  
*预计实施时间：2天*