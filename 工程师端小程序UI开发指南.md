# 工程师端小程序UI开发指南 - 完整Prompt

## 📋 项目背景与要求

你是一名资深的微信小程序前端开发工程师，需要开发一个**IT工程师工作台小程序**，这是一个独立的小程序项目，与现有的用户端IT服务中心小程序配套使用。

### 核心业务场景
- **用户群体**：IT工程师、IT经理
- **主要功能**：工单分配、处理、耗材管理、工作统计
- **设计风格**：与用户端保持一致，专业、简洁、高效

## 🎨 设计系统规范

### 主题色彩系统
```css
/* 主品牌色 */
--primary-color: #0ea5e9; /* 天蓝色 */

/* 浅蓝色调色板 */
--light-blue-50: #f0f9ff;   /* 最浅背景 */
--light-blue-100: #e0f2fe;  /* 次浅背景 */
--light-blue-200: #bae6fd;  /* 浅色边框 */
--light-blue-300: #7dd3fc;  /* 浅色文字 */
--light-blue-400: #38bdf8;  /* 次主色 */
--light-blue-500: #0ea5e9;  /* 主色 */
--light-blue-600: #0284c7;  /* 深主色 */
--light-blue-700: #0369a1;  /* 更深 */
--light-blue-800: #075985;  /* 深色文字 */
--light-blue-900: #0c4a6e;  /* 最深色 */

/* 状态颜色系统 */
--status-pending: #fef3c7;   /* 待处理-背景 */
--status-pending-text: #92400e; /* 待处理-文字 */
--status-processing: #dbeafe; /* 处理中-背景 */
--status-processing-text: #1e40af; /* 处理中-文字 */
--status-resolved: #d1fae5;  /* 已解决-背景 */
--status-resolved-text: #065f46; /* 已解决-文字 */
--status-cancelled: #fee2e2; /* 已取消-背景 */
--status-cancelled-text: #991b1b; /* 已取消-文字 */

/* 优先级颜色 */
--priority-urgent: #ff4d4f;   /* 紧急-红色 */
--priority-high: #faad14;     /* 高-橙色 */
--priority-medium: #1890ff;   /* 中-蓝色 */
--priority-low: #52c41a;      /* 低-绿色 */
```

### 字体系统
```css
/* 字体族 */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;

/* 字体大小（微信小程序rpx单位） */
--text-xs: 20rpx;    /* 辅助信息 */
--text-sm: 24rpx;    /* 次要文字 */
--text-base: 28rpx;  /* 正文（默认） */
--text-lg: 32rpx;    /* 小标题 */
--text-xl: 36rpx;    /* 标题 */
--text-2xl: 40rpx;   /* 大标题 */
--text-3xl: 48rpx;   /* 特大标题 */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 间距系统（基于4rpx的倍数）
```css
--spacing-1: 8rpx;   /* 最小间距 */
--spacing-2: 16rpx;  /* 小间距 */
--spacing-3: 24rpx;  /* 中间距 */
--spacing-4: 32rpx;  /* 大间距 */
--spacing-5: 40rpx;  /* 更大间距 */
--spacing-6: 48rpx;  /* 最大间距 */
```

### 圆角和阴影系统
```css
/* 圆角 */
--radius-sm: 8rpx;   /* 小圆角 */
--radius-md: 16rpx;  /* 标准圆角 */
--radius-lg: 24rpx;  /* 大圆角 */
--radius-xl: 32rpx;  /* 特大圆角 */

