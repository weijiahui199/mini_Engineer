// 缓存管理器
class CacheManager {
  constructor() {
    this.memoryCache = new Map();
    this.cacheConfig = {
      // 缓存时间配置（毫秒）
      userInfo: 30 * 60 * 1000,        // 30分钟
      ticketList: 5 * 60 * 1000,        // 5分钟
      ticketDetail: 10 * 60 * 1000,     // 10分钟
      statistics: 15 * 60 * 1000,       // 15分钟
      materials: 60 * 60 * 1000,        // 1小时
      engineers: 30 * 60 * 1000,        // 30分钟
      default: 10 * 60 * 1000           // 默认10分钟
    };
    
    // 缓存大小限制
    this.maxMemoryCacheSize = 50;      // 内存缓存最大条目
    this.maxStorageSize = 2 * 1024 * 1024; // 本地存储最大2MB
  }
  
  /**
   * 获取缓存数据
   * @param {string} key - 缓存键
   * @param {string} type - 缓存类型
   * @returns {any} 缓存数据或null
   */
  get(key, type = 'default') {
    // 先检查内存缓存
    const memoryData = this.getFromMemory(key);
    if (memoryData !== null) {
      return memoryData;
    }
    
    // 再检查本地存储
    const storageData = this.getFromStorage(key, type);
    if (storageData !== null) {
      // 写入内存缓存
      this.setToMemory(key, storageData);
      return storageData;
    }
    
    return null;
  }
  
  /**
   * 设置缓存数据
   * @param {string} key - 缓存键
   * @param {any} data - 数据
   * @param {string} type - 缓存类型
   */
  set(key, data, type = 'default') {
    // 同时写入内存和存储
    this.setToMemory(key, data);
    this.setToStorage(key, data, type);
  }
  
  /**
   * 从内存缓存获取
   * @param {string} key - 缓存键
   * @returns {any} 缓存数据或null
   */
  getFromMemory(key) {
    const cached = this.memoryCache.get(key);
    
    if (cached && cached.expireTime > Date.now()) {
      console.log(`💾 命中内存缓存: ${key}`);
      return cached.data;
    }
    
    // 过期则删除
    if (cached) {
      this.memoryCache.delete(key);
    }
    
    return null;
  }
  
  /**
   * 设置内存缓存
   * @param {string} key - 缓存键
   * @param {any} data - 数据
   */
  setToMemory(key, data) {
    // 检查缓存大小限制
    if (this.memoryCache.size >= this.maxMemoryCacheSize) {
      // 删除最旧的缓存（LRU）
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(key, {
      data: data,
      expireTime: Date.now() + this.getCacheDuration(key)
    });
  }
  
  /**
   * 从本地存储获取
   * @param {string} key - 缓存键
   * @param {string} type - 缓存类型
   * @returns {any} 缓存数据或null
   */
  getFromStorage(key, type) {
    try {
      const storageKey = this.getStorageKey(key);
      const cached = wx.getStorageSync(storageKey);
      
      if (cached && cached.expireTime > Date.now()) {
        console.log(`💾 命中存储缓存: ${key}`);
        return cached.data;
      }
      
      // 过期则删除
      if (cached) {
        wx.removeStorageSync(storageKey);
      }
    } catch (error) {
      console.error('读取缓存失败:', error);
    }
    
    return null;
  }
  
  /**
   * 设置本地存储缓存
   * @param {string} key - 缓存键
   * @param {any} data - 数据
   * @param {string} type - 缓存类型
   */
  setToStorage(key, data, type) {
    try {
      const storageKey = this.getStorageKey(key);
      const cacheData = {
        data: data,
        expireTime: Date.now() + this.getCacheDuration(type),
        type: type,
        timestamp: Date.now()
      };
      
      // 检查存储空间
      this.checkStorageSpace();
      
      wx.setStorageSync(storageKey, cacheData);
      console.log(`✅ 缓存已保存: ${key}`);
    } catch (error) {
      console.error('保存缓存失败:', error);
      // 如果存储空间不足，清理旧缓存
      if (error.errMsg?.includes('exceed')) {
        this.clearExpiredCache();
        // 重试一次
        try {
          wx.setStorageSync(storageKey, cacheData);
        } catch (retryError) {
          console.error('重试保存缓存失败:', retryError);
        }
      }
    }
  }
  
  /**
   * 获取缓存时长
   * @param {string} type - 缓存类型
   * @returns {number} 缓存时长（毫秒）
   */
  getCacheDuration(type) {
    return this.cacheConfig[type] || this.cacheConfig.default;
  }
  
  /**
   * 获取存储键名
   * @param {string} key - 缓存键
   * @returns {string} 存储键名
   */
  getStorageKey(key) {
    return `cache_${key}`;
  }
  
  /**
   * 检查存储空间
   */
  checkStorageSpace() {
    try {
      const info = wx.getStorageInfoSync();
      const usedSize = info.currentSize * 1024; // 转换为字节
      
      if (usedSize > this.maxStorageSize * 0.9) {
        console.warn('存储空间接近上限，开始清理...');
        this.clearExpiredCache();
      }
    } catch (error) {
      console.error('检查存储空间失败:', error);
    }
  }
  
  /**
   * 清理过期缓存
   */
  clearExpiredCache() {
    try {
      const keys = wx.getStorageInfoSync().keys;
      let clearedCount = 0;
      
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          const cached = wx.getStorageSync(key);
          if (cached && cached.expireTime < Date.now()) {
            wx.removeStorageSync(key);
            clearedCount++;
          }
        }
      });
      
