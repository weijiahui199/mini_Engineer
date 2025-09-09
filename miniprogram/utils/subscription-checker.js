// 全局订阅检查器
const { canSilentSubscribe, requestSubscribeMessage, recordSubscription, getEngineerTemplateIds, shouldCheckSubscription } = require('./wxp');

class SubscriptionChecker {
  constructor() {
    this.checking = false;
    this.lastCheckTime = 0;
    this.checkInterval = 60 * 60 * 1000; // 1小时检查一次
  }
  
  // 初始化（在 app.js 中调用）
  init() {
    // 监听页面切换
    wx.onAppShow(() => {
      this.checkIfNeeded();
    });
    
    // 定时检查
    setInterval(() => {
      this.checkIfNeeded();
    }, this.checkInterval);
  }
  
  // 检查是否需要订阅
  async checkIfNeeded() {
    // 防止重复检查
    if (this.checking) return;
    
    // 检查时间间隔
    if (Date.now() - this.lastCheckTime < this.checkInterval) return;
    
    this.checking = true;
    this.lastCheckTime = Date.now();
    
    try {
      // 获取最新用户信息
      const userInfo = await this.fetchLatestUserInfo();
      
      if (!userInfo) {
        this.checking = false;
        return;
      }
      
      // 检查角色变化
      const oldRole = wx.getStorageSync('LAST_KNOWN_ROLE');
      const currentRole = userInfo.roleGroup;
      
      // 角色发生变化，从普通用户变为工程师/经理
      if (oldRole !== currentRole && ['工程师', '经理'].includes(currentRole)) {
        wx.setStorageSync('LAST_KNOWN_ROLE', currentRole);
        
        // 显示角色变更通知
        wx.showModal({
          title: '角色变更',
          content: `您的角色已变更为${currentRole}，是否开启工单通知？`,
          confirmText: '开启',
          cancelText: '稍后',
          success: (res) => {
            if (res.confirm) {
              this.requestSubscriptionForRole(currentRole);
            }
          }
        });
      }
      
      // 定期检查订阅配额
      else if (['工程师', '经理'].includes(currentRole)) {
        await this.checkSubscriptionQuota(currentRole);
      }
      
    } catch (error) {
      console.error('订阅检查失败:', error);
    } finally {
      this.checking = false;
    }
  }
  
  // 获取最新用户信息
  async fetchLatestUserInfo() {
    try {
      const result = await wx.cloud.callFunction({
        name: 'userProfile',
        data: { action: 'get' }
      });
      
      if (result.result?.success) {
        const userInfo = result.result.data;
        wx.setStorageSync('userInfo', userInfo);
        return userInfo;
      }
      
      return null;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return wx.getStorageSync('userInfo');
    }
  }
  
  // 检查订阅配额
  async checkSubscriptionQuota(role) {
    try {
      // 检查本地记录的配额检查时间
      const lastQuotaCheck = wx.getStorageSync('LAST_QUOTA_CHECK');
      const threeDays = 3 * 24 * 60 * 60 * 1000;
      
      if (lastQuotaCheck && Date.now() - lastQuotaCheck < threeDays) {
        return;
      }
      
      // 检查云端配额
      const result = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: {
          action: 'getSubscriptionQuota'
        }
      });
      
      const quota = result.result?.quota || 0;
      
      // 配额不足时提醒
      if (quota < 3) {
        wx.showToast({
          title: '通知配额不足，建议订阅',
          icon: 'none',
          duration: 3000
        });
        
        // 延迟显示订阅按钮
        setTimeout(() => {
          this.showSubscriptionButton();
        }, 3000);
      }
      
      wx.setStorageSync('LAST_QUOTA_CHECK', Date.now());
    } catch (error) {
      console.error('检查配额失败:', error);
    }
  }
  
  // 为角色请求订阅
  async requestSubscriptionForRole(role) {
    const templates = getEngineerTemplateIds();
    const templateIds = Object.values(templates);
    
    const { acceptedTemplateIds } = await requestSubscribeMessage(templateIds, true);
    
    if (acceptedTemplateIds.length > 0) {
      const typeMap = {};
      Object.entries(templates).forEach(([type, templateId]) => {
        typeMap[templateId] = type;
      });
      
      await recordSubscription(acceptedTemplateIds, typeMap);
      
      wx.showToast({
        title: '订阅成功',
        icon: 'success'
      });
    }
  }
  
  // 在当前页面显示订阅按钮
  showSubscriptionButton() {
    // 获取当前页面实例
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      
      // 如果页面有显示订阅按钮的方法
      if (typeof currentPage.showSubscriptionButton === 'function') {
        currentPage.showSubscriptionButton();
      }
    }
  }
}

// 导出单例
module.exports = new SubscriptionChecker();