/* 阴影层级 */
--shadow-light: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);    /* 轻微阴影 */
--shadow-standard: 0 4rpx 20rpx rgba(0, 0, 0, 0.08); /* 标准阴影 */
--shadow-elevated: 0 6rpx 24rpx rgba(0, 0, 0, 0.12); /* 悬浮阴影 */
--shadow-brand: 0 8rpx 32rpx rgba(14, 165, 233, 0.2); /* 品牌色阴影 */
```

### 图标系统
使用emoji图标为主，TDesign图标为辅：
```javascript
// 核心业务图标（emoji优先）
const icons = {
  // 工单相关
  ticket: '🎫',
  pending: '⏳', 
  processing: '🔄',
  resolved: '✅',
  cancelled: '❌',
  urgent: '🔴',
  
  // 功能图标  
  dashboard: '📊',
  assignment: '👥',
  materials: '📦',
  tools: '🔧',
  statistics: '📈',
  engineer: '👨‍🔧',
  manager: '👨‍💼',
  
  // 操作图标
  add: '➕',
  edit: '✏️',
  delete: '🗑️',
  search: '🔍',
  filter: '🔽',
  more: '⋯'
};
```

## 🧩 TDesign组件库使用规范

### 必需的TDesign组件配置
在 `app.json` 中全局注册以下组件：
```json
{
  "usingComponents": {
    "t-button": "miniprogram_npm/tdesign-miniprogram/button/button",
    "t-icon": "miniprogram_npm/tdesign-miniprogram/icon/icon", 
    "t-cell": "miniprogram_npm/tdesign-miniprogram/cell/cell",
    "t-cell-group": "miniprogram_npm/tdesign-miniprogram/cell-group/cell-group",
    "t-tag": "miniprogram_npm/tdesign-miniprogram/tag/tag",
    "t-search": "miniprogram_npm/tdesign-miniprogram/search/search",
    "t-tabs": "miniprogram_npm/tdesign-miniprogram/tabs/tabs",
    "t-tab-panel": "miniprogram_npm/tdesign-miniprogram/tab-panel/tab-panel",
    "t-swipe-cell": "miniprogram_npm/tdesign-miniprogram/swipe-cell/swipe-cell",
    "t-popup": "miniprogram_npm/tdesign-miniprogram/popup/popup",
    "t-dialog": "miniprogram_npm/tdesign-miniprogram/dialog/dialog",
    "t-toast": "miniprogram_npm/tdesign-miniprogram/toast/toast",
    "t-loading": "miniprogram_npm/tdesign-miniprogram/loading/loading",
    "t-empty": "miniprogram_npm/tdesign-miniprogram/empty/empty",
    "t-fab": "miniprogram_npm/tdesign-miniprogram/fab/fab",
    "t-picker": "miniprogram_npm/tdesign-miniprogram/picker/picker",
    "t-input": "miniprogram_npm/tdesign-miniprogram/input/input",
    "t-textarea": "miniprogram_npm/tdesign-miniprogram/textarea/textarea",
    "t-checkbox": "miniprogram_npm/tdesign-miniprogram/checkbox/checkbox",
    "t-radio": "miniprogram_npm/tdesign-miniprogram/radio/radio",
    "t-switch": "miniprogram_npm/tdesign-miniprogram/switch/switch",
    "t-slider": "miniprogram_npm/tdesign-miniprogram/slider/slider",
    "t-stepper": "miniprogram_npm/tdesign-miniprogram/stepper/stepper",
    "t-progress": "miniprogram_npm/tdesign-miniprogram/progress/progress",
    "t-grid": "miniprogram_npm/tdesign-miniprogram/grid/grid",
    "t-grid-item": "miniprogram_npm/tdesign-miniprogram/grid-item/grid-item"
  }
}
```

### TDesign组件使用优先级
1. **优先使用TDesign组件**：按钮、输入框、标签、弹窗等
2. **TDesign + 自定义样式**：需要特殊样式时覆盖TDesign默认样式
3. **原生组件**：TDesign不支持时使用微信原生组件
4. **自定义组件**：复杂业务逻辑时自己开发

### TDesign组件样式覆盖规范
```css
/* 按钮组件样式覆盖 */
.t-button--primary {
  background-color: var(--primary-color) !important;
  border-color: var(--primary-color) !important;
}

/* 标签组件样式覆盖 */
.t-tag--primary {
  background-color: var(--light-blue-100) !important;
  color: var(--primary-color) !important;
  border-color: var(--light-blue-200) !important;
}

