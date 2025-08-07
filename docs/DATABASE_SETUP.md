# 云数据库配置和部署指南

## 部署前准备

1. **确保云开发环境已开通**
   - 在微信开发者工具中点击"云开发"按钮
   - 确认环境ID配置正确（在 `app.js` 中的 `env` 参数）

2. **上传云函数**
   需要上传以下云函数到云端：
   ```bash
   # 在微信开发者工具中右键点击以下文件夹，选择"上传并部署：云端安装依赖"
   - cloudfunctions/login
   - cloudfunctions/initDatabase
   ```

## 数据库初始化步骤

### 方法一：自动初始化（推荐）
小程序首次启动时会自动调用 `initDatabase` 云函数初始化数据库。

### 方法二：手动初始化
1. 在微信开发者工具云开发控制台中
2. 选择"云函数"标签
3. 找到 `initDatabase` 函数
4. 点击"云端测试"执行函数

## 数据库集合结构

### 1. users（用户表）
```javascript
{
  _id: String,           // 自动生成的ID
  openid: String,        // 用户唯一标识
  name: String,          // 用户姓名
  role: String,          // 角色：engineer/manager
  avatar: String,        // 头像URL
  status: String,        // 状态：online/busy/offline
  department: String,    // 部门
  phone: String,         // 电话
  email: String,         // 邮箱
  skills: Array,         // 技能列表
  createTime: Date,      // 创建时间
  updateTime: Date       // 更新时间
}
```

### 2. tickets（工单表）
```javascript
{
  _id: String,           // 自动生成的ID
  ticketNo: String,      // 工单编号
  title: String,         // 标题
  description: String,   // 描述
  category: String,      // 类别
  priority: String,      // 优先级：urgent/high/medium/low
  status: String,        // 状态：pending/processing/resolved/cancelled
  submitterName: String, // 提交人姓名
  submitterPhone: String,// 提交人电话
  location: String,      // 位置
  assigneeOpenid: String,// 分配工程师openid
  assigneeName: String,  // 分配工程师姓名
  createTime: Date,      // 创建时间
  updateTime: Date,      // 更新时间
  resolveTime: Date,     // 解决时间
  images: Array,         // 图片列表
  solution: String,      // 解决方案
  feedback: String       // 用户反馈
}
```

### 3. materials（物料表）
```javascript
{
  _id: String,           // 自动生成的ID
  name: String,          // 物料名称
  category: String,      // 类别
  unit: String,          // 单位
  quantity: Number,      // 数量
  minStock: Number,      // 最低库存
  location: String,      // 存放位置
  description: String,   // 描述
  createTime: Date,      // 创建时间
  updateTime: Date       // 更新时间
}
```

### 4. notifications（通知表）
```javascript
{
  _id: String,           // 自动生成的ID
  userOpenid: String,    // 接收用户openid
  type: String,          // 类型：ticket_new/system/material_low
  title: String,         // 标题
  content: String,       // 内容
  ticketId: String,      // 相关工单ID（可选）
  isRead: Boolean,       // 是否已读
  createTime: Date,      // 创建时间
  readTime: Date         // 阅读时间
}
```

## 数据库权限配置

在云开发控制台的"数据库"标签中，为每个集合设置权限：

### 推荐权限设置
```json
{
  "read": "auth.openid != null",
  "write": "auth.openid != null"
}
```

或使用更精细的权限控制：

### users 集合
```json
{
  "read": "auth.openid == doc.openid || auth.openid in get('database.users.manager').openid",
  "write": "auth.openid == doc.openid"
}
```

### tickets 集合
```json
{
  "read": true,
  "write": "auth.openid != null"
}
```

## 功能测试

### 1. 测试数据库连接
- 启动小程序
- 查看控制台是否有错误信息
- 检查是否成功获取到openid

### 2. 测试工作台数据
- 进入工作台页面
- 检查统计数据是否正确显示
- 检查工单列表是否正确加载

### 3. 测试工单列表
- 进入工单列表页面
- 测试筛选功能
- 测试搜索功能
- 测试接受/处理工单功能

## 常见问题

### Q1: 数据库初始化失败
**解决方案：**
1. 检查云函数是否已上传
2. 检查环境ID是否正确
3. 手动在云开发控制台创建集合

### Q2: 获取不到用户信息
**解决方案：**
1. 确保 login 云函数已上传
2. 检查网络连接
3. 清除缓存重新登录

### Q3: 工单数据加载失败
**解决方案：**
1. 检查数据库权限设置
2. 确认集合名称正确
3. 查看控制台错误信息

## 数据维护

### 清除测试数据
```javascript
// 在云函数中执行
const db = cloud.database();
await db.collection('tickets').where({
  ticketNo: db.RegExp({
    regexp: '^TK',
    options: 'i'
  })
}).remove();
```

### 备份数据
使用云开发控制台的"数据库备份"功能定期备份重要数据。

## 监控和日志

1. **查看云函数日志**
   - 云开发控制台 > 云函数 > 日志

2. **查看数据库操作日志**
   - 云开发控制台 > 数据库 > 操作日志

3. **性能监控**
   - 云开发控制台 > 监控告警