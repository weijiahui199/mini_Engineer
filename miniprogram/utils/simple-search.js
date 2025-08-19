/**
 * 简单的搜索实现（Fuse.js 的备用方案）
 * 当 Fuse.js 无法加载时使用
 */

class SimpleSearch {
  constructor(data, options = {}) {
    this.data = data || [];
    this.keys = options.keys || [];
  }
  
  /**
   * 执行搜索
   * @param {String} keyword 搜索关键词
   * @returns {Array} 搜索结果
   */
  search(keyword) {
    if (!keyword) return this.data;
    
    keyword = keyword.toLowerCase().trim();
    
    return this.data.filter(item => {
      // 遍历所有配置的搜索字段
      for (let keyConfig of this.keys) {
        const fieldName = typeof keyConfig === 'string' ? keyConfig : keyConfig.name;
        const fieldValue = this.getFieldValue(item, fieldName);
        
        if (fieldValue && fieldValue.toLowerCase().includes(keyword)) {
          return true;
        }
      }
      return false;
    });
  }
  
  /**
   * 获取字段值
   */
  getFieldValue(obj, path) {
    const keys = path.split('.');
    let value = obj;
    
    for (let key of keys) {
      if (value && typeof value === 'object') {
        value = value[key];
      } else {
        return null;
      }
    }
    
    return value ? String(value) : null;
  }
}

module.exports = SimpleSearch;