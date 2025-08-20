// 耗材类目配置 - 云函数端
// 与前端保持一致（miniprogram/config/material-categories.js）
const VALID_CATEGORIES = ['paper', 'writing', 'print', 'clean']

// 验证类目是否有效
function isValidCategory(category) {
  // 特殊值处理
  if (category === 'all') return true // 'all' 表示所有类目
  if (category === 'popular') return true // 'popular' 是虚拟类目，后端当作 'all' 处理
  return VALID_CATEGORIES.includes(category)
}

// 获取所有有效类目（不包括虚拟类目）
function getAllCategories() {
  return VALID_CATEGORIES
}

// 类目标签映射
const CATEGORY_LABELS = {
  paper: '纸张',
  writing: '书写',
  print: '打印耗材',
  clean: '清洁/杂项',
  popular: '常用' // 虚拟类目
}

// 获取类目标签
function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] || category
}

// 处理类目参数（popular 转换为 all）
function processCategoryParam(category) {
  if (category === 'popular') return 'all'
  return category
}

module.exports = {
  isValidCategory,
  getAllCategories,
  getCategoryLabel,
  processCategoryParam,
  VALID_CATEGORIES
}