/* 单元格组件样式覆盖 */
.t-cell {
  background-color: white;
  border-radius: var(--radius-md);
  margin-bottom: var(--spacing-2);
  box-shadow: var(--shadow-light);
}
```

## 📱 页面结构与布局规范

### 标准页面模板
```html
<!-- 标准页面结构 -->
<view class="page-container">
  <!-- 导航栏（如需自定义） -->
  <view class="custom-navbar" wx:if="{{needCustomNavbar}}">
    <view class="navbar-content">
      <view class="navbar-left">
        <t-icon name="chevron-left" size="40rpx" bind:click="onBack" />
      </view>
      <view class="navbar-title">{{pageTitle}}</view>
      <view class="navbar-right">
        <t-icon name="more" size="40rpx" bind:click="onMore" />
      </view>
    </view>
  </view>

  <!-- 主要内容区域 -->
  <view class="page-content">
    <!-- 搜索栏（如需要） -->
    <view class="search-container" wx:if="{{needSearch}}">
      <t-search 
        model:value="{{searchKeyword}}"
        placeholder="搜索工单、工程师..."
        bind:change="onSearchChange"
      />
    </view>

    <!-- 筛选标签（如需要） -->
    <view class="filter-container" wx:if="{{needFilter}}">
      <scroll-view scroll-x class="filter-scroll">
        <view class="filter-tags">
          <t-tag 
            wx:for="{{filterOptions}}" 
            wx:key="value"
            variant="{{item.active ? 'dark' : 'outline'}}"
            theme="primary"
            bind:click="onFilterClick"
            data-value="{{item.value}}"
          >
            {{item.label}}
          </t-tag>
        </view>
      </scroll-view>
    </view>

    <!-- 数据展示区域 -->
    <view class="content-main">
      <!-- 加载状态 -->
      <t-loading theme="dots" loading="{{loading}}" text="加载中...">
        <!-- 实际内容 -->
        <slot name="content"></slot>
      </t-loading>

      <!-- 空状态 -->
      <t-empty 
        wx:if="{{!loading && isEmpty}}"
        icon="{{emptyIcon}}"
        description="{{emptyText}}"
      >
        <t-button slot="action" theme="primary" bind:click="onRefresh">
          刷新重试
        </t-button>
      </t-empty>
    </view>
  </view>

  <!-- 底部操作栏（如需要） -->
  <view class="page-footer" wx:if="{{needFooter}}">
    <view class="footer-actions">
      <t-button 
        wx:for="{{footerButtons}}" 
        wx:key="key"
        theme="{{item.theme || 'default'}}"
        size="large"
        bind:click="{{item.handler}}"
        loading="{{item.loading}}"
        disabled="{{item.disabled}}"
      >
        {{item.text}}
      </t-button>
    </view>
  </view>

  <!-- 悬浮按钮（如需要） -->
  <t-fab 
    wx:if="{{needFab}}"
    icon="{{fabIcon}}"
    bind:click="onFabClick"
    style="bottom: 140rpx; right: 40rpx;"
  />
</view>
```

### 卡片组件模板
```html
<!-- 工单卡片组件 -->
<view class="ticket-card">
  <!-- 卡片头部 -->
  <view class="card-header">
    <view class="card-title">
      <text class="ticket-emoji">🎫</text>
      <text class="ticket-no">{{ticket.ticketNo}}</text>
      <t-tag 
        theme="{{getPriorityTheme(ticket.priority)}}"
        variant="light"
        size="small"
      >
        {{ticket.priority}}
      </t-tag>
    </view>
    <view class="card-status">
      <t-tag 
        theme="{{getStatusTheme(ticket.status)}}"
        variant="light"
      >
        {{getStatusText(ticket.status)}}
      </t-tag>
    </view>
  </view>

  <!-- 卡片内容 -->
  <view class="card-content">
    <view class="ticket-title">{{ticket.title}}</view>
    <view class="ticket-meta">
      <view class="meta-item">
        <text class="meta-icon">👤</text>
        <text class="meta-text">{{ticket.submitter}}</text>
      </view>
      <view class="meta-item">
        <text class="meta-icon">📍</text>
        <text class="meta-text">{{ticket.location}}</text>
      </view>
      <view class="meta-item">
        <text class="meta-icon">⏰</text>
        <text class="meta-text">{{ticket.createTime}}</text>
      </view>
    </view>
  </view>

  <!-- 卡片操作 -->
  <view class="card-actions">
    <t-button 
      wx:for="{{getCardActions(ticket)}}" 
      wx:key="key"
      theme="{{item.theme}}"
      size="small"
      bind:click="{{item.handler}}"
      data-ticket="{{ticket}}"
    >
      {{item.text}}
    </t-button>
  </view>
