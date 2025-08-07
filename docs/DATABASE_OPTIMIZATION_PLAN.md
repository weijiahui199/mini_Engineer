# 数据库优化计划
> 创建时间：2024-12-17  
> 版本：v1.0  
> 状态：待实施

## 一、现状分析与问题诊断

### 1.1 当前数据库架构
- **数据库类型**：微信云开发数据库（NoSQL）
- **环境ID**：cloud1-1gp11xbgcf2738ca
- **主要集合**：
  - `users` - 用户信息（工程师、经理、客户）
  - `tickets` - 工单数据
  - `materials` - 物料库存
  - `worklog` - 工作日志
  - `notifications` - 通知消息（待创建）
  - `helpRequests` - 协助请求（待创建）

### 1.2 存在的性能问题

#### 问题1：重复查询
- Dashboard页面同时发起4-5个独立查询
- 多个页面重复查询用户信息
- 统计数据每次都重新计算

#### 问题2：缺少索引优化
- 查询条件没有对应的索引支持
- 复合查询效率低下
- 排序操作消耗大量资源

#### 问题3：数据加载策略不当
- 一次性加载所有数据
- 分页实现使用skip，效率随页数增加而降低
- 没有实现数据预加载

#### 问题4：缺少缓存机制
- 每次操作都直接查询数据库
- 静态数据重复获取
- 没有利用本地存储

#### 问题5：查询逻辑不优化
- 多个串行查询阻塞页面加载
- 没有使用聚合管道优化复杂查询
- 字段获取没有使用投影

## 二、优化方案设计

### 2.1 数据库索引优化

#### tickets集合索引设计
```javascript
// 索引1：用户工单查询
{
  keys: {
    openid: 1,
    createTime: -1
  },
  name: "idx_user_tickets"
}

// 索引2：工程师工单查询
{
  keys: {
    assignedTo: 1,
    status: 1,
    createTime: -1
  },
  name: "idx_engineer_tickets"
}

// 索引3：状态和优先级筛选
{
  keys: {
    status: 1,
    priority: 1,
    createTime: -1
  },
  name: "idx_status_priority"
}

// 索引4：工单号查询（唯一索引）
{
  keys: {
    ticketNo: 1
  },
  unique: true,
  name: "idx_ticket_no"
}
```

#### users集合索引设计
```javascript
// 索引1：OpenID查询（唯一索引）
{
  keys: {
    openid: 1
  },
  unique: true,
  name: "idx_openid"
}

// 索引2：角色查询
{
  keys: {
    roleGroup: 1,
    status: 1
  },
  name: "idx_role_status"
}
```

#### materials集合索引设计
```javascript
// 索引1：分类和库存查询
{
  keys: {
    category: 1,
    stock: -1
  },
  name: "idx_category_stock"
}

// 索引2：物料名称搜索
{
  keys: {
    name: "text"
  },
  name: "idx_name_text"
}
```

### 2.2 查询优化策略

#### 策略1：聚合查询替代多次查询
```javascript
// 优化前：4次独立查询
const pending = await db.collection('tickets').where({status: 'pending'}).count();
const processing = await db.collection('tickets').where({status: 'processing'}).count();
const resolved = await db.collection('tickets').where({status: 'resolved'}).count();
const urgent = await db.collection('tickets').where({priority: 'urgent'}).count();

// 优化后：1次聚合查询
const stats = await db.collection('tickets').aggregate()
  .group({
    _id: null,
    pending: $.sum($.cond({if: $.eq(['$status', 'pending']), then: 1, else: 0})),
    processing: $.sum($.cond({if: $.eq(['$status', 'processing']), then: 1, else: 0})),
    resolved: $.sum($.cond({if: $.eq(['$status', 'resolved']), then: 1, else: 0})),
    urgent: $.sum($.cond({if: $.eq(['$priority', 'urgent']), then: 1, else: 0}))
  })
  .end();
```

