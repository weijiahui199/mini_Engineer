// 耗材类目配置 - 前后端共用
const MATERIAL_CATEGORIES = {
  // 类目定义
  categories: [
    {
      value: 'popular',
      label: '常用',
      icon: '🔥',
      description: '常用耗材',
      isVirtual: true // 虚拟类目，显示所有类目的热门产品
    },
    {
      value: 'paper',
      label: '纸张',
      icon: '📄',
      description: '打印纸、便利贴、文件夹等纸质产品'
    },
    {
      value: 'writing',
      label: '书写',
      icon: '✏️',
      description: '签字笔、白板笔、订书机等书写工具'
    },
    {
      value: 'print',
      label: '打印耗材',
      icon: '🖨️',
      description: '墨盒、硒鼓、色带等打印耗材'
    },
    {
      value: 'clean',
      label: '清洁/杂项',
      icon: '🧹',
      description: '垃圾袋、抽纸、清洁用品等'
    }
  ],
  
  // 获取所有实际类目（不包括虚拟类目）
  getRealCategories() {
    return this.categories.filter(c => !c.isVirtual).map(c => c.value)
  },
  
  // 获取类目标签
  getCategoryLabel(value) {
    const category = this.categories.find(c => c.value === value)
    return category ? category.label : value
  },
  
  // 获取类目图标
  getCategoryIcon(value) {
    const category = this.categories.find(c => c.value === value)
    return category ? category.icon : '📦'
  },
  
  // 验证类目是否有效
  isValidCategory(value) {
    if (value === 'all') return true // 'all' 是特殊值，表示所有类目
    return this.categories.some(c => c.value === value)
  },
  
  // 处理类目参数（用于API请求）
  processCategoryParam(value) {
    // popular 转换为 all，其他保持不变
    if (value === 'popular') return 'all'
    return value
  }
}

module.exports = MATERIAL_CATEGORIES