// 智能刷新管理器
// 用于管理页面数据的智能刷新策略

class RefreshManager {
  constructor() {
    // 记录最后更新时间
    this.lastUpdateTimes = new Map();
    
    // 刷新策略配置（毫秒）
    this.refreshConfig = {
      userInfo: {
        minInterval: 30 * 1000,      // 最小刷新间隔：30秒
        maxCacheTime: 5 * 60 * 1000, // 最大缓存时间：5分钟
        forceRefreshEvents: ['USER_INFO_UPDATED', 'AVATAR_UPDATED'] // 强制刷新的事件
      },
      ticketList: {
        minInterval: 10 * 1000,       // 最小刷新间隔：10秒
        maxCacheTime: 2 * 60 * 1000,  // 最大缓存时间：2分钟
        forceRefreshEvents: ['TICKET_UPDATED', 'TICKET_CREATED', 'TICKET_ACCEPTED', 'TICKET_COMPLETED', 'TICKET_REJECTED']
      },
      dashboard: {
        minInterval: 15 * 1000,       // 最小刷新间隔：15秒
        maxCacheTime: 3 * 60 * 1000,  // 最大缓存时间：3分钟
        forceRefreshEvents: ['USER_INFO_UPDATED', 'TICKET_UPDATED', 'TICKET_ACCEPTED', 'TICKET_COMPLETED']
      },
      ticketDetail: {
        minInterval: 5 * 1000,        // 最小刷新间隔：5秒
        maxCacheTime: 1 * 60 * 1000,  // 最大缓存时间：1分钟
        forceRefreshEvents: ['TICKET_UPDATED', 'TICKET_ACCEPTED', 'TICKET_COMPLETED', 'TICKET_REJECTED']
      },
      materials: {
        minInterval: 30 * 1000,       // 最小刷新间隔：30秒
        maxCacheTime: 5 * 60 * 1000,  // 最大缓存时间：5分钟（常用类目）
        forceRefreshEvents: ['MATERIAL_UPDATED', 'ORDER_SUBMITTED', 'STOCK_CHANGED']
      },
      materials_popular: {
        minInterval: 30 * 1000,       // 最小刷新间隔：30秒
        maxCacheTime: 3 * 60 * 1000,  // 最大缓存时间：3分钟（常用变化频繁）
        forceRefreshEvents: ['MATERIAL_UPDATED', 'ORDER_SUBMITTED']
      },
      materials_other: {
        minInterval: 60 * 1000,       // 最小刷新间隔：60秒
        maxCacheTime: 10 * 60 * 1000, // 最大缓存时间：10分钟（其他类目）
        forceRefreshEvents: ['MATERIAL_UPDATED', 'ORDER_SUBMITTED']
      },
      default: {
        minInterval: 20 * 1000,       // 默认最小刷新间隔：20秒
        maxCacheTime: 10 * 60 * 1000, // 默认最大缓存时间：10分钟
        forceRefreshEvents: []
      }
    };
    
    // 强制刷新标记
    this.forceRefreshFlags = new Map();
    
    // 页面活跃状态
    this.pageActiveStatus = new Map();
  }
  
  /**
   * 判断是否需要刷新
   * @param {String} dataType 数据类型
   * @param {Object} options 选项
   * @returns {Boolean} 是否需要刷新
   */
  shouldRefresh(dataType, options = {}) {
    const {
      forceRefresh = false,  // 强制刷新
      checkCache = true,      // 检查缓存
      pageActive = true       // 页面是否活跃
    } = options;
    
    // 强制刷新
    if (forceRefresh || this.hasForceRefreshFlag(dataType)) {
      console.log(`[RefreshManager] ${dataType} 强制刷新`);
      this.clearForceRefreshFlag(dataType);
      return true;
    }
    
    // 页面不活跃不刷新
    if (!pageActive) {
      console.log(`[RefreshManager] ${dataType} 页面不活跃，跳过刷新`);
      return false;
    }
    
    const config = this.getConfig(dataType);
    const lastUpdate = this.lastUpdateTimes.get(dataType) || 0;
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdate;
    
    // 检查最小刷新间隔
    if (timeSinceLastUpdate < config.minInterval) {
      console.log(`[RefreshManager] ${dataType} 距离上次刷新时间过短: ${Math.floor(timeSinceLastUpdate/1000)}s`);
      return false;
    }
    
    // 检查缓存有效性
    if (checkCache) {
      const UserCache = require('./user-cache');
      const CacheManager = require('./cache-manager');
      
      // 对于用户信息，检查UserCache
      if (dataType === 'userInfo' && UserCache.isCacheValid()) {
        const remainingTime = UserCache.getCacheRemainingTime();
        console.log(`[RefreshManager] ${dataType} 缓存仍有效，剩余: ${remainingTime}分钟`);
        
        // 如果缓存时间超过最大缓存时间，仍然刷新
        if (timeSinceLastUpdate > config.maxCacheTime) {
          console.log(`[RefreshManager] ${dataType} 虽然缓存有效，但已超过最大缓存时间，需要刷新`);
          return true;
        }
        return false;
      }
      
      // 对于其他数据，检查CacheManager
      const cacheKey = this.getCacheKey(dataType);
      const cachedData = CacheManager.get(cacheKey, dataType);
      if (cachedData) {
        console.log(`[RefreshManager] ${dataType} 使用缓存数据`);
        
        // 如果缓存时间超过最大缓存时间，仍然刷新
        if (timeSinceLastUpdate > config.maxCacheTime) {
          console.log(`[RefreshManager] ${dataType} 缓存已超过最大缓存时间，需要刷新`);
          return true;
        }
        return false;
      }
    }
    
    // 默认需要刷新
    console.log(`[RefreshManager] ${dataType} 需要刷新`);
    return true;
  }
  
