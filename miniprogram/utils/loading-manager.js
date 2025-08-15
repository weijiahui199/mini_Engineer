// 加载状态管理器
// 优化弱网环境下的用户体验

class LoadingManager {
  constructor() {
    // 加载状态配置
    this.config = {
      timeout: 30000,        // 默认超时时间（30秒）
      minShowTime: 500,      // 最小显示时间（避免闪烁）
      slowNetworkTime: 3000  // 慢网络判定时间（3秒）
    };
    
    // 当前加载状态
    this.loadingStack = [];
    this.currentLoading = null;
    this.slowNetworkTimer = null;
  }
  
  /**
   * 显示加载提示
   * @param {Object} options - 加载选项
   * @returns {String} loadingId - 用于关闭的ID
   */
  show(options = {}) {
    const {
      title = '加载中...',
      mask = true,
      timeout = this.config.timeout,
      slowNetworkMessage = '网络较慢，请耐心等待...',
      onTimeout = null
    } = options;
    
    // 生成唯一ID
    const loadingId = `loading_${Date.now()}_${Math.random()}`;
    
    // 创建加载项
    const loadingItem = {
      id: loadingId,
      title,
      mask,
      timeout,
      slowNetworkMessage,
      onTimeout,
      startTime: Date.now(),
      timeoutTimer: null,
      slowNetworkTimer: null
    };
    
    // 添加到栈
    this.loadingStack.push(loadingItem);
    
    // 如果是第一个，立即显示
    if (this.loadingStack.length === 1) {
      this._showLoading(loadingItem);
    }
    
    // 设置超时处理
    if (timeout > 0) {
      loadingItem.timeoutTimer = setTimeout(() => {
        this._handleTimeout(loadingId);
      }, timeout);
    }
    
    // 设置慢网络提示
    loadingItem.slowNetworkTimer = setTimeout(() => {
      this._showSlowNetworkTip(loadingId, slowNetworkMessage);
    }, this.config.slowNetworkTime);
    
    return loadingId;
  }
  
  /**
   * 隐藏加载提示
   * @param {String} loadingId - 加载ID
   */
  hide(loadingId) {
    if (!loadingId) {
      // 如果没有ID，隐藏最上层的
      if (this.loadingStack.length > 0) {
        loadingId = this.loadingStack[this.loadingStack.length - 1].id;
      } else {
        wx.hideLoading();
        return;
      }
    }
    
    // 查找并移除
    const index = this.loadingStack.findIndex(item => item.id === loadingId);
    if (index === -1) return;
    
    const loadingItem = this.loadingStack[index];
    
    // 清理定时器
    if (loadingItem.timeoutTimer) {
      clearTimeout(loadingItem.timeoutTimer);
    }
    if (loadingItem.slowNetworkTimer) {
      clearTimeout(loadingItem.slowNetworkTimer);
    }
    
    // 检查最小显示时间
    const showTime = Date.now() - loadingItem.startTime;
    const remainTime = this.config.minShowTime - showTime;
    
    if (remainTime > 0) {
      // 延迟隐藏，避免闪烁
      setTimeout(() => {
        this._removeLoading(index);
      }, remainTime);
    } else {
      this._removeLoading(index);
    }
  }
  
  /**
   * 隐藏所有加载提示
   */
  hideAll() {
    // 清理所有定时器
    this.loadingStack.forEach(item => {
      if (item.timeoutTimer) clearTimeout(item.timeoutTimer);
      if (item.slowNetworkTimer) clearTimeout(item.slowNetworkTimer);
    });
    
    // 清空栈
    this.loadingStack = [];
    this.currentLoading = null;
    
    // 隐藏loading
    wx.hideLoading();
  }
  
  /**
   * 显示加载提示（内部方法）
   * @param {Object} loadingItem - 加载项
   */
  _showLoading(loadingItem) {
    this.currentLoading = loadingItem;
    wx.showLoading({
      title: loadingItem.title,
      mask: loadingItem.mask
    });
  }
  
