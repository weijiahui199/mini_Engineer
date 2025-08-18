# 调试问题与解决方案记录

## 项目信息
- **项目名称**：微信小程序 IT Engineer Workstation
- **技术栈**：微信云开发 + TDesign UI
- **记录开始时间**：2025-08-12

---

## 问题记录模板
```markdown
### 问题 #编号：问题简述
- **发生时间**：YYYY-MM-DD HH:MM
- **问题描述**：详细描述问题现象
- **错误信息**：如有错误日志，贴在这里
- **问题原因**：分析问题的根本原因
- **解决方案**：具体的解决步骤
- **相关文件**：涉及的文件路径
- **验证结果**：解决后的测试结果
- **经验总结**：可以总结的经验教训
```

---

## 已解决的问题

### 问题 #1：完成设置按钮图标不显示
- **发生时间**：2025-08-12
- **问题描述**：用户信息设置页面"完成设置"按钮前的check图标没有正常显示
- **错误信息**：无错误信息，图标简单不显示
- **问题原因**：TDesign的check图标可能不存在或名称不正确
- **解决方案**：移除图标，只保留文字，保持界面简洁
- **相关文件**：`/miniprogram/pages/login/user-setup.wxml`
- **验证结果**：按钮正常显示，功能正常
- **经验总结**：使用第三方UI库的图标时，需要确认图标名称是否正确，不确定时可以先不使用图标

### 问题 #2：TDesign图标使用和头像显示问题
- **发生时间**：2025-08-12
- **问题描述**：
  1. 完成设置按钮的check图标不显示
  2. 头像右下角的相机图标失效
  3. 头像边缘被切割，显示不完整
- **错误信息**：无错误信息，样式问题
- **问题原因**：
  1. t-icon组件已在app.json中全局注册，check图标名称正确
  2. 相机图标color属性设置不当
  3. avatar-wrapper使用了overflow:hidden导致边缘被裁剪
- **解决方案**：
  1. 修复按钮图标：添加btn-content容器，正确显示check图标
  2. 修复相机图标：移除color属性，让其使用CSS中定义的颜色
  3. 修复头像边缘：移除overflow:hidden，改用padding实现边框效果
- **相关文件**：
  - `/miniprogram/pages/login/user-setup.wxml`
  - `/miniprogram/pages/login/user-setup.wxss`
- **验证结果**：
  - 完成按钮显示check图标
  - 相机图标正常显示
  - 头像完整显示，边缘有白色边框
- **经验总结**：
  1. TDesign图标组件需要在app.json中全局注册
  2. 图标颜色优先使用CSS定义，避免在标签中直接设置color
  3. 圆形头像使用padding+背景色实现边框，避免overflow:hidden裁剪内容

---

### 问题 #3：TDesign图标无法显示的根本原因及解决方案
- **发生时间**：2025-08-12
- **问题描述**：TDesign的t-icon组件在小程序中无法正常显示图标
- **错误信息**：无错误，但图标不显示
- **问题原因**：
  1. TDesign图标使用Web字体（iconfont）实现
  2. 字体文件从CDN加载：`https://tdesign.gtimg.com/icon/0.3.2/fonts/`
  3. 小程序开发工具可能无法加载外部字体文件
  4. 网络环境或安全策略可能阻止字体加载
- **解决方案**：使用Emoji图标作为备用方案
  1. 相机图标：使用📷 emoji
  2. 勾选图标：使用✓字符
  3. 用户图标：使用👤 emoji
  4. 通过CSS filter实现颜色调整
- **相关文件**：
  - `/miniprogram/pages/login/user-setup.wxml`
  - `/miniprogram/pages/login/user-setup.wxss`
  - 创建了备用组件：`/miniprogram/components/icon-text/`
- **验证结果**：图标正常显示，功能正常
- **经验总结**：
  1. 小程序中使用字体图标需要注意CDN加载问题
  2. 可以使用Emoji作为图标的备用方案
  3. 通过CSS filter可以调整Emoji的显示效果
  4. 建议在生产环境中下载字体文件到本地或使用图片图标

### 问题 #4：本地图标尺寸调整
- **发生时间**：2025-08-12
- **问题描述**：本地PNG图标显示尺寸过小
- **问题原因**：初始设置的图标尺寸太小（24-32rpx）
- **解决方案**：
  1. 相机图标：32rpx（头像编辑按钮）
  2. 用户图标：44rpx（输入框图标）
  3. 勾选图标：44rpx（按钮图标）
  4. 登录页用户图标：48rpx
  5. 头像编辑overlay容器：56rpx
- **相关文件**：
  - `/miniprogram/pages/login/user-setup.wxss`
  - `/miniprogram/pages/login/index.wxss`
