// 实时数据管理器
class RealtimeManager {
  constructor() {
    this.watchers = new Map();
    this.db = null;
    this.isInitialized = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
  }
  
  /**
   * 初始化实时管理器
   */
  init() {
    if (this.isInitialized) return;
    
    const app = getApp();
    this.db = app.globalData.db || wx.cloud.database();
    this.isInitialized = true;
    
    console.log('✅ 实时管理器初始化成功');
    
    // 监听网络状态变化
    this.setupNetworkListener();
  }
  
  /**
   * 设置网络状态监听
   */
  setupNetworkListener() {
    wx.onNetworkStatusChange((res) => {
      console.log('网络状态变化:', res.isConnected ? '已连接' : '已断开');
      
      if (res.isConnected && this.watchers.size > 0) {
        // 网络恢复，重新连接所有监听器
        this.reconnectAllWatchers();
      }
    });
  }
  
  /**
   * 监听工单列表变化
   * @param {Object} query - 查询条件
   * @param {Function} onChange - 变化回调
   * @returns {string} 监听器ID
   */
  watchTickets(query, onChange) {
    if (!this.isInitialized) this.init();
    
    const watcherId = `tickets_${Date.now()}_${Math.random()}`;
    
    try {
      // 创建数据库监听
      const watcher = this.db.collection('tickets')
        .where(query)
        .watch({
          onChange: (snapshot) => {
            this.handleTicketChange(snapshot, onChange);
          },
          onError: (err) => {
            this.handleWatchError(watcherId, err);
          }
        });
      
      // 保存监听器信息
      this.watchers.set(watcherId, {
        watcher,
        collection: 'tickets',
        query,
        onChange,
        retryCount: 0
      });
      
      console.log(`📡 开始监听工单变化 [${watcherId}]`);
      return watcherId;
      
    } catch (error) {
      console.error('创建工单监听失败:', error);
      this.handleWatchError(watcherId, error);
      return null;
    }
  }
  
  /**
   * 监听单个工单详情变化
   * @param {string} ticketId - 工单ID
   * @param {Function} onChange - 变化回调
   * @returns {string} 监听器ID
   */
  watchTicketDetail(ticketId, onChange) {
    if (!this.isInitialized) this.init();
    
    const watcherId = `ticket_detail_${ticketId}`;
    
    try {
      const watcher = this.db.collection('tickets')
        .doc(ticketId)
        .watch({
          onChange: (snapshot) => {
            this.handleTicketDetailChange(snapshot, onChange);
          },
          onError: (err) => {
            this.handleWatchError(watcherId, err);
          }
        });
      
      this.watchers.set(watcherId, {
        watcher,
        collection: 'tickets',
        docId: ticketId,
        onChange,
        retryCount: 0
      });
      
      console.log(`📡 开始监听工单详情 [${ticketId}]`);
      return watcherId;
      
    } catch (error) {
      console.error('创建工单详情监听失败:', error);
      return null;
    }
  }
  
  /**
   * 监听通知消息
   * @param {string} userId - 用户ID
   * @param {Function} onChange - 变化回调
   * @returns {string} 监听器ID
   */
  watchNotifications(userId, onChange) {
    if (!this.isInitialized) this.init();
    
    const watcherId = `notifications_${userId}`;
    
    try {
      const watcher = this.db.collection('notifications')
        .where({
          toUser: userId,
          read: false
        })
        .orderBy('createTime', 'desc')
        .limit(10)
        .watch({
          onChange: (snapshot) => {
            this.handleNotificationChange(snapshot, onChange);
          },
          onError: (err) => {
            this.handleWatchError(watcherId, err);
          }
        });
      
      this.watchers.set(watcherId, {
        watcher,
        collection: 'notifications',
        userId,
        onChange,
        retryCount: 0
      });
      
      console.log(`📡 开始监听通知消息 [${userId}]`);
      return watcherId;
      
    } catch (error) {
      console.error('创建通知监听失败:', error);
      return null;
    }
  }
  
  /**
   * 处理工单列表变化
   * @param {Object} snapshot - 数据快照
   * @param {Function} onChange - 回调函数
   */
  handleTicketChange(snapshot, onChange) {
    console.log('工单列表变化:', snapshot.type);
    
    const { docs, docChanges, type } = snapshot;
    
    // 格式化变化数据
    const changes = {
      type: type,
      docs: docs,
      added: [],
      updated: [],
      removed: []
    };
    
    // 分类变化类型
    docChanges.forEach(change => {
      const doc = change.doc;
      switch(change.dataType) {
        case 'add':
          changes.added.push(doc);
          break;
        case 'update':
          changes.updated.push(doc);
          break;
        case 'remove':
          changes.removed.push(doc);
          break;
      }
    });
    
    // 触发回调
    if (onChange) {
      onChange(changes);
    }
    
    // 显示提示
    this.showChangeNotification(changes);
  }
  
  /**
   * 处理工单详情变化
   * @param {Object} snapshot - 数据快照
   * @param {Function} onChange - 回调函数
   */
  handleTicketDetailChange(snapshot, onChange) {
    console.log('工单详情变化:', snapshot.type);
    
    const { docs } = snapshot;
    
    if (docs && docs.length > 0) {
      const ticketData = docs[0];
      
      // 触发回调
      if (onChange) {
        onChange({
          type: snapshot.type,
          data: ticketData
        });
      }
      
      // 显示状态变化提示
      if (snapshot.type === 'update') {
        wx.showToast({
          title: '工单状态已更新',
          icon: 'none',
          duration: 2000
        });
      }
    }
  }
  
