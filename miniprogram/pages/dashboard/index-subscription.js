// dashboard 页面的订阅检查逻辑（可以集成到 dashboard/index.js）
const { canSilentSubscribe, requestSubscribeMessage, recordSubscription, getEngineerTemplateIds, shouldCheckSubscription } = require('../../utils/wxp');

// 在 Page 的 onShow 或 onLoad 中调用
async function checkAndRequestSubscription() {
  try {
    // 获取最新的用户信息（从数据库）
    const result = await wx.cloud.callFunction({
      name: 'userProfile',
      data: { action: 'get' }
    });
    
    if (!result.result?.success) return;
    
    const userInfo = result.result.data;
    
    // 检查是否是工程师或经理
    if (userInfo.roleGroup === '工程师' || userInfo.roleGroup === '经理') {
      // 检查是否需要提醒订阅（24小时检查一次）
      if (!shouldCheckSubscription()) {
        return;
      }
      
      // 检查是否已经订阅过
      const hasSubscribed = wx.getStorageSync('HAS_ENGINEER_SUBSCRIBED');
      if (hasSubscribed) {
        // 可以定期（如每周）清除这个标记，让用户重新订阅以累积配额
        const lastSubscribeTime = wx.getStorageSync('LAST_SUBSCRIBE_TIME');
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - lastSubscribeTime > oneWeek) {
          wx.removeStorageSync('HAS_ENGINEER_SUBSCRIBED');
        } else {
          return;
        }
      }
      
      const templates = getEngineerTemplateIds();
      const templateIds = Object.values(templates);
      
      // 检查是否可以静默请求
      const canSilent = await canSilentSubscribe(templateIds);
      
      if (canSilent) {
        // 静默请求
        const { acceptedTemplateIds } = await requestSubscribeMessage(templateIds, false);
        
        if (acceptedTemplateIds.length > 0) {
          const typeMap = {};
          Object.entries(templates).forEach(([type, templateId]) => {
            typeMap[templateId] = type;
          });
          
          await recordSubscription(acceptedTemplateIds, typeMap);
          wx.setStorageSync('HAS_ENGINEER_SUBSCRIBED', true);
          wx.setStorageSync('LAST_SUBSCRIBE_TIME', Date.now());
        }
      } else {
        // 显示提示，让用户主动订阅
        wx.showModal({
          title: '开启通知',
          content: '您已成为工程师，开启通知可及时收到工单消息',
          confirmText: '开启',
          cancelText: '稍后',
          success: async (res) => {
            if (res.confirm) {
              const { acceptedTemplateIds } = await requestSubscribeMessage(templateIds, true);
              
              if (acceptedTemplateIds.length > 0) {
                const typeMap = {};
                Object.entries(templates).forEach(([type, templateId]) => {
                  typeMap[templateId] = type;
                });
                
                await recordSubscription(acceptedTemplateIds, typeMap);
                wx.setStorageSync('HAS_ENGINEER_SUBSCRIBED', true);
                wx.setStorageSync('LAST_SUBSCRIBE_TIME', Date.now());
                
                wx.showToast({
                  title: '订阅成功',
                  icon: 'success'
                });
              }
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('检查订阅失败:', error);
  }
}

module.exports = {
  checkAndRequestSubscription
};