  /**
   * 移除加载项（内部方法）
   * @param {Number} index - 索引
   */
  _removeLoading(index) {
    this.loadingStack.splice(index, 1);
    
    if (this.loadingStack.length === 0) {
      // 没有其他loading了，隐藏
      this.currentLoading = null;
      wx.hideLoading();
    } else {
      // 显示下一个
      const nextLoading = this.loadingStack[this.loadingStack.length - 1];
      if (this.currentLoading !== nextLoading) {
        this._showLoading(nextLoading);
      }
    }
  }
  
  /**
   * 处理超时（内部方法）
   * @param {String} loadingId - 加载ID
   */
  _handleTimeout(loadingId) {
    const loadingItem = this.loadingStack.find(item => item.id === loadingId);
    if (!loadingItem) return;
    
    // 隐藏loading
    this.hide(loadingId);
    
    // 显示超时提示
    wx.showModal({
      title: '操作超时',
      content: '操作超时，请检查网络后重试',
      showCancel: false,
      confirmText: '确定',
      success: () => {
        if (loadingItem.onTimeout) {
          loadingItem.onTimeout();
        }
      }
    });
  }
  
  /**
   * 显示慢网络提示（内部方法）
   * @param {String} loadingId - 加载ID
   * @param {String} message - 提示消息
   */
  _showSlowNetworkTip(loadingId, message) {
    const loadingItem = this.loadingStack.find(item => item.id === loadingId);
    if (!loadingItem) return;
    
    // 如果还在加载中，更新提示文字
    if (this.currentLoading === loadingItem) {
      wx.showLoading({
        title: message,
        mask: loadingItem.mask
      });
    }
  }
  
  /**
   * 显示进度加载
   * @param {Object} options - 选项
   * @returns {Object} 进度控制器
   */
  showProgress(options = {}) {
    const {
      title = '处理中',
      totalSteps = 100,
      onCancel = null
    } = options;
    
    let currentStep = 0;
    let cancelled = false;
    const loadingId = this.show({
      title: `${title} (0%)`,
      mask: true,
      timeout: 0 // 不自动超时
    });
    
    // 返回进度控制器
    return {
      // 更新进度
      update: (step, customTitle) => {
        if (cancelled) return;
        
        currentStep = Math.min(step, totalSteps);
        const percent = Math.round((currentStep / totalSteps) * 100);
        const newTitle = customTitle || `${title} (${percent}%)`;
        
        // 更新显示
        const loadingItem = this.loadingStack.find(item => item.id === loadingId);
        if (loadingItem && this.currentLoading === loadingItem) {
          wx.showLoading({
            title: newTitle,
            mask: true
          });
        }
      },
      
      // 完成
      complete: () => {
        if (cancelled) return;
        this.hide(loadingId);
      },
      
      // 取消
      cancel: () => {
        cancelled = true;
        this.hide(loadingId);
        if (onCancel) onCancel();
      },
      
      // 是否已取消
      isCancelled: () => cancelled
    };
  }
  
  /**
   * 显示Toast提示（自动判断图标）
   * @param {String} message - 消息
   * @param {String} type - 类型：success/error/warning/info
   * @param {Number} duration - 持续时间
   */
  showToast(message, type = 'info', duration = 2000) {
    const iconMap = {
      success: 'success',
      error: 'error',
      warning: 'none',
      info: 'none'
    };
    
    wx.showToast({
      title: message,
      icon: iconMap[type] || 'none',
      duration
    });
  }
  
  /**
   * 显示操作成功提示
   * @param {String} message - 消息
   */
  showSuccess(message = '操作成功') {
    this.showToast(message, 'success');
  }
  
  /**
   * 显示操作失败提示
   * @param {String} message - 消息
   */
  showError(message = '操作失败') {
    this.showToast(message, 'error');
  }
  
  /**
   * 显示警告提示
   * @param {String} message - 消息
   */
  showWarning(message) {
    this.showToast(message, 'warning', 3000);
  }
  
  /**
   * 显示信息提示
   * @param {String} message - 消息
   */
  showInfo(message) {
    this.showToast(message, 'info');
  }
}

// 导出单例
module.exports = new LoadingManager();