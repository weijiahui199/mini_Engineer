// 工程师工作台页面
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
      cancelled: '已取消'
    },
    
    // 最后更新时间
    lastUpdateTime: '刚刚',
    
    // 今日统计
    todayStats: [
      { key: 'pending', label: '待处理', value: 3, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
      { key: 'processing', label: '进行中', value: 5, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
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
    
    // 延迟加载数据，等待app初始化完成
    setTimeout(() => {
      this.loadDashboardData();
    }, 500);
    
    this.startAutoRefresh();
  },

  onShow() {
    this.refreshDashboardData();
  },

  onUnload() {
    this.stopAutoRefresh();
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

  // 开始处理工单
  startProcessing(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认操作',
      content: '确定要开始处理这个工单吗？',
      success: (res) => {
        if (res.confirm) {
          this.updateTicketStatus(id, 'processing');
        }
      }
    });
  },

  // 查看详情
  viewDetail(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-detail/index?id=${id}`
    });
  },

  // 更新工单状态
  async updateTicketStatus(ticketId, status) {
    wx.showLoading({
      title: '处理中...'
    });

    try {
      // 获取当前用户信息
      const userInfo = this.app.globalData.userInfo;
      
      // 更新工单状态
      await this.db.collection('tickets').doc(ticketId).update({
        data: {
          status: status,
          assigneeOpenid: userInfo.openid || this.app.globalData.openid,
          assigneeName: userInfo.name || this.data.engineerInfo.name,
          updateTime: new Date()
        }
      });
      
      wx.showToast({
        title: '操作成功',
        icon: 'success'
      });
      
      // 刷新数据
      this.loadDashboardData();
    } catch (error) {
      console.error('更新工单状态失败:', error);
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
      cancelled: 'default'
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

  // 更换头像
  changeAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        // 这里应该上传到服务器，现在先保存在本地
        this.uploadAvatar(tempFilePath);
      }
    });
  },

  // 上传头像
  uploadAvatar(filePath) {
    wx.showLoading({
      title: '上传中...'
    });
    
    // 模拟上传过程
    setTimeout(() => {
      // 更新头像
      this.setData({
        'engineerInfo.avatar': filePath
      });
      
      // 保存到本地存储
      wx.setStorageSync('userAvatar', filePath);
      
      wx.hideLoading();
      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      });
    }, 1500);
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
      
      // 获取分配给当前用户的进行中工单数
      const processingCount = await this.db.collection('tickets').where({
        assigneeOpenid: app.globalData.openid || 'test_engineer_001',
        status: 'processing'
      }).count();
      
      // 获取保存的头像
      const savedAvatar = wx.getStorageSync('userAvatar') || '';
      
      return {
        name: userInfo?.nickName || '微信用户',  // 使用nickName字段
        avatar: savedAvatar || userInfo?.avatar || '',
        status: userInfo?.status || 'online',
        currentTasks: processingCount.total || 5,
        maxTasks: 10,
        location: userInfo?.department || '技术部',
        phone: userInfo?.phone || '',
        email: userInfo?.email || ''
      };
    } catch (error) {
      console.error('加载用户信息失败:', error);
      // 返回默认信息
      return {
        name: '微信用户',  // 默认用户名
        avatar: wx.getStorageSync('userAvatar') || '',
        status: 'online',
        currentTasks: 5,
        maxTasks: 10,
        location: '技术部'
      };
    }
  },
  
  // 加载工单统计
  async loadTicketStats() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      const userInfo = app.globalData.userInfo;
      
      if (!openid) {
        console.log('等待用户openid...');
        return this.getDefaultStats();
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const db = this.db;
      const _ = db.command;
      
      // 构建查询条件
      let baseQuery;
      
      // 经理可以看到所有工单和分配给自己的工单
      if (userInfo?.roleGroup === '经理') {
        // 经理看到所有工单的统计 + 分配给自己的工单
        baseQuery = {}; // 不限制，看到所有工单
      } else {
        // 工程师只看分配给自己的工单
        baseQuery = _.or([
          { assignedTo: openid },
          { assigneeOpenid: openid }
        ]);
      }
      
      // 并行获取各种状态的工单数量
      let pending, processing, resolved, urgent;
      
      if (userInfo?.roleGroup === '经理') {
        // 经理看到两部分数据：全部工单 + 分配给自己的工单
        const myQuery = _.or([
          { assignedTo: openid },
          { assigneeOpenid: openid }
        ]);
        
        [pending, processing, resolved, urgent] = await Promise.all([
          // 待处理：全部待处理 + 分配给我的待处理
          db.collection('tickets').where(_.or([
            { status: 'pending' },
            _.and([myQuery, { status: 'pending' }])
          ])).count(),
          
          // 进行中：全部进行中 + 我正在处理的
          db.collection('tickets').where(_.or([
            { status: 'processing' },
            _.and([myQuery, { status: 'processing' }])
          ])).count(),
          
          // 今日完成
          db.collection('tickets').where(_.and([
            { status: _.in(['resolved', 'closed']) },
            { updateTime: _.gte(today) }
          ])).count(),
          
          // 紧急工单
          db.collection('tickets').where(_.and([
            { priority: 'urgent' },
            { status: _.in(['pending', 'processing']) }
          ])).count()
        ]);
      } else {
        // 工程师只看分配给自己的
        [pending, processing, resolved, urgent] = await Promise.all([
          db.collection('tickets').where(_.and([
            baseQuery,
            { status: 'pending' }
          ])).count(),
          
          db.collection('tickets').where(_.and([
            baseQuery,
            { status: 'processing' }
          ])).count(),
          
          db.collection('tickets').where(_.and([
            baseQuery,
            { status: _.in(['resolved', 'closed']) },
            { updateTime: _.gte(today) }
          ])).count(),
          
          db.collection('tickets').where(_.and([
            baseQuery,
            { priority: 'urgent' },
            { status: _.in(['pending', 'processing']) }
          ])).count()
        ]);
      }
      
      return [
        { key: 'pending', label: '待处理', value: pending.total || 0, colorClass: 'text-orange', icon: '/assets/icons/pending-icon.png' },
        { key: 'processing', label: '进行中', value: processing.total || 0, colorClass: 'text-blue', icon: '/assets/icons/processing-icon.png' },
        { key: 'resolved', label: '已完成', value: resolved.total || 0, colorClass: 'text-green', icon: '/assets/icons/completed-icon.png' },
        { key: 'urgent', label: '紧急', value: urgent.total || 0, colorClass: 'text-red', icon: '/assets/icons/urgent-icon.png' }
      ];
    } catch (error) {
      console.error('加载工单统计失败:', error);
      // 返回默认统计
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
  
  // 加载紧急工单
  async loadUrgentTickets() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      const userInfo = app.globalData.userInfo;
      
      if (!openid) {
        return [];
      }
      
      const db = this.db;
      const _ = db.command;
      
      let whereCondition;
      
      if (userInfo?.roleGroup === '经理') {
        // 经理看到所有紧急工单
        whereCondition = _.and([
          { priority: 'urgent' },
          { status: _.in(['pending', 'processing']) }
        ]);
      } else {
        // 工程师只看分配给自己的紧急工单
        whereCondition = _.and([
          _.or([
            { assignedTo: openid },
            { assigneeOpenid: openid }
          ]),
          { priority: 'urgent' },
          { status: _.in(['pending', 'processing']) }
        ]);
      }
      
      const res = await db.collection('tickets')
        .where(whereCondition)
        .orderBy('createTime', 'desc')
        .limit(3)
        .get();
      
      return res.data.map(ticket => ({
        id: ticket._id,
        title: ticket.title || ticket.description || '紧急工单'
      }));
    } catch (error) {
      console.error('加载紧急工单失败:', error);
      return [];
    }
  },
  
  // 加载最新工单
  async loadLatestTickets() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      const userInfo = app.globalData.userInfo;
      
      if (!openid) {
        console.log('等待用户openid...');
        return this.getDefaultLatestTickets();
      }
      
      const db = this.db;
      const _ = db.command;
      
      let whereCondition;
      
      if (userInfo?.roleGroup === '经理') {
        // 经理看到所有最新工单
        whereCondition = {};
      } else {
        // 工程师只看分配给自己的
        whereCondition = _.or([
          { assignedTo: openid },
          { assigneeOpenid: openid }
        ]);
      }
      
      // 获取最新工单
      const res = await db.collection('tickets')
        .where(whereCondition)
        .orderBy('createTime', 'desc')
        .limit(5)
        .get();
      
      if (res.data.length === 0) {
        return this.getDefaultLatestTickets();
      }
      
      return res.data.map(ticket => ({
        id: ticket._id,
        ticketNo: ticket.ticketNo ? '#' + ticket.ticketNo : '#' + ticket._id.slice(-6).toUpperCase(),
        title: ticket.title || ticket.description || '工单',
        priority: ticket.priority || 'medium',
        status: ticket.status || 'pending',
        submitter: ticket.submitterName || ticket.userName || '用户',
        location: ticket.location || ticket.department || '未知位置',
        createTime: this.formatTime(ticket.createTime || ticket.createdAt)
      }));
    } catch (error) {
      console.error('加载最新工单失败:', error);
      // 返回默认数据
      return this.getDefaultLatestTickets();
    }
  },
  
  // 获取默认最新工单
  getDefaultLatestTickets() {
    return [
      {
        id: 'default_1',
        ticketNo: '#暂无',
        title: '暂无待处理工单',
        priority: 'low',
        status: 'pending',
        submitter: '-',
        location: '-',
        createTime: '-'
      }
    ];
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
          id: 'TK001214',
          ticketNo: '#TK001214',
          title: '打印机故障',
          priority: 'high',
          status: 'processing',
          submitter: '李四',
          location: '人事部2楼',
          createTime: '30分钟前'
        },
        {
          id: 'TK001213',
          ticketNo: '#TK001213',
          title: '网络连接问题',
          priority: 'medium',
          status: 'pending',
          submitter: '王五',
          location: '市场部4楼',
          createTime: '1小时前'
        }
      ]
    };
  }
});