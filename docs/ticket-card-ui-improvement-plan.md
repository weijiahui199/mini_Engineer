# 工单卡片UI改进计划 V2

## 需求分析

### 需要显示的信息
1. **工单号** - ✅ 已有
2. **标题** - ✅ 已有
3. **问题类型** - ✅ 已有 (category)
4. **负责人姓名** - ⚠️ 部分显示（仅经理视图）
5. **工单创建时间** - ⚠️ 当前显示更新时间
6. **工单状态** - ✅ 已有
7. **创建人公司名称** - ❌ 缺失
8. **工单地址** - ✅ 已有 (location)

## 当前UI分析

### ticket-list页面当前布局
```
┌─────────────────────────────────────────┐
│ [优先级点] #工单号 [紧急标签] [状态标签] │ <- 头部
├─────────────────────────────────────────┤
│ 标题文字                                 │ <- 内容
│ 问题类型                                 │
├─────────────────────────────────────────┤
│ [icon] 提交人  [icon] 位置  [icon] 时间  │ <- 信息栏
│ [icon] 负责人（仅经理可见）              │
├─────────────────────────────────────────┤
│ [操作按钮]                               │ <- 操作区
└─────────────────────────────────────────┘
```

## 改进方案（右对齐布局）

### 新的工单卡片布局
```
┌────────────────────────────────────────────────┐
│ [●] #TK20241225001         [状态] [紧急] [按钮]│
├────────────────────────────────────────────────┤
│ 标题：服务器无法访问                           │
│ [icon] 硬件故障                                │
├────────────────────────────────────────────────┤
│ [icon] 腾讯科技有限公司                        │
│ [icon] 深圳市南山区科技园A座10楼               │
│ [icon] 张三 · 2024-12-25 14:30                 │
│ [icon] 负责人：李工程师（如有）                │
└────────────────────────────────────────────────┘
```

### 详细布局说明
```
┌────────────────────────────────────────────────┐
│ 左侧内容区                      右侧操作区     │
│                                                 │
│ [优先级圆点] #工单号      [状态标签][紧急][按钮]│
│                                                 │
│ 工单标题文字                                    │
│ [类型图标] 问题类型                             │
│                                                 │
│ [公司图标] 公司名称                             │
│ [位置图标] 详细地址                             │
│ [用户图标] 创建人 · [时间图标] 创建时间         │
│ [工程师图标] 负责人：姓名（当已分配时显示）     │
└────────────────────────────────────────────────┘
```

## 实施计划

### 第一步：图标需求清单
请将以下图标文件添加到 `/miniprogram/assets/icons/` 文件夹：

#### 必需图标（16x16 或 20x20 SVG/PNG）
1. **company.svg** - 公司图标
2. **location.svg** - 位置/地址图标
3. **user.svg** - 用户/创建人图标
4. **time.svg** - 时间/时钟图标
5. **engineer.svg** - 工程师/负责人图标
6. **category.svg** - 问题类型通用图标

#### 可选图标（针对不同问题类型）
7. **category-hardware.svg** - 硬件类型图标
8. **category-software.svg** - 软件类型图标
9. **category-network.svg** - 网络类型图标
10. **category-other.svg** - 其他类型图标

### 第二步：数据准备
1. **修改数据格式化函数**
   - 在 `ticket-list/index.js` 的 `formattedList` 中添加 `company` 字段
   - 添加 `createTimeDisplay` 专门显示创建时间
   - 确保 `assigneeName` 对所有角色可见

### 第三步：更新ticket-list页面布局

### 第三步：更新ticket-list页面布局
1. **修改头部布局**（flex布局，右对齐）
   - 左侧：优先级圆点 + 工单号
   - 右侧：状态标签 + 紧急标签 + 操作按钮

2. **调整内容区域**
   - 标题独立一行
   - 问题类型带图标

3. **重组信息栏**
   - 公司名称（独立一行）
   - 位置地址（独立一行）
   - 创建人 + 创建时间（同一行）
   - 负责人信息（如有，独立一行）

### 第四步：更新dashboard页面
- 同步ticket-list的改动
- 保持两个页面一致性

## 具体代码改动点

