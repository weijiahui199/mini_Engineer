// utils/wxp.js - Promise适配层和订阅管理工具

// Promise化封装
export const wxp = new Proxy({}, {
  get(_, key) {
    return (opts = {}) => new Promise((resolve, reject) => {
      wx[key]({
        ...opts,
        success: resolve,
        fail: reject,
      });
    });
  }
});

// 检查是否可以静默请求订阅（用户已"总是保持接受"）
export async function canSilentSubscribe(templateIds = []) {
  try {
    const { subscriptionsSetting } = await wxp.getSetting();
    if (!subscriptionsSetting || !subscriptionsSetting.mainSwitch) {
      return false;
    }
    const items = subscriptionsSetting.itemSettings || {};
    // 需要所有模板均为 'accept' 才认为可静默
    return templateIds.every(id => items[id] === 'accept');
  } catch (error) {
    console.error('检查订阅设置失败:', error);
    return false;
  }
}

// 请求订阅消息
export async function requestSubscribeMessage(templateIds, showTips = false) {
  try {
    // 首次使用时显示引导
    if (showTips) {
      const hasGuided = wx.getStorageSync('SUBSCRIBE_GUIDED');
      if (!hasGuided) {
        await wxp.showModal({
          title: '订阅消息提示',
          content: '建议您勾选"总是保持以上选择"，这样可以及时收到工单通知',
          confirmText: '知道了',
          showCancel: false
        });
        wx.setStorageSync('SUBSCRIBE_GUIDED', true);
      }
    }
    
    // 请求订阅
    const res = await wxp.requestSubscribeMessage({
      tmplIds: templateIds
    });
    
    // 统计接受的模板
    const acceptedTemplateIds = Object.entries(res || {})
      .filter(([_, status]) => status === 'accept')
      .map(([templateId]) => templateId);
    
    // 处理拒绝和禁用的情况
    const stats = { accept: 0, reject: 0, ban: 0 };
    Object.values(res || {}).forEach(status => {
      if (stats[status] !== undefined) stats[status]++;
    });
    
    // 如果有禁用的模板，提示用户
    if (stats.ban > 0) {
      wx.showModal({
        title: '订阅被关闭',
        content: '请在设置中开启订阅消息权限以便接收通知',
        confirmText: '去设置',
        success: (result) => {
          if (result.confirm) {
            wx.openSetting();
          }
        }
      });
    }
    
    return {
      acceptedTemplateIds,
      stats,
      success: acceptedTemplateIds.length > 0
    };
  } catch (error) {
    console.error('请求订阅失败:', error);
    return {
      acceptedTemplateIds: [],
      stats: { accept: 0, reject: 0, ban: 0 },
      success: false,
      error: error.message
    };
  }
}

// 记录订阅到云函数
export async function recordSubscription(acceptedTemplateIds, typeMap) {
  if (!acceptedTemplateIds || acceptedTemplateIds.length === 0) {
    return { success: false, message: '没有需要记录的订阅' };
  }
  
  try {
    const result = await wx.cloud.callFunction({
      name: 'recordSubscription',
      data: {
        acceptedTemplateIds,
        typeMap
      }
    });
    
    if (result.result && result.result.code === 200) {
      // 记录最后订阅时间
      wx.setStorageSync('SUBSCRIBE_LAST_CHECK_AT', Date.now());
      return { success: true, added: result.result.added };
    }
    
    return { success: false, message: result.result?.message || '记录失败' };
  } catch (error) {
    console.error('记录订阅失败:', error);
    return { success: false, error: error.message };
  }
}

// 检查是否需要提醒订阅（24小时检查一次）
export function shouldCheckSubscription() {
  const lastCheck = wx.getStorageSync('SUBSCRIBE_LAST_CHECK_AT');
  if (!lastCheck) return true;
  
  const dayInMs = 24 * 60 * 60 * 1000;
  return Date.now() - lastCheck > dayInMs;
}

// 获取工程师端模板ID（已替换为实际的模板ID）
export function getEngineerTemplateIds() {
  return {
    new_ticket: 'A5RmnL45TNMGA7a7MYeL7jSPOHuIVprbbVKqwvZsZ2c',      // 待接单提醒（模板编号：28000）
    ticket_cancelled: 'CHwAIAdTsyFcH1yP108bo3M3oCQccy2MmkDA82UhRYQ',  // 服务取消通知（模板编号：30749）
    manager_notice: 'TEMPLATE_ID_MANAGER'       // 经理通知模板ID（待申请）
  };
}

// 导出默认对象
export default {
  wxp,
  canSilentSubscribe,
  requestSubscribeMessage,
  recordSubscription,
  shouldCheckSubscription,
  getEngineerTemplateIds
};