#### 策略2：使用字段投影减少数据传输
```javascript
// 优化前：获取所有字段
const tickets = await db.collection('tickets').get();

// 优化后：只获取需要的字段
const tickets = await db.collection('tickets')
  .field({
    ticketNo: true,
    title: true,
    status: true,
    priority: true,
    createTime: true
  })
  .get();
```

#### 策略3：并行查询优化
```javascript
// 优化前：串行查询
const userInfo = await getUserInfo();
const tickets = await getTickets();
const materials = await getMaterials();

// 优化后：并行查询
const [userInfo, tickets, materials] = await Promise.all([
  getUserInfo(),
  getTickets(),
  getMaterials()
]);
```

### 2.3 缓存机制设计

#### 三级缓存架构
```javascript
class CacheManager {
  constructor() {
    this.memoryCache = new Map(); // 内存缓存
    this.storageCache = wx.getStorageSync('cache') || {}; // 本地缓存
  }

  // 获取数据（优先级：内存 > 本地 > 数据库）
  async get(key, fetcher, options = {}) {
    const { ttl = 300000, useStorage = true } = options; // 默认5分钟过期

    // 1. 检查内存缓存
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      if (Date.now() - cached.time < ttl) {
        return cached.data;
      }
    }

    // 2. 检查本地缓存
    if (useStorage && this.storageCache[key]) {
      const cached = this.storageCache[key];
      if (Date.now() - cached.time < ttl) {
        this.memoryCache.set(key, cached);
        return cached.data;
      }
    }

    // 3. 从数据库获取
    const data = await fetcher();
    this.set(key, data, useStorage);
    return data;
  }

  // 设置缓存
  set(key, data, useStorage = true) {
    const cached = { data, time: Date.now() };
    this.memoryCache.set(key, cached);
    
    if (useStorage) {
      this.storageCache[key] = cached;
      wx.setStorageSync('cache', this.storageCache);
    }
  }

  // 清除缓存
  clear(key) {
    if (key) {
      this.memoryCache.delete(key);
      delete this.storageCache[key];
    } else {
      this.memoryCache.clear();
      this.storageCache = {};
    }
    wx.setStorageSync('cache', this.storageCache);
  }
}
```

#### 缓存策略配置
| 数据类型 | 缓存时间 | 存储位置 | 更新策略 |
|---------|---------|---------|---------|
| 用户信息 | 30分钟 | 内存+本地 | 登录时更新 |
| 工单统计 | 30秒 | 内存 | 定时刷新 |
| 物料列表 | 5分钟 | 内存+本地 | 修改时失效 |
| 筛选结果 | 1分钟 | 内存 | 条件变化时失效 |
| 工程师列表 | 10分钟 | 内存+本地 | 手动刷新 |

### 2.4 分页优化方案

#### 游标分页实现
```javascript
class CursorPagination {
  constructor(collection, pageSize = 10) {
    this.collection = collection;
    this.pageSize = pageSize;
    this.lastDoc = null;
    this.hasMore = true;
  }

  async loadNext(where = {}) {
    let query = this.collection.where(where);
    
    // 使用上一页最后一个文档作为游标
    if (this.lastDoc) {
      query = query.orderBy('createTime', 'desc')
                   .startAfter(this.lastDoc);
    } else {
      query = query.orderBy('createTime', 'desc');
    }
    
    const res = await query.limit(this.pageSize + 1).get();
    
    // 检查是否有更多数据
    this.hasMore = res.data.length > this.pageSize;
    const data = res.data.slice(0, this.pageSize);
    
    // 更新游标
    if (data.length > 0) {
      this.lastDoc = data[data.length - 1];
    }
    
    return { data, hasMore: this.hasMore };
  }

  reset() {
    this.lastDoc = null;
    this.hasMore = true;
  }
}
```

#### 预加载机制
```javascript
class PreloadManager {
  constructor() {
    this.preloadQueue = new Map();
  }

  // 预加载下一页数据
  async preloadNext(key, loader) {
    if (!this.preloadQueue.has(key)) {
      const promise = loader();
      this.preloadQueue.set(key, promise);
      return promise;
    }
    return this.preloadQueue.get(key);
  }

  // 获取预加载的数据
  async getPreloaded(key) {
    if (this.preloadQueue.has(key)) {
      const data = await this.preloadQueue.get(key);
      this.preloadQueue.delete(key);
      return data;
    }
    return null;
  }
}
```