  /**
   * 处理通知变化
   * @param {Object} snapshot - 数据快照
   * @param {Function} onChange - 回调函数
   */
  handleNotificationChange(snapshot, onChange) {
    console.log('通知消息变化:', snapshot.type);
    
    const { docs, docChanges } = snapshot;
    
    // 检查是否有新通知
    const newNotifications = docChanges.filter(
      change => change.dataType === 'add'
    ).map(change => change.doc);
    
    if (newNotifications.length > 0) {
      // 显示新通知提醒
      this.showNewNotificationAlert(newNotifications[0]);
    }
    
    // 触发回调
    if (onChange) {
      onChange({
        type: snapshot.type,
        notifications: docs,
        newCount: newNotifications.length
      });
    }
  }
  
  /**
   * 显示变化通知
   * @param {Object} changes - 变化数据
   */
  showChangeNotification(changes) {
    if (changes.added.length > 0) {
      wx.showToast({
        title: `新增${changes.added.length}个工单`,
        icon: 'none',
        duration: 2000
      });
    } else if (changes.updated.length > 0) {
      // 静默更新，不显示提示
      console.log(`更新了${changes.updated.length}个工单`);
    }
  }
  
  /**
   * 显示新通知提醒
   * @param {Object} notification - 通知对象
   */
  showNewNotificationAlert(notification) {
    wx.showModal({
      title: notification.title || '新通知',
      content: notification.message,
      confirmText: '查看',
      cancelText: '忽略',
      success: (res) => {
        if (res.confirm && notification.relatedId) {
          // 跳转到相关页面
          this.navigateToRelated(notification);
        }
      }
    });
  }
  
  /**
   * 跳转到相关页面
   * @param {Object} notification - 通知对象
   */
  navigateToRelated(notification) {
    switch(notification.relatedType) {
      case 'ticket':
        wx.navigateTo({
          url: `/pages/ticket-detail/index?id=${notification.relatedId}`
        });
        break;
      case 'help':
        wx.navigateTo({
          url: `/pages/help-detail/index?id=${notification.relatedId}`
        });
        break;
      default:
        console.log('未知的关联类型:', notification.relatedType);
    }
  }
  
  /**
   * 处理监听错误
   * @param {string} watcherId - 监听器ID
   * @param {Error} error - 错误对象
   */
  handleWatchError(watcherId, error) {
    console.error(`监听器错误 [${watcherId}]:`, error);
    
    const watcherInfo = this.watchers.get(watcherId);
    if (!watcherInfo) return;
    
    watcherInfo.retryCount++;
    
    // 判断是否需要重试
    if (watcherInfo.retryCount <= this.maxReconnectAttempts) {
      console.log(`尝试重连 [${watcherId}]，第${watcherInfo.retryCount}次`);
      
      setTimeout(() => {
        this.reconnectWatcher(watcherId);
      }, this.reconnectDelay * watcherInfo.retryCount);
    } else {
      console.error(`监听器 [${watcherId}] 重连失败，已达最大重试次数`);
      this.removeWatcher(watcherId);
    }
  }
  
  /**
   * 重连监听器
   * @param {string} watcherId - 监听器ID
   */
  reconnectWatcher(watcherId) {
    const watcherInfo = this.watchers.get(watcherId);
    if (!watcherInfo) return;
    
    // 先关闭旧连接
    if (watcherInfo.watcher) {
      watcherInfo.watcher.close();
    }
    
    // 根据类型重新创建监听
    if (watcherInfo.collection === 'tickets') {
      if (watcherInfo.docId) {
        this.watchTicketDetail(watcherInfo.docId, watcherInfo.onChange);
      } else if (watcherInfo.query) {
        this.watchTickets(watcherInfo.query, watcherInfo.onChange);
      }
    } else if (watcherInfo.collection === 'notifications') {
      this.watchNotifications(watcherInfo.userId, watcherInfo.onChange);
    }
  }
  
  /**
   * 重连所有监听器
   */
  reconnectAllWatchers() {
    console.log('重连所有监听器...');
    
    this.watchers.forEach((info, watcherId) => {
      this.reconnectWatcher(watcherId);
    });
  }
  
  /**
   * 移除监听器
   * @param {string} watcherId - 监听器ID
   */
  removeWatcher(watcherId) {
    const watcherInfo = this.watchers.get(watcherId);
    
    if (watcherInfo && watcherInfo.watcher) {
      try {
        watcherInfo.watcher.close();
        console.log(`📡 关闭监听器 [${watcherId}]`);
      } catch (error) {
        console.error('关闭监听器失败:', error);
      }
    }
    
    this.watchers.delete(watcherId);
  }
  
  /**
   * 移除所有监听器
   */
  removeAllWatchers() {
    console.log('关闭所有监听器...');
    
    this.watchers.forEach((info, watcherId) => {
      this.removeWatcher(watcherId);
    });
    
    this.watchers.clear();
  }
  
  /**
   * 获取监听器状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    const status = {
      initialized: this.isInitialized,
      activeWatchers: this.watchers.size,
      watchers: []
    };
    
    this.watchers.forEach((info, id) => {
      status.watchers.push({
        id,
        collection: info.collection,
        retryCount: info.retryCount
      });
    });
    
    return status;
  }
}

// 导出单例
module.exports = new RealtimeManager();