- **验证结果**：图标尺寸适中，视觉效果良好
- **经验总结**：
  1. 小程序中图标建议尺寸：32-48rpx
  2. 按钮中的图标可以稍大：44-48rpx
  3. 输入框图标：40-44rpx

### 问题 #5：统一头像上传方式
- **发生时间**：2025-08-12
- **问题描述**：将dashboard和个人中心的头像更新方式改为与登录界面一致
- **解决方案**：
  1. 使用微信新API `open-type="chooseAvatar"`
  2. 统一使用本地PNG图标替代TDesign图标
  3. 添加相机图标overlay效果
  4. 统一样式：蓝色渐变背景 + 白色边框
- **相关文件**：
  - `/miniprogram/pages/dashboard/index.wxml` - 更新头像选择按钮
  - `/miniprogram/pages/dashboard/index.wxss` - 添加头像样式
  - `/miniprogram/pages/dashboard/index.js` - 添加onChooseAvatar方法
  - `/miniprogram/pages/profile/index.wxml` - 更新图标为本地PNG
  - `/miniprogram/pages/profile/index.wxss` - 添加图标样式
- **验证结果**：三个页面头像上传方式已统一
- **经验总结**：
  1. 微信小程序推荐使用新的头像选择API
  2. 统一的UI组件可以提升用户体验
  3. 本地图标资源比CDN字体图标更可靠

### 问题 #6：UI优化调整
- **发生时间**：2025-08-12
- **问题描述**：
  1. Dashboard头像缺少背景，空白时不美观
  2. 个人中心的在线状态绿点不需要
- **解决方案**：
  1. Dashboard头像添加圆形灰色背景（#f0f0f0）
  2. 删除个人中心的在线状态指示器（绿点）
  3. 统一两个页面的头像背景色
- **相关文件**：
  - `/miniprogram/pages/dashboard/index.wxss` - 添加灰色背景
  - `/miniprogram/pages/profile/index.wxml` - 删除在线状态HTML
  - `/miniprogram/pages/profile/index.wxss` - 删除相关CSS，添加灰色背景
- **验证结果**：头像显示更美观，界面更简洁
- **经验总结**：
  1. 头像容器应该有默认背景色，避免空白
  2. 不需要的功能应及时移除，保持界面简洁

### 问题 #7：用户信息和头像无法保存到数据库
- **发生时间**：2025-08-12 23:30
- **问题描述**：
  1. 用户设置头像和昵称后，数据无法保存到数据库
  2. 头像上传到云存储成功，但数据库中avatar字段为空
  3. 昵称设置后仍显示默认的"用户XXXX"
  4. 切换页面后看不到更新的信息
- **错误信息**：
  ```
  [UserSetup] 数据库更新结果: {stats: {updated: 0}, errMsg: "collection.update:ok"}
  ```
- **问题原因**：
  1. **权限规则不匹配**：数据库权限使用 `doc._openid == auth.openid`，但数据中只有 `openid` 字段
  2. **头像上传判断错误**：只判断了 `startsWith('http')`，但微信选择的头像是 `wxfile://` 开头
  3. **数据库更新方式错误**：使用 `where().update()` 可能找不到记录
- **解决方案**：
  1. **修复权限问题**：
     - 在所有创建用户的地方添加 `_openid` 字段
     - 或修改数据库权限规则为 `doc.openid == auth.openid`
  2. **修复头像上传**：
     - 支持 `wxfile://` 开头的临时文件
  3. **改用云函数更新**：
     - 使用 `userProfile` 云函数处理数据更新
     - 云函数中支持 `avatar` 字段
     - 先查询再更新，不存在则创建
  4. **优化缓存机制**：
     - 保存后清除 UserCache 缓存
     - 页面 onShow 时强制刷新数据
- **相关文件**：
  - `/miniprogram/pages/login/user-setup.js` - 修复头像上传判断，使用云函数更新
  - `/cloudfunctions/userProfile/index.js` - 添加avatar字段支持，处理用户不存在的情况
  - `/cloudfunctions/login/index.js` - 添加_openid字段
  - `/miniprogram/pages/dashboard/index.js` - onShow时刷新用户信息
  - `/miniprogram/pages/profile/index.js` - onShow时强制刷新
- **验证结果**：
  - 头像能正确上传到云存储
  - 数据库正确保存头像和昵称
  - 切换页面时能看到最新的头像和昵称
  - 下拉刷新正常工作
- **经验总结**：
  1. **数据库权限是关键**：必须确保权限字段与实际数据字段匹配
  2. **使用云函数更可靠**：云函数有更高的数据库操作权限
  3. **缓存需要主动管理**：更新后要清除缓存，确保获取最新数据
  4. **字段命名要一致**：`_openid` vs `openid`，`nickName` vs `nickname` 容易出错
  5. **测试要全面**：不仅要测试新用户，还要测试已存在用户的更新

