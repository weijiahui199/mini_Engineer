# 工单列表页面改造方案

## 改造目标
将工单列表从数据库搜索改为 Fuse.js 本地搜索，提升搜索性能和用户体验。

## 主要改动点

### 1. 数据流程变化

#### 现有流程：
```
用户输入 → 构建数据库查询 → 云数据库搜索 → 返回结果
         ↓
    500-1000ms 延迟
```

#### 新流程：
```
页面加载 → 获取全部工单 → 初始化 Fuse.js 索引
         ↓
用户输入 → 本地 Fuse.js 搜索 → 立即返回结果
         ↓
      20-50ms 延迟
```

### 2. 具体代码改动

#### 2.1 在 onLoad 中添加搜索管理器初始化
```javascript
// pages/ticket-list/index.js
const SearchManager = require('../../utils/search-manager');
const { logSearch, logSearchClick } = require('../../utils/search-logger-simple');

Page({
  data: {
    // 新增数据字段
    searchManager: null,      // Fuse.js 搜索管理器
    allTickets: [],           // 保存所有工单（用于搜索）
    searchMode: 'local',      // 搜索模式：local/database
    searchInfo: null,         // 搜索信息（结果数、耗时等）
    isSearching: false,       // 是否正在搜索
    
    // ... 保留原有 data
  },
  
  onLoad(options) {
    // ... 原有代码
    
    // 初始化搜索管理器
    this.searchManager = new SearchManager();
    
    // 加载工单列表
    this.loadAllTickets(); // 新增：加载所有工单用于搜索
  }
})
```

#### 2.2 新增加载所有工单方法
```javascript
// 加载所有工单（用于本地搜索）
async loadAllTickets() {
  try {
    // 根据角色构建查询条件
    const where = await this.buildQueryCondition();
    
    // 获取所有工单（不分页）
    const res = await this.db.collection('tickets')
      .where(where)
      .orderBy('priority', 'desc')
      .orderBy('updateTime', 'desc')
      .limit(500)  // 限制最多500条，避免数据过大
      .get();
    
    // 格式化工单数据
    const formattedList = res.data.map(ticket => this.formatTicket(ticket));
    
    // 初始化搜索索引
    this.searchManager.initSearch(formattedList);
    
    // 保存数据
    this.setData({
      allTickets: formattedList,
      ticketList: formattedList.slice(0, this.data.pageSize), // 初始显示第一页
      hasMore: formattedList.length > this.data.pageSize
    });
    
    // 缓存数据
    CacheManager.set('ticket_list', {
      allTickets: formattedList,
      timestamp: Date.now()
    }, 'allTickets');
    
  } catch (error) {
    console.error('加载工单失败:', error);
    // 使用模拟数据
    this.loadMockData();
  }
}
```

#### 2.3 改造搜索方法
```javascript
// 搜索输入处理（替换原有的 onSearchChange）
onSearchChange(e) {
  const keyword = e.detail.value.trim();
  this.setData({ searchKeyword: keyword });
  
  // 清空搜索
  if (!keyword) {
    this.clearSearch();
    return;
  }
  
  // 防抖处理
  if (this.searchTimer) {
    clearTimeout(this.searchTimer);
  }
  
  this.searchTimer = setTimeout(() => {
    this.executeLocalSearch(keyword);
  }, 300);
},

// 执行本地搜索
executeLocalSearch(keyword) {
  if (!keyword) {
    this.clearSearch();
    return;
  }
  
  // 显示搜索中状态
  this.setData({ isSearching: true });
  
  const startTime = Date.now();
  
  try {
    // 使用 Fuse.js 搜索
    const results = this.searchManager.search(keyword);
    const searchTime = Date.now() - startTime;
    
    // 记录搜索日志
    logSearch(keyword, results.length, {
      searchType: 'manual',
      searchTime: searchTime,
      page: 'ticket-list'
    });
    
    // 更新显示
    this.setData({
      ticketList: results,
      searchInfo: {
        keyword: keyword,
        resultCount: results.length,
        searchTime: searchTime,
        mode: 'local'
      },
      isSearching: false,
      hasMore: false  // 搜索结果不分页
    });
    
    // 如果没有结果，记录无结果搜索
    if (results.length === 0) {
      console.log('[搜索] 无结果:', keyword);
    }
    
  } catch (error) {
    console.error('[搜索] 执行失败:', error);
    this.setData({ isSearching: false });
    wx.showToast({
      title: '搜索失败',
      icon: 'none'
    });
  }
},

// 清空搜索
clearSearch() {
  this.setData({
    searchKeyword: '',
    searchInfo: null,
    ticketList: this.data.allTickets.slice(0, this.data.pageSize),
    hasMore: this.data.allTickets.length > this.data.pageSize
  });
}
```

#### 2.4 改造点击事件记录
```javascript
// 点击工单卡片
onTicketClick(e) {
  const ticket = e.currentTarget.dataset.ticket;
  const index = e.currentTarget.dataset.index;
  
  // 如果正在搜索，记录点击
  if (this.data.searchKeyword) {
    logSearchClick(this.data.searchKeyword, index);
  }
  
  // 跳转到详情页
  wx.navigateTo({
    url: `/pages/ticket-detail/index?id=${ticket.id}`
  });
}
```

#### 2.5 改造下拉刷新
```javascript
// 下拉刷新
async onPullDownRefresh() {
  console.log('[工单列表] 下拉刷新');
  
  // 清空搜索
  this.clearSearch();
  
  // 重新加载所有数据
  await this.loadAllTickets();
  
  // 刷新角色（可能有变化）
  await this.refreshUserRole();
  
  wx.stopPullDownRefresh();
  
  wx.showToast({
    title: '刷新成功',
    icon: 'success',
    duration: 1000
  });
}
```

