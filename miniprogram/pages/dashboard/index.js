// 工程师工作台页面
const UserCache = require('../../utils/user-cache');
const RefreshManager = require('../../utils/refresh-manager');
const NetworkHandler = require('../../utils/network-handler');

Page({
  data: {
    // 工程师信息
    engineerInfo: {
      name: '张工程师',
      avatar: '',
      currentTasks: 5,
      maxTasks: 10,
      location: '行政楼2楼'
    },
    
    // 状态文本映射
    statusText: {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
      cancelled: '已取消',
      paused: '已暂停'
    },
    
    // 最后更新时间
    lastUpdateTime: '刚刚',
    
    // 今日统计
    todayStats: [
      { key: 'pending', label: '待处理', value: 3, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
      { key: 'processing', label: '进行中', value: 5, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
      { key: 'paused', label: '已暂停', value: 0, colorClass: 'text-orange', icon: '/assets/icons/pause-icon.png' },
      { key: 'resolved', label: '已完成', value: 2, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
      { key: 'urgent', label: '紧急', value: 1, colorClass: 'text-red', icon: '/assets/icons/urgent-icon.png' }
    ],
    
    // 紧急工单
    urgentTickets: [],
    
    // 快捷操作
    quickActions: [
      { key: 'my-tickets', title: '我的工单', icon: '📋', imageIcon: '/assets/icons/ticket-icon.png' },
      { key: 'materials', title: '耗材管理', icon: '📦', imageIcon: '/assets/icons/material-icon.png' },
      { key: 'help', title: '呼叫经理', icon: '📞', imageIcon: '/assets/icons/call-icon.png' },
      { key: 'stats', title: '工作统计', icon: '📊', imageIcon: '/assets/icons/stats-icon.png' }
    ],
    
    // 最新工单
    latestTickets: []
  },

  onLoad() {
    // 获取app实例
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    
    // 注册头像更新事件监听，保存监听器ID
    this.avatarListenerId = this.app.eventBus.on(
      this.app.EVENTS.AVATAR_UPDATED, 
      this.handleAvatarUpdate.bind(this), 
      this
    );
    console.log('[Dashboard] 已注册头像更新事件监听, ID:', this.avatarListenerId);
    
    // 延迟加载数据，等待app初始化完成
    setTimeout(() => {
      this.loadDashboardData();
    }, 500);
    
    this.startAutoRefresh();
  },
  
  // 处理头像更新事件
  handleAvatarUpdate(data) {
    console.log('[Dashboard] 收到头像更新事件:', data);
    
    // 标记需要强制刷新
    RefreshManager.setForceRefreshFlag('userInfo');
    if (data && data.localPath) {
      // 直接更新页面显示的头像
      this.setData({
        'engineerInfo.avatar': data.localPath
      });
      console.log('[Dashboard] 页面头像已更新');
    }
  },

  onShow() {
    console.log('[Dashboard] onShow 触发');
    
    // 设置页面活跃状态
    RefreshManager.setPageActive('dashboard', true);
    
    // 智能刷新决策
    const decisions = RefreshManager.makeRefreshDecision('dashboard', ['userInfo', 'dashboard']);
    
    // 根据决策刷新用户信息
    if (decisions.userInfo) {
      console.log('[Dashboard] 需要刷新用户信息');
      this.loadUserInfo(true).then(userInfo => {
        if (userInfo) {
          this.setData({
            engineerInfo: userInfo
          });
          RefreshManager.recordRefresh('userInfo');
        }
      });
    } else {
      // 使用缓存的用户信息
      this.loadUserInfo(false).then(userInfo => {
        if (userInfo) {
          this.setData({
            engineerInfo: userInfo
          });
        }
      });
    }
    
    // 根据决策刷新仪表板数据
    if (decisions.dashboard) {
      console.log('[Dashboard] 需要刷新仪表板数据');
      this.refreshDashboardData();
      RefreshManager.recordRefresh('dashboard');
    }
  },
  
  onHide() {
    // 页面隐藏时设置为非活跃
    RefreshManager.setPageActive('dashboard', false);
  },

  onUnload() {
    this.stopAutoRefresh();
    
    // 移除事件监听，使用监听器ID
    if (this.app && this.app.eventBus && this.avatarListenerId) {
      this.app.eventBus.off(this.app.EVENTS.AVATAR_UPDATED, this.avatarListenerId);
      console.log('[Dashboard] 已移除头像更新事件监听, ID:', this.avatarListenerId);
    }
  },

  // 下拉刷新处理
  async onPullDownRefresh() {
    console.log('[Dashboard] 用户下拉刷新');
    
    try {
      // 强制刷新用户信息（清除缓存）
      const [userInfo, ticketStats, urgentTickets, latestTickets] = await Promise.all([
        this.loadUserInfo(true),  // 传入true强制刷新
        this.loadTicketStats(),
        this.loadUrgentTickets(),
        this.loadLatestTickets()
      ]);
      
      // 更新页面数据
      this.setData({
        engineerInfo: userInfo,
        todayStats: ticketStats,
        urgentTickets: urgentTickets,
        latestTickets: latestTickets,
        lastUpdateTime: this.formatTime(new Date())
      });
      
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

  // 加载工作台数据
  async loadDashboardData() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    try {
      // 并行获取所有数据
      const [userInfo, ticketStats, urgentTickets, latestTickets, notifications] = await Promise.all([
        this.loadUserInfo(),
        this.loadTicketStats(),
        this.loadUrgentTickets(),
        this.loadLatestTickets(),
        this.loadNotifications()
      ]);
      
      // 更新页面数据
      this.setData({
        engineerInfo: userInfo,
        todayStats: ticketStats,
        urgentTickets: urgentTickets,
        latestTickets: latestTickets,
        lastUpdateTime: this.formatTime(new Date())
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      // 如果数据库加载失败，使用模拟数据
      const mockData = this.getMockDashboardData();
      this.setData({
        engineerInfo: mockData.engineerInfo,
        todayStats: mockData.todayStats,
        urgentTickets: mockData.urgentTickets,
        latestTickets: mockData.latestTickets,
        lastUpdateTime: this.formatTime(new Date())
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 刷新数据
  async refreshDashboardData() {
    try {
      // 刷新统计数据
      const [ticketStats, urgentTickets, latestTickets] = await Promise.all([
        this.loadTicketStats(),
        this.loadUrgentTickets(),
        this.loadLatestTickets()
      ]);
      
      this.setData({
        todayStats: ticketStats,
        urgentTickets: urgentTickets,
        latestTickets: latestTickets,
        lastUpdateTime: this.formatTime(new Date())
      });
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  },

  // 开始自动刷新
  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      this.refreshDashboardData();
    }, 30000); // 30秒刷新一次
  },

  // 停止自动刷新
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  },

  // 统计项点击
  onStatClick(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/ticket-list/index?filter=${type}`
    });
  },

  // 快捷操作点击
  onQuickAction(e) {
    const action = e.currentTarget.dataset.action;
    
    // 这些功能开发中
    if (action === 'materials' || action === 'stats' || action === 'help') {
      wx.showToast({
        title: '功能开发中',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    const routes = {
      'my-tickets': '/pages/ticket-list/index'
    };
    
    if (routes[action]) {
      wx.navigateTo({
        url: routes[action]
      });
    }
  },

  // 导航到紧急工单
  navigateToUrgentTickets() {
    wx.navigateTo({
      url: '/pages/ticket-list/index?filter=urgent'
    });
  },

  // 导航到工单列表
  navigateToTicketList() {
    wx.switchTab({
      url: '/pages/ticket-list/index'
    });
  },

  // 导航到工单详情
  navigateToTicketDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-detail/index?id=${id}`
    });
  },

  // 接受工单（开始处理）
  async acceptTicket(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    const ticketId = e.currentTarget.dataset.id;
    const that = this;
    
    console.log('[Dashboard acceptTicket] 开始接单，工单ID:', ticketId);
    console.log('[Dashboard acceptTicket] 当前用户信息:', this.app.globalData);
    
    wx.showModal({
      title: '确认接单',
      content: '确定要开始处理这个工单吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          try {
            console.log('[Dashboard acceptTicket] 准备调用云函数...');
            console.log('[Dashboard acceptTicket] 云函数参数:', {
              action: 'acceptTicket',
              ticketId: ticketId
            });
            
            // 使用云函数接单
            const result = await wx.cloud.callFunction({
              name: 'submitTicket',
              data: {
                action: 'acceptTicket',
                ticketId: ticketId
              }
            });
            
            console.log('[Dashboard acceptTicket] 云函数完整返回:', result);
            console.log('[Dashboard acceptTicket] result.result:', result.result);
            console.log('[Dashboard acceptTicket] result.result.code:', result.result?.code);
            console.log('[Dashboard acceptTicket] result.result.message:', result.result?.message);
            
            if (result.result && result.result.code === 200) {
              console.log('[Dashboard acceptTicket] 接单成功！');
              wx.hideLoading();
              wx.showToast({
                title: '接单成功',
                icon: 'success'
              });
              
              // 刷新页面数据
              setTimeout(() => {
                console.log('[Dashboard acceptTicket] 刷新数据...');
                that.loadDashboardData();
              }, 1500);
            } else {
              // 处理错误
              console.error('[Dashboard acceptTicket] 接单失败，错误信息:', result.result);
              const message = result.result?.message || '接单失败';
              const code = result.result?.code;
              
              wx.hideLoading();
              
              if (code === 409 || message.includes('已被接单')) {
                wx.showModal({
                  title: '接单失败',
                  content: '该工单已被其他工程师接单',
                  showCancel: false,
                  success: () => {
                    that.loadDashboardData();
                  }
                });
              } else if (code === 403) {
                wx.showModal({
                  title: '权限不足',
                  content: '您没有接单权限，请确认您的角色是工程师或经理',
                  showCancel: false
                });
              } else {
                wx.showModal({
                  title: '接单失败',
                  content: message,
                  showCancel: false,
                  success: () => {
                    that.loadDashboardData();
                  }
                });
              }
            }
          } catch (error) {
            console.error('[Dashboard acceptTicket] 调用云函数出错:', error);
            console.error('[Dashboard acceptTicket] 错误堆栈:', error.stack);
            wx.hideLoading();
            wx.showModal({
              title: '接单失败',
              content: '网络错误或云函数调用失败，请重试',
              showCancel: false
            });
          }
        }
      }
    });
  },

  // 开始处理工单（已废弃，改用acceptTicket）
  startProcessing(e) {
    // 调用新的接单方法
    this.acceptTicket(e);
  },

  // 查看详情
  viewDetail(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-detail/index?id=${id}`
    });
  },

  // 更新工单状态 - 使用云函数版本
  async updateTicketStatus(ticketId, status) {
    wx.showLoading({
      title: '处理中...'
    });

    try {
      // 获取当前用户信息
      const userInfo = this.app.globalData.userInfo;
      
      // 使用云函数更新状态
      const result = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: {
          action: 'updateStatus',
          ticketId: ticketId,
          status: status,
          assigneeName: userInfo?.nickName || this.data.engineerInfo.name
        }
      });
      
      console.log('[dashboard updateTicketStatus] 云函数返回:', result);
      
      if (result.result && result.result.code === 200) {
        wx.hideLoading();
        wx.showToast({
          title: '操作成功',
          icon: 'success'
        });
        
        // 刷新数据
        this.loadDashboardData();
      } else {
        throw new Error(result.result?.message || '更新失败');
      }
    } catch (error) {
      console.error('[dashboard] 更新工单状态失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },


  // 获取状态主题
  getStatusTheme(status) {
    const themes = {
      pending: 'warning',
      processing: 'primary',
      resolved: 'success',
      cancelled: 'default',
      paused: 'warning'  // 暂停状态使用警告色
    };
    return themes[status] || 'default';
  },

  // 格式化时间
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前';
    } else if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前';
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  },

  // 选择头像（新的微信API）
  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('[Dashboard] 选择的头像:', avatarUrl);
    
    if (!avatarUrl) return;

    // 检查网络状态
    if (!NetworkHandler.isNetworkConnected()) {
      wx.showToast({
        title: '网络未连接，请检查网络',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({ title: '上传中...' });

    try {
      // 获取openid
      const openid = this.app.globalData.openid || wx.getStorageSync('openid');
      if (!openid) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      // 上传头像到云存储（带重试）
      const cloudPath = `avatars/${openid}_${Date.now()}.png`;
      const uploadRes = await NetworkHandler.uploadFileWithRetry({
        cloudPath,
        filePath: avatarUrl
      });

      console.log('[Dashboard] 头像上传成功:', uploadRes.fileID);

      // 更新数据库中的用户头像（带重试）
      await NetworkHandler.databaseOperationWithRetry(async () => {
        return this.db.collection('users').where({
          openid: openid
        }).update({
          data: {
            avatar: uploadRes.fileID,
            avatarUpdateTime: new Date(),
            updateTime: new Date()
          }
        });
      });

      // 更新本地显示
      this.setData({
        'engineerInfo.avatar': uploadRes.fileID
      });

      // 更新缓存
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.avatar = uploadRes.fileID;
      wx.setStorageSync('userInfo', userInfo);

      // 更新全局数据
      if (this.app.globalData.userInfo) {
        this.app.globalData.userInfo.avatar = uploadRes.fileID;
      }
      
      // 更新头像缓存并触发全局事件
      const UserCache = require('../../utils/user-cache');
      await UserCache.updateAvatarCache(uploadRes.fileID);
      console.log('[Dashboard] 已更新头像缓存并触发全局事件');

      wx.hideLoading();
      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      });

    } catch (error) {
      console.error('[Dashboard] 头像更新失败:', error);
      wx.hideLoading();
      
      // 显示友好的错误提示
      NetworkHandler.showErrorDialog(error, {
        title: '头像更新失败',
        confirmText: '重试',
        cancelText: '取消',
        onConfirm: () => {
          // 重新触发选择头像
          this.onChooseAvatar(e);
        }
      });
    }
  },


  // 加载用户信息（使用缓存）
  async loadUserInfo(forceRefresh = false) {
    console.log('[Dashboard.loadUserInfo] 开始加载用户信息, forceRefresh:', forceRefresh);
    try {
      const app = getApp();
      
      // 使用缓存管理器获取用户信息
      const userInfo = await UserCache.getUserInfo(forceRefresh);
      console.log('[Dashboard.loadUserInfo] 获取到的用户信息:', userInfo);
      
      if (!userInfo) {
        console.log('[Dashboard.loadUserInfo] 用户信息为空，返回默认值');
        // 如果没有用户信息，返回默认值
        return {
          name: '微信用户',
          avatar: '',
          status: 'online',
          currentTasks: 0,
          maxTasks: 10,
          location: '技术部'
        };
      }
      
      // 获取分配给当前用户的进行中工单数
      const processingCount = await this.db.collection('tickets').where({
        assigneeOpenid: app.globalData.openid || userInfo.openid,
        status: 'processing'
      }).count();
      
      // 实现三级头像优先级
      let avatarUrl = '';
      
      // 1. 优先使用本地缓存的非默认头像
      if (userInfo.localAvatar && !userInfo.localAvatar.includes('thirdwx.qlogo.cn')) {
        avatarUrl = userInfo.localAvatar;
        console.log('[Dashboard.loadUserInfo] 使用本地缓存头像:', avatarUrl);
      }
      // 2. 如果没有本地缓存但有云存储头像，尝试下载并缓存
      else if (userInfo.avatar && userInfo.avatar.startsWith('cloud://')) {
        console.log('[Dashboard.loadUserInfo] 检测到云存储头像，尝试获取本地缓存或下载');
        // 如果UserCache没有自动下载（比如是刷新场景），这里手动下载
        if (!userInfo.localAvatar || userInfo.localAvatar.includes('thirdwx.qlogo.cn')) {
          console.log('[Dashboard.loadUserInfo] 本地无有效缓存，开始下载云存储头像');
          const localPath = await UserCache.downloadAndCacheAvatar(userInfo.avatar);
          if (localPath) {
            avatarUrl = localPath;
            console.log('[Dashboard.loadUserInfo] 云存储头像已下载到本地:', localPath);
          } else {
            // 下载失败，使用云存储URL
            avatarUrl = userInfo.avatar;
            console.log('[Dashboard.loadUserInfo] 下载失败，使用云存储URL');
          }
        } else {
          avatarUrl = userInfo.localAvatar;
          console.log('[Dashboard.loadUserInfo] 使用已缓存的云存储头像');
        }
      }
      // 3. 都没有则使用默认
      else {
        avatarUrl = userInfo.avatar || '';
        console.log('[Dashboard.loadUserInfo] 使用默认头像或空');
      }
      
      console.log('[Dashboard.loadUserInfo] 最终决定使用的头像URL:', avatarUrl);
      
      const result = {
        name: userInfo.nickName || '微信用户',  // 使用nickName字段
        nickName: userInfo.nickName || '微信用户',  // 同时保留nickName字段
        avatar: avatarUrl,
        status: userInfo.status || 'online',
        currentTasks: processingCount.total || 0,
        maxTasks: 10,
        location: userInfo.department || '技术部',
        phone: userInfo.phone || '',
        email: userInfo.email || ''
      };
      
      console.log('[Dashboard.loadUserInfo] 返回的用户信息:', result);
      return result;
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 返回默认信息
      return {
        name: '微信用户',  // 默认用户名
        nickName: '微信用户',  // 同时保留nickName字段
        avatar: '',
        status: 'online',
        currentTasks: 0,
        maxTasks: 10,
        location: '技术部'
      };
    }
  },
  
  // 加载工单统计 - 重构版本
  async loadTicketStats() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      const userInfo = app.globalData.userInfo;
      const roleGroup = userInfo?.roleGroup || '用户';
      
      if (!openid) {
        console.log('[Dashboard] 等待用户openid...');
        return this.getDefaultStats();
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const db = this.db;
      const _ = db.command;
      
      // 根据角色返回不同的统计
      if (roleGroup === '经理') {
        // 经理：全局视角
        const [allPending, allProcessing, todayResolved, allUrgent] = await Promise.all([
          // 所有待处理
          db.collection('tickets').where({ 
            status: 'pending' 
          }).count(),
          
          // 所有处理中
          db.collection('tickets').where({ 
            status: 'processing' 
          }).count(),
          
          // 今日完成（全部）
          db.collection('tickets').where({
            status: _.in(['resolved', 'closed']),
            updateTime: _.gte(today)
          }).count(),
          
          // 所有紧急工单
          db.collection('tickets').where({
            priority: 'urgent',
            status: _.in(['pending', 'processing'])
          }).count()
        ]);
        
        return [
          { key: 'pending', label: '待处理', value: allPending.total || 0, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
          { key: 'processing', label: '处理中', value: allProcessing.total || 0, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
          { key: 'resolved', label: '今日完成', value: todayResolved.total || 0, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
          { key: 'urgent', label: '紧急', value: allUrgent.total || 0, colorClass: 'text-red', icon: '/assets/icons/urgent-icon.png' }
        ];
        
      } else if (roleGroup === '工程师') {
        // 工程师：工单池 + 个人视角
        const [poolTickets, myProcessing, myPaused, myTodayResolved, urgentTickets] = await Promise.all([
          // 工单池（未分配的待处理）
          db.collection('tickets').where(_.and([
            { status: 'pending' },
            _.or([
              { assigneeOpenid: _.exists(false) },
              { assigneeOpenid: '' },
              { assigneeOpenid: null }
            ])
          ])).count(),
          
          // 我的处理中
          db.collection('tickets').where({
            assigneeOpenid: openid,
            status: 'processing'
          }).count(),
          
          // 我的暂停（pending状态但有assigneeOpenid）
          db.collection('tickets').where({
            assigneeOpenid: openid,
            status: 'pending'
          }).count(),
          
          // 我今日完成
          db.collection('tickets').where({
            assigneeOpenid: openid,
            status: _.in(['resolved', 'closed']),
            updateTime: _.gte(today)
          }).count(),
          
          // 紧急（工单池的 + 我的）
          db.collection('tickets').where(_.and([
            { priority: 'urgent' },
            _.or([
              // 工单池中的紧急
              _.and([
                { status: 'pending' },
                _.or([
                  { assigneeOpenid: _.exists(false) },
                  { assigneeOpenid: '' }
                ])
              ]),
              // 我负责的紧急
              { assigneeOpenid: openid }
            ])
          ])).count()
        ]);
        
        return [
          { key: 'pool', label: '待接单', value: poolTickets.total || 0, colorClass: 'text-green', icon: '/assets/icons/pending-icon.png' },
          { key: 'processing', label: '处理中', value: myProcessing.total || 0, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
          { key: 'paused', label: '已暂停', value: myPaused.total || 0, colorClass: 'text-orange', icon: '/assets/icons/pause-icon.png' },
          { key: 'resolved', label: '今日完成', value: myTodayResolved.total || 0, colorClass: 'text-cyan', icon: '/assets/icons/completed-icon.png' },
          { key: 'urgent', label: '紧急', value: urgentTickets.total || 0, colorClass: 'text-red', icon: '/assets/icons/urgent-icon.png' }
        ];
        
      } else {
        // 普通用户：只看自己创建的
        const [myPending, myProcessing, myResolved] = await Promise.all([
          db.collection('tickets').where({
            openid: openid,
            status: 'pending'
          }).count(),
          
          db.collection('tickets').where({
            openid: openid,
            status: 'processing'
          }).count(),
          
          db.collection('tickets').where({
            openid: openid,
            status: _.in(['resolved', 'closed'])
          }).count()
        ]);
        
        const total = myPending.total + myProcessing.total + myResolved.total;
        
        return [
          { key: 'pending', label: '待处理', value: myPending.total || 0, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
          { key: 'processing', label: '处理中', value: myProcessing.total || 0, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
          { key: 'resolved', label: '已完成', value: myResolved.total || 0, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
          { key: 'total', label: '全部', value: total, colorClass: 'text-gray', icon: '/assets/icons/stats-icon.png' }
        ];
      }
    } catch (error) {
      console.error('[Dashboard] 加载工单统计失败:', error);
      return this.getDefaultStats();
    }
  },
  
  // 获取默认统计数据
  getDefaultStats() {
    return [
      { key: 'pending', label: '待处理', value: 0, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
      { key: 'processing', label: '进行中', value: 0, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
      { key: 'resolved', label: '已完成', value: 0, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
      { key: 'urgent', label: '紧急', value: 0, colorClass: 'text-red', icon: '/assets/icons/urgent-icon.png' }
    ];
  },
  
  // 加载紧急工单 - 重构版本
  async loadUrgentTickets() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      const userInfo = app.globalData.userInfo;
      const roleGroup = userInfo?.roleGroup || '用户';
      
      if (!openid) {
        return [];
      }
      
      const db = this.db;
      const _ = db.command;
      
      let whereCondition;
      
      if (roleGroup === '经理') {
        // 经理：看到所有紧急工单
        whereCondition = _.and([
          { priority: 'urgent' },
          { status: _.in(['pending', 'processing']) }
        ]);
      } else if (roleGroup === '工程师') {
        // 工程师：看工单池的紧急 + 自己的紧急
        whereCondition = _.and([
          { priority: 'urgent' },
          { status: _.in(['pending', 'processing']) },
          _.or([
            // 工单池中的紧急（未分配）
            _.and([
              { status: 'pending' },
              _.or([
                { assigneeOpenid: _.exists(false) },
                { assigneeOpenid: '' }
              ])
            ]),
            // 我负责的紧急
            { assigneeOpenid: openid }
          ])
        ]);
      } else {
        // 普通用户：只看自己创建的紧急工单
        whereCondition = _.and([
          { openid: openid },
          { priority: 'urgent' },
          { status: _.in(['pending', 'processing']) }
        ]);
      }
      
      const res = await db.collection('tickets')
        .where(whereCondition)
        .orderBy('updateTime', 'desc')  // 按更新时间排序，最近有动作的优先
        .limit(3)
        .get();
      
      return res.data.map(ticket => ({
        id: ticket._id,
        title: ticket.title || ticket.description || '紧急工单',
        isPool: !ticket.assigneeOpenid && ticket.status === 'pending',
        isMine: ticket.assigneeOpenid === openid
      }));
    } catch (error) {
      console.error('[Dashboard] 加载紧急工单失败:', error);
      return [];
    }
  },
  
  // 加载待处理工单 - 只显示待处理状态的工单
  async loadLatestTickets() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      const userInfo = app.globalData.userInfo;
      const roleGroup = userInfo?.roleGroup || '用户';
      
      if (!openid) {
        console.log('[Dashboard] 等待用户openid...');
        return [];
      }
      
      const db = this.db;
      const _ = db.command;
      
      let whereCondition;
      
      if (roleGroup === '经理') {
        // 经理：看所有待处理工单
        whereCondition = { status: 'pending' };
      } else if (roleGroup === '工程师') {
        // 工程师：看工单池（未分配）+ 自己负责的待处理
        whereCondition = _.and([
          { status: 'pending' },
          _.or([
            // 工单池（未分配）
            _.or([
              { assigneeOpenid: _.exists(false) },
              { assigneeOpenid: '' }
            ]),
            // 自己负责的
            { assigneeOpenid: openid }
          ])
        ]);
      } else {
        // 普通用户：只看自己创建的待处理工单
        whereCondition = _.and([
          { openid: openid },
          { status: 'pending' }
        ]);
      }
      
      // 获取待处理工单
      const res = await db.collection('tickets')
        .where(whereCondition)
        .orderBy('priority', 'desc')  // 优先级高的排前面
        .orderBy('updateTime', 'desc')  // 然后按更新时间排序，最近有动作的优先
        .limit(5)
        .get();
      
      if (res.data.length === 0) {
        // 没有待处理工单时返回空数组
        return [];
      }
      
      return res.data.map(ticket => {
        // 判断是否是暂停状态（pending但有assignee）
        let displayStatus = ticket.status || 'pending';
        if (ticket.status === 'pending' && ticket.assigneeOpenid) {
          displayStatus = 'paused';  // UI显示为暂停
        }
        
        return {
          id: ticket._id,
          ticketNo: ticket.ticketNo || ticket._id.slice(-6).toUpperCase(),  // 去掉#前缀
          title: ticket.title || ticket.description || '工单',
          category: ticket.category || '其他',  // 新增问题类型
          priority: ticket.priority || 'normal',
          status: displayStatus,  // 使用显示状态
          realStatus: ticket.status,  // 保留真实状态
          submitter: ticket.submitterName || ticket.userName || '用户',
          company: ticket.company || '',  // 新增公司字段
          location: ticket.location || ticket.department || '未知位置',
          createTime: ticket.createTime || ticket.createdAt,
          createTimeDisplay: this.formatTime(ticket.createTime || ticket.createdAt),  // 专门用于显示创建时间
          updateTime: this.formatTime(ticket.updateTime || ticket.createTime || ticket.createdAt),
          // 标记工单类型
          isPool: !ticket.assigneeOpenid && ticket.status === 'pending',  // 工单池
          isMine: ticket.assigneeOpenid === openid,  // 我的工单
          isPaused: ticket.status === 'pending' && ticket.assigneeOpenid === openid,  // 我的暂停工单
          assigneeName: ticket.assigneeName || '',  // 负责人名称，所有角色可见
          assigneeOpenid: ticket.assigneeOpenid || ''
        };
      });
    } catch (error) {
      console.error('[Dashboard] 加载待处理工单失败:', error);
      return [];
    }
  },
  
  // 加载通知消息
  async loadNotifications() {
    try {
      const app = getApp();
      const openid = app.globalData.openid || 'test_engineer_001';
      
      // 获取未读通知数
      const unreadCount = await this.db.collection('notifications')
        .where({
          userOpenid: openid,
          isRead: false
        })
        .count();
      
      // 更新未读通知数（如果需要显示）
      if (unreadCount.total > 0) {
        // 可以在页面上显示未读消息提示
        console.log('未读通知数：', unreadCount.total);
      }
      
      return unreadCount.total;
    } catch (error) {
      console.error('加载通知失败:', error);
      return 0;
    }
  },
  
  // 获取模拟数据
  getMockDashboardData() {
    // 获取保存的头像
    const savedAvatar = wx.getStorageSync('userAvatar') || '';
    
    return {
      engineerInfo: {
        name: '张工程师',
        avatar: savedAvatar,
        status: 'online',
        currentTasks: 5,
        maxTasks: 10,
        location: '行政楼2楼'
      },
      todayStats: [
        { key: 'pending', label: '待处理', value: 3, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
        { key: 'processing', label: '进行中', value: 5, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
        { key: 'resolved', label: '已完成', value: 2, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
        { key: 'urgent', label: '紧急', value: 1, colorClass: 'text-red', icon: '/assets/icons/urgent-icon.png' }
      ],
      urgentTickets: [
        { id: 'TK001215', title: '电脑无法开机' }
      ],
      latestTickets: [
        {
          id: 'TK001215',
          ticketNo: '#TK001215',
          title: '电脑无法开机',
          priority: 'urgent',
          status: 'pending',
          submitter: '张三',
          location: '财务部3楼',
          createTime: '10分钟前'
        },
        {
          id: 'TK001213',
          ticketNo: '#TK001213',
          title: '网络连接问题',
          priority: 'high',
          status: 'pending',
          submitter: '王五',
          location: '市场部4楼',
          createTime: '1小时前'
        }
      ]
    };
  },
  
  /**
   * 处理头像更新事件
   * @param {Object} data 更新数据
   */
  handleAvatarUpdate(data) {
    console.log('[Dashboard] 收到头像更新通知:', data);
    
    // 优先使用本地路径，其次是临时URL，最后是文件ID
    const avatarUrl = data.localPath || data.tempUrl || data.fileID;
    
    if (avatarUrl) {
      // 更新页面显示
      this.setData({
        'engineerInfo.avatar': avatarUrl
      });
      console.log('[Dashboard] 头像已更新为:', avatarUrl);
      
      // 更新缓存中的用户信息
      const cachedUserInfo = wx.getStorageSync('cached_user_info');
      if (cachedUserInfo) {
        cachedUserInfo.avatar = data.fileID || avatarUrl;
        cachedUserInfo.localAvatar = data.localPath || avatarUrl;
        wx.setStorageSync('cached_user_info', cachedUserInfo);
        console.log('[Dashboard] 已更新缓存中的头像信息');
      }
    }
  }
});