### 2.5 批量操作优化

#### 批量查询实现
```javascript
async function batchQuery(ids, collection, batchSize = 50) {
  const batches = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }
  
  const results = await Promise.all(
    batches.map(batch => 
      collection.where({
        _id: db.command.in(batch)
      }).get()
    )
  );
  
  return results.flatMap(r => r.data);
}
```

#### 批量更新实现
```javascript
async function batchUpdate(updates, collection) {
  const transaction = await db.startTransaction();
  
  try {
    const promises = updates.map(({ id, data }) =>
      transaction.collection(collection).doc(id).update({ data })
    );
    
    await Promise.all(promises);
    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
```

## 三、实施计划

### 第一阶段：基础优化（第1周）
- [ ] 创建数据库索引
- [ ] 优化Dashboard页面查询
- [ ] 修复分页重复问题
- [ ] 实现基础缓存机制

### 第二阶段：查询优化（第2周）
- [ ] 实现聚合查询
- [ ] 添加字段投影
- [ ] 并行化查询请求
- [ ] 优化工单列表查询

### 第三阶段：缓存系统（第3周）
- [ ] 实现CacheManager
- [ ] 集成缓存到各页面
- [ ] 添加缓存失效策略
- [ ] 实现预加载机制

### 第四阶段：高级优化（第4周）
- [ ] 实现游标分页
- [ ] 添加虚拟滚动
- [ ] 批量操作优化
- [ ] 性能监控系统

## 四、性能指标

### 优化前基准
- Dashboard加载时间：2.5s
- 工单列表首屏：1.8s
- 翻页加载：1.2s
- 数据库请求数：15-20次/页面

### 优化目标
- Dashboard加载时间：< 1s
- 工单列表首屏：< 0.8s
- 翻页加载：< 0.5s
- 数据库请求数：< 5次/页面

### 监控指标
```javascript
class PerformanceMonitor {
  static track(operation, fn) {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    
    // 记录性能数据
    wx.reportAnalytics('db_performance', {
      operation,
      duration,
      timestamp: Date.now()
    });
    
    // 慢查询告警
    if (duration > 1000) {
      console.warn(`Slow query detected: ${operation} took ${duration}ms`);
    }
    
    return result;
  }
}
```

## 五、注意事项

### 5.1 兼容性考虑
- 保持向后兼容，新旧代码能够共存
- 提供降级方案，缓存失效时能正常工作
- 分步实施，每步都要充分测试

### 5.2 数据一致性
- 缓存更新策略要保证数据一致性
- 关键操作（如工单状态更新）要实时同步
- 提供手动刷新机制

### 5.3 错误处理
- 所有优化都要有错误处理
- 失败时自动降级到原始方案
- 记录错误日志便于排查

### 5.4 测试要求
- 单元测试覆盖核心优化逻辑
- 性能测试验证优化效果
- 压力测试确保稳定性

## 六、回滚方案

如果优化后出现问题，可以通过以下步骤回滚：

1. **关闭缓存**：设置全局开关禁用缓存
2. **恢复查询**：使用原始查询逻辑
3. **删除索引**：如果索引导致问题可以删除
4. **版本控制**：保留优化前的代码版本

## 七、文档更新

优化完成后需要更新以下文档：
- API文档：新增缓存相关API
- 部署文档：索引创建步骤
- 开发指南：最佳实践更新
- 性能报告：优化效果数据

## 八、后续优化

### 长期优化方向
1. **数据分片**：大数据量时考虑分片存储
2. **读写分离**：分离查询和更新操作
3. **CDN加速**：静态资源使用CDN
4. **服务端渲染**：关键页面SSR优化

### 持续监控
1. 建立性能基准线
2. 定期性能评估
3. 用户体验反馈
4. 自动化性能测试

---

**文档版本历史**
- v1.0 (2024-12-17): 初始版本，制定优化计划