#### 2.6 改造上拉加载
```javascript
// 上拉加载更多（本地分页）
onReachBottom() {
  // 如果正在搜索，不加载更多
  if (this.data.searchKeyword) {
    return;
  }
  
  // 如果没有更多数据
  if (!this.data.hasMore) {
    return;
  }
  
  // 从 allTickets 中加载更多
  const currentLength = this.data.ticketList.length;
  const nextBatch = this.data.allTickets.slice(
    currentLength,
    currentLength + this.data.pageSize
  );
  
  if (nextBatch.length > 0) {
    this.setData({
      ticketList: [...this.data.ticketList, ...nextBatch],
      hasMore: currentLength + nextBatch.length < this.data.allTickets.length
    });
  } else {
    this.setData({ hasMore: false });
  }
}
```

### 3. UI 改动

#### 3.1 搜索框增强（index.wxml）
```xml
<!-- 搜索容器 -->
<view class="search-container">
  <t-search
    value="{{searchKeyword}}"
    placeholder="搜索工单号、标题、提交人或公司"
    bind:change="onSearchChange"
    bind:clear="onSearchClear"
    bind:submit="onSearchSubmit"
  />
  
  <!-- 搜索信息提示 -->
  <view wx:if="{{searchInfo}}" class="search-info">
    <text class="result-count">找到 {{searchInfo.resultCount}} 条结果</text>
    <text class="search-time">（{{searchInfo.searchTime}}ms）</text>
    <text wx:if="{{searchInfo.mode === 'local'}}" class="search-mode">本地搜索</text>
  </view>
</view>

<!-- 无搜索结果提示 -->
<view wx:if="{{searchKeyword && ticketList.length === 0}}" class="no-results">
  <image src="/assets/icons/common/no-data.png" class="no-results-icon" />
  <view class="no-results-content">
    <text class="no-results-title">未找到相关工单</text>
    <text class="no-results-keyword">"{{searchKeyword}}"</text>
    <view class="no-results-hints">
      <text class="hint-title">搜索提示：</text>
      <text class="hint-item">• 输入完整的工单号（如 TK20250101001）</text>
      <text class="hint-item">• 搜索标题中的关键词</text>
      <text class="hint-item">• 输入提交人姓名或公司名称</text>
    </view>
  </view>
</view>
```

#### 3.2 样式优化（index.wxss）
```css
/* 搜索信息提示 */
.search-info {
  padding: 8rpx 32rpx;
  background: #f0f7ff;
  display: flex;
  align-items: center;
  font-size: 24rpx;
}

.search-info .result-count {
  color: #1677ff;
  font-weight: 500;
}

.search-info .search-time {
  color: #8c8c8c;
  margin-left: 8rpx;
}

.search-info .search-mode {
  margin-left: auto;
  padding: 4rpx 12rpx;
  background: #1677ff;
  color: white;
  border-radius: 8rpx;
  font-size: 20rpx;
}

/* 无结果提示优化 */
.no-results {
  padding: 100rpx 40rpx;
  text-align: center;
}

.no-results-icon {
  width: 200rpx;
  height: 200rpx;
  opacity: 0.5;
}

.no-results-content {
  margin-top: 40rpx;
}

.no-results-title {
  display: block;
  font-size: 32rpx;
  color: #8c8c8c;
  margin-bottom: 16rpx;
}

.no-results-keyword {
  display: block;
  font-size: 36rpx;
  color: #1677ff;
  font-weight: 500;
  margin-bottom: 40rpx;
}

.no-results-hints {
  text-align: left;
  display: inline-block;
}

.hint-title {
  display: block;
  font-size: 28rpx;
  color: #595959;
  margin-bottom: 16rpx;
  font-weight: 500;
}

.hint-item {
  display: block;
  font-size: 26rpx;
  color: #8c8c8c;
  line-height: 1.8;
}
```

### 4. 性能优化措施

#### 4.1 数据量控制
- 限制最多加载 500 条工单
- 超过限制时提示用户使用筛选条件

#### 4.2 搜索优化
- 300ms 防抖，避免频繁搜索
- 搜索结果缓存（可选）
- 异步搜索，不阻塞 UI

#### 4.3 内存管理
- 页面 unload 时清理搜索索引
- 定期更新索引，避免数据过期

### 5. 降级方案

保留切换到数据库搜索的能力：
```javascript
// 切换搜索模式
toggleSearchMode() {
  const newMode = this.data.searchMode === 'local' ? 'database' : 'local';
  this.setData({ searchMode: newMode });
  
  wx.showToast({
    title: `切换到${newMode === 'local' ? '本地' : '数据库'}搜索`,
    icon: 'none'
  });
}
```

### 6. 测试要点

1. **功能测试**
   - 工单号精确搜索
   - 标题模糊搜索
   - 提交人搜索
   - 公司名搜索
   - 清空搜索

2. **性能测试**
   - 搜索响应时间 < 100ms
   - 500条数据初始化时间 < 500ms
   - 内存占用 < 10MB

3. **兼容性测试**
   - 不同角色权限
   - 数据更新后重建索引
   - 网络异常处理

### 7. 上线步骤

1. **灰度测试**（可选）
   - 先对部分用户开放
   - 收集反馈和性能数据

2. **正式上线**
   - 全量发布
   - 监控错误日志
   - 收集搜索数据

3. **持续优化**
   - 基于搜索日志优化权重
   - 添加热门搜索
   - 实现搜索建议

这个改造方案能在不破坏原有功能的前提下，显著提升搜索性能和用户体验。