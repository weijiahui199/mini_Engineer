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

## 更新日志

- 2025-08-12：创建文档，整理调试模板和技巧