### 问题 #8：Dashboard和个人中心页面头像边缘被切掉
- **发生时间**：2025-08-12 23:45
- **问题描述**：
  1. Dashboard页面的头像边缘被切掉
  2. 个人中心页面的头像边缘显示不完整
  3. 头像的边框可能占用了额外空间导致图片被裁剪
- **问题原因**：
  1. Dashboard页面的`.avatar-wrapper`使用了`overflow: hidden`
  2. 个人中心页面使用`border`占用了盒模型空间
  3. 头像容器和图片尺寸不匹配
- **解决方案**：
  1. **Dashboard页面**：
     - 移除`overflow: hidden`避免裁剪
     - 使用`padding`代替`border`实现边框效果
     - 调整图片尺寸计算，减去padding的宽度
     - 添加`object-fit: cover`确保图片正确填充
  2. **个人中心页面**：
     - 增加容器尺寸以容纳边框
     - 使用`box-shadow`代替`border`，避免占用盒模型空间
     - 添加`object-fit: cover`保持图片比例
     - 调整图片定位，留出边框空间
- **相关文件**：
  - `/miniprogram/pages/dashboard/index.wxss` - 修改头像容器和图片样式
  - `/miniprogram/pages/profile/index.wxss` - 调整头像尺寸和边框实现方式
- **验证结果**：
  - 头像完整显示，边缘不再被切掉
  - 边框效果保持美观
  - 图片比例正确，不变形
- **经验总结**：
  1. **避免使用overflow:hidden**：圆形头像使用`border-radius`就足够，不需要`overflow:hidden`
  2. **边框实现方式**：使用`box-shadow`或`padding`实现边框，避免占用额外空间
  3. **尺寸计算**：容器尺寸要考虑边框、padding的影响
  4. **object-fit属性**：使用`object-fit: cover`确保图片正确填充并保持比例

### 问题 #9：工单接单按钮无法点击问题
- **发生时间**：2025-08-16
- **问题描述**：
  1. 点击"开始处理"按钮没有任何反应
  2. 按钮显示条件判断失败，显示按钮=false
  3. 接单后状态更新成功但数据库未实际更新
- **错误信息**：
  ```
  [acceptTicketSafely] 工单更新成功 但是数据库中还是pending
  TypeError: e.stopPropagation is not a function
  ```
- **问题原因**：
  1. **数据库权限问题**：小程序端直接更新数据库受权限限制
  2. **状态字段比较问题**：status字段可能包含隐藏字符或转义字符
  3. **按钮显示条件问题**：工单已被分配（assigneeOpenid有值）导致条件不满足
  4. **事件处理问题**：catchtap事件对象的stopPropagation方法不一定存在
- **解决方案**：
  1. **改用云函数事务处理接单**：
     - 不再尝试直接从小程序端更新数据库
     - 使用submitTicket云函数的acceptTicket方法
     - 利用数据库事务确保原子性操作
  2. **修复状态字段处理**：
     - 使用String().trim()清理状态字段
     - 确保状态比较的准确性
  3. **添加详细调试日志**：
     - onLoad时记录app实例和数据库实例
     - getUserRole时记录用户信息和角色
     - loadTicketList时记录原始数据和格式化数据
     - acceptTicketSafely开始时立即显示Toast确认触发
  4. **添加测试工具**：
     - 页面顶部红色测试按钮，可模拟接单
     - 工单卡片显示调试信息（角色、状态、assignee）
     - 绿色/橙色临时按钮用于不同状态测试
- **相关文件**：
  - `/miniprogram/pages/ticket-list/index.js` - 修改acceptTicketSafely使用云函数
  - `/miniprogram/pages/ticket-list/index.wxml` - 添加调试信息和测试按钮
  - `/cloudfunctions/submitTicket/index.js` - acceptTicket方法使用事务
- **验证结果**：
  - 点击"开始处理"按钮成功触发接单
  - 数据库正确更新：status变为processing，assigneeOpenid被设置
  - 接单后按钮变为"查看详情"或"继续处理"
  - 并发接单得到正确处理（只有一个工程师能成功）
- **经验总结**：
  1. **数据库操作优先使用云函数**：云函数有完整权限，小程序端可能受限
  2. **使用事务保证数据一致性**：防止并发问题和部分更新
  3. **调试时添加可视化信息**：临时显示关键数据，方便定位问题
  4. **字符串比较要小心**：使用trim()清理，注意隐藏字符
  5. **按钮显示逻辑要完整**：考虑所有状态（未分配、我的工单、他人工单）

## 待解决的问题

（待添加）

---

## 常用调试技巧

### 1. 云函数调试
```javascript
// 在云函数中添加详细日志
console.log('=== 函数开始执行 ===');
console.log('接收参数:', JSON.stringify(event, null, 2));
console.log('上下文:', JSON.stringify(wxContext, null, 2));
```

