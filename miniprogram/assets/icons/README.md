# 图标资源说明

## 📁 文件夹结构
```
/assets/icons/
├── README.md          # 本说明文档
├── common/           # 通用图标
├── user/            # 用户相关图标
├── system/          # 系统功能图标
└── business/        # 业务相关图标
```

## 🎨 需要的图标列表

### 高优先级（立即需要）
请提供以下图标的SVG或PNG文件（建议尺寸：48x48px，支持透明背景）：

#### 用户界面基础图标
1. **check.svg** - 勾选/完成图标 ✓
2. **camera.svg** - 相机/拍照图标 📷
3. **user.svg** - 用户/个人图标 👤
4. **edit.svg** - 编辑图标 ✏️
5. **close.svg** - 关闭图标 ✕

#### 导航相关
6. **chevron-right.svg** - 右箭头 >
7. **chevron-left.svg** - 左箭头 <
8. **chevron-up.svg** - 上箭头 ^
9. **chevron-down.svg** - 下箭头 v

#### 功能图标
10. **setting.svg** - 设置图标 ⚙️
11. **notification.svg** - 通知/消息图标 🔔
12. **help-circle.svg** - 帮助图标 ❓
13. **info-circle.svg** - 信息图标 ℹ️
14. **file.svg** - 文件图标 📄

#### 业务相关
15. **task.svg** - 任务/工单图标 📋
16. **box.svg** - 箱子/库存图标 📦

### 中优先级（后续可能需要）
17. **add.svg** - 添加 +
18. **minus.svg** - 减少 -
19. **search.svg** - 搜索 🔍
20. **home.svg** - 主页 🏠
21. **dashboard.svg** - 仪表盘 📊
22. **calendar.svg** - 日历 📅
23. **clock.svg** - 时钟 🕐
24. **location.svg** - 位置 📍
25. **phone.svg** - 电话 📞
26. **email.svg** - 邮件 ✉️

## 🎨 图标规范

### 颜色方案
- **默认颜色**：#666666（灰色）
- **激活颜色**：#0ea5e9（主题蓝）
- **成功颜色**：#10b981（绿色）
- **警告颜色**：#f59e0b（橙色）
- **错误颜色**：#ef4444（红色）

### 文件格式要求
1. **格式**：优先SVG，其次PNG
2. **尺寸**：
   - SVG：可缩放
   - PNG：48x48px（@1x）、96x96px（@2x）、144x144px（@3x）
3. **命名规范**：
   - 使用小写字母
   - 单词间用连字符连接
   - 例如：`user-avatar.svg`、`chevron-right.svg`

### SVG 优化建议
```xml
<!-- SVG模板示例 -->
<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="..." fill="currentColor"/>
</svg>
```
- 使用 `currentColor` 以支持动态颜色
- 移除不必要的属性和元数据
- 确保 viewBox 设置正确

## 📝 使用方法

### 在WXML中使用
```xml
<!-- 使用本地图标 -->
<image 
  class="icon" 
  src="/assets/icons/common/check.svg"
  mode="aspectFit"
/>

<!-- 或使用自定义组件 -->
<local-icon name="check" size="32rpx" color="#0ea5e9" />
```

### 在WXSS中设置样式
```css
.icon {
  width: 32rpx;
  height: 32rpx;
  /* SVG图标可以通过filter改变颜色 */
  filter: invert(50%) sepia(100%) saturate(500%) hue-rotate(180deg);
}
```

## 🔄 更新记录
- 2025-08-12：创建图标文件夹和说明文档
- 待添加：等待图标文件上传

---

**注意**：请将图标文件按照上述结构存放，以便统一管理和使用。