// 登录页面
Page({
  data: {
    agreed: false,
    loading: false,
    loginType: 'quick'  // 登录类型：quick（快速登录）、guest（游客）
  },

  onLoad() {
    // 检查是否已登录
    this.checkLoginStatus();
  },

  // 检查登录状态
  checkLoginStatus() {
    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo');
    const token = wx.getStorageSync('token');
    
    if (userInfo && token) {
      // 已登录，直接跳转到主页
      this.navigateToHome();
    }
  },

  // 主登录方法 - 直接使用 wx.login
  doLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      });
      return;
    }

    this.setData({ 
      loading: true,
      loginType: 'quick'
    });
    
    // 直接使用 wx.login 获取 openid
    wx.login({
      success: async (res) => {
        if (res.code) {
          try {
            console.log('登录凭证code:', res.code);
            
            // 调用云函数登录
            const result = await wx.cloud.callFunction({
              name: 'login',
              data: {
                code: res.code,
                loginType: 'normal'  // 标记为正常登录
              }
            });
            
            if (result.result.success) {
              const { openid, token, userInfo } = result.result.data;
              
              // 保存登录信息
              wx.setStorageSync('openid', openid);
              wx.setStorageSync('token', token);
              wx.setStorageSync('userInfo', userInfo);
              
              // 更新全局数据
              const app = getApp();
              app.globalData.openid = openid;
              app.globalData.userInfo = userInfo;
              app.globalData.isLogin = true;
              
              wx.showToast({
                title: '登录成功',
                icon: 'success'
              });
              
              // 判断是否需要设置用户信息
              setTimeout(() => {
                if (!userInfo.avatar || !userInfo.nickName || userInfo.nickName.startsWith('用户')) {
                  // 新用户或未设置信息的用户，跳转到信息设置页面
                  wx.redirectTo({
                    url: '/pages/login/user-setup?firstTime=true'
                  });
                } else {
                  // 已有完整信息的用户，直接进入主页
                  this.navigateToHome();
                }
              }, 1500);
            } else {
              throw new Error(result.result.message || '登录失败');
            }
          } catch (error) {
            console.error('登录失败:', error);
            wx.showToast({
              title: error.message || '登录失败，请重试',
              icon: 'none'
            });
          }
        }
      },
      fail: (err) => {
        console.error('wx.login失败:', err);
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },


  // 游客登录
  guestLogin() {
    wx.showModal({
      title: '提示',
      content: '游客模式功能有限，建议您登录后使用完整功能',
      confirmText: '继续',
      cancelText: '去登录',
      success: (res) => {
        if (res.confirm) {
          // 设置游客身份
          const guestInfo = {
            nickName: '游客用户',
            isGuest: true
            // 不设置avatar，避免覆盖
          };
          
          wx.setStorageSync('userInfo', guestInfo);
          wx.setStorageSync('isGuest', true);
          
          const app = getApp();
          app.globalData.userInfo = guestInfo;
          app.globalData.isGuest = true;
          
          this.navigateToHome();
        }
      }
    });
  },

  // 协议勾选
  onAgreementChange(e) {
    this.setData({
      agreed: e.detail.value.includes('agree')
    });
  },

  // 显示用户协议
  showUserAgreement() {
    wx.showModal({
      title: '用户协议',
      content: '1. 本应用仅供内部使用\n2. 请保护好您的账号信息\n3. 禁止恶意使用或攻击系统\n4. 所有操作将被记录审计\n5. 如有问题请联系管理员',
      showCancel: false,
      confirmText: '我已了解'
    });
  },

  // 显示隐私政策
  showPrivacyPolicy() {
    wx.showModal({
      title: '隐私政策',
      content: '1. 我们重视您的隐私保护\n2. 仅收集必要的用户信息\n3. 不会向第三方泄露您的信息\n4. 数据传输采用加密处理\n5. 您有权要求删除个人信息',
      showCancel: false,
      confirmText: '我已了解'
    });
  },


  // 显示登录帮助
  showHelp() {
    wx.showModal({
      title: '登录帮助',
      content: '1. 立即登录：使用微信账号快速登录系统\n\n2. 游客访问：体验有限功能，不保存数据\n\n3. 登录后可在个人中心修改头像和昵称\n\n如遇问题请联系管理员',
      showCancel: false,
      confirmText: '我知道了'
    });
  },

  // 跳转到主页
  navigateToHome() {
    wx.reLaunch({
      url: '/pages/dashboard/index'
    });
  }
});