      console.log(`🧹 清理了 ${clearedCount} 个过期缓存`);
    } catch (error) {
      console.error('清理缓存失败:', error);
    }
  }
  
  /**
   * 清除指定类型的缓存
   * @param {string} type - 缓存类型
   */
  clearByType(type) {
    try {
      const keys = wx.getStorageInfoSync().keys;
      
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          const cached = wx.getStorageSync(key);
          if (cached && cached.type === type) {
            wx.removeStorageSync(key);
          }
        }
      });
      
      // 清理内存缓存
      for (const [key, value] of this.memoryCache.entries()) {
        if (key.includes(type)) {
          this.memoryCache.delete(key);
        }
      }
      
      console.log(`🧹 清理了类型为 ${type} 的缓存`);
    } catch (error) {
      console.error('清理缓存失败:', error);
    }
  }
  
  /**
   * 清除特定缓存
   * @param {string} key - 缓存键
   */
  remove(key) {
    // 清除内存缓存
    this.memoryCache.delete(key);
    
    // 清除存储缓存
    try {
      const storageKey = this.getStorageKey(key);
      wx.removeStorageSync(storageKey);
      console.log(`🗑️ 已删除缓存: ${key}`);
    } catch (error) {
      console.error('删除缓存失败:', error);
    }
  }
  
  /**
   * 清除所有缓存
   */
  clearAll() {
    // 清除内存缓存
    this.memoryCache.clear();
    
    // 清除存储缓存
    try {
      const keys = wx.getStorageInfoSync().keys;
      
      keys.forEach(key => {
        if (key.startsWith('cache_')) {
          wx.removeStorageSync(key);
        }
      });
      
      console.log('🧹 已清除所有缓存');
    } catch (error) {
      console.error('清除缓存失败:', error);
    }
  }
  
  /**
   * 预加载缓存
   * @param {Array} items - 预加载项 [{key, loader, type}]
   */
  async preload(items) {
    console.log('🚀 开始预加载缓存...');
    
    const promises = items.map(async (item) => {
      try {
        // 检查是否已有缓存
        const cached = this.get(item.key, item.type);
        if (cached) {
          return cached;
        }
        
        // 加载数据
        const data = await item.loader();
        
        // 设置缓存
        this.set(item.key, data, item.type);
        
        return data;
      } catch (error) {
        console.error(`预加载失败 [${item.key}]:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(promises);
    console.log('✅ 预加载完成');
    return results;
  }
  
  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = {
      memoryCache: {
        size: this.memoryCache.size,
        items: []
      },
      storageCache: {
        size: 0,
        items: []
      }
    };
    
    // 内存缓存统计
    for (const [key, value] of this.memoryCache.entries()) {
      stats.memoryCache.items.push({
        key,
        expireTime: new Date(value.expireTime).toLocaleString()
      });
    }
    
    // 存储缓存统计
    try {
      const info = wx.getStorageInfoSync();
      stats.storageCache.size = info.currentSize;
      
      info.keys.forEach(key => {
        if (key.startsWith('cache_')) {
          const cached = wx.getStorageSync(key);
          if (cached) {
            stats.storageCache.items.push({
              key: key.replace('cache_', ''),
              type: cached.type,
              expireTime: new Date(cached.expireTime).toLocaleString()
            });
          }
        }
      });
    } catch (error) {
      console.error('获取缓存统计失败:', error);
    }
    
    return stats;
  }
  
  /**
   * 刷新缓存
   * @param {string} key - 缓存键
   * @param {Function} loader - 加载函数
   * @param {string} type - 缓存类型
   */
  async refresh(key, loader, type = 'default') {
    try {
      // 删除旧缓存
      this.remove(key);
      
      // 加载新数据
      const data = await loader();
      
      // 设置新缓存
      this.set(key, data, type);
      
      console.log(`🔄 缓存已刷新: ${key}`);
      return data;
    } catch (error) {
      console.error(`刷新缓存失败 [${key}]:`, error);
      throw error;
    }
  }
}

// 导出单例
module.exports = new CacheManager();