### 2. 小程序端调试
```javascript
// 在关键位置添加日志
console.log('[页面名称] 操作说明:', {
  data: this.data,
  params: params,
  timestamp: new Date().toISOString()
});
```

### 3. 数据库操作调试
```javascript
// 查询前后打印
console.log('查询条件:', whereCondition);
const result = await db.collection('users').where(whereCondition).get();
console.log('查询结果:', result);
```

### 4. 缓存调试
```javascript
// 检查缓存状态
const storageInfo = wx.getStorageInfoSync();
console.log('缓存信息:', {
  size: storageInfo.currentSize + 'KB',
  keys: storageInfo.keys,
  userInfo: wx.getStorageSync('userInfo')
});
```

---

## 重要代码片段备份

### 用户登录核心代码
```javascript
// 位置：/cloudfunctions/login/index.js
// 功能：处理用户登录，生成token
```

### 头像上传核心代码
```javascript
// 位置：/cloudfunctions/avatarUpload/index.js
// 功能：处理头像上传到云存储
```

---

## 注意事项

1. **调试日志规范**
   - 使用统一的日志格式：`[模块名] 操作: 详情`
   - 在生产环境记得移除敏感信息日志

2. **代码重用原则**
   - 优先使用 utils 目录下的工具函数
   - 避免重复造轮子，检查现有实现

3. **问题定位流程**
   - 先查看浏览器/开发者工具控制台
   - 检查网络请求和响应
   - 查看云函数日志
   - 检查数据库数据状态

---

### 问题 #10：工单详情页面按钮风格不统一
- **发生时间**：2025-08-16
- **问题描述**：
  1. 待处理状态的"退回"和"继续处理"按钮使用TDesign组件
  2. 其他状态的按钮使用自定义磨砂玻璃风格
  3. 按钮布局和样式不一致，影响视觉体验
- **问题原因**：
  1. 历史代码遗留，部分使用t-button组件
  2. 后期添加的按钮使用了自定义样式
  3. 没有统一的设计规范
- **解决方案**：
  1. **统一按钮组件**：
     - 将所有t-button替换为自定义button元素
     - 使用统一的`custom-action-btn`基础类
  2. **按钮颜色方案**：
     - 开始处理：蓝色（主色调）- 全宽显示
     - 退回：橙色 - 警示操作
     - 继续处理：绿色 - 积极操作
     - 暂停：灰色 - 中性操作
     - 完成工单：浅红色 - 重要操作
     - 重新处理：蓝色 - 恢复操作
     - 关闭工单：灰色 - 终止操作
  3. **磨砂玻璃效果**：
     ```css
     background: rgba(color, 0.15);
     backdrop-filter: blur(10px);
     border: 2rpx solid rgba(color, 0.3);
     box-shadow: 0 4rpx 12rpx rgba(color, 0.2);
     ```
  4. **布局优化**：
     - 使用flex布局，gap: 24rpx
     - 按钮自动平分宽度（flex: 1）
     - 垂直居中对齐
- **相关文件**：
  - `/miniprogram/pages/ticket-detail/index.wxml` - 替换按钮组件
  - `/miniprogram/pages/ticket-detail/index.wxss` - 添加新按钮样式
- **验证结果**：
  - 所有状态下按钮风格统一
  - 磨砂玻璃效果一致
  - 布局整齐美观
- **经验总结**：
  1. **设计系统的重要性**：建立统一的组件库和样式规范
  2. **渐进式重构**：发现不一致时及时统一
  3. **视觉一致性**：相同功能级别的按钮应该有相似的视觉权重
  4. **色彩语义**：使用颜色传达操作的性质（危险、安全、中性等）

### 问题 #11：工单时间线显示错误 - 暂停后继续处理报错
- **发生时间**：2025-08-16
- **问题描述**：
  1. 工程师暂停工单后，点击继续处理时报错
  2. 错误信息：`Cannot set property 'isActive' of undefined`
  3. 时间线节点的数组索引访问失败
- **错误信息**：
  ```javascript
  TypeError: Cannot set property 'isActive' of undefined
  at updateTimeline (index.js:638)
  // timeline[2].isActive = true; // 这里timeline[2]不存在
  ```
- **问题原因**：
  1. **硬编码索引问题**：`updateTimeline`方法使用硬编码的数组索引（`timeline[2]`、`timeline[3]`）
  2. **动态节点生成**：`buildTimeline`根据工单状态动态生成节点，暂停状态可能不生成某些节点
  3. **状态转换逻辑缺失**：没有处理从暂停（pending但有assignee）到处理中的转换
