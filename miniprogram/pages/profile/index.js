// 个人中心页面
Page({
  data: {
    // 用户信息
    userInfo: {
      avatar: '',
      name: '张工程师',
      roleText: 'IT运维工程师',
      department: '信息技术部',
      isManager: false,
      isOnline: true
    },
    
    // 统计数据
    stats: {
      totalCompleted: 1280,
      monthCompleted: 128,
      rating: 4.8
    },
    
    // 工单统计
    ticketStats: {
      completed: 45,
      processing: 3,
      avgTime: 2.5
    },
    
    // 耗材统计
    materialStats: {
      total: 23,
      types: 8
    },
    
    // 消息未读数
    unreadCount: 3,
    
    // 版本号
    version: '1.0.0',
    
    // 设置弹窗
    settingsVisible: false,
    
    // 设置项
    settings: {
      newTicketNotify: true,
      statusChangeNotify: true,
      helpRequestNotify: true,
      autoAccept: false,
      maxParallelTickets: 5,
      showNavigation: true,
      theme: 'light',
      fontSize: '标准',
      showOnlineStatus: true
    },
    
    // 缓存大小
    cacheSize: '12.5MB',
    
    // 版本更新
    updateDialogVisible: false,
    updateInfo: {
      version: '1.0.1',
      description: '1. 优化工单处理流程\n2. 新增语音输入功能\n3. 修复已知问题'
    }
  },

  onLoad() {
    this.loadUserInfo();
    this.loadStats();
    this.checkUpdate();
  },

  onShow() {
    // 刷新未读消息数
    this.loadUnreadCount();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: {
          ...this.data.userInfo,
          ...userInfo,
          roleText: userInfo.isManager ? 'IT运维主管' : 'IT运维工程师'
        }
      });
    }
  },

  // 加载统计数据
  loadStats() {
    // 模拟加载统计数据
    // 实际应用中从服务器获取
  },

  // 加载未读消息数
  loadUnreadCount() {
    // 模拟加载未读消息
    this.setData({
      unreadCount: Math.floor(Math.random() * 10)
    });
  },

  // 检查更新
  checkUpdate() {
    // 小程序会自动更新，不需要通知用户
  },

  // 更换头像
  changeAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        // 上传头像到服务器
        this.uploadAvatar(tempFilePath);
      }
    });
  },

  // 上传头像
  uploadAvatar(filePath) {
    wx.showLoading({
      title: '上传中...'
    });
    
    // 模拟上传
    setTimeout(() => {
      this.setData({
        'userInfo.avatar': filePath
      });
      wx.hideLoading();
      wx.showToast({
        title: '更换成功',
        icon: 'success'
      });
    }, 1500);
  },

  // 快捷入口跳转
  goToTicketStats() {
    wx.navigateTo({
      url: '/pages/statistics/index?tab=ticket'
    });
  },

  goToMaterialStats() {
    wx.navigateTo({
      url: '/pages/materials/index?tab=analysis'
    });
  },

  // 功能页面跳转
  goToUserInfo() {
    wx.navigateTo({
      url: '/pages/user-info/index'
    });
  },

  goToWorkHistory() {
    wx.navigateTo({
      url: '/pages/work-history/index'
    });
  },

  goToTeamManage() {
    wx.navigateTo({
      url: '/pages/team-manage/index'
    });
  },

  goToScheduleManage() {
    wx.navigateTo({
      url: '/pages/schedule-manage/index'
    });
  },

  goToReports() {
    wx.navigateTo({
      url: '/pages/reports/index'
    });
  },

  goToNotification() {
    wx.navigateTo({
      url: '/pages/notification/index'
    });
  },

  goToSettings() {
    this.setData({
      settingsVisible: true
    });
  },

  goToHelp() {
    wx.navigateTo({
      url: '/pages/help/index'
    });
  },

  goToAbout() {
    wx.navigateTo({
      url: '/pages/about/index'
    });
  },

  // 设置相关
  closeSettings() {
    this.setData({
      settingsVisible: false
    });
  },

  handleSettingsChange(e) {
    this.setData({
      settingsVisible: e.detail.visible
    });
  },

  // 通知设置
  onNewTicketNotifyChange(e) {
    this.setData({
      'settings.newTicketNotify': e.detail.value
    });
    this.saveSettings();
  },

  onStatusChangeNotifyChange(e) {
    this.setData({
      'settings.statusChangeNotify': e.detail.value
    });
    this.saveSettings();
  },

  onHelpRequestNotifyChange(e) {
    this.setData({
      'settings.helpRequestNotify': e.detail.value
    });
    this.saveSettings();
  },

  // 工作设置
  onAutoAcceptChange(e) {
    this.setData({
      'settings.autoAccept': e.detail.value
    });
    this.saveSettings();
  },

  setMaxParallelTickets() {
    const options = ['3个', '5个', '8个', '10个'];
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        const values = [3, 5, 8, 10];
        this.setData({
          'settings.maxParallelTickets': values[res.tapIndex]
        });
        this.saveSettings();
      }
    });
  },

  onShowNavigationChange(e) {
    this.setData({
      'settings.showNavigation': e.detail.value
    });
    this.saveSettings();
  },

  // 界面设置
  selectTheme() {
    wx.showActionSheet({
      itemList: ['浅色', '深色'],
      success: (res) => {
        const themes = ['light', 'dark'];
        this.setData({
          'settings.theme': themes[res.tapIndex]
        });
        this.saveSettings();
        // 应用主题
        this.applyTheme(themes[res.tapIndex]);
      }
    });
  },

  selectFontSize() {
    wx.showActionSheet({
      itemList: ['小', '标准', '大', '特大'],
      success: (res) => {
        const sizes = ['小', '标准', '大', '特大'];
        this.setData({
          'settings.fontSize': sizes[res.tapIndex]
        });
        this.saveSettings();
      }
    });
  },

  // 隐私设置
  onShowOnlineStatusChange(e) {
    this.setData({
      'settings.showOnlineStatus': e.detail.value
    });
    this.saveSettings();
  },

  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '清除中...'
          });
          
          // 清除缓存
          setTimeout(() => {
            wx.clearStorageSync();
            this.setData({
              cacheSize: '0MB'
            });
            wx.hideLoading();
            wx.showToast({
              title: '清除成功',
              icon: 'success'
            });
          }, 1000);
        }
      }
    });
  },

  // 保存设置
  saveSettings() {
    wx.setStorageSync('settings', this.data.settings);
  },

  // 应用主题
  applyTheme(theme) {
    // 这里可以调用全局方法来切换主题
    wx.showToast({
      title: `已切换到${theme === 'light' ? '浅色' : '深色'}主题`,
      icon: 'none'
    });
  },

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除登录信息
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/index'
          });
        }
      }
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'IT工程师助手',
      path: '/pages/dashboard/index'
    };
  }
});