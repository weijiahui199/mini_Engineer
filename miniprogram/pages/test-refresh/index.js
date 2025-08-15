// 测试智能刷新机制的页面
const RefreshManager = require('../../utils/refresh-manager');
const UserCache = require('../../utils/user-cache');

Page({
  data: {
    refreshStats: {},
    cacheInfo: {},
    userInfo: null,
    testResults: [],
    lastRefreshTime: ''
  },

  onLoad() {
    this.app = getApp();
    this.loadData();
  },

  onShow() {
    RefreshManager.setPageActive('test-refresh', true);
    this.updateStats();
  },

  onHide() {
    RefreshManager.setPageActive('test-refresh', false);
  },

  // 加载数据
  loadData() {
    this.updateStats();
    this.loadUserInfo();
  },

  // 更新统计信息
  updateStats() {
    const stats = RefreshManager.getStats();
    const cacheInfo = this.getCacheInfo();
    
    this.setData({
      refreshStats: stats,
      cacheInfo: cacheInfo,
      lastRefreshTime: new Date().toLocaleTimeString()
    });
  },

  // 获取缓存信息
  getCacheInfo() {
    const storageInfo = wx.getStorageInfoSync();
    const userCacheValid = UserCache.isCacheValid();
    const remainingTime = UserCache.getCacheRemainingTime();
    
    return {
      size: (storageInfo.currentSize / 1024).toFixed(2) + 'MB',
      keys: storageInfo.keys.length,
      userCacheValid: userCacheValid,
      userCacheRemaining: remainingTime + '分钟'
    };
  },

  // 加载用户信息
  async loadUserInfo() {
    const userInfo = await UserCache.getUserInfo(false);
    this.setData({ userInfo });
  },

  // 测试智能刷新决策
  testSmartRefresh() {
    const decisions = RefreshManager.makeRefreshDecision('test-page', ['userInfo', 'dashboard', 'ticketList']);
    
    const result = {
      time: new Date().toLocaleTimeString(),
      decisions: decisions,
      message: '智能刷新决策测试完成'
    };
    
    this.addTestResult(result);
  },

  // 测试强制刷新标记
  testForceRefresh() {
    // 设置强制刷新标记
    RefreshManager.setForceRefreshFlag('userInfo');
    
    // 检查决策
    const decision = RefreshManager.shouldRefresh('userInfo');
    
    const result = {
      time: new Date().toLocaleTimeString(),
      forceFlag: true,
      decision: decision,
      message: '强制刷新标记测试完成'
    };
    
    this.addTestResult(result);
    this.updateStats();
  },

  // 测试事件触发刷新
  testEventTrigger() {
    // 触发用户信息更新事件
    this.app.eventBus.emit(this.app.EVENTS.USER_INFO_UPDATED, {
      test: true,
      timestamp: Date.now()
    });
    
    // 等待一下让事件处理完成
    setTimeout(() => {
      const decisions = RefreshManager.makeRefreshDecision('test-page', ['userInfo']);
      
      const result = {
        time: new Date().toLocaleTimeString(),
        event: 'USER_INFO_UPDATED',
        decisions: decisions,
        message: '事件触发刷新测试完成'
      };
      
      this.addTestResult(result);
      this.updateStats();
    }, 100);
  },

  // 测试缓存刷新
  async testCacheRefresh() {
    // 清除用户缓存
    UserCache.clearCache();
    
    // 重新加载
    const userInfo = await UserCache.getUserInfo(true);
    
    const result = {
      time: new Date().toLocaleTimeString(),
      action: '清除并重新加载缓存',
      userInfo: userInfo ? '成功' : '失败',
      message: '缓存刷新测试完成'
    };
    
    this.addTestResult(result);
    this.updateStats();
    this.loadUserInfo();
  },

  // 测试最小刷新间隔
  testMinInterval() {
    // 记录第一次刷新
    RefreshManager.recordRefresh('userInfo');
    
    // 立即尝试第二次刷新
    const decision1 = RefreshManager.shouldRefresh('userInfo');
    
    // 等待35秒后再试（超过最小间隔）
    wx.showModal({
      title: '提示',
      content: '将在35秒后进行第二次测试',
      showCancel: false,
      success: () => {
        wx.showLoading({ title: '等待中...' });
        
        setTimeout(() => {
          wx.hideLoading();
          const decision2 = RefreshManager.shouldRefresh('userInfo');
          
          const result = {
            time: new Date().toLocaleTimeString(),
            immediate: decision1,
            after35s: decision2,
            message: '最小刷新间隔测试完成'
          };
          
          this.addTestResult(result);
          this.updateStats();
        }, 35000);
      }
    });
  },

  // 清理测试数据
  clearTests() {
    RefreshManager.reset();
    this.setData({
      testResults: []
    });
    this.updateStats();
    
    wx.showToast({
      title: '已清理',
      icon: 'success'
    });
  },

  // 添加测试结果
  addTestResult(result) {
    const results = this.data.testResults;
    results.unshift(result);
    if (results.length > 10) {
      results.pop();
    }
    this.setData({ testResults: results });
  },

  // 手动刷新
  onRefresh() {
    this.loadData();
    wx.showToast({
      title: '已刷新',
      icon: 'success'
    });
  }
});