- **解决方案**：
  1. **改用ID查找节点**：
     ```javascript
     // 不再使用 timeline[2]
     // 改为循环查找
     for (let item of timeline) {
       if (item.id === 'processing') {
         item.isActive = true;
         break;
       }
     }
     ```
  2. **确保节点存在**：
     - 有负责人就显示"处理中"节点
     - 暂停状态显示为"已暂停"描述
  3. **添加容错处理**：
     - try-catch包装时间线更新
     - 失败不影响主流程
- **相关文件**：
  - `/miniprogram/pages/ticket-detail/index.js` - updateTimeline和buildTimeline方法
- **验证结果**：
  - 暂停后继续处理正常工作
  - 时间线正确更新状态
  - 无报错信息
- **经验总结**：
  1. **避免硬编码索引**：使用ID或其他标识符查找数组元素
  2. **防御性编程**：检查对象存在性再访问属性
  3. **动态数据结构**：处理可变长度数组时要特别小心

### 问题 #12：MongoDB日期格式处理问题
- **发生时间**：2025-08-16
- **问题描述**：
  1. 数据库返回的日期格式为：`{$date: "2025-08-16T03:20:40.122Z"}`
  2. formatDateTime函数无法正确识别此格式
  3. 时间显示为"时间格式错误"或空白
- **问题原因**：
  1. **特殊日期格式**：MongoDB/云数据库使用特殊的JSON格式表示日期
  2. **类型判断失败**：不是字符串也不是Date对象
  3. **直接转换失败**：`new Date(date)`无法处理对象格式
- **解决方案**：
  ```javascript
  formatDateTime(date) {
    let d;
    if (date.$date) {
      // MongoDB日期格式
      d = new Date(date.$date);
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (date instanceof Date) {
      d = date;
    } else {
      d = new Date(date);
    }
    // 检查日期有效性
    if (isNaN(d.getTime())) {
      return '时间格式错误';
    }
    // 格式化输出
  }
  ```
- **相关文件**：
  - `/miniprogram/pages/ticket-detail/index.js` - formatDateTime方法
- **验证结果**：
  - 正确显示所有时间字段
  - 支持多种日期格式
- **经验总结**：
  1. **了解数据源格式**：不同数据库有不同的日期表示方式
  2. **多格式兼容**：日期处理函数要支持多种输入格式
  3. **有效性检查**：始终检查Date对象的有效性

### 问题 #13：工单处理时间重复设置问题
- **发生时间**：2025-08-16
- **问题描述**：
  1. 暂停后继续处理，processTime被重新设置
  2. 导致原始的处理开始时间丢失
  3. 时间线显示不准确
- **问题原因**：
  1. **云函数逻辑问题**：`updateTicketStatus`每次转换到processing都设置processTime
  2. **缺少状态检查**：没有判断是否已经有processTime
  3. **接单函数遗漏**：`acceptTicket`没有设置processTime
- **解决方案**：
  1. **条件设置processTime**：
     ```javascript
     if (status === 'processing') {
       // 只有第一次进入处理状态时才设置
       if (!ticket.processTime) {
         updateData.processTime = db.serverDate()
       }
     }
     ```
  2. **接单时设置**：
     ```javascript
     // acceptTicket函数中
     data: {
       status: 'processing',
       acceptTime: db.serverDate(),
       processTime: db.serverDate(), // 添加这行
     }
     ```
- **相关文件**：
  - `/cloudfunctions/submitTicket/index.js` - updateTicketStatus和acceptTicket函数
- **验证结果**：
  - 处理时间只在第一次设置
  - 暂停后继续不会覆盖
  - 时间线显示准确
- **经验总结**：
  1. **状态转换要完整**：考虑所有可能的状态转换路径
  2. **时间字段管理**：一次性时间字段要防止重复设置
  3. **数据一致性**：相关函数要保持逻辑一致

### 问题 #14：退回工单时预填内容问题
- **发生时间**：2025-08-16
- **问题描述**：
  1. 退回工单时输入框预填"工程师退回"
  2. 用户需要先删除再输入自己的原因
  3. 影响用户体验
- **问题原因**：
  1. **默认值设置**：代码中设置了默认退回原因
  2. **强制预填**：`res.content || '工程师退回'`
- **解决方案**：
  1. **移除默认值**：
     ```javascript
     // 原来：const rejectReason = res.content || '工程师退回';
     // 改为：const rejectReason = res.content || '';
     ```
  2. **云函数处理**：
     ```javascript
     // 只有提供了原因才添加字段
     if (reason && reason.trim()) {
       updateData.rejectReason = reason.trim()
     }
     ```
- **相关文件**：
  - `/miniprogram/pages/ticket-detail/index.js` - rejectTicket方法
  - `/cloudfunctions/submitTicket/index.js` - rejectTicket函数
- **验证结果**：
  - 输入框保持空白
  - 用户可选择性填写
  - 不填写时不保存默认文本