</view>
```

## 🎯 核心页面开发规范

### 1. 工程师工作台（Dashboard）
**页面路径**：`pages/dashboard/index`

**功能要求**：
- 工作概览：今日任务统计、处理进度
- 快捷操作：查看待处理工单、记录耗材、请求协助
- 最新工单：显示最近分配的工单
- 工作状态：在线/忙碌/离线状态切换

**UI组件使用**：
```html
<!-- 统计卡片使用 t-grid -->
<t-grid column="{{2}}" border="{{false}}">
  <t-grid-item 
    wx:for="{{statsData}}" 
    wx:key="key"
    text="{{item.label}}"
    description="{{item.value}}"
    icon="{{item.icon}}"
  />
</t-grid>

<!-- 快捷操作使用 t-cell-group -->
<t-cell-group title="快捷操作">
  <t-cell 
    wx:for="{{quickActions}}" 
    wx:key="key"
    title="{{item.title}}"
    description="{{item.description}}"
    left-icon="{{item.icon}}"
    arrow
    bind:click="{{item.handler}}"
  />
</t-cell-group>
```

### 2. 工单列表页面
**页面路径**：`pages/ticket-list/index`

**功能要求**：
- 工单筛选：状态、优先级、类型筛选
- 搜索功能：按工单号、标题、提交人搜索
- 列表展示：卡片式列表，支持滑动操作
- 批量操作：支持多选和批量分配

**UI组件使用**：
```html
<!-- 筛选使用 t-tabs -->
<t-tabs value="{{activeTab}}" bind:change="onTabChange">
  <t-tab-panel 
    wx:for="{{tabOptions}}" 
    wx:key="value"
    label="{{item.label}}"
    value="{{item.value}}"
  />
</t-tabs>

<!-- 列表项使用 t-swipe-cell -->
<t-swipe-cell 
  wx:for="{{ticketList}}" 
  wx:key="id"
  right="{{getSwipeActions(item)}}"
>
  <!-- 工单卡片内容 -->
  <view slot="content">
    <!-- 使用上面的卡片模板 -->
  </view>
</t-swipe-cell>
```

### 3. 工单详情页面
**页面路径**：`pages/ticket-detail/index`

**功能要求**：
- 工单信息：完整的工单详情展示
- 处理记录：时间线展示处理过程
- 解决方案：添加解决方案和附件
- 耗材记录：弹窗式耗材使用记录
- 状态操作：开始处理、暂停、完成等

**UI组件使用**：
```html
<!-- 工单信息使用 t-cell-group -->
<t-cell-group title="工单信息">
  <t-cell title="工单编号" description="{{ticket.ticketNo}}" />
  <t-cell title="问题标题" description="{{ticket.title}}" />
  <t-cell title="提交人" description="{{ticket.submitter}}" />
  <t-cell title="所在位置" description="{{ticket.location}}" />
</t-cell-group>

<!-- 解决方案输入使用 t-textarea -->
<view class="solution-section">
  <t-textarea
    model:value="{{solutionText}}"
    placeholder="请描述解决方案..."
    maxlength="500"
    indicator
  />
</view>

<!-- 底部操作使用 t-button -->
<view class="detail-actions">
  <t-button theme="default" bind:click="onPause">暂停处理</t-button>
  <t-button theme="primary" bind:click="onComplete">完成工单</t-button>
