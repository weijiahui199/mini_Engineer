# 耗材列表页面刷新机制设计文档

## 一、当前问题分析

### 1.1 现状问题
- **频繁请求**：每次切换类目都会重新请求后端数据
- **性能浪费**：相同类目的数据被重复请求
- **用户体验差**：每次切换都有加载延迟
- **后端压力大**：大量重复的数据请求

### 1.2 需要解决的核心问题
1. 减少不必要的后端请求
2. 提升页面切换的响应速度
3. 保证数据的实时性和准确性
4. 平衡缓存和数据新鲜度

## 二、缓存策略设计

### 2.1 缓存层级
```javascript
// 缓存结构设计
categoryCache = {
  'popular': {
    data: [...],           // 材料列表数据
    timestamp: 1234567890, // 缓存时间戳
    page: 1,              // 当前页码
    hasMore: true,        // 是否有更多数据
    total: 100            // 总数
  },
  'paper': { ... },
  'writing': { ... },
  // ...
}
```

### 2.2 缓存有效期策略

| 类目类型 | 缓存时长 | 说明 |
|---------|---------|------|
| popular（常用） | 5分钟 | 常用耗材变化频繁，需要较短缓存 |
| 其他类目 | 10分钟 | 一般类目变化较少，可以较长缓存 |
| 搜索结果 | 不缓存 | 搜索结果实时性要求高 |

### 2.3 缓存失效触发条件
1. **时间失效**：超过缓存有效期
2. **主动失效**：
   - 用户下拉刷新
   - 用户点击刷新按钮
   - 购物车提交订单成功后
3. **被动失效**：
   - App进入后台超过30分钟
   - 内存警告时清理

## 三、数据更新原则

### 3.1 初次加载
```
用户进入页面
  ↓
检查本地缓存
  ↓
有缓存且未过期 → 显示缓存数据 → 后台静默更新（可选）
  ↓
无缓存或已过期 → 请求后端数据 → 更新缓存
```

### 3.2 类目切换
```
切换类目
  ↓
检查该类目缓存
  ↓
有缓存且未过期：
  - 立即显示缓存数据
  - 不请求后端
  ↓
无缓存或已过期：
  - 显示加载状态
  - 请求后端数据
  - 更新缓存
```

### 3.3 下拉刷新
```
用户下拉刷新
  ↓
强制请求后端（忽略缓存）
  ↓
更新当前类目缓存
  ↓
同步更新购物车数量显示
```

### 3.4 购物车同步
```
从购物车页返回
  ↓
不重新请求数据
  ↓
仅同步更新数量显示（syncMaterialQuantities）
```

## 四、实现方案

### 4.1 缓存管理器
```javascript
// 缓存管理类
class MaterialCacheManager {
  constructor() {
    this.cache = {}
    this.cacheTimeout = {
      'popular': 5 * 60 * 1000,  // 5分钟
      'default': 10 * 60 * 1000  // 10分钟
    }
  }
  
  // 获取缓存
  getCache(category) {
    const cached = this.cache[category]
    if (!cached) return null
    
    const timeout = this.cacheTimeout[category] || this.cacheTimeout.default
    const isExpired = Date.now() - cached.timestamp > timeout
    
    return isExpired ? null : cached
  }
  
  // 设置缓存
  setCache(category, data) {
    this.cache[category] = {
      ...data,
      timestamp: Date.now()
    }
  }
  
  // 清除指定类目缓存
  clearCache(category) {
    delete this.cache[category]
  }
  
  // 清除所有缓存
  clearAllCache() {
    this.cache = {}
  }
}
```

### 4.2 页面加载流程优化
```javascript
// 优化后的加载流程
async loadMaterials(isRefresh = false) {
  const category = this.data.currentCategory
  
  // 强制刷新时清除缓存
  if (isRefresh) {
    this.cacheManager.clearCache(category)
  }
  
  // 尝试从缓存获取
  const cached = this.cacheManager.getCache(category)
  if (cached && !isRefresh) {
    console.log('[缓存命中]', category)
    this.setData({
      materials: cached.data,
      page: cached.page,
      hasMore: cached.hasMore,
      total: cached.total,
      loading: false
    })
    
    // 后台静默更新（可选）
    if (this.shouldSilentUpdate(cached)) {
      this.silentUpdateMaterials(category)
    }
    return
  }
  
  // 缓存未命中，请求后端
  console.log('[缓存未命中，请求后端]', category)
  await this.fetchMaterialsFromServer(category)
}
```