- **经验总结**：
  1. **用户体验优先**：避免不必要的预填内容
  2. **可选字段处理**：真正可选的字段不应有默认值
  3. **数据清洁**：避免存储无意义的默认文本

## 调试技巧总结

### 时间处理调试
1. **添加详细日志**：
   ```javascript
   console.log('[模块名] 时间字段:', {
     原始值: date,
     类型: typeof date,
     格式化结果: formattedDate
   });
   ```

2. **MongoDB日期格式兼容**：
   - 检查 `date.$date` 属性
   - 支持字符串、Date对象、MongoDB格式

3. **时间字段管理原则**：
   - 创建时间：只在创建时设置
   - 更新时间：每次操作都更新
   - 状态时间：首次进入状态时设置

### 数组操作调试
1. **避免硬编码索引**：
   - 使用 `find()` 或 `findIndex()`
   - 循环查找特定ID的元素
   - 添加存在性检查

2. **动态数组处理**：
   ```javascript
   // 安全的数组访问
   const item = array.find(x => x.id === targetId);
   if (item) {
     item.property = value;
   }
   ```

### 云函数调试
1. **日志位置**：
   - 函数入口记录参数
   - 关键操作前后记录状态
   - 错误捕获记录详情

2. **权限问题排查**：
   - 检查操作者身份
   - 验证数据所有权
   - 记录权限判断结果

### 问题 #15：工单状态在用户取消操作后仍然改变【待调查】
- **发生时间**：2025-08-16
- **问题描述**：
  1. 用户点击退回按钮，显示确认对话框
  2. 用户点击取消，但工单状态已经变成了待接单
  3. 似乎在显示对话框之前或用户确认之前状态就改变了
- **代码检查结果**：
  - 所有二次确认操作代码逻辑正确（都在 `if (res.confirm)` 内执行）
  - `startProcessing()` ✓
  - `pauseProcessing()` ✓  
  - `completeTicket()` ✓
  - `reopenTicket()` ✓
  - `closeTicket()` ✓
  - `acceptTicket()` ✓
  - `rejectTicket()` ✓
- **可能原因**：
  1. **异步操作未完成**：之前的操作还在执行中
  2. **页面重载触发**：`loadTicketDetail` 可能触发了某些自动操作
  3. **缓存问题**：显示的是缓存的旧状态
  4. **双击/多次点击**：用户可能快速点击了多次
- **调试建议**：
  ```javascript
  // 在rejectTicket开头添加防重复点击
  if (this.data.isRejecting) {
    console.log('正在处理中，请勿重复点击');
    return;
  }
  this.setData({ isRejecting: true });
  
  // 在操作完成或取消后重置
  this.setData({ isRejecting: false });
  ```
- **相关文件**：
  - `/miniprogram/pages/ticket-detail/index.js` - 所有状态操作方法
- **状态**：待进一步调查和复现

### 问题 #16：实现工单暂停状态的UI标识和功能
- **发生时间**：2025-08-16
- **问题描述**：
  1. 工单在暂停状态没有明确的UI提示
  2. 暂停状态在数据库中表示为 `status='pending'` 但有 `assigneeOpenid`
  3. 容易与真正的待处理工单混淆
  4. 缺少继续处理的便捷操作
- **问题原因**：
  1. **状态设计缺陷**：使用同一个 `pending` 状态表示两种不同的情况
  2. **UI未区分**：前端没有识别并显示暂停状态的逻辑
  3. **云函数不完整**：暂停时清空了负责人信息，导致无法区分
- **解决方案**：
  
  **1. 前端识别暂停状态（所有页面）**：
  ```javascript
  // 判断是否是暂停状态
  let displayStatus = ticket.status || 'pending';
  if (ticket.status === 'pending' && ticket.assigneeOpenid) {
    displayStatus = 'paused';  // UI显示为暂停
  }
  ```
  
  **2. 添加状态文本映射**：
  ```javascript
  statusText: {
    pending: '待处理',
    processing: '处理中',
    resolved: '已解决',
    cancelled: '已取消',
    paused: '已暂停'  // 新增
  }
  ```
  
  **3. 云函数保留负责人信息**：
  ```javascript
  // 暂停时不清空assignee
  if (status === 'pending' && currentStatus === 'processing') {
    updateData.pauseTime = db.serverDate()
    // 注意：不要添加 assigneeOpenid: db.command.remove()
  }
  ```
  
  **4. 新增专门的云函数方法**：
  ```javascript
  case 'pauseTicket':
    return await pauseTicket(event, wxContext)
  case 'continueTicket':
    return await continueTicket(event, wxContext)
  ```
  
- **相关文件**：
  - `/miniprogram/pages/ticket-list/index.js` - 识别暂停状态，添加继续处理按钮
  - `/miniprogram/pages/ticket-list/index.wxml` - 显示暂停标签和按钮
  - `/miniprogram/pages/ticket-detail/index.js` - 暂停状态处理逻辑
  - `/miniprogram/pages/dashboard/index.js` - 统计暂停工单
  - `/cloudfunctions/submitTicket/index.js` - 新增暂停/继续函数
