// 个人中心页面
const testManager = require('../../utils/test-manager');
const avatarManager = require('../../utils/avatar-manager');
const UserCache = require('../../utils/user-cache');
const RefreshManager = require('../../utils/refresh-manager');
const NetworkHandler = require('../../utils/network-handler');

Page({
  data: {
    // 用户信息
    userInfo: {
      avatar: '',
      name: '张工程师',
      nickName: '',  // 用户昵称
      roleText: 'IT运维工程师',
      department: '信息技术部',
      isManager: false,
      isOnline: true
    },
    
    // 昵称编辑相关
    isEditingNickName: false,
    tempNickName: '',
    
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
    
    // 注册头像更新事件监听，保存监听器ID
    this.avatarListenerId = this.app.eventBus.on(
      this.app.EVENTS.AVATAR_UPDATED, 
      this.handleAvatarUpdate.bind(this), 
      this
    );
    console.log('[Profile] 已注册头像更新事件监听, ID:', this.avatarListenerId);
    
    this.loadUserInfo();
    this.loadStats();
    this.checkUpdate();
    
    // 判断是否显示测试功能（只在开发环境显示）
    const accountInfo = wx.getAccountInfoSync();
    this.setData({
      showTestSection: accountInfo.miniProgram.envVersion !== 'release'
    });
    
    // 开发环境下，打印缓存调试信息
    if (accountInfo.miniProgram.envVersion !== 'release') {
      this.printCacheDebugInfo();
    }
  },
  
  // 处理头像更新事件
  handleAvatarUpdate(data) {
    console.log('[Profile] 收到头像更新事件:', data);
    
    // 标记需要强制刷新
    RefreshManager.setForceRefreshFlag('userInfo');
    if (data && data.localPath) {
      // 直接更新页面显示的头像
      this.setData({
        'userInfo.avatar': data.localPath
      });
      console.log('[Profile] 页面头像已更新');
    }
  },
  
  // 打印缓存调试信息
  printCacheDebugInfo() {
    console.log('========== 页面加载时的缓存状态 ==========');
    const info = wx.getStorageInfoSync();
    console.log('缓存大小:', info.currentSize, 'KB');
    console.log('缓存键:', info.keys);
    
    // 关键缓存值
    console.log('\n关键缓存值:');
    console.log('- userAvatar:', wx.getStorageSync('userAvatar'));
    console.log('- cached_avatar_file_id:', wx.getStorageSync('cached_avatar_file_id')); 
    console.log('- cached_user_avatar:', wx.getStorageSync('cached_user_avatar'));
    
    const userInfo = wx.getStorageSync('cached_user_info');
    if (userInfo) {
      console.log('- cached_user_info.avatar:', userInfo.avatar);
      console.log('- cached_user_info.nickName:', userInfo.nickName);
    }
    
    console.log('- openid:', wx.getStorageSync('openid'));
    console.log('==========================================');
  },

  onShow() {
    console.log('[Profile] onShow 触发');
    
    // 设置页面活跃状态
    RefreshManager.setPageActive('profile', true);
    
    // 智能刷新决策
    const decisions = RefreshManager.makeRefreshDecision('profile', ['userInfo']);
    
    // 根据决策刷新用户信息
    if (decisions.userInfo) {
      console.log('[Profile] 需要刷新用户信息');
      this.loadUserInfo(true);
      RefreshManager.recordRefresh('userInfo');
    } else {
      console.log('[Profile] 使用缓存的用户信息');
      // 使用缓存的用户信息
      this.loadUserInfo(false);
    }
    
    // 始终刷新未读消息数
    this.loadUnreadCount();
  },
  
  onHide() {
    // 页面隐藏时设置为非活跃
    RefreshManager.setPageActive('profile', false);
  },

  // 下拉刷新处理
  async onPullDownRefresh() {
    console.log('[Profile] 用户下拉刷新');
    
    try {
      // 强制刷新用户信息（清除缓存）
      await this.loadUserInfo(true);
      
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      console.error('刷新失败:', error);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    } finally {
      // 停止下拉刷新动画
      wx.stopPullDownRefresh();
    }
  },

  // 加载用户信息（使用缓存）
  async loadUserInfo(forceRefresh = false) {
    console.log('[Profile.loadUserInfo] 开始加载用户信息, forceRefresh:', forceRefresh);
    try {
      // 使用缓存管理器获取用户信息
      const userInfo = await UserCache.getUserInfo(forceRefresh);
      console.log('[Profile.loadUserInfo] 获取到的用户信息:', userInfo);
      
      if (!userInfo) {
        console.log('[Profile.loadUserInfo] 用户信息为空，使用默认值');
        // 如果没有用户信息，使用默认值
        this.setData({
          userInfo: {
            avatar: '',
            name: '微信用户',
            roleText: '普通用户',
            department: '技术部',
            isManager: false,
            isOnline: true
          }
        });
        return;
      }
      
      // 实现三级头像优先级
      let avatarUrl = '';
      
      // 1. 优先使用本地缓存的非默认头像
      if (userInfo.localAvatar && !userInfo.localAvatar.includes('thirdwx.qlogo.cn')) {
        avatarUrl = userInfo.localAvatar;
        console.log('[Profile.loadUserInfo] 使用本地缓存头像:', avatarUrl);
      }
      // 2. 如果没有本地缓存但有云存储头像，尝试下载并缓存
      else if (userInfo.avatar && userInfo.avatar.startsWith('cloud://')) {
        console.log('[Profile.loadUserInfo] 检测到云存储头像，尝试获取本地缓存或下载');
        // 如果UserCache没有自动下载（比如是刷新场景），这里手动下载
        if (!userInfo.localAvatar || userInfo.localAvatar.includes('thirdwx.qlogo.cn')) {
          console.log('[Profile.loadUserInfo] 本地无有效缓存，开始下载云存储头像');
          const localPath = await UserCache.downloadAndCacheAvatar(userInfo.avatar);
          if (localPath) {
            avatarUrl = localPath;
            console.log('[Profile.loadUserInfo] 云存储头像已下载到本地:', localPath);
          } else {
            // 下载失败，使用云存储URL（会触发临时链接获取）
            avatarUrl = userInfo.avatar;
            console.log('[Profile.loadUserInfo] 下载失败，使用云存储URL');
          }
        } else {
          avatarUrl = userInfo.localAvatar;
          console.log('[Profile.loadUserInfo] 使用已缓存的云存储头像');
        }
      }
      // 3. 都没有则使用默认
      else {
        avatarUrl = userInfo.avatar || '';
        console.log('[Profile.loadUserInfo] 使用默认头像或空');
      }
      
      console.log('[Profile.loadUserInfo] 决定使用的头像URL:', avatarUrl);
      console.log('[Profile.loadUserInfo] - localAvatar:', userInfo.localAvatar);
      console.log('[Profile.loadUserInfo] - avatar:', userInfo.avatar);
      
      this.setData({
        userInfo: {
          avatar: avatarUrl,
          name: userInfo.nickName || '微信用户',  // 使用nickName字段
          nickName: userInfo.nickName || '微信用户',  // 同时保留nickName字段
          roleText: userInfo.roleGroup === '经理' ? 'IT运维主管' : userInfo.roleGroup === '工程师' ? 'IT运维工程师' : '普通用户',
          roleGroup: userInfo.roleGroup || '用户',
          department: userInfo.department || '技术部',
          isManager: userInfo.roleGroup === '经理',
          isOnline: userInfo.status === 'online',
          phone: userInfo.phone || '',
          email: userInfo.email || ''
        }
      });
      console.log('[Profile.loadUserInfo] 页面数据已更新，头像:', this.data.userInfo.avatar);
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 使用默认信息
      this.setData({
        userInfo: {
          avatar: '',
          name: '微信用户',  // 默认用户名
          nickName: '微信用户',  // 同时保留nickName字段
          roleText: '普通用户',
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
  // 选择头像 - 使用新的 open-type="chooseAvatar"
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('选择的头像:', avatarUrl);
    
    // 立即更新显示
    this.setData({
      'userInfo.avatar': avatarUrl
    });
    
    // 上传头像到云存储并更新数据库
    this.uploadAvatar(avatarUrl);
  },
  
  // 上传头像到云存储
  async uploadAvatar(tempFilePath) {
    // 检查网络状态
    if (!NetworkHandler.isNetworkConnected()) {
      wx.showToast({
        title: '网络未连接',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 弱网提示
    if (NetworkHandler.isWeakNetwork()) {
      wx.showToast({
        title: '当前网络较慢，上传可能需要更长时间',
        icon: 'none',
        duration: 2000
      });
    }
    
    wx.showLoading({ title: '上传中...' });
    
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      
      // 上传到云存储（带重试）
      const cloudPath = `avatars/${openid}_${Date.now()}.png`;
      const uploadRes = await NetworkHandler.uploadFileWithRetry({
        cloudPath,
        filePath: tempFilePath
      });
      
      // 更新数据库（带重试）
      await NetworkHandler.databaseOperationWithRetry(async () => {
        return this.db.collection('users').where({
          openid: openid
        }).update({
          data: {
            avatar: uploadRes.fileID,
            avatarUpdateTime: new Date()
          }
        });
      });
      
      // 更新本地缓存
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.avatar = uploadRes.fileID;
      wx.setStorageSync('userInfo', userInfo);
      
      // 更新全局数据
      app.globalData.userInfo.avatar = uploadRes.fileID;
      
      // 更新头像缓存并触发全局事件
      const UserCache = require('../../utils/user-cache');
      await UserCache.updateAvatarCache(uploadRes.fileID);
      console.log('[Profile] 已更新头像缓存并触发全局事件');
      
      wx.hideLoading();
      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('上传头像失败:', error);
      wx.hideLoading();
      
      // 显示友好的错误提示
      const errorMessage = NetworkHandler.getFriendlyErrorMessage(error);
      
      wx.showModal({
        title: '头像上传失败',
        content: errorMessage,
        showCancel: true,
        confirmText: '重试',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            // 重试上传
            this.uploadAvatar(tempFilePath);
          } else {
            // 恢复原头像
            this.loadUserInfo();
          }
        }
      });
    }
  },
  
  // 编辑昵称
  editNickName() {
    this.setData({
      isEditingNickName: true,
      tempNickName: this.data.userInfo.nickName || this.data.userInfo.name
    });
  },
  
  // 昵称输入
  onNickNameInput(e) {
    this.setData({
      tempNickName: e.detail.value
    });
  },
  
  // 昵称失去焦点
  onNickNameBlur() {
    // 延迟关闭，避免与保存按钮冲突
    setTimeout(() => {
      if (this.data.isEditingNickName) {
        this.setData({
          isEditingNickName: false
        });
      }
    }, 200);
  },
  
  // 保存昵称
  async saveNickName() {
    const nickName = this.data.tempNickName.trim();
    
    if (!nickName) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({ title: '保存中...' });
    
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      
      // 更新数据库
      await this.db.collection('users').where({
        openid: openid
      }).update({
        data: {
          nickName: nickName,
          updateTime: new Date()
        }
      });
      
      // 更新本地显示
      this.setData({
        'userInfo.nickName': nickName,
        'userInfo.name': nickName,
        isEditingNickName: false
      });
      
      // 更新缓存
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.nickName = nickName;
      wx.setStorageSync('userInfo', userInfo);
      
      // 更新全局数据
      app.globalData.userInfo.nickName = nickName;
      
      wx.hideLoading();
      wx.showToast({
        title: '昵称更新成功',
        icon: 'success'
      });
    } catch (error) {
      console.error('保存昵称失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  // 兼容旧的changeAvatar方法
  async changeAvatar() {
    console.log('[Profile.changeAvatar] 开始更换头像');
    wx.showLoading({
      title: '处理中...',
      mask: true
    });
    
    try {
      // 使用头像管理器选择并上传头像
      const result = await avatarManager.chooseAndUploadAvatar({
        maxSize: 400,     // 最大尺寸400x400
        quality: 0.8,     // 压缩质量80%
        sourceType: ['album', 'camera']
      });
      
      console.log('[Profile.changeAvatar] 上传结果:', result);
      wx.hideLoading();
      
      if (result.success) {
        console.log('[Profile.changeAvatar] 上传成功，fileID:', result.fileID);
        
        // 获取临时URL用于显示
        const tempUrl = await avatarManager.getTempAvatarUrl(result.fileID);
        console.log('[Profile.changeAvatar] 获取到的临时URL:', tempUrl);
        
        // 更新页面显示
        this.setData({
          'userInfo.avatar': tempUrl
        });
        console.log('[Profile.changeAvatar] 页面头像已更新为:', tempUrl);
        
        // 更新全局数据
        if (this.app.globalData.userInfo) {
          this.app.globalData.userInfo.avatar = result.fileID;
          console.log('[Profile.changeAvatar] 全局数据头像已更新为:', result.fileID);
        }
        
        // 清除旧的临时文件缓存
        const oldUserAvatar = wx.getStorageSync('userAvatar');
        if (oldUserAvatar && oldUserAvatar.startsWith('http://tmp/')) {
          console.log('[Profile.changeAvatar] 清除旧的临时文件缓存:', oldUserAvatar);
          wx.removeStorageSync('userAvatar');
        }
        
        // 不再使用userAvatar存储，统一使用缓存管理器
        console.log('[Profile.changeAvatar] 不再单独存储userAvatar，使用统一缓存管理');
        
        // 使用专门的头像缓存更新方法
        await UserCache.updateAvatarCache(result.fileID);
        console.log('[Profile.changeAvatar] 头像缓存已更新');
        
        wx.showToast({
          title: '头像更新成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.error || '上传失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('更换头像失败:', error);
      wx.showToast({
        title: '更换头像失败',
        icon: 'none'
      });
    }
  },


  // 快捷入口跳转
  navigateToTickets() {
    wx.switchTab({
      url: '/pages/ticket-list/index'
    });
  },

  goToMaterialStats() {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 功能页面跳转
  goToUserInfo() {
    wx.navigateTo({
      url: '/pages/user-info/index'
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

  // 退出登录
  logout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除所有登录相关的本地存储
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          wx.removeStorageSync('openid');
          wx.removeStorageSync('isGuest');
          wx.removeStorageSync('userAvatar');
          wx.removeStorageSync('userRoleGroup');
          
          // 清除用户缓存
          UserCache.clearCache();
          
          // 重置全局变量
          const app = getApp();
          app.globalData.isLogin = false;
          app.globalData.userInfo = null;
          app.globalData.openid = null;
          app.globalData.token = null;
          app.globalData.isGuest = false;
          
          // 提示退出成功
          wx.showToast({
            title: '已退出登录',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟跳转到登录页
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/login/index'
            });
          }, 1500);
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
  },
  
  // ========== 缓存调试方法 ==========
  
  // 显示缓存信息
  showCacheInfo() {
    const info = wx.getStorageInfoSync();
    const userAvatar = wx.getStorageSync('userAvatar');
    const cachedAvatarFileID = wx.getStorageSync('cached_avatar_file_id');
    const cachedUserAvatar = wx.getStorageSync('cached_user_avatar');
    const cachedUserInfo = wx.getStorageSync('cached_user_info');
    const cacheTime = wx.getStorageSync('user_cache_time');
    
    let message = `缓存大小: ${info.currentSize}KB\n`;
    message += `缓存键数: ${info.keys.length}\n\n`;
    
    message += `头像缓存:\n`;
    message += `- userAvatar: ${userAvatar ? '有' : '无'}\n`;
    message += `- cached_avatar_file_id: ${cachedAvatarFileID ? '有' : '无'}\n`;
    message += `- cached_user_avatar: ${cachedUserAvatar ? '有' : '无'}\n\n`;
    
    if (cachedUserInfo) {
      message += `用户信息缓存:\n`;
      message += `- nickName: ${cachedUserInfo.nickName}\n`;
      message += `- avatar: ${cachedUserInfo.avatar ? '有' : '无'}\n`;
      message += `- department: ${cachedUserInfo.department}\n`;
    }
    
    if (cacheTime) {
      const age = Date.now() - cacheTime;
      const hours = Math.floor(age / (1000 * 60 * 60));
      message += `\n缓存年龄: ${hours}小时`;
    }
    
    wx.showModal({
      title: '缓存信息',
      content: message,
      showCancel: false
    });
    
    // 同时在控制台打印详细信息
    console.log('========== 详细缓存信息 ==========');
    console.log('userAvatar:', userAvatar);
    console.log('cached_avatar_file_id:', cachedAvatarFileID);
    console.log('cached_user_avatar:', cachedUserAvatar);
    console.log('cached_user_info:', cachedUserInfo);
    console.log('====================================');
  },
  
  // 清除头像缓存
  clearAvatarCache() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有头像相关缓存吗？这将清理所有混乱的头像数据。',
      success: (res) => {
        if (res.confirm) {
          // 清除所有可能的头像缓存
          console.log('[清理头像缓存] 开始清理...');
          
          // 1. 清除旧的userAvatar（可能是临时文件）
          const oldUserAvatar = wx.getStorageSync('userAvatar');
          if (oldUserAvatar) {
            console.log('[清理头像缓存] 清除userAvatar:', oldUserAvatar);
            wx.removeStorageSync('userAvatar');
          }
          
          // 2. 清除缓存的头像文件ID
          const cachedFileID = wx.getStorageSync('cached_avatar_file_id');
          if (cachedFileID) {
            console.log('[清理头像缓存] 清除cached_avatar_file_id:', cachedFileID);
            wx.removeStorageSync('cached_avatar_file_id');
          }
          
          // 3. 清除缓存的本地头像路径
          const cachedAvatar = wx.getStorageSync('cached_user_avatar');
          if (cachedAvatar) {
            console.log('[清理头像缓存] 清除cached_user_avatar:', cachedAvatar);
            wx.removeStorageSync('cached_user_avatar');
          }
          
          // 4. 清除头像缓存时间
          wx.removeStorageSync('avatar_cache_time');
          
          // 5. 清除用户信息缓存中的头像
          const cachedUserInfo = wx.getStorageSync('cached_user_info');
          if (cachedUserInfo && cachedUserInfo.avatar) {
            console.log('[清理头像缓存] 清除cached_user_info中的头像');
            delete cachedUserInfo.avatar;
            delete cachedUserInfo.localAvatar;
            wx.setStorageSync('cached_user_info', cachedUserInfo);
          }
          
          console.log('[清理头像缓存] 清理完成');
          
          wx.showToast({
            title: '头像缓存已清除',
            icon: 'success'
          });
          
          // 重新加载用户信息
          setTimeout(() => {
            this.loadUserInfo(true); // 强制刷新
          }, 1500);
        }
      }
    });
  },
  
  // 强制刷新用户信息
  async forceRefreshUser() {
    wx.showLoading({
      title: '刷新中...'
    });
    
    try {
      // 清除用户信息缓存
      wx.removeStorageSync('cached_user_info');
      wx.removeStorageSync('user_cache_time');
      
      // 强制从数据库重新加载
      await this.loadUserInfo(true);
      
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    } catch (error) {
      wx.hideLoading();
      console.error('强制刷新失败:', error);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    }
  },
  
  onUnload() {
    // 移除事件监听，使用监听器ID
    if (this.app && this.app.eventBus && this.avatarListenerId) {
      this.app.eventBus.off(this.app.EVENTS.AVATAR_UPDATED, this.avatarListenerId);
      console.log('[Profile] 已移除头像更新事件监听, ID:', this.avatarListenerId);
    }
  },
  
  /**
   * 处理头像更新事件
   * @param {Object} data 更新数据
   */
  handleAvatarUpdate(data) {
    console.log('[Profile] 收到头像更新通知:', data);
    
    // 优先使用本地路径，其次是临时URL，最后是文件ID
    const avatarUrl = data.localPath || data.tempUrl || data.fileID;
    
    if (avatarUrl) {
      // 更新页面显示
      this.setData({
        'userInfo.avatar': avatarUrl
      });
      console.log('[Profile] 头像已更新为:', avatarUrl);
      
      // 更新缓存中的用户信息
      const cachedUserInfo = wx.getStorageSync('cached_user_info');
      if (cachedUserInfo) {
        cachedUserInfo.avatar = data.fileID || avatarUrl;
        cachedUserInfo.localAvatar = data.localPath || avatarUrl;
        wx.setStorageSync('cached_user_info', cachedUserInfo);
        console.log('[Profile] 已更新缓存中的头像信息');
      }
    }
  }
});