### 4.3 智能预加载
```javascript
// 预加载相邻类目（提升体验）
preloadAdjacentCategories(currentCategory) {
  const categories = ['popular', 'paper', 'writing', 'print', 'clean']
  const currentIndex = categories.indexOf(currentCategory)
  
  // 预加载前后类目
  const preloadIndexes = [
    currentIndex - 1,
    currentIndex + 1
  ].filter(i => i >= 0 && i < categories.length)
  
  preloadIndexes.forEach(index => {
    const category = categories[index]
    if (!this.cacheManager.getCache(category)) {
      // 低优先级后台加载
      setTimeout(() => {
        this.backgroundFetch(category)
      }, 1000)
    }
  })
}
```

## 五、性能监控指标

### 5.1 关键指标
- **缓存命中率**：缓存命中次数 / 总请求次数
- **平均加载时间**：数据展示的平均耗时
- **后端请求次数**：实际发送到后端的请求数
- **数据新鲜度**：数据更新的及时性

### 5.2 监控实现
```javascript
// 性能监控
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      requestCount: 0,
      totalLoadTime: 0
    }
  }
  
  getCacheHitRate() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses
    return total > 0 ? (this.metrics.cacheHits / total * 100).toFixed(2) : 0
  }
  
  getAverageLoadTime() {
    return this.metrics.requestCount > 0 
      ? (this.metrics.totalLoadTime / this.metrics.requestCount).toFixed(0)
      : 0
  }
}
```

## 六、特殊场景处理

### 6.1 库存实时性要求
- **问题**：库存数据需要较高的实时性
- **方案**：
  1. 缩短缓存时间（2-3分钟）
  2. 进入详情页时强制刷新该商品数据
  3. 添加到购物车时实时校验库存

### 6.2 价格变动处理
- **Manager角色**：可以看到价格，价格变动需要及时更新
- **方案**：Manager角色缓存时间减半

### 6.3 网络异常处理
```javascript
// 网络异常时的降级策略
handleNetworkError() {
  // 1. 优先使用过期缓存
  const expiredCache = this.getExpiredCache(category)
  if (expiredCache) {
    this.showExpiredDataWarning()
    return expiredCache
  }
  
  // 2. 显示离线提示
  this.showOfflineMessage()
  
  // 3. 提供重试机制
  this.enableRetryButton()
}
```

## 七、实施计划

### 第一阶段：基础缓存（优先级：高）
1. 实现基础缓存管理器
2. 添加类目数据缓存
3. 实现缓存过期机制

### 第二阶段：优化体验（优先级：中）
1. 实现智能预加载
2. 添加后台静默更新
3. 优化加载动画

### 第三阶段：监控优化（优先级：低）
1. 添加性能监控
2. 收集用户行为数据
3. 根据数据优化缓存策略

## 八、预期效果

### 8.1 性能提升
- **后端请求减少**：预计减少60-70%
- **页面切换速度**：提升80%以上
- **用户体验**：类目切换几乎无延迟

### 8.2 资源节省
- **网络流量**：减少50%以上
- **服务器负载**：降低60%
- **电量消耗**：减少频繁网络请求

## 九、注意事项

1. **数据一致性**：确保缓存数据与实际库存的一致性
2. **缓存大小**：监控缓存占用，防止内存溢出
3. **用户习惯**：根据用户使用习惯动态调整缓存策略
4. **A/B测试**：逐步推出，观察效果

## 十、总结

通过实施多级缓存策略和智能刷新机制，可以显著提升页面性能和用户体验，同时大幅降低后端压力。关键在于平衡数据实时性和性能之间的关系，通过合理的缓存时长和更新策略，实现最优的用户体验。