- **验证结果**：
  - 暂停工单显示"已暂停"标签
  - 继续处理按钮正常工作
  - Dashboard单独统计暂停工单数量
  - 暂停后保留负责人信息
- **经验总结**：
  1. **状态设计要明确**：不同的业务状态应该有明确的区分方式
  2. **前后端要同步**：修改状态逻辑时，前端和云函数都要更新
  3. **保持数据完整性**：暂停不是退回，应保留负责人信息
  4. **UI反馈要清晰**：用户需要一眼看出工单的真实状态

### 问题 #17：实现暂停状态时容易遗漏的关键点
- **发生时间**：2025-08-16
- **问题描述**：在实现工单暂停/继续功能时，有多个容易遗漏的更新点
- **容易遗漏的点**：

  **1. 状态映射的完整性**：
  - ❌ 只更新了部分页面的 `statusText`
  - ✅ 需要更新：工单列表、工单详情、Dashboard 三个页面
  
  **2. 状态主题（颜色）映射**：
  ```javascript
  // 容易忘记添加 paused 的主题色
  getStatusTheme(status) {
    const themes = {
      pending: 'warning',
      processing: 'primary',
      resolved: 'success',
      cancelled: 'default',
      paused: 'warning'  // 容易遗漏！
    };
  }
  ```
  
  **3. 统计数据的更新**：
  - Dashboard 的 `loadTicketStats` 需要单独统计暂停工单
  - 初始 `todayStats` 数组需要添加暂停项
  - 工程师和经理的统计逻辑不同
  
  **4. 权限检查的特殊处理**：
  ```javascript
  // updateTicketStatus 中需要区分三种情况
  if (currentStatus === 'pending' && status === 'processing') {
    if (!ticket.assigneeOpenid) {
      // 接单
    } else if (ticket.assigneeOpenid === wxContext.OPENID) {
      // 继续处理（容易遗漏）
    } else {
      // 不能接别人的工单
    }
  }
  ```
  
  **5. 时间字段的管理**：
  - `processTime`：只在第一次处理时设置
  - `pauseTime`：暂停时设置
  - `continueTime`：继续时设置（新增字段）
  - `acceptTime`：接单时设置
  
  **6. 按钮样式的添加**：
  ```css
  /* 容易忘记添加继续处理按钮的样式 */
  .btn-continue {
    background: rgba(34, 197, 94, 0.15);
    backdrop-filter: blur(10px);
    color: #16a34a;
    /* ... */
  }
  ```
  
  **7. 工单列表的筛选条件**：
  ```javascript
  // 工程师看工单池时，要排除暂停的工单
  db.collection('tickets').where(_.and([
    { status: 'pending' },
    _.or([
      { assigneeOpenid: _.exists(false) },
      { assigneeOpenid: '' },
      { assigneeOpenid: null }
    ])
  ]))
  ```
  
  **8. 模拟数据的更新**：
  - `getMockDashboardData` 中的统计数据
  - `getMockTicketData` 中的示例工单
  
  **9. 状态转换的完整性**：
  ```javascript
  // allowedTransitions 要允许暂停和继续
  const allowedTransitions = {
    'pending': ['processing', 'cancelled', 'resolved'],
    'processing': ['pending', 'resolved', 'cancelled'], // pending是暂停
  }
  ```
  
  **10. 事件处理的防冒泡**：
  ```javascript
  // 列表页按钮需要阻止事件冒泡
  catchtap="continueProcessing"  // 不是 bindtap
  ```

- **检查清单**：
  - [ ] 所有页面的 `statusText` 都包含 `paused`
  - [ ] 所有页面的 `getStatusTheme` 都处理 `paused`
  - [ ] Dashboard 统计包含暂停工单
  - [ ] 云函数权限检查区分暂停恢复
  - [ ] 云函数保留负责人信息
  - [ ] 时间字段正确设置
  - [ ] 按钮样式已添加
  - [ ] 工单筛选逻辑正确
  - [ ] 状态转换允许暂停/继续
  - [ ] 事件处理使用 `catchtap`

- **调试技巧**：
  ```javascript
  // 在关键位置添加日志
  console.log('[暂停状态检查]', {
    status: ticket.status,
    assigneeOpenid: ticket.assigneeOpenid,
    isPaused: ticket.status === 'pending' && !!ticket.assigneeOpenid,
    displayStatus: displayStatus
  });
  ```

