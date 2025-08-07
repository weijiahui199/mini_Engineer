// 个人中心页面
const testManager = require('../../utils/test-manager');

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
    },
    
    // 显示测试功能区域（仅开发环境）
    showTestSection: false
  },

  onLoad() {
    // 获取app实例和数据库
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    
    this.loadUserInfo();
    this.loadStats();
    this.checkUpdate();
    
    // 判断是否显示测试功能（只在开发环境显示）
    const accountInfo = wx.getAccountInfoSync();
    this.setData({
      showTestSection: accountInfo.miniProgram.envVersion !== 'release'
    });
  },

  onShow() {
    // 刷新未读消息数
    this.loadUnreadCount();
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      const app = getApp();
      let userInfo = app.globalData.userInfo;
      
      // 如果全局没有用户信息，尝试从数据库获取
      if (!userInfo && app.globalData.openid) {
        const res = await this.db.collection('users').where({
          openid: app.globalData.openid
        }).get();
        
        if (res.data.length > 0) {
          userInfo = res.data[0];
          app.globalData.userInfo = userInfo;
        }
      }
      
      // 如果还是没有用户信息，创建默认工程师
      if (!userInfo) {
        userInfo = {
          name: '新工程师',
          role: 'engineer',
          avatar: '',
          department: '技术部',
          phone: '',
          email: '',
          status: 'online'
        };
      }
      
      // 获取本地保存的头像
      const savedAvatar = wx.getStorageSync('userAvatar') || userInfo.avatar || '';
      
      this.setData({
        userInfo: {
          avatar: savedAvatar,
          name: userInfo.name || '工程师',
          roleText: userInfo.roleGroup === '经理' ? 'IT运维主管' : 'IT运维工程师',
          roleGroup: userInfo.roleGroup || '工程师',
          department: userInfo.department || '技术部',
          isManager: userInfo.roleGroup === '经理',
          isOnline: userInfo.status === 'online',
          phone: userInfo.phone || '',
          email: userInfo.email || ''
        }
      });
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 使用默认信息
      this.setData({
        userInfo: {
          avatar: wx.getStorageSync('userAvatar') || '',
          name: '默认工程师',
          roleText: 'IT运维工程师',
          department: '技术部',
          isManager: false,
          isOnline: true
        }
      });
    }
  },

  // 加载统计数据
  async loadStats() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      
      if (!openid) {
        console.log('等待用户openid...');
        return;
      }
      
      const _ = this.db.command;
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // 查询条件：分配给当前工程师的工单
      const baseQuery = _.or([
        { assignedTo: openid },
        { assigneeOpenid: openid }
      ]);
      
      // 并行获取统计数据
      const [totalCompleted, monthCompleted, processingCount] = await Promise.all([
        // 总完成数
        this.db.collection('tickets').where(_.and([
          baseQuery,
          { status: _.in(['resolved', 'closed']) }
        ])).count(),
        
        // 本月完成数
        this.db.collection('tickets').where(_.and([
          baseQuery,
          { status: _.in(['resolved', 'closed']) },
          _.or([
            { updateTime: _.gte(thisMonth) },
            { resolveTime: _.gte(thisMonth) }
          ])
        ])).count(),
        
        // 进行中的工单数
        this.db.collection('tickets').where(_.and([
          baseQuery,
          { status: 'processing' }
        ])).count()
      ]);
      
      // 计算平均处理时间（这里用模拟数据）
      const avgTime = 2.5;
      
      // 更新统计数据
      this.setData({
        stats: {
          totalCompleted: totalCompleted.total || 0,
          monthCompleted: monthCompleted.total || 0,
          rating: 4.8  // 评分暂时用模拟数据
        },
        ticketStats: {
          completed: totalCompleted.total || 0,
          processing: processingCount.total || 0,
          avgTime: avgTime
        }
      });
      
      // 加载物料统计
      await this.loadMaterialStats();
    } catch (error) {
      console.error('加载统计数据失败:', error);
      // 使用默认数据
      this.setData({
        stats: {
          totalCompleted: 0,
          monthCompleted: 0,
          rating: 4.8
        },
        ticketStats: {
          completed: 0,
          processing: 0,
          avgTime: 2.5
        }
      });
    }
  },
  
  // 加载物料统计
  async loadMaterialStats() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      
      if (!openid) return;
      
      // 获取物料使用记录数
      const materialCount = await this.db.collection('worklog').where({
        engineerOpenid: openid,
        type: 'material'
      }).count();
      
      // 获取物料种类数（从materials集合）
      const typesCount = await this.db.collection('materials').count();
      
      this.setData({
        materialStats: {
          total: materialCount.total || 0,
          types: typesCount.total || 0
        }
      });
    } catch (error) {
      console.error('加载物料统计失败:', error);
    }
  },

  // 加载未读消息数
  async loadUnreadCount() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      
      if (!openid) return;
      
      // 由于notifications集合还不存在，暂时返回0
      // 后续可以创建notifications集合来管理通知
      this.setData({
        unreadCount: 0
      });
    } catch (error) {
      console.error('加载未读消息失败:', error);
      this.setData({
        unreadCount: 0
      });
    }
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
  async uploadAvatar(filePath) {
    wx.showLoading({
      title: '上传中...'
    });
    
    try {
      // 上传到云存储
      const cloudPath = `avatars/${this.app.globalData.openid}_${Date.now()}.jpg`;
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath
      });
      
      // 更新数据库中的用户头像
      if (this.app.globalData.userInfo && this.app.globalData.userInfo._id) {
        await this.db.collection('users').doc(this.app.globalData.userInfo._id).update({
          data: {
            avatar: uploadRes.fileID,
            updateTime: new Date()
          }
        });
      }
      
      // 更新页面显示
      this.setData({
        'userInfo.avatar': filePath
      });
      
      // 保存到本地存储
      wx.setStorageSync('userAvatar', filePath);
      
      wx.hideLoading();
      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('上传头像失败:', error);
      wx.hideLoading();
      
      // 即使上传失败，也保存到本地
      this.setData({
        'userInfo.avatar': filePath
      });
      wx.setStorageSync('userAvatar', filePath);
      
      wx.showToast({
        title: '头像已保存',
        icon: 'success'
      });
    }
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

  // 切换管理员模式（仅用于测试）
  onManagerModeChange(e) {
    const isManager = e.detail.value;
    const updatedUserInfo = {
      ...this.data.userInfo,
      isManager,
      roleText: isManager ? 'IT运维主管' : 'IT运维工程师'
    };
    
    this.setData({
      userInfo: updatedUserInfo
    });
    
    // 保存到本地存储
    wx.setStorageSync('userInfo', updatedUserInfo);
    
    wx.showToast({
      title: isManager ? '已切换为管理员模式' : '已切换为普通用户模式',
      icon: 'none'
    });
  },
  
  // 分享
  onShareAppMessage() {
    return {
      title: 'IT工程师助手',
      path: '/pages/dashboard/index'
    };
  },
  
  // =========================
  // 测试功能区域
  // =========================
  
  // 切换为经理角色
  async switchToManager() {
    wx.showLoading({
      title: '切换中...'
    });
    
    const success = await testManager.testSetAsManager();
    wx.hideLoading();
    
    if (success) {
      // 重新加载用户信息
      this.loadUserInfo();
    }
  },
  
  // 切换为工程师角色
  async switchToEngineer() {
    wx.showLoading({
      title: '切换中...'
    });
    
    const success = await testManager.testSetAsEngineer();
    wx.hideLoading();
    
    if (success) {
      // 重新加载用户信息
      this.loadUserInfo();
    }
  },
  
  // 创建测试数据
  async createTestData() {
    wx.showModal({
      title: '创建测试数据',
      content: '将创建3个测试工单，其中2个分配给当前用户',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '创建中...'
          });
          
          const success = await testManager.createTestTickets();
          wx.hideLoading();
          
          if (success) {
            wx.showToast({
              title: '创建成功',
              icon: 'success'
            });
          }
        }
      }
    });
  }
});