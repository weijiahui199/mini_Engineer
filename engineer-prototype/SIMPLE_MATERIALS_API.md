# 简化版耗材管理 API 设计

## 📋 概述

基于小公司规模和快速上线需求，简化耗材管理功能，只保留最基本和必要的功能。

### 🆕 耗材弹窗功能

为了确保耗材使用记录的完整性，在以下操作时会自动弹出耗材记录界面：
- **完成工单**：强制记录本次处理使用的耗材
- **暂停处理**：记录阶段性使用的耗材，便于跟踪中间过程
- **主动记录**：工程师可随时点击"记录耗材"按钮

---

## 🔧 云函数设计

### 扩展现有云函数和新增云函数

#### 1. 扩展 submitTicket 云函数
添加工程师端工单管理功能到现有的submitTicket云函数中：

##### 新增action: 'assign' - 分配工单（经理专用）
```javascript
wx.cloud.callFunction({
  name: 'submitTicket',
  data: {
    action: 'assign',
    ticketId: 'ticket_123',
    assignedTo: 'engineer_openid',  // 被分配工程师的openid
    notes: '请优先处理，用户比较着急'
  }
})
```

##### 新增action: 'listForEngineer' - 获取工程师工单列表
```javascript
wx.cloud.callFunction({
  name: 'submitTicket',
  data: {
    action: 'listForEngineer',
    status: 'assigned',  // 'assigned', 'processing', 'all'
    page: 1,
    limit: 20
  }
})
```

#### 2. 新增 materialManager 云函数

##### action: 'recordUsage' - 记录耗材使用
```javascript
// 在工单处理时记录使用的耗材
// 支持完成工单、暂停处理、主动记录三种场景
wx.cloud.callFunction({
  name: 'materialManager',
  data: {
    action: 'recordUsage',
    ticketId: 'ticket_123',
    actionType: 'complete', // 'complete', 'pause', 'record'
    description: '处理电脑无法开机问题',
    timeSpent: 65, // 耗时分钟数
    materials: [
      {
        materialName: '网线',
        quantity: 3,
        unit: '米',
        notes: '更换损坏的连接线'
      },
      {
        materialName: '螺丝包',
        quantity: 1,
        unit: '套',
        notes: '固定设备'
      }
    ]
  }
})

// 响应
{
  "code": 200,
  "message": "耗材使用记录已保存",
  "data": {
    "actionType": "complete",
    "ticketStatus": "resolved" // 根据actionType更新工单状态
  }
}
```

##### action: 'getCommonMaterials' - 获取常用耗材列表
```javascript
// 获取预设的常用耗材列表（用于下拉选择）
wx.cloud.callFunction({
  name: 'materialManager',
  data: {
    action: 'getCommonMaterials'
  }
})

// 响应
{
  "code": 200,
  "data": [
    { "materialName": "网线", "unit": "米", "category": "网络" },
    { "materialName": "打印纸", "unit": "包", "category": "办公" },
    { "materialName": "墨盒", "unit": "个", "category": "办公" },
    { "materialName": "螺丝包", "unit": "套", "category": "硬件" },
    { "materialName": "电源线", "unit": "根", "category": "硬件" },
    { "materialName": "数据线", "unit": "根", "category": "硬件" }
  ]
}
```

##### action: 'getPersonalStats' - 获取个人使用统计
```javascript
// 获取工程师个人的耗材使用统计
wx.cloud.callFunction({
  name: 'materialManager',
  data: {
    action: 'getPersonalStats',
    timeRange: 'month'  // week, month
  }
})

// 响应
{
  "code": 200,
  "data": {
    "totalTypes": 5,        // 使用的耗材种类数
    "totalTickets": 12,     // 涉及的工单数
    "topUsed": [
      { "materialName": "网线", "totalQuantity": 18, "unit": "米" },
      { "materialName": "螺丝包", "totalQuantity": 5, "unit": "套" },
      { "materialName": "打印纸", "totalQuantity": 2, "unit": "包" },
      { "materialName": "墨盒", "totalQuantity": 1, "unit": "个" }
    ]
  }
}
```

##### action: 'getTeamStats' - 获取团队使用统计（仅经理可用）
```javascript
// 经理查看团队整体的耗材使用情况
wx.cloud.callFunction({
  name: 'materialManager',
  data: {
    action: 'getTeamStats',
    timeRange: 'month'
  }
})

// 响应
{
  "code": 200,
  "data": {
    "teamSummary": {
      "totalTypes": 8,
      "totalTickets": 45,
      "activeEngineers": 4
    },
    "topMaterials": [
      { "materialName": "网线", "totalQuantity": 68, "unit": "米" },
      { "materialName": "打印纸", "totalQuantity": 12, "unit": "包" },
      { "materialName": "螺丝包", "totalQuantity": 15, "unit": "套" },
      { "materialName": "墨盒", "totalQuantity": 6, "unit": "个" }
    ]
  }
}
```

---

## 📊 数据库查询（简化版）

### 1. 记录耗材使用
```javascript
// 在工作日志中添加耗材使用记录
async function recordMaterialUsage(ticketId, materials, engineerOpenid) {
  await db.collection('worklog').add({
    data: {
      _openid: engineerOpenid,
      ticketId: ticketId,
      type: 'work',
      action: 'complete',
      materialsUsed: materials,
      createTime: new Date()
    }
  });
}
```