  /**
   * 记录刷新时间
   * @param {String} dataType 数据类型
   */
  recordRefresh(dataType) {
    this.lastUpdateTimes.set(dataType, Date.now());
    console.log(`[RefreshManager] 记录 ${dataType} 刷新时间`);
  }
  
  /**
   * 设置强制刷新标记
   * @param {String} dataType 数据类型
   */
  setForceRefreshFlag(dataType) {
    this.forceRefreshFlags.set(dataType, true);
    console.log(`[RefreshManager] 设置 ${dataType} 强制刷新标记`);
  }
  
  /**
   * 清除强制刷新标记
   * @param {String} dataType 数据类型
   */
  clearForceRefreshFlag(dataType) {
    this.forceRefreshFlags.delete(dataType);
  }
  
  /**
   * 检查是否有强制刷新标记
   * @param {String} dataType 数据类型
   * @returns {Boolean}
   */
  hasForceRefreshFlag(dataType) {
    return this.forceRefreshFlags.get(dataType) === true;
  }
  
  /**
   * 获取配置
   * @param {String} dataType 数据类型
   * @returns {Object} 配置对象
   */
  getConfig(dataType) {
    return this.refreshConfig[dataType] || this.refreshConfig.default;
  }
  
  /**
   * 获取缓存键
   * @param {String} dataType 数据类型
   * @returns {String} 缓存键
   */
  getCacheKey(dataType) {
    const keyMap = {
      userInfo: 'user_info',
      ticketList: 'ticket_list',
      dashboard: 'dashboard_data',
      statistics: 'statistics_data'
    };
    return keyMap[dataType] || dataType;
  }
  
  /**
   * 设置页面活跃状态
   * @param {String} pageName 页面名称
   * @param {Boolean} active 是否活跃
   */
  setPageActive(pageName, active) {
    this.pageActiveStatus.set(pageName, active);
    console.log(`[RefreshManager] ${pageName} 页面状态: ${active ? '活跃' : '非活跃'}`);
  }
  
  /**
   * 获取页面活跃状态
   * @param {String} pageName 页面名称
   * @returns {Boolean}
   */
  isPageActive(pageName) {
    return this.pageActiveStatus.get(pageName) !== false;
  }
  
  /**
   * 处理全局事件
   * @param {String} eventName 事件名称
   */
  handleGlobalEvent(eventName) {
    console.log(`[RefreshManager] 处理全局事件: ${eventName}`);
    
    // 遍历所有配置，设置相关的强制刷新标记
    Object.entries(this.refreshConfig).forEach(([dataType, config]) => {
      if (config.forceRefreshEvents && config.forceRefreshEvents.includes(eventName)) {
        this.setForceRefreshFlag(dataType);
      }
    });
  }
  
  /**
   * 智能刷新决策
   * @param {String} pageName 页面名称
   * @param {Array} dataTypes 需要刷新的数据类型
   * @returns {Object} 刷新决策
   */
  makeRefreshDecision(pageName, dataTypes = []) {
    const decisions = {};
    const pageActive = this.isPageActive(pageName);
    
    dataTypes.forEach(dataType => {
      decisions[dataType] = this.shouldRefresh(dataType, { pageActive });
    });
    
    console.log(`[RefreshManager] ${pageName} 页面刷新决策:`, decisions);
    return decisions;
  }
  
  /**
   * 批量记录刷新
   * @param {Array} dataTypes 数据类型数组
   */
  recordBatchRefresh(dataTypes) {
    dataTypes.forEach(dataType => {
      this.recordRefresh(dataType);
    });
  }
  
  /**
   * 清理过期记录
   * @param {Number} maxAge 最大保留时间（毫秒）
   */
  cleanup(maxAge = 60 * 60 * 1000) {
    const now = Date.now();
    const toDelete = [];
    
    this.lastUpdateTimes.forEach((time, key) => {
      if (now - time > maxAge) {
        toDelete.push(key);
      }
    });
    
    toDelete.forEach(key => {
      this.lastUpdateTimes.delete(key);
    });
    
    if (toDelete.length > 0) {
      console.log(`[RefreshManager] 清理了 ${toDelete.length} 条过期记录`);
    }
  }
  
  /**
   * 获取刷新统计
   * @returns {Object} 统计信息
   */
  getStats() {
    const stats = {
      lastUpdateTimes: {},
      forceRefreshFlags: [],
      activePages: []
    };
    
    this.lastUpdateTimes.forEach((time, key) => {
      stats.lastUpdateTimes[key] = new Date(time).toLocaleString();
    });
    
    this.forceRefreshFlags.forEach((flag, key) => {
      if (flag) stats.forceRefreshFlags.push(key);
    });
    
    this.pageActiveStatus.forEach((active, page) => {
      if (active) stats.activePages.push(page);
    });
    
    return stats;
  }
  
  /**
   * 重置管理器
   */
  reset() {
    this.lastUpdateTimes.clear();
    this.forceRefreshFlags.clear();
    this.pageActiveStatus.clear();
    console.log('[RefreshManager] 管理器已重置');
  }
}

// 导出单例
module.exports = new RefreshManager();