</view>
```

### 4. 耗材管理页面
**页面路径**：`pages/materials/index`

**功能要求**：
- 耗材使用记录：显示个人使用历史
- 常用耗材：快捷添加常用耗材
- 统计信息：使用量统计和趋势
- 耗材申请：申请新的耗材类型

**UI组件使用**：
```html
<!-- 统计信息使用 t-progress -->
<view class="material-stats">
  <view 
    wx:for="{{materialStats}}" 
    wx:key="name"
    class="stat-item"
  >
    <view class="stat-header">
      <text>{{item.name}}</text>
      <text>{{item.used}}/{{item.total}} {{item.unit}}</text>
    </view>
    <t-progress percentage="{{item.percentage}}" theme="primary" />
  </view>
</view>

<!-- 快捷添加使用 t-stepper -->
<view class="quick-add-section">
  <view 
    wx:for="{{commonMaterials}}" 
    wx:key="id"
    class="material-item"
  >
    <view class="material-info">
      <text class="material-name">{{item.name}}</text>
      <text class="material-unit">{{item.unit}}</text>
    </view>
    <t-stepper 
      model:value="{{item.quantity}}"
      min="0"
      max="100"
      bind:change="onMaterialChange"
      data-material="{{item}}"
    />
  </view>
</view>
```

### 5. 工作统计页面
**页面路径**：`pages/statistics/index`

**功能要求**：
- 个人统计：工单处理量、平均耗时、完成率
- 团队对比：与团队平均水平对比（仅经理可见）
- 时间趋势：按周、月显示工作趋势
- 详细报告：导出工作报告

**UI组件使用**：
```html
<!-- 时间选择使用 t-picker -->
<t-picker
  value="{{timeRange}}"
  data="{{timeRangeOptions}}"
  bind:change="onTimeRangeChange"
>
  <t-cell title="统计时间" description="{{timeRangeText}}" arrow />
</t-picker>

<!-- 统计数据使用 t-grid -->
<t-grid column="{{2}}" border="{{false}}">
  <t-grid-item 
    wx:for="{{personalStats}}" 
    wx:key="key"
    text="{{item.value}}"
    description="{{item.label}}"
  />
</t-grid>
```

## 🎨 样式开发规范

### CSS类命名规范
使用BEM命名方法：
```css
/* 页面级样式 */
.dashboard-page { }
.ticket-list-page { }
.ticket-detail-page { }

/* 组件级样式 */
.ticket-card { }
.ticket-card__header { }
.ticket-card__content { }
.ticket-card__actions { }
.ticket-card--urgent { }

/* 功能级样式 */
.status-tag { }
.status-tag--pending { }
.status-tag--processing { }
.status-tag--resolved { }

/* 工具类样式 */
.text-primary { color: var(--primary-color); }
.bg-light-blue { background-color: var(--light-blue-50); }
.shadow-card { box-shadow: var(--shadow-standard); }
.radius-md { border-radius: var(--radius-md); }
```

### 响应式和适配
```css
/* 安全区域适配 */
.page-container {
  padding-bottom: env(safe-area-inset-bottom);
}

/* 不同屏幕尺寸适配 */
@media (max-width: 750rpx) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 751rpx) {
  .stats-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}