### 2. 获取个人统计
```javascript
// 统计个人本月耗材使用情况
async function getPersonalStats(engineerOpenid, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const result = await db.collection('worklog')
    .aggregate()
    .match({
      _openid: engineerOpenid,
      createTime: _.gte(startDate),
      'materialsUsed.0': _.exists(true)
    })
    .unwind('$materialsUsed')
    .group({
      _id: '$materialsUsed.materialName',
      totalQuantity: { $sum: '$materialsUsed.quantity' },
      unit: { $first: '$materialsUsed.unit' },
      ticketCount: { $sum: 1 }
    })
    .sort({ totalQuantity: -1 })
    .end();
    
  return {
    totalTypes: result.list.length,
    totalTickets: new Set(result.list.map(item => item.ticketCount)).size,
    topUsed: result.list.slice(0, 5)
  };
}
```

### 3. 获取团队统计
```javascript
// 统计团队整体耗材使用情况（仅经理可用）
async function getTeamStats(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // 获取所有工程师的耗材使用记录
  const result = await db.collection('worklog')
    .aggregate()
    .match({
      createTime: _.gte(startDate),
      'materialsUsed.0': _.exists(true)
    })
    .unwind('$materialsUsed')
    .group({
      _id: {
        materialName: '$materialsUsed.materialName',
        engineer: '$_openid'
      },
      totalQuantity: { $sum: '$materialsUsed.quantity' },
      unit: { $first: '$materialsUsed.unit' }
    })
    .end();
    
  // 处理数据，计算团队总计
  const materialTotals = {};
  const engineerStats = {};
  
  result.list.forEach(item => {
    const { materialName, engineer } = item._id;
    
    // 材料总计
    if (!materialTotals[materialName]) {
      materialTotals[materialName] = {
        materialName,
        totalQuantity: 0,
        unit: item.unit
      };
    }
    materialTotals[materialName].totalQuantity += item.totalQuantity;
    
    // 工程师统计
    if (!engineerStats[engineer]) {
      engineerStats[engineer] = {
        engineer,
        materialTypes: 0,
        totalTickets: 0
      };
    }
    engineerStats[engineer].materialTypes++;
  });
  
  return {
    teamSummary: {
      totalTypes: Object.keys(materialTotals).length,
      activeEngineers: Object.keys(engineerStats).length
    },
    topMaterials: Object.values(materialTotals)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 5),
    engineerStats: Object.values(engineerStats)
  };
}
```

---

## 📱 前端实现（简化版）

### 1. 耗材选择组件
```javascript
// 简化的耗材选择器
Component({
  data: {
    commonMaterials: [],      // 常用耗材列表
    selectedMaterials: []     // 已选择的耗材
  },
  
  async lifetimes() {
    // 加载常用耗材列表
    const result = await wx.cloud.callFunction({
      name: 'materialManager',
      data: { action: 'getCommonMaterials' }
    });
    
    this.setData({
      commonMaterials: result.result.data
    });
  },
  
  methods: {
    // 添加耗材
    addMaterial() {
      this.setData({
        selectedMaterials: [...this.data.selectedMaterials, {
          materialName: '',
          quantity: 1,
          unit: '',
          notes: ''
        }]
      });
    },
    
    // 保存耗材记录
    async saveMaterials() {
      if (this.data.selectedMaterials.length === 0) return;
      
      try {
        await wx.cloud.callFunction({
          name: 'materialManager',
          data: {
            action: 'recordUsage',
            ticketId: this.data.ticketId,
            materials: this.data.selectedMaterials
          }
        });
        
        wx.showToast({ title: '保存成功' });
        this.triggerEvent('saved');
        
      } catch (error) {
        wx.showToast({ title: '保存失败', icon: 'error' });
      }
    }
  }
});
```

### 2. 统计页面
```javascript
// 简化的统计页面
Page({
  data: {
    personalStats: {},
    teamStats: {},      // 仅经理看到
    isManager: false
  },
  
  async onLoad() {
    // 检查用户角色
    const userInfo = wx.getStorageSync('userInfo');
    this.setData({ isManager: userInfo.role === 'manager' });
    
    // 加载统计数据
    await this.loadStats();
  },
  
  async loadStats() {
    try {
      // 个人统计
      const personalResult = await wx.cloud.callFunction({
        name: 'materialManager',
        data: {
          action: 'getPersonalStats',
          timeRange: 'month'
        }
      });
      
      this.setData({ personalStats: personalResult.result.data });
      
      // 团队统计（仅经理）
      if (this.data.isManager) {
        const teamResult = await wx.cloud.callFunction({
          name: 'materialManager',
          data: {
            action: 'getTeamStats',
            timeRange: 'month'
          }
        });
        
        this.setData({ teamStats: teamResult.result.data });
      }
      
    } catch (error) {
      wx.showToast({ title: '加载失败', icon: 'error' });
    }
  }
});
```

---

## 🎯 实现重点

### 1. 简化原则
- **无库存管理**：不跟踪实际库存，只记录使用量
- **无预警系统**：不需要库存警报功能
- **无成本计算**：不计算具体价格，只记录数量

### 2. 核心功能
- **记录使用**：工程师在处理工单时记录耗材使用
- **预设选项**：提供常用耗材的下拉选择
- **简单统计**：显示个人和团队的使用统计

### 3. 权限控制
- **工程师**：记录耗材使用，查看个人统计
- **经理**：查看所有统计，管理常用耗材列表

### 4. 开发优先级
1. **第一周**：实现耗材记录功能
2. **第二周**：实现统计查看功能
3. **第三周**：测试和优化

这个简化版本可以满足基本的耗材使用跟踪需求，同时保持系统简单易维护，适合小公司快速上线使用。