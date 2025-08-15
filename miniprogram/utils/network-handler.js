// 网络错误处理和重试机制
class NetworkHandler {
  constructor() {
    // 重试配置
    this.retryConfig = {
      maxRetries: 3,           // 最大重试次数
      retryDelay: 1000,        // 重试延迟（毫秒）
      exponentialBackoff: true, // 指数退避
      timeout: 30000           // 请求超时时间（毫秒）
    };
    
    // 错误消息映射
    this.errorMessages = {
      'request:fail': '网络连接失败，请检查网络设置',
      'request:fail timeout': '请求超时，请稍后重试',
      'uploadFile:fail': '文件上传失败',
      'downloadFile:fail': '文件下载失败',
      'cloud.callFunction:fail': '云函数调用失败',
      'collection.add:fail': '数据保存失败',
      'collection.update:fail': '数据更新失败',
      'ECONNABORTED': '连接中断，请重试',
      'NETWORK_ERROR': '网络异常，请检查网络连接',
      'TIMEOUT': '操作超时，请稍后重试',
      'SERVER_ERROR': '服务器错误，请稍后重试',
      'default': '操作失败，请重试'
    };
    
    // 网络状态
    this.networkType = 'unknown';
    this.isConnected = true;
    
    // 初始化网络监听
    this.initNetworkListener();
  }
  
  /**
   * 初始化网络状态监听
   */
  initNetworkListener() {
    // 监听网络状态变化
    wx.onNetworkStatusChange((res) => {
      this.isConnected = res.isConnected;
      this.networkType = res.networkType;
      
      console.log('[NetworkHandler] 网络状态变化:', {
        isConnected: res.isConnected,
        networkType: res.networkType
      });
      
      if (!res.isConnected) {
        this.showNetworkError('网络已断开');
      } else if (this.networkType === '2g') {
        this.showNetworkWarning('当前为2G网络，可能较慢');
      }
    });
    
    // 获取当前网络状态
    wx.getNetworkType({
      success: (res) => {
        this.networkType = res.networkType;
        this.isConnected = res.networkType !== 'none';
      }
    });
  }
  
  /**
   * 执行带重试的异步操作
   * @param {Function} operation - 要执行的异步操作
   * @param {Object} options - 重试选项
   * @returns {Promise} 操作结果
   */
  async executeWithRetry(operation, options = {}) {
    const config = {
      ...this.retryConfig,
      ...options
    };
    
    let lastError;
    let retryCount = 0;
    
    while (retryCount <= config.maxRetries) {
      try {
        // 检查网络连接
        if (!this.isConnected) {
          throw new Error('NETWORK_ERROR');
        }
        
        // 执行操作（带超时控制）
        const result = await this.withTimeout(
          operation(),
          config.timeout
        );
        
        // 成功则返回结果
        return result;
        
      } catch (error) {
        lastError = error;
        console.error(`[NetworkHandler] 操作失败 (尝试 ${retryCount + 1}/${config.maxRetries + 1}):`, error);
        
        // 如果是不可重试的错误，直接抛出
        if (this.isNonRetryableError(error)) {
          throw error;
        }
        
        // 如果还有重试机会
        if (retryCount < config.maxRetries) {
          // 计算延迟时间
          const delay = config.exponentialBackoff 
            ? config.retryDelay * Math.pow(2, retryCount)
            : config.retryDelay;
          
          // 显示重试提示
          if (retryCount === 0) {
            wx.showLoading({
              title: `正在重试(${retryCount + 1}/${config.maxRetries})...`,
              mask: true
            });
          } else {
            wx.showLoading({
              title: `重试中(${retryCount + 1}/${config.maxRetries})...`,
              mask: true
            });
          }
          
          // 等待后重试
          await this.sleep(delay);
          retryCount++;
        } else {
          // 重试次数用完，抛出错误
          wx.hideLoading();
          throw lastError;
        }
      }
    }
    
    wx.hideLoading();
    throw lastError;
  }
  