### 问题 #18：工单列表下拉刷新不生效
- **发生时间**：2025-08-18
- **问题描述**：用户反馈工单列表页面下拉刷新后，工单列表不会更新
- **错误信息**：无错误信息，但刷新后数据没有变化
- **问题原因**：
  1. **分页参数错误**：`refreshList` 方法中将 `page` 设置为 0，而 `loadTicketList` 中计算 skip 时使用 `(page - 1) * pageSize`，导致 skip 为负数
  2. **缺少智能刷新管理**：页面没有集成 RefreshManager，每次都直接刷新，没有利用缓存
  3. **事件通知缺失**：工单状态变化时没有触发全局事件，其他页面无法感知变化
- **解决方案**：
  1. **修复分页参数**：将 `refreshList` 中的 `page: 0` 改为 `page: 1`
  2. **集成 RefreshManager**：
     - 在页面引入 RefreshManager 和 CacheManager
     - 实现 `smartRefreshList` 方法进行智能刷新决策
     - 在 onShow 时检查是否需要刷新
     - 记录刷新时间和缓存数据
  3. **添加工单事件**：
     - 在 event-bus.js 中添加工单相关事件常量
     - 在 app.js 中监听工单事件并通知 RefreshManager
     - 在工单操作时触发相应事件
  4. **优化刷新配置**：
     - 为 ticketList 配置合理的刷新间隔和缓存时间
     - 关联工单事件到强制刷新
- **相关文件**：
  - `/miniprogram/pages/ticket-list/index.js` - 修复 page 参数，集成智能刷新
  - `/miniprogram/utils/refresh-manager.js` - 添加工单相关配置
  - `/miniprogram/utils/event-bus.js` - 添加工单事件常量
  - `/miniprogram/app.js` - 监听工单事件
- **验证结果**：
  - 下拉刷新正常工作，数据能正确更新
  - 智能刷新避免了频繁的数据请求
  - 工单操作后其他页面能自动感知并刷新
- **经验总结**：
  1. **分页参数要一致**：page 从 0 还是从 1 开始要全局统一
  2. **智能刷新提升性能**：避免不必要的数据请求，提升用户体验
  3. **事件驱动更新**：使用事件总线让多个页面保持数据同步
  4. **缓存策略要合理**：根据数据特性设置不同的缓存时间

### 问题 #19：用户角色更新后工单列表不刷新
- **发生时间**：2025-08-18
- **问题描述**：
  1. 用户在数据库中手动更新角色（如从工程师改为经理）
  2. 工单列表页面仍然使用旧的角色权限查询
  3. 导致下拉刷新后工单列表仍然显示不正确
- **问题原因**：
  1. **角色缓存问题**：`getUserRole()` 只在 `onLoad` 时调用一次，后续不会更新
  2. **初始值错误**：`userRoleGroup` 初始默认值为"工程师"，而不是动态获取
  3. **权限查询差异**：
     - 工程师：只能看工单池（未分配）+ 自己负责的工单
     - 经理：可以看到所有工单
  4. **缓存优先级**：优先使用 `globalData.userInfo`，其次是本地缓存，最后才是默认值
- **解决方案**：
  1. **添加 `refreshUserRole` 方法**：
     - 强制从数据库获取最新用户信息
     - 比较角色是否变化
     - 更新全局数据和本地缓存
     - 角色变化时强制刷新工单列表
  2. **在 `onShow` 时刷新角色**：
     - 每次页面显示都检查用户角色
     - 确保使用最新的权限查询工单
  3. **下拉刷新时也更新角色**：
     - 在 `onPullDownRefresh` 中调用 `refreshUserRole`
     - 确保刷新时获取最新权限
  4. **初始角色设为空**：
     - 将 `userRoleGroup` 初始值设为空字符串
     - 等待实际获取后再设置
- **相关文件**：
  - `/miniprogram/pages/ticket-list/index.js` - 添加角色刷新逻辑
- **验证结果**：
  - 数据库更新角色后，页面能正确显示对应权限的工单
  - 下拉刷新时会重新获取用户角色
  - 角色变化时自动刷新工单列表
- **经验总结**：
  1. **权限要实时验证**：不能只在初始化时获取一次
  2. **缓存要有更新机制**：提供强制刷新的方法
  3. **角色变化要触发刷新**：权限改变时相关数据都要更新
  4. **调试日志很重要**：记录角色获取和变化过程

## 更新日志

- 2025-08-12：创建文档，整理调试模板和技巧
- 2025-08-16：添加工单按钮风格统一问题及解决方案
- 2025-08-16：添加时间线显示错误、日期格式处理、处理时间重复设置、退回预填内容等问题及解决方案
- 2025-08-16：记录工单状态意外变化问题（待调查）
- 2025-08-16：添加工单暂停状态实现方案和容易遗漏的关键点
- 2025-08-18：添加工单列表下拉刷新问题及智能刷新管理解决方案
- 2025-08-18：添加用户角色更新后工单列表不刷新问题及解决方案