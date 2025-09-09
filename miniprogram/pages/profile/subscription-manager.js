// 个人中心的订阅管理功能
const { canSilentSubscribe, requestSubscribeMessage, recordSubscription, getEngineerTemplateIds } = require('../../utils/wxp');

// 订阅管理器
const SubscriptionManager = {
  // 检查当前订阅状态
  async checkSubscriptionStatus() {
    try {
      // 获取用户角色
      const userInfo = wx.getStorageSync('userInfo');
      if (!userInfo) return { needSubscribe: false, role: null };
      
      // 检查是否需要订阅
      const needSubscribe = ['工程师', '经理'].includes(userInfo.roleGroup);
      
      if (!needSubscribe) {
        return { needSubscribe: false, role: userInfo.roleGroup };
      }
      
      // 检查订阅配额
      const result = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: {
          action: 'checkSubscriptionQuota'
        }
      });
      
      return {
        needSubscribe: true,
        role: userInfo.roleGroup,
        quota: result.result?.quota || 0,
        canSilent: await canSilentSubscribe(Object.values(getEngineerTemplateIds()))
      };
    } catch (error) {
      console.error('检查订阅状态失败:', error);
      return { needSubscribe: false, error: error.message };
    }
  },
  
  // 主动请求订阅
  async requestSubscription(showTips = true) {
    try {
      const templates = getEngineerTemplateIds();
      const templateIds = Object.values(templates);
      
      const { acceptedTemplateIds, stats } = await requestSubscribeMessage(templateIds, showTips);
      
      if (acceptedTemplateIds.length > 0) {
        const typeMap = {};
        Object.entries(templates).forEach(([type, templateId]) => {
          typeMap[templateId] = type;
        });
        
        const result = await recordSubscription(acceptedTemplateIds, typeMap);
        
        return {
          success: true,
          acceptedCount: acceptedTemplateIds.length,
          stats
        };
      }
      
      return {
        success: false,
        stats
      };
    } catch (error) {
      console.error('请求订阅失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },
  
  // 定期提醒订阅（用于累积配额）
  scheduleSubscriptionReminder() {
    // 每周提醒一次
    const lastReminder = wx.getStorageSync('LAST_SUBSCRIPTION_REMINDER');
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    
    if (!lastReminder || Date.now() - lastReminder > oneWeek) {
      wx.showModal({
        title: '订阅提醒',
        content: '建议您定期订阅通知，以确保能及时收到工单消息',
        confirmText: '立即订阅',
        cancelText: '下次再说',
        success: async (res) => {
          if (res.confirm) {
            await this.requestSubscription(true);
          }
          wx.setStorageSync('LAST_SUBSCRIPTION_REMINDER', Date.now());
        }
      });
    }
  }
};

module.exports = SubscriptionManager;