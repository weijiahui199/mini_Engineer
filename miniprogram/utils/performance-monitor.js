// 性能监控工具
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.thresholds = {
      pageLoad: 3000,      // 页面加载阈值 3秒
      apiCall: 2000,       // API调用阈值 2秒
      dbQuery: 1000,       // 数据库查询阈值 1秒
      imageLoad: 1500      // 图片加载阈值 1.5秒
    };
  }
  
  /**
   * 开始计时
   * @param {string} name - 计时器名称
   * @param {string} type - 类型(pageLoad/apiCall/dbQuery/imageLoad)
   */
  startTimer(name, type = 'general') {
    const key = `${type}:${name}`;
    this.metrics.set(key, {
      type,
      name,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'running'
    });
  }
  
  /**
   * 结束计时
   * @param {string} name - 计时器名称
   * @param {string} type - 类型
   * @param {Object} extraData - 额外数据
   */
  endTimer(name, type = 'general', extraData = {}) {
    const key = `${type}:${name}`;
    const metric = this.metrics.get(key);
    
    if (!metric) {
      console.warn(`计时器 ${key} 不存在`);
      return null;
    }
    
    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;
    metric.status = 'completed';
    metric.extraData = extraData;
    
    // 检查是否超过阈值
    this.checkThreshold(metric);
    
    // 记录性能数据
    this.logPerformance(metric);
    
    return duration;
  }
  
  /**
   * 检查性能阈值
   * @param {Object} metric - 性能指标
   */
  checkThreshold(metric) {
    const threshold = this.thresholds[metric.type];
    
    if (threshold && metric.duration > threshold) {
      console.warn(`⚠️ 性能警告: ${metric.type}:${metric.name} 耗时 ${metric.duration}ms，超过阈值 ${threshold}ms`);
      
      // 记录慢操作
      this.recordSlowOperation(metric);
    }
  }
  
  /**
   * 记录慢操作
   * @param {Object} metric - 性能指标
   */
  recordSlowOperation(metric) {
    try {
      let slowOps = wx.getStorageSync('slowOperations') || [];
      
      slowOps.push({
        ...metric,
        timestamp: new Date().toISOString(),
        page: getCurrentPages()[getCurrentPages().length - 1]?.route || 'unknown',
        userOpenid: getApp()?.globalData?.openid || 'unknown'
      });
      
      // 只保留最近50条记录
      if (slowOps.length > 50) {
        slowOps = slowOps.slice(-50);
      }
      
      wx.setStorageSync('slowOperations', slowOps);
    } catch (e) {
      console.error('记录慢操作失败:', e);
    }
  }
  
  /**
   * 监控页面性能
   * @param {string} pageName - 页面名称
   */
  monitorPage(pageName) {
    const pageInstance = this;
    
    return {
      onLoad() {
        pageInstance.startTimer(pageName, 'pageLoad');
      },
      
      onReady() {
        const duration = pageInstance.endTimer(pageName, 'pageLoad');
        console.log(`📊 页面 ${pageName} 加载完成，耗时: ${duration}ms`);
      },
      
      onUnload() {
        // 清理该页面的计时器
        pageInstance.cleanupPageTimers(pageName);
      }
    };
  }
  
  /**
   * 监控数据库查询
   * @param {string} collection - 集合名称
   * @param {string} operation - 操作类型
   * @param {Function} queryFunc - 查询函数
   */
  async monitorDbQuery(collection, operation, queryFunc) {
    const timerName = `${collection}.${operation}`;
    this.startTimer(timerName, 'dbQuery');
    
    try {
      const result = await queryFunc();
      const duration = this.endTimer(timerName, 'dbQuery', {
        collection,
        operation,
        resultCount: result.data?.length || 0
      });
      
      return result;
    } catch (error) {
      this.endTimer(timerName, 'dbQuery', {
        collection,
        operation,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * 监控API调用
   * @param {string} apiName - API名称
   * @param {Function} apiFunc - API函数
   */
  async monitorApiCall(apiName, apiFunc) {
    this.startTimer(apiName, 'apiCall');
    
    try {
      const result = await apiFunc();
      this.endTimer(apiName, 'apiCall', {
        success: true
      });
      return result;
    } catch (error) {
      this.endTimer(apiName, 'apiCall', {
        success: false,
        error: error.message
      });
      throw error;
    }
  }
  
  /**
   * 记录性能数据
   * @param {Object} metric - 性能指标
   */
  logPerformance(metric) {
    // 开发环境输出详细日志
    if (__wxConfig.envVersion === 'develop') {
      const emoji = metric.duration > this.thresholds[metric.type] ? '🐢' : '🚀';
      console.log(`${emoji} [${metric.type}] ${metric.name}: ${metric.duration}ms`);
    }
    
    // 聚合性能数据用于分析
    this.aggregatePerformanceData(metric);
  }
  
  /**
   * 聚合性能数据
   * @param {Object} metric - 性能指标
   */
  aggregatePerformanceData(metric) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const storageKey = `perfData_${today}`;
      let perfData = wx.getStorageSync(storageKey) || {};
      
      const key = `${metric.type}:${metric.name}`;
      if (!perfData[key]) {
        perfData[key] = {
          count: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          avgDuration: 0
        };
      }
      
      const stats = perfData[key];
      stats.count++;
      stats.totalDuration += metric.duration;
      stats.minDuration = Math.min(stats.minDuration, metric.duration);
      stats.maxDuration = Math.max(stats.maxDuration, metric.duration);
      stats.avgDuration = Math.round(stats.totalDuration / stats.count);
      
      wx.setStorageSync(storageKey, perfData);
      
      // 清理旧数据（保留最近7天）
      this.cleanupOldPerfData();
    } catch (e) {
      console.error('聚合性能数据失败:', e);
    }
  }
  
  /**
   * 清理旧的性能数据
   */
  cleanupOldPerfData() {
    try {
      const keys = wx.getStorageInfoSync().keys;
      const today = new Date();
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      keys.forEach(key => {
        if (key.startsWith('perfData_')) {
          const dateStr = key.replace('perfData_', '');
          const keyDate = new Date(dateStr);
          
          if (keyDate < sevenDaysAgo) {
            wx.removeStorageSync(key);
          }
        }
      });
    } catch (e) {
      console.error('清理旧性能数据失败:', e);
    }
  }
  
  /**
   * 清理页面相关的计时器
   * @param {string} pageName - 页面名称
   */
  cleanupPageTimers(pageName) {
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.name.includes(pageName) && metric.status === 'running') {
        this.metrics.delete(key);
      }
    }
  }
  
  /**
   * 获取性能报告
   * @returns {Object} 性能报告
   */
  getPerformanceReport() {
    const today = new Date().toISOString().split('T')[0];
    const perfData = wx.getStorageSync(`perfData_${today}`) || {};
    const slowOps = wx.getStorageSync('slowOperations') || [];
    
    return {
      date: today,
      summary: perfData,
      slowOperations: slowOps.slice(-10), // 最近10条慢操作
      recommendations: this.generateRecommendations(perfData, slowOps)
    };
  }
  
  /**
   * 生成性能优化建议
   * @param {Object} perfData - 性能数据
   * @param {Array} slowOps - 慢操作列表
   * @returns {Array} 优化建议
   */
  generateRecommendations(perfData, slowOps) {
    const recommendations = [];
    
    // 分析慢查询
    Object.entries(perfData).forEach(([key, stats]) => {
      if (stats.avgDuration > this.thresholds[key.split(':')[0]]) {
        recommendations.push({
          type: 'warning',
          operation: key,
          message: `平均耗时 ${stats.avgDuration}ms，建议优化`,
          suggestion: this.getSuggestion(key, stats)
        });
      }
    });
    
    // 分析频繁的慢操作
    const slowOpCounts = {};
    slowOps.forEach(op => {
      const key = `${op.type}:${op.name}`;
      slowOpCounts[key] = (slowOpCounts[key] || 0) + 1;
    });
    
    Object.entries(slowOpCounts).forEach(([key, count]) => {
      if (count >= 3) {
        recommendations.push({
          type: 'critical',
          operation: key,
          message: `频繁出现慢操作（${count}次）`,
          suggestion: '建议立即优化此操作'
        });
      }
    });
    
    return recommendations;
  }
  
  /**
   * 获取优化建议
   * @param {string} key - 操作标识
   * @param {Object} stats - 统计数据
   * @returns {string} 优化建议
   */
  getSuggestion(key, stats) {
    const [type, name] = key.split(':');
    
    switch(type) {
      case 'dbQuery':
        return '考虑添加索引、减少查询字段或使用缓存';
      case 'pageLoad':
        return '检查页面初始化逻辑，考虑懒加载或分步加载';
      case 'apiCall':
        return '检查网络请求，考虑使用缓存或批量请求';
      case 'imageLoad':
        return '优化图片大小，使用CDN或懒加载';
      default:
        return '分析具体操作，寻找优化点';
    }
  }
}

// 导出单例
module.exports = new PerformanceMonitor();