  /**
   * 带超时的Promise
   * @param {Promise} promise - 要执行的Promise
   * @param {Number} timeout - 超时时间（毫秒）
   * @returns {Promise}
   */
  withTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('TIMEOUT'));
        }, timeout);
      })
    ]);
  }
  
  /**
   * 判断是否为不可重试的错误
   * @param {Error} error - 错误对象
   * @returns {Boolean}
   */
  isNonRetryableError(error) {
    const nonRetryableErrors = [
      'auth:fail',           // 认证失败
      'permission denied',   // 权限拒绝
      'invalid parameter',   // 参数错误
      'file not found',      // 文件不存在
      'quota exceeded'       // 配额超限
    ];
    
    const errorMessage = error.message || error.errMsg || '';
    return nonRetryableErrors.some(msg => 
      errorMessage.toLowerCase().includes(msg)
    );
  }
  
  /**
   * 延迟函数
   * @param {Number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 获取友好的错误消息
   * @param {Error} error - 错误对象
   * @returns {String} 错误消息
   */
  getFriendlyErrorMessage(error) {
    const errorStr = error.message || error.errMsg || error.toString();
    
    // 查找匹配的错误消息
    for (const [key, message] of Object.entries(this.errorMessages)) {
      if (errorStr.includes(key)) {
        return message;
      }
    }
    
    // 特殊处理云函数错误
    if (errorStr.includes('cloud.callFunction')) {
      if (errorStr.includes('ECONNREFUSED')) {
        return '服务暂时不可用，请稍后重试';
      }
      if (errorStr.includes('404')) {
        return '功能未部署，请联系管理员';
      }
    }
    
    return this.errorMessages.default;
  }
  
  /**
   * 显示网络错误提示
   * @param {String} message - 错误消息
   */
  showNetworkError(message) {
    wx.showToast({
      title: message || '网络错误',
      icon: 'none',
      duration: 3000
    });
  }
  
  /**
   * 显示网络警告
   * @param {String} message - 警告消息
   */
  showNetworkWarning(message) {
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  }
  
  /**
   * 显示错误对话框（严重错误）
   * @param {Error} error - 错误对象
   * @param {Object} options - 选项
   */
  showErrorDialog(error, options = {}) {
    const {
      title = '操作失败',
      showCancel = true,
      confirmText = '重试',
      cancelText = '取消',
      onConfirm = null,
      onCancel = null
    } = options;
    
    const message = this.getFriendlyErrorMessage(error);
    
    wx.showModal({
      title,
      content: message,
      showCancel,
      confirmText,
      cancelText,
      success: (res) => {
        if (res.confirm && onConfirm) {
          onConfirm();
        } else if (res.cancel && onCancel) {
          onCancel();
        }
      }
    });
  }
  
  /**
   * 检查网络是否为弱网
   * @returns {Boolean}
   */
  isWeakNetwork() {
    return ['2g', '3g'].includes(this.networkType);
  }
  
  /**
   * 检查网络是否连接
   * @returns {Boolean}
   */
  isNetworkConnected() {
    return this.isConnected;
  }
  
  /**
   * 获取网络类型
   * @returns {String}
   */
  getNetworkType() {
    return this.networkType;
  }
  
  /**
   * 上传文件（带重试）
   * @param {Object} options - 上传选项
   * @returns {Promise}
   */
  async uploadFileWithRetry(options) {
    return this.executeWithRetry(
      () => wx.cloud.uploadFile(options),
      {
        maxRetries: 3,
        retryDelay: 2000
      }
    );
  }
  
  /**
   * 调用云函数（带重试）
   * @param {Object} options - 云函数选项
   * @returns {Promise}
   */
  async callFunctionWithRetry(options) {
    return this.executeWithRetry(
      () => wx.cloud.callFunction(options),
      {
        maxRetries: 2,
        retryDelay: 1500
      }
    );
  }
  
  /**
   * 数据库操作（带重试）
   * @param {Function} dbOperation - 数据库操作函数
   * @returns {Promise}
   */
  async databaseOperationWithRetry(dbOperation) {
    return this.executeWithRetry(
      dbOperation,
      {
        maxRetries: 2,
        retryDelay: 1000
      }
    );
  }
}

// 导出单例
module.exports = new NetworkHandler();