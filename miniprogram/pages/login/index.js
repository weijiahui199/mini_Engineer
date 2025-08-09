// 登录页面
Page({
  data: {
    userInfo: null,
    hasUserInfo: false,
    canUseGetUserProfile: wx.canIUse('getUserProfile'),
    agreed: false,
    loading: false,
    showPhoneLogin: false  // 默认不显示手机号登录（需要企业认证）
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

  // 获取用户信息 - 使用新的规范
  getUserProfile() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      });
      return;
    }

    // 检查是否支持 getUserProfile
    if (wx.getUserProfile) {
      wx.getUserProfile({
        desc: '用于完善用户资料和提供个性化服务',
        success: (res) => {
          console.log('获取用户信息成功', res);
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          });
          
          // 保存用户信息到本地
          wx.setStorageSync('wxUserInfo', res.userInfo);
          
          // 继续登录流程
          this.wxLogin(res.userInfo);
        },
        fail: (err) => {
          console.error('获取用户信息失败', err);
          // 用户拒绝授权，提供快速登录选项
          wx.showModal({
            title: '提示',
            content: '获取用户信息失败，是否使用快速登录？',
            confirmText: '快速登录',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                this.quickLogin();
              }
            }
          });
        }
      });
    } else {
      // 基础库版本过低，使用快速登录
      console.log('不支持 getUserProfile，使用快速登录');
      this.quickLogin();
    }
  },

  // 微信登录
  wxLogin(wxUserInfo) {
    this.setData({ loading: true });
    
    wx.login({
      success: async (res) => {
        if (res.code) {
          console.log('登录凭证code:', res.code);
          
          // 调用云函数进行登录
          try {
            const result = await wx.cloud.callFunction({
              name: 'login',
              data: {
                code: res.code,
                userInfo: wxUserInfo || this.data.userInfo
              }
            });
            
            console.log('云函数登录结果:', result);
            
            if (result.result.success) {
              // 保存登录信息
              const { openid, token, userInfo } = result.result.data;
              
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
              
              // 跳转到主页
              setTimeout(() => {
                this.navigateToHome();
              }, 1500);
            } else {
              throw new Error(result.result.message || '登录失败');
            }
          } catch (error) {
            console.error('登录失败:', error);
            wx.showToast({
              title: error.message || '登录失败',
              icon: 'none'
            });
          }
        } else {
          wx.showToast({
            title: '登录失败，请重试',
            icon: 'none'
          });
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

  // 获取手机号登录
  onGetPhoneNumber(e) {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      });
      return;
    }

    console.log('获取手机号结果:', e);
    
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      this.setData({ loading: true });
      
      // 调用云函数解密手机号
      wx.cloud.callFunction({
        name: 'login',
        data: {
          action: 'getPhoneNumber',
          cloudID: e.detail.cloudID,
          encryptedData: e.detail.encryptedData,
          iv: e.detail.iv
        }
      }).then(res => {
        console.log('手机号解密结果:', res);
        
        if (res.result.success) {
          // 继续登录流程
          this.wxLogin();
        } else {
          wx.showToast({
            title: '获取手机号失败',
            icon: 'none'
          });
        }
      }).catch(err => {
        console.error('获取手机号失败:', err);
        wx.showToast({
          title: '获取手机号失败',
          icon: 'none'
        });
      }).finally(() => {
        this.setData({ loading: false });
      });
    } else {
      wx.showToast({
        title: '需要手机号授权才能登录',
        icon: 'none'
      });
    }
  },

  // 手动登录（已有用户信息）
  manualLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      });
      return;
    }
    
    this.wxLogin();
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

  // 快速登录（无需授权）
  quickLogin() {
    if (!this.data.agreed) {
      wx.showToast({
        title: '请先同意用户协议',
        icon: 'none'
      });
      return;
    }
    
    this.setData({ loading: true });
    
    // 直接使用wx.login获取openid，不获取用户信息
    wx.login({
      success: async (res) => {
        if (res.code) {
          try {
            // 生成默认用户信息
            const defaultUserInfo = {
              nickName: '微信用户' + Math.random().toString(36).substr(2, 4).toUpperCase(),
              avatarUrl: '/assets/default-avatar.png',
              gender: 0,
              country: '',
              province: '',
              city: '',
              language: 'zh_CN'
            };
            
            // 调用云函数登录
            const result = await wx.cloud.callFunction({
              name: 'login',
              data: {
                code: res.code,
                userInfo: defaultUserInfo,
                isQuickLogin: true  // 标记为快速登录
              }
            });
            
            if (result.result.success) {
              const { openid, token, userInfo } = result.result.data;
              
              wx.setStorageSync('openid', openid);
              wx.setStorageSync('token', token);
              wx.setStorageSync('userInfo', userInfo);
              
              const app = getApp();
              app.globalData.openid = openid;
              app.globalData.userInfo = userInfo;
              app.globalData.isLogin = true;
              
              wx.showToast({
                title: '登录成功',
                icon: 'success'
              });
              
              setTimeout(() => {
                this.navigateToHome();
              }, 1500);
            }
          } catch (error) {
            console.error('快速登录失败:', error);
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            });
          }
        }
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  // 显示登录帮助
  showHelp() {
    wx.showModal({
      title: '登录帮助',
      content: '1. 微信授权登录：获取您的微信头像和昵称，提供个性化服务\n\n2. 快速登录：无需授权，使用默认信息快速进入系统\n\n3. 游客访问：体验有限功能，不保存数据\n\n如遇问题请联系管理员',
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