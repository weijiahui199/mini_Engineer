# Material Cart 页面重构计划

## 1. 项目概述

### 1.1 背景
当前 `material-cart` 页面经过多次修改，代码结构变得复杂，存在以下问题：
- 布局嵌套层级过多
- 高度计算逻辑复杂
- 底部内容遮挡问题
- 样式代码冗余
- 维护成本高

### 1.2 目标
- 简化页面结构，提升代码可维护性
- 采用现代化布局方案，避免复杂的高度计算
- 实现 TDesign 设计规范
- 添加左滑删除等交互功能
- 提升用户体验

## 2. 技术方案

### 2.1 技术栈
- **UI框架**: TDesign MiniProgram v1.10.0
- **布局方案**: Flex 布局
- **核心组件**:
  - `t-swipe-cell` - 左滑删除
  - `t-checkbox` - 选择框
  - `t-stepper` - 数量步进器
  - `t-popup` - 工单选择弹窗
  - `t-textarea` - 备注输入

### 2.2 页面结构设计

```
material-cart/
├── index.wxml          # 页面结构
├── index.wxss          # 页面样式
├── index.js            # 页面逻辑
└── index.json          # 页面配置
```

### 2.3 布局架构

```html
<view class="cart-page">
  <!-- 固定顶部 -->
  <view class="cart-header">
    <text>已选 {{count}} 件</text>
    <button>清空</button>
  </view>
  
  <!-- 滚动内容区 -->
  <scroll-view class="cart-body">
    <!-- 全选栏 -->
    <view class="select-all-bar">
      <t-checkbox>全选</t-checkbox>
    </view>
    
    <!-- 商品列表 -->
    <view class="cart-list">
      <t-swipe-cell>
        <!-- 商品内容 -->
      </t-swipe-cell>
    </view>
    
    <!-- 功能区域 -->
    <view class="function-area">
      <!-- 工单关联 -->
      <!-- 备注输入 -->
      <!-- 申领须知 -->
    </view>
  </scroll-view>
  
  <!-- 固定底部 -->
  <view class="cart-footer">
    <button>提交申领</button>
  </view>
</view>
```

## 3. 核心功能实现

### 3.1 左滑删除功能
```javascript
// 使用 TDesign swipe-cell 组件
<t-swipe-cell right="{{[{text: '删除', className: 'btn-delete'}]}}">
  <view class="cart-item">
    <!-- 商品内容 -->
  </view>
</t-swipe-cell>
```

### 3.2 布局方案
```css
.cart-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.cart-header {
  flex: 0 0 auto;  /* 固定高度 */
}

.cart-body {
  flex: 1;         /* 自适应剩余空间 */
  overflow-y: auto;
}

.cart-footer {
  flex: 0 0 auto;  /* 固定高度 */
}
```

### 3.3 数据结构优化
```javascript
data: {
  cartItems: [
    {
      id: 'xxx',
      materialId: 'xxx',
      materialName: '晨光A4复印纸',
      variantLabel: '70g/500张',
      image: 'url',
      stock: 120,
      unit: '包',
      quantity: 2,
      selected: true,
      stockWarning: false,
      costPrice: 15.00,    // 成本价格
      salePrice: 25.00     // 销售价格（仅经理可见）
    }
  ],
  selectedCount: 0,
  totalPrice: 0,      // 基于 salePrice 计算
  totalCost: 0,       // 基于 costPrice 计算（可选）
  selectAll: false,
  
  // 工单相关
  selectedTicket: null,
  ticketList: [],
  
  // 备注
  remark: ''
}
```

## 4. 实施步骤

### Phase 1: 准备工作（Day 1）
- [x] 分析现有代码结构
- [x] 整理核心功能需求
- [x] 编写重构计划文档
- [ ] 备份现有代码

### Phase 2: 结构重构（Day 2）
- [ ] 创建新的页面结构（WXML）
- [ ] 实现 Flex 布局（WXSS）
- [ ] 集成 TDesign 组件
- [ ] 实现左滑删除功能