```

### 动画效果
```css
/* 页面切换动画 */
.page-enter {
  animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

/* 卡片悬停效果 */
.ticket-card {
  transition: all 0.3s ease;
}

.ticket-card:active {
  transform: scale(0.98);
  box-shadow: var(--shadow-light);
}

/* 加载动画 */
.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## 📱 交互行为规范

### 触摸反馈
```javascript
// 按钮点击反馈
onButtonTap(e) {
  wx.vibrateShort(); // 轻微震动反馈
  
  // 执行业务逻辑
  this.handleButtonAction(e);
}

// 长按反馈
onLongPress(e) {
  wx.vibrateShort();
  
  // 显示上下文菜单
  this.showContextMenu(e);
}
```

### 错误处理和提示
```javascript
// 成功提示
showSuccessToast(message) {
  wx.showToast({
    title: message,
    icon: 'success',
    duration: 2000
  });
}

// 错误提示
showErrorToast(message) {
  wx.showToast({
    title: message,
    icon: 'error',
    duration: 3000
  });
}

// 确认对话框
showConfirmDialog(options) {
  return new Promise((resolve) => {
    wx.showModal({
      title: options.title || '确认操作',
      content: options.content,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      success: (res) => {
        resolve(res.confirm);
      }
    });
  });
}
```

### 加载状态管理
```javascript
// 页面数据
data: {
  loading: false,
  refreshing: false,
  loadingMore: false
},

// 显示加载
showLoading(text = '加载中...') {
  this.setData({ loading: true });
  wx.showLoading({ title: text });
},

// 隐藏加载
hideLoading() {
  this.setData({ loading: false });
  wx.hideLoading();
},

// 下拉刷新
onPullDownRefresh() {
  this.setData({ refreshing: true });
  this.loadData().finally(() => {
    this.setData({ refreshing: false });
    wx.stopPullDownRefresh();
  });
}
```

## 🔧 开发调试指南

### TDesign组件问题排查
当遇到TDesign组件问题时，按以下顺序排查：

1. **查阅官方文档**：https://tdesign.tencent.com/miniprogram/getting-started
2. **检查组件版本**：确认使用的是最新版本1.9.4
3. **验证属性配置**：检查必需属性是否正确传入
4. **查看控制台错误**：查看开发者工具的错误信息
5. **检查样式覆盖**：确认自定义样式是否生效

### 常见问题解决方案
```javascript
// 1. TDesign组件不显示
// 检查是否正确注册组件
"usingComponents": {
  "t-button": "miniprogram_npm/tdesign-miniprogram/button/button"
}

// 2. 样式不生效
// 使用!important强制覆盖
.custom-button {
  background-color: #0ea5e9 !important;
}

// 3. 事件绑定问题
// 确认使用正确的事件名称
<t-button bind:click="onButtonClick" />

// 4. 数据绑定问题  
// 检查数据格式是否匹配组件要求
data: {
  options: [
    { label: '选项1', value: 'option1' },
    { label: '选项2', value: 'option2' }
  ]
}
```

### 性能优化建议
```javascript
// 1. 使用setData优化
// 避免频繁的setData调用
updateMultipleData() {
  this.setData({
    loading: false,
    dataList: newList,
    total: newTotal
  });
}

// 2. 图片懒加载
// 使用intersection observer
createIntersectionObserver() {
  wx.createIntersectionObserver()
    .relativeToViewport()
    .observe('.lazy-image', (res) => {
      if (res.intersectionRatio > 0) {
        this.loadImage(res.target.dataset.src);
      }
    });
}

// 3. 长列表优化
// 使用虚拟滚动或分页加载
onReachBottom() {
  if (!this.data.loadingMore && this.data.hasMore) {
    this.loadMoreData();
  }
}
```

## ✅ 开发检查清单

### 代码质量检查
- [ ] 所有TDesign组件都正确引入和配置
- [ ] 样式变量使用统一的设计系统
- [ ] 遵循BEM命名规范
- [ ] 错误处理和边界情况考虑完整
- [ ] 交互反馈及时且合适
- [ ] 代码注释清晰明了

### 用户体验检查
- [ ] 页面加载速度快（<3秒）
- [ ] 操作响应及时（<1秒）
- [ ] 错误提示友好易懂
- [ ] 空状态和加载状态设计合理
- [ ] 适配不同屏幕尺寸
- [ ] 支持无障碍访问

### 功能完整性检查
- [ ] 所有业务流程可以完整走通
- [ ] 数据验证和错误处理完善
- [ ] 与后端API接口对接正常
- [ ] 本地存储和状态管理正确
- [ ] 页面间导航和数据传递正常

---

**重要提醒**：在开发过程中，始终优先查阅TDesign官方文档(https://tdesign.tencent.com/miniprogram/getting-started)，确保组件使用正确。遇到问题时，先检查组件属性配置，再考虑自定义实现。保持代码简洁、可维护，注重用户体验和性能优化。