/**
 * 简化版搜索日志收集器
 * 用于收集用户搜索行为数据，支持后期导出分析
 */

class SimpleSearchLogger {
  constructor() {
    this.pendingLogs = [];  // 待上传的日志
    this.uploadTimer = null; // 批量上传定时器
    this.uploadInterval = 5000; // 5秒批量上传一次
  }

  /**
   * 记录搜索行为
   * @param {Object} searchData 搜索数据
   */
  logSearch(searchData) {
    try {
      const logEntry = {
        // 基础信息
        keyword: (searchData.keyword || '').trim(),
        searchTime: new Date().toISOString(),
        
        // 搜索结果
        resultCount: searchData.resultCount || 0,
        hasResults: searchData.resultCount > 0,
        
        // 搜索上下文（可选）
        searchType: searchData.searchType || 'manual', // manual/suggestion/history
        clickedIndex: searchData.clickedIndex || -1,   // -1表示未点击
        
        // 页面信息
        page: searchData.page || 'ticket-list',
        
        // 简单的设备信息
        platform: wx.getSystemInfoSync().platform || 'unknown'
      };

      // 添加到待上传队列
      this.pendingLogs.push(logEntry);
      
      // 如果队列达到10条，立即上传
      if (this.pendingLogs.length >= 10) {
        this.uploadLogs();
      } else {
        // 否则设置定时上传
        this.scheduleUpload();
      }
      
      console.log('[SearchLogger] 搜索已记录:', logEntry.keyword);
      
    } catch (error) {
      console.error('[SearchLogger] 记录失败:', error);
    }
  }

  /**
   * 记录搜索结果点击
   * @param {String} keyword 搜索关键词
   * @param {Number} index 点击的结果索引
   */
  logClick(keyword, index) {
    try {
      // 找到对应的搜索记录并更新点击信息
      const recentLog = this.pendingLogs.find(log => 
        log.keyword === keyword && log.clickedIndex === -1
      );
      
      if (recentLog) {
        recentLog.clickedIndex = index;
        console.log('[SearchLogger] 点击已记录:', keyword, index);
      }
    } catch (error) {
      console.error('[SearchLogger] 记录点击失败:', error);
    }
  }

  /**
   * 安排上传
   */
  scheduleUpload() {
    if (this.uploadTimer) return;
    
    this.uploadTimer = setTimeout(() => {
      this.uploadLogs();
    }, this.uploadInterval);
  }

  /**
   * 批量上传日志到数据库
   */
  async uploadLogs() {
    if (this.pendingLogs.length === 0) return;
    
    // 清除定时器
    if (this.uploadTimer) {
      clearTimeout(this.uploadTimer);
      this.uploadTimer = null;
    }
    
    // 取出待上传的日志
    const logsToUpload = [...this.pendingLogs];
    this.pendingLogs = [];
    
    try {
      const db = wx.cloud.database();
      
      // 检查集合是否存在（通过尝试查询）
      try {
        await db.collection('search_logs').limit(1).get();
      } catch (checkError) {
        // 如果集合不存在，静默失败，不上传日志
        console.log('[SearchLogger] search_logs 集合不存在，跳过日志上传');
        return;
      }
      
      // 批量插入
      for (const log of logsToUpload) {
        await db.collection('search_logs').add({
          data: log
        }).catch(err => {
          console.error('[SearchLogger] 单条上传失败:', err);
          // 失败的重新加入队列
          this.pendingLogs.push(log);
        });
      }
      
      console.log('[SearchLogger] 批量上传完成:', logsToUpload.length, '条');
      
    } catch (error) {
      console.error('[SearchLogger] 批量上传失败:', error);
      // 失败的重新加入队列
      this.pendingLogs.push(...logsToUpload);
    }
  }

  /**
   * 强制上传所有待上传的日志
   */
  flush() {
    this.uploadLogs();
  }
}

// 导出单例
let instance = null;

// 创建获取实例的函数
function getSearchLogger() {
  if (!instance) {
    instance = new SimpleSearchLogger();
  }
  return instance;
}

// 导出方法
module.exports = {
  /**
   * 获取搜索日志记录器实例
   */
  getSearchLogger: getSearchLogger,
  
  /**
   * 快捷记录方法
   */
  logSearch(keyword, resultCount, options = {}) {
    const logger = getSearchLogger();
    logger.logSearch({
      keyword,
      resultCount,
      ...options
    });
  },
  
  /**
   * 快捷记录点击
   */
  logSearchClick(keyword, index) {
    const logger = getSearchLogger();
    logger.logClick(keyword, index);
  }
};