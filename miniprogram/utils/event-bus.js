// 全局事件总线
// 用于跨页面通信和状态同步

class EventBus {
  constructor() {
    // 事件存储对象
    this.events = {};
    // 使用WeakMap存储上下文，避免循环引用
    this.contexts = new WeakMap();
    // 调试模式
    this.debug = true;
    // 监听器ID计数器
    this.listenerIdCounter = 0;
  }
  
  /**
   * 注册事件监听
   * @param {String} eventName 事件名称
   * @param {Function} callback 回调函数
   * @param {Object} context 上下文对象（通常是页面实例）
   * @returns {String} 监听器ID，用于移除监听
   */
  on(eventName, callback, context) {
    if (!eventName || !callback) {
      console.error('[EventBus] 事件名和回调函数不能为空');
      return null;
    }
    
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    
    // 生成唯一的监听器ID
    const listenerId = `listener_${++this.listenerIdCounter}`;
    
    // 检查是否重复注册
    const exists = this.events[eventName].some(item => {
      if (item.callback === callback) {
        // 如果有context，检查context是否相同
        if (context && item.contextId) {
          const storedContext = this.contexts.get(item);
          return storedContext === context;
        }
        // 没有context的情况
        return !item.contextId;
      }
      return false;
    });
    
    if (!exists) {
      const listener = {
        id: listenerId,
        callback,
        contextId: context ? listenerId : null
      };
      
      // 如果有context，存储到WeakMap中
      if (context) {
        this.contexts.set(listener, context);
      }
      
      this.events[eventName].push(listener);
      
      if (this.debug) {
        console.log(`[EventBus] 注册事件: ${eventName}, ID: ${listenerId}, 当前监听数: ${this.events[eventName].length}`);
      }
      
      return listenerId;
    }
    
    return null;
  }
  
  /**
   * 触发事件
   * @param {String} eventName 事件名称
   * @param {Any} data 传递的数据
   */
  emit(eventName, data) {
    if (!this.events[eventName]) {
      if (this.debug) {
        console.log(`[EventBus] 事件 ${eventName} 没有监听者`);
      }
      return;
    }
    
    if (this.debug) {
      console.log(`[EventBus] 触发事件: ${eventName}, 监听者数量: ${this.events[eventName].length}`, data);
    }
    
    // 复制一份监听器数组，防止在回调中修改原数组
    const listeners = [...this.events[eventName]];
    
    listeners.forEach((listener) => {
      try {
        const { callback, contextId } = listener;
        
        // 从WeakMap中获取context
        if (contextId) {
          const context = this.contexts.get(listener);
          if (context) {
            callback.call(context, data);
          } else {
            // context已被垃圾回收，移除该监听器
            if (this.debug) {
              console.log(`[EventBus] Context已被回收，移除监听器: ${listener.id}`);
            }
            this.removeListenerById(eventName, listener.id);
          }
        } else {
          callback(data);
        }
      } catch (error) {
        console.error(`[EventBus] 事件 ${eventName} 处理出错:`, error);
      }
    });
  }
  
  /**
   * 移除事件监听
   * @param {String} eventName 事件名称
   * @param {Function|String} callbackOrId 回调函数或监听器ID
   * @param {Object} context 上下文对象
   */
  off(eventName, callbackOrId, context) {
    if (!this.events[eventName]) {
      return;
    }
    
    // 如果是监听器ID
    if (typeof callbackOrId === 'string') {
      this.removeListenerById(eventName, callbackOrId);
      return;
    }
    
    const callback = callbackOrId;
    
    if (!callback) {
      // 如果没有指定回调，移除该事件的所有监听
      // 清理WeakMap中的引用
      this.events[eventName].forEach(listener => {
        if (listener.contextId) {
          this.contexts.delete(listener);
        }
      });
      delete this.events[eventName];
      if (this.debug) {
        console.log(`[EventBus] 移除事件 ${eventName} 的所有监听`);
      }
      return;
    }
    
    // 移除特定的回调
    this.events[eventName] = this.events[eventName].filter(listener => {
      const shouldRemove = context ? 
        (listener.callback === callback && listener.contextId && this.contexts.get(listener) === context) :
        (listener.callback === callback && !listener.contextId);
      
      if (shouldRemove) {
        // 清理WeakMap中的引用
        if (listener.contextId) {
          this.contexts.delete(listener);
        }
        return false;
      }
      return true;
    });
    
    // 如果没有监听器了，删除事件
    if (this.events[eventName].length === 0) {
      delete this.events[eventName];
    }
    
    if (this.debug) {
      console.log(`[EventBus] 移除事件监听: ${eventName}, 剩余监听数: ${this.events[eventName]?.length || 0}`);
    }
  }
  
  /**
   * 移除某个上下文的所有事件监听
   * @param {Object} context 上下文对象
   */
  offAll(context) {
    if (!context) return;
    
    Object.keys(this.events).forEach(eventName => {
      this.events[eventName] = this.events[eventName].filter(listener => {
        if (listener.contextId) {
          const storedContext = this.contexts.get(listener);
          if (storedContext === context) {
            // 清理WeakMap中的引用
            this.contexts.delete(listener);
            return false;
          }
        }
        return true;
      });
      
      if (this.events[eventName].length === 0) {
        delete this.events[eventName];
      }
    });
    
    if (this.debug) {
      console.log('[EventBus] 移除上下文的所有事件监听');
    }
  }
  
  /**
   * 根据ID移除监听器
   * @param {String} eventName 事件名称
   * @param {String} listenerId 监听器ID
   */
  removeListenerById(eventName, listenerId) {
    if (!this.events[eventName]) return;
    
    this.events[eventName] = this.events[eventName].filter(listener => {
      if (listener.id === listenerId) {
        // 清理WeakMap中的引用
        if (listener.contextId) {
          this.contexts.delete(listener);
        }
        return false;
      }
      return true;
    });
    
    if (this.events[eventName].length === 0) {
      delete this.events[eventName];
    }
  }
  
  /**
   * 一次性事件监听
   * @param {String} eventName 事件名称
   * @param {Function} callback 回调函数
   * @param {Object} context 上下文对象
   * @returns {String} 监听器ID
   */
  once(eventName, callback, context) {
    let listenerId;
    const onceWrapper = (data) => {
      callback.call(context, data);
      this.off(eventName, listenerId);
    };
    
    listenerId = this.on(eventName, onceWrapper, context);
    return listenerId;
  }
  
  /**
   * 清空所有事件
   */
  clear() {
    // 清理所有WeakMap引用
    Object.keys(this.events).forEach(eventName => {
      this.events[eventName].forEach(listener => {
        if (listener.contextId) {
          this.contexts.delete(listener);
        }
      });
    });
    
    this.events = {};
    this.listenerIdCounter = 0;
    
    if (this.debug) {
      console.log('[EventBus] 清空所有事件');
    }
  }
  
  /**
   * 获取事件监听器数量
   * @param {String} eventName 事件名称
   */
  getListenerCount(eventName) {
    return this.events[eventName]?.length || 0;
  }
}

// 事件名称常量，避免拼写错误
const EVENTS = {
  AVATAR_UPDATED: 'avatar-updated',           // 头像更新
  USER_INFO_UPDATED: 'user-info-updated',     // 用户信息更新
  USER_LOGOUT: 'user-logout',                 // 用户登出
  CACHE_CLEARED: 'cache-cleared',             // 缓存清除
  THEME_CHANGED: 'theme-changed'              // 主题切换
};

// 导出
module.exports = {
  EventBus,
  EVENTS
};