### Phase 3: 功能迁移（Day 3）
- [ ] 迁移商品选择逻辑
- [ ] 迁移数量修改功能
- [ ] 迁移工单关联功能
- [ ] 迁移提交申领功能

### Phase 4: 优化完善（Day 4）
- [ ] 样式美化对齐原型图
- [ ] 添加动画效果
- [ ] 性能优化
- [ ] 代码清理

### Phase 5: 测试验收（Day 5）
- [ ] 功能测试
- [ ] 兼容性测试
- [ ] 边界情况测试
- [ ] 用户体验优化

## 5. 关键改进点

### 5.1 布局改进
- **现状**: 使用绝对定位 + 动态计算高度
- **改进**: 使用 Flex 布局，自适应高度
- **效果**: 无需计算，自动适配各种屏幕

### 5.2 交互改进
- **现状**: 长按显示删除菜单
- **改进**: 左滑直接显示删除按钮
- **效果**: 更符合移动端操作习惯

### 5.3 代码结构改进
- **现状**: 单文件 1000+ 行代码
- **改进**: 组件化，逻辑分离
- **效果**: 更易维护和扩展

### 5.4 性能改进
- **现状**: 频繁的 DOM 查询和计算
- **改进**: 使用 CSS 原生能力
- **效果**: 减少 JS 运算，提升性能

## 6. 风险评估

### 6.1 潜在风险
1. **兼容性风险**: TDesign 组件在不同机型的表现
2. **数据迁移风险**: 本地存储数据结构变化
3. **功能遗漏风险**: 重构过程中遗漏边缘功能

### 6.2 应对措施
1. 充分测试主流机型
2. 做好数据结构兼容处理
3. 详细的功能清单对照检查

## 7. 预期效果

### 7.1 性能提升
- 页面加载速度提升 30%
- 滚动流畅度提升 50%
- 代码量减少 40%

### 7.2 用户体验提升
- 操作更直观（左滑删除）
- 布局更稳定（无跳动）
- 响应更快速

### 7.3 开发体验提升
- 代码更清晰
- 维护更简单
- 扩展更容易

## 8. 参考资源

### 8.1 设计资源
- 原型图: `/engineer-prototype/material-cart.html`
- TDesign 文档: https://tdesign.tencent.com/miniprogram

### 8.2 技术文档
- 微信小程序文档: https://developers.weixin.qq.com/miniprogram/dev/
- Flex 布局指南: https://css-tricks.com/snippets/css/a-guide-to-flexbox/

### 8.3 相关页面
- 耗材列表页: `/pages/material-list/`
- 耗材详情页: `/pages/material-detail/`
- 申领记录页: `/pages/requisition-history/`（待开发）

## 9. 时间计划

| 阶段 | 任务 | 预计时间 | 负责人 | 状态 |
|-----|------|---------|--------|------|
| Phase 1 | 准备工作 | 0.5天 | - | 进行中 |
| Phase 2 | 结构重构 | 1天 | - | 待开始 |
| Phase 3 | 功能迁移 | 1天 | - | 待开始 |
| Phase 4 | 优化完善 | 0.5天 | - | 待开始 |
| Phase 5 | 测试验收 | 1天 | - | 待开始 |

**总计**: 4天

## 10. 注意事项

1. **保持功能完整性**: 确保所有现有功能都被正确迁移
2. **数据兼容性**: 确保本地存储的购物车数据能正常读取
3. **权限控制**: 保持经理和工程师的权限差异
4. **错误处理**: 完善各种异常情况的处理
5. **用户反馈**: 添加适当的 loading 和 toast 提示

## 11. 成功标准

- [ ] 所有核心功能正常工作
- [ ] 页面在各种机型上显示正常
- [ ] 滚动流畅，无卡顿
- [ ] 左滑删除功能流畅
- [ ] 代码结构清晰，易于维护
- [ ] 通过所有测试用例

---

**文档版本**: v1.0  
**创建日期**: 2024-01-21  
**最后更新**: 2024-01-21  
**作者**: Claude Assistant  
**审核**: 待定