### 1. ticket-list/index.js（数据层）
```javascript
// 第174-193行，修改formatted对象
const formatted = {
  id: ticket._id,
  ticketNo: ticket.ticketNo, // 去掉#前缀
  title: ticket.title,
  category: ticket.category,
  priority: ticket.priority,
  status: displayStatus,
  realStatus: cleanStatus,
  submitter: ticket.submitterName,
  company: ticket.company || '', // 新增公司字段
  location: ticket.location,
  createTime: this.formatTime(ticket.createTime),
  createTimeDisplay: this.formatTime(ticket.createTime), // 专门用于显示
  displayTime: this.formatTime(ticket.createTime), // 改为创建时间
  assigned: !!ticket.assigneeOpenid,
  assigneeOpenid: ticket.assigneeOpenid || '',
  assigneeName: ticket.assigneeName || '', // 确保所有角色可见
  isPaused: cleanStatus === 'pending' && !!ticket.assigneeOpenid
};
```

### 2. ticket-list/index.wxml（视图层 - 新布局）
```xml
<view class="ticket-card">
  <!-- 头部：flex布局，两端对齐 -->
  <view class="card-header">
    <view class="header-left">
      <view class="priority-dot priority-{{item.priority}}"></view>
      <text class="ticket-no">#{{item.ticketNo}}</text>
    </view>
    <view class="header-right">
      <t-tag theme="{{getStatusTheme(item.status)}}" size="small">
        {{statusText[item.status]}}
      </t-tag>
      <t-tag wx:if="{{item.priority === 'urgent'}}" theme="danger" size="small">
        紧急
      </t-tag>
    </view>
  </view>
  
  <!-- 内容区 -->
  <view class="card-content">
    <text class="ticket-title">{{item.title}}</text>
    <view class="ticket-category">
      <image class="category-icon" src="/assets/icons/category.svg"/>
      <text>{{item.category}}</text>
    </view>
  </view>
  
  <!-- 信息区 -->
  <view class="card-info">
    <view class="info-line">
      <image class="info-icon" src="/assets/icons/company.svg"/>
      <text class="info-text">{{item.company}}</text>
    </view>
    <view class="info-line">
      <image class="info-icon" src="/assets/icons/location.svg"/>
      <text class="info-text">{{item.location}}</text>
    </view>
    <view class="info-line">
      <image class="info-icon" src="/assets/icons/user.svg"/>
      <text class="info-text">{{item.submitter}}</text>
      <text class="info-separator">·</text>
      <image class="info-icon" src="/assets/icons/time.svg"/>
      <text class="info-text">{{item.createTimeDisplay}}</text>
    </view>
    <view class="info-line" wx:if="{{item.assigneeName}}">
      <image class="info-icon" src="/assets/icons/engineer.svg"/>
      <text class="info-text">负责人：{{item.assigneeName}}</text>
    </view>
  </view>
  
  <!-- 操作区：保持在右下角 -->
  <view class="card-actions">
    <button wx:if="{{showActionButton}}" class="action-btn">
      操作
    </button>
  </view>
</view>
```

### 3. ticket-list/index.wxss（样式调整）
```css
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16rpx;
}

.header-right {
  display: flex;
  gap: 8rpx;
  align-items: center;
}

.card-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 16rpx;
  border-top: 1px solid #f0f0f0;
}

.info-icon {
  width: 32rpx;
  height: 32rpx;
  margin-right: 8rpx;
}

.info-line {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.info-separator {
  margin: 0 16rpx;
  color: #999;
}
```

## 优势
1. **专业外观** - 使用图标而非emoji，更加专业
2. **布局清晰** - 右对齐设计，信息层次分明
3. **最小改动** - 基于现有结构调整，改动量小
4. **一致性强** - 两个页面统一设计

## 注意事项
1. 确保所有图标文件已添加到指定目录
2. 测试不同长度文本的显示效果
3. 验证右对齐布局在不同屏幕尺寸的表现
4. 确保操作按钮点击区域不与卡片点击冲突

## 预计改动
- **代码行数**：约40-50行
- **影响页面**：ticket-list、dashboard
- **新增文件**：10个图标文件