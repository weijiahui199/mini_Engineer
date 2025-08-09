// 错误处理和重试机制
class ErrorHandler {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
  }
  
  /**
   * 带重试机制的异步操作执行
   * @param {Function} asyncFunc - 异步函数
   * @param {Object} options - 配置选项
   * @returns {Promise} 执行结果
   */
  async executeWithRetry(asyncFunc, options = {}) {
    const {
      maxRetries = this.maxRetries,
      retryDelay = this.retryDelay,
      onRetry = null,
      context = null
    } = options;
    
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 执行异步操作
        const result = await asyncFunc.call(context);
        return result;
      } catch (error) {
        lastError = error;
        console.error(`[Attempt ${attempt}/${maxRetries}] 操作失败:`, error);
        
        // 判断是否需要重试
        if (!this.shouldRetry(error) || attempt === maxRetries) {
          throw error;
        }
        
        // 执行重试回调
        if (onRetry) {
          onRetry(attempt, error);
        }
        
        // 等待后重试，使用指数退避
        await this.delay(retryDelay * Math.pow(2, attempt - 1));
      }
    }
    
    throw lastError;
  }
  
  /**
   * 判断错误是否应该重试
   * @param {Error} error - 错误对象
   * @returns {boolean} 是否重试
   */
  shouldRetry(error) {
    // 网络错误应该重试
    if (error.errCode === -1 || error.errCode === 'NETWORK_ERROR') {
      return true;
    }
    
    // 超时错误应该重试
    if (error.errCode === 'TIMEOUT' || error.message?.includes('timeout')) {
      return true;
    }
    
    // 云函数临时错误应该重试
    if (error.errCode >= 500 && error.errCode < 600) {
      return true;
    }
    
    // 数据库连接错误应该重试
    if (error.message?.includes('database') || error.message?.includes('connection')) {
      return true;
    }
    
    // 其他错误不重试
    return false;
  }
  
  /**
   * 延迟执行
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 处理并显示错误
   * @param {Error} error - 错误对象
   * @param {string} defaultMessage - 默认错误消息
   */
  handleError(error, defaultMessage = '操作失败') {
    console.error('错误详情:', error);
    
    let message = defaultMessage;
    
    // 根据错误类型自定义消息
    if (error.errCode === -1) {
      message = '网络连接失败，请检查网络';
    } else if (error.errCode === 'PERMISSION_DENIED') {
      message = '权限不足，无法执行此操作';
    } else if (error.errCode === 'RESOURCE_NOT_FOUND') {
      message = '请求的资源不存在';
    } else if (error.errCode === 'TIMEOUT') {
      message = '请求超时，请稍后重试';
    } else if (error.message) {
      // 如果有具体错误信息，显示它
      message = error.message;
    }
    
    // 显示错误提示
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2500
    });
    
    // 记录错误日志
    this.logError(error, defaultMessage);
  }
  
  /**
   * 记录错误日志
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  logError(error, context) {
    const errorLog = {
      time: new Date().toISOString(),
      context: context,
      error: {
        message: error.message,
        code: error.errCode || error.code,
        stack: error.stack
      },
      userInfo: {
        openid: getApp()?.globalData?.openid || 'unknown',
        role: getApp()?.globalData?.userInfo?.roleGroup || 'unknown'
      },
      systemInfo: wx.getSystemInfoSync()
    };
    
    // 存储到本地日志
    this.saveLocalLog(errorLog);
    
    // 可选：上报到服务器
    this.reportToServer(errorLog);
  }
  
  /**
   * 保存本地错误日志
   * @param {Object} errorLog - 错误日志对象
   */
  saveLocalLog(errorLog) {
    try {
      // 获取现有日志
      let logs = wx.getStorageSync('errorLogs') || [];
      
      // 限制日志数量，保留最近100条
      if (logs.length >= 100) {
        logs = logs.slice(-99);
      }
      
      logs.push(errorLog);
      wx.setStorageSync('errorLogs', logs);
    } catch (e) {
      console.error('保存错误日志失败:', e);
    }
  }
  
  /**
   * 上报错误到服务器
   * @param {Object} errorLog - 错误日志对象
   */
  async reportToServer(errorLog) {
    try {
      // 批量上报，避免频繁请求
      const pendingLogs = wx.getStorageSync('pendingErrorLogs') || [];
      pendingLogs.push(errorLog);
      
      if (pendingLogs.length >= 10) {
        // 达到批量上报阈值
        const db = wx.cloud.database();
        await db.collection('errorLogs').add({
          data: {
            logs: pendingLogs,
            reportTime: new Date()
          }
        });
        
        // 清空待上报日志
        wx.removeStorageSync('pendingErrorLogs');
      } else {
        // 保存待上报日志
        wx.setStorageSync('pendingErrorLogs', pendingLogs);
      }
    } catch (e) {
      console.error('上报错误日志失败:', e);
    }
  }
}

// 导出单例
module.exports = new ErrorHandler();