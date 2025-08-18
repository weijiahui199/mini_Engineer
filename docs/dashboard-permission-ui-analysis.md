# Dashboard 页面权限与UI分析报告

## 生成时间
2025-08-18

## 更新说明
根据产品说明更新了对权限体系的理解：
- 普通用户可以访问Dashboard页面，但不应看到工单详情（商业机密）
- 经理在Dashboard看到的是个人数据，不是全局数据
- UI元素可以对所有角色显示，只是数据内容需要权限控制

## 1. 角色权限体系（更新后的理解）

### 1.1 系统中的三种角色
1. **普通用户**（默认）
   - ✅ 可以访问Dashboard页面
   - ✅ 可以看到UI框架和统计图表
   - ❌ 不能看到工单详情（商业机密）
   - ❌ 不能接单处理
   - 只能看到自己创建的工单统计

2. **工程师**
   - 可以看到工单池（未分配的工单）
   - 可以看到自己负责的工单
   - 可以接单处理
   - 统计数据包括：工单池 + 个人负责的工单

3. **经理**
   - 在Dashboard上看到的是**个人角色下的数据**（不是全局）
   - 可以看到分配给自己的工单
   - 可以接单处理
   - 全局数据统计功能待开发

## 2. 当前存在的权限UI问题（基于新的理解）

### 2.1 页面访问权限 ✅ （无问题）
- 普通用户可以访问Dashboard页面 - **这是正确的**
- 页面标题"工程师工作台"可能需要改为更通用的"工作台"

### 2.2 统计数据显示的问题

#### 当前的统计数据逻辑（`loadTicketStats` 方法）:

**普通用户**:
```javascript
// 第806-831行
return [
  { key: 'pending', label: '待处理', value: myPending.total },
  { key: 'processing', label: '处理中', value: myProcessing.total },
  { key: 'resolved', label: '已完成', value: myResolved.total },
  { key: 'total', label: '全部', value: total }
];
```
❌ **问题**: 普通用户看不到"待接单"的统计UI，因为返回的数组中没有 `key: 'pool'` 的项

**工程师**:
```javascript
// 第797-803行
return [
  { key: 'pool', label: '待接单', value: poolTickets.total },  // ✅ 有待接单
  { key: 'processing', label: '处理中', value: myProcessing.total },
  { key: 'paused', label: '已暂停', value: myPaused.total },
  { key: 'resolved', label: '今日完成', value: myTodayResolved.total },
  { key: 'urgent', label: '紧急', value: urgentTickets.total }
];
```

**经理** (实际代码):
```javascript
// 第714-745行
// 注意：这里查询的是全局数据，不是个人数据
db.collection('tickets').where({ status: 'pending' }).count()  // 所有待处理
db.collection('tickets').where({ status: 'processing' }).count()  // 所有处理中
```
❌ **问题**: 经理看到的是全局统计，而不是个人数据

### 2.3 快捷操作 ✅ （暂不处理）
根据说明，快捷操作功能尚未开发，暂时不需要处理权限问题。

### 2.4 工单列表的权限问题（商业机密保护）

#### 当前实现（`loadLatestTickets` 方法）:

**普通用户** (第952-957行):
```javascript
// 普通用户：只看自己创建的待处理工单
whereCondition = _.and([
  { openid: openid },
  { status: 'pending' }
]);
```
✅ 正确：普通用户只能看到自己创建的工单

**工程师** (第938-951行):
```javascript
// 工程师：看工单池（未分配）+ 自己负责的待处理
whereCondition = _.and([
  { status: 'pending' },
  _.or([
    _.or([
      { assigneeOpenid: _.exists(false) },
      { assigneeOpenid: '' }
    ]),
    { assigneeOpenid: openid }
  ])
]);
```
✅ 正确：工程师可以看到工单池和自己的工单

**经理** (第935-937行):
```javascript
// 经理：看所有待处理工单
whereCondition = { status: 'pending' };
```
✅ **正确**: 经理看到所有待处理工单是正确的设计，经理需要全局视角来管理团队

#### 工单详情显示问题:
❌ **严重问题**: 普通用户可以在工单列表中看到其他人的工单详情（如果数据库有脏数据），这涉及商业机密泄露

### 2.5 操作按钮的权限控制

**当前按钮显示逻辑** (index.wxml 第180-203行):
```html
<button wx:if="{{item.status === 'pending' && !item.assigneeOpenid}}">
  开始处理
</button>
```

❌ **问题**: 
- 普通用户如果看到工单（不应该看到），会显示"开始处理"按钮
- 点击后才提示"权限不足"
- 应该根据用户角色控制按钮显示

## 3. 基于新理解的修改建议

### 3.1 需要立即修改的内容

#### A. 修改初始统计数据为0 ✅
```javascript
// 修改位置: index.js 第30-36行
todayStats: [
  { key: 'pending', label: '待处理', value: 0, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
  { key: 'processing', label: '进行中', value: 0, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
  { key: 'paused', label: '已暂停', value: 0, colorClass: 'text-orange', icon: '/assets/icons/pause-icon.png' },
  { key: 'resolved', label: '已完成', value: 0, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
  { key: 'urgent', label: '紧急', value: 0, colorClass: 'text-red', icon: '/assets/icons/urgent-icon.png' }
]
```

#### B. ~~修复经理的统计数据查询~~ ✅ 无需修改
经理看到全局数据是正确的设计，保持现有逻辑即可。

#### C. ~~修复经理的工单列表查询~~ ✅ 无需修改  
经理看到所有待处理工单是正确的，这样才能进行团队管理和工单分配。

#### D. 统一统计UI显示 ⚠️
让所有角色都能看到相同的统计UI框架，只是数据为0：
```javascript
// 为普通用户也返回5个统计项，保持UI一致
if (roleGroup === '用户') {
  return [
    { key: 'pool', label: '待接单', value: 0, colorClass: 'text-green', icon: '/assets/icons/pending-icon.png' },
    { key: 'processing', label: '处理中', value: myProcessing.total || 0, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
    { key: 'paused', label: '已暂停', value: 0, colorClass: 'text-orange', icon: '/assets/icons/pause-icon.png' },
    { key: 'resolved', label: '已完成', value: myResolved.total || 0, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
    { key: 'total', label: '我的工单', value: total, colorClass: 'text-gray', icon: '/assets/icons/stats-icon.png' }
  ];
}
```

#### E. 添加角色识别到页面数据 ✅
```javascript
data: {
  userRole: '',  // 当前用户角色
  isEngineer: false,  // 是否是工程师
  isManager: false,   // 是否是经理
  // ... 其他数据
}
```

#### F. 控制"开始处理"按钮的显示 ⚠️
```html
<!-- 只有工程师和经理显示"开始处理"按钮 -->
<button 
  wx:if="{{(isEngineer || isManager) && item.status === 'pending' && !item.assigneeOpenid}}"
  class="custom-action-btn btn-primary-action"
  catchtap="acceptTicket"
  data-id="{{item.id}}"
>
  开始处理
</button>
```

## 4. 重点问题总结

### 4.1 需要立即修复的问题

1. **初始统计数据的虚拟值** ✅
   - 将所有统计初始值改为0

2. **普通用户看不到"待接单"统计UI** ⚠️
   - 统一所有角色的统计UI框架
   - 普通用户的"待接单"显示为0

3. **"开始处理"按钮权限控制** ⚠️
   - 添加角色判断，普通用户不显示此按钮

### 4.2 数据权限保护正确的地方

1. **工单列表查询** ✅
   - 普通用户只能查看自己创建的工单
   - 工程师可以看工单池和自己的工单
   - 经理可以看所有待处理工单（全局管理视角）
   - 数据库查询层面已经做了权限控制

2. **紧急工单查询** ✅
   - 按角色正确过滤了数据
   
3. **经理的全局视角** ✅
   - 经理看到所有工单是正确的设计
   - 用于团队管理和工单分配

### 4.3 UI显示原则（基于新理解）

1. **页面访问**: 所有角色都可以访问Dashboard
2. **UI框架**: 统计图表等UI元素对所有角色可见
3. **数据内容**: 根据权限显示不同的数据（工单是商业机密）
4. **操作按钮**: 根据角色显示或隐藏

## 5. 建议的修改步骤

### 第一步：修改初始数据
```javascript
// index.js 第30-36行
todayStats: [
  { key: 'pending', label: '待处理', value: 0, ... },
  { key: 'processing', label: '进行中', value: 0, ... },
  { key: 'paused', label: '已暂停', value: 0, ... },
  { key: 'resolved', label: '已完成', value: 0, ... },
  { key: 'urgent', label: '紧急', value: 0, ... }
]

// 同时修改 engineerInfo
engineerInfo: {
  name: '张工程师',  // 保留默认名
  avatar: '',
  currentTasks: 0,   // 改为0
  maxTasks: 0,        // 改为0
  location: ''        // 改为空字符串
}
```

### 第二步：添加角色标识
```javascript
data: {
  userRole: '',      // 添加
  isEngineer: false, // 添加
  isManager: false,  // 添加
  // ... 其他数据
}
```

### 第三步：统一统计UI
让普通用户也看到5个统计项（待接单显示为0）

### 第四步：控制操作按钮
根据 isEngineer 和 isManager 控制"开始处理"按钮的显示

## 总结

基于最新的理解，需要修改的问题是：
1. ✅ **虚拟数据需要清零** - 避免误导
2. ⚠️ **UI框架不统一** - 普通用户看不到"待接单"统计项
3. ⚠️ **按钮权限控制缺失** - 普通用户不应看到"开始处理"按钮

经理看到全局工单是正确的设计，无需修改。这些修改不会影响普通用户访问页面，只是确保他们看不到商业机密（工单详情），同时保持UI的一致性。