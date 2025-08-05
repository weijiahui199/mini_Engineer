// 工程师工作台页面
Page({
  data: {
    // 工程师信息
    engineerInfo: {
      name: '张工程师',
      avatar: '',
      status: 'online', // online, busy, offline
      currentTasks: 5,
      maxTasks: 10,
      location: '行政楼2楼'
    },
    
    // 状态文本映射
    statusText: {
      online: '在线',
      busy: '忙碌',
      offline: '离线',
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
      cancelled: '已取消'
    },
    
    // 最后更新时间
    lastUpdateTime: '刚刚',
    
    // 今日统计
    todayStats: [
      { key: 'pending', label: '待处理', value: 3, colorClass: 'text-orange' },
      { key: 'processing', label: '进行中', value: 5, colorClass: 'text-blue' },
      { key: 'resolved', label: '已完成', value: 2, colorClass: 'text-green' },
      { key: 'urgent', label: '紧急', value: 1, colorClass: 'text-red' }
    ],
    
    // 紧急工单
    urgentTickets: [],
    
    // 快捷操作
    quickActions: [
      { key: 'my-tickets', title: '我的工单', icon: '📋' },
      { key: 'materials', title: '耗材管理', icon: '📦' },
      { key: 'help', title: '呼叫经理', icon: '📞' },
      { key: 'stats', title: '工作统计', icon: '📊' }
    ],
    
    // 最新工单
    latestTickets: [],
    
    // 状态切换弹窗
    statusPopupVisible: false,
    statusOptions: [
      { label: '在线', value: 'online' },
      { label: '忙碌', value: 'busy' },
      { label: '离线', value: 'offline' }
    ]
  },

  onLoad() {
    this.loadDashboardData();
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
      // 模拟数据加载
      const mockData = this.getMockDashboardData();
      
      this.setData({
        engineerInfo: mockData.engineerInfo,
        todayStats: mockData.todayStats,
        urgentTickets: mockData.urgentTickets,
        latestTickets: mockData.latestTickets,
        lastUpdateTime: this.formatTime(new Date())
      });
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({
        title: '数据加载失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 刷新数据
  refreshDashboardData() {
    this.setData({
      lastUpdateTime: this.formatTime(new Date())
    });
    // 这里可以调用API刷新数据
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
    const routes = {
      'my-tickets': '/pages/ticket-list/index',
      'materials': '/pages/materials/index',
      'help': '/pages/help-request/index',
      'stats': '/pages/statistics/index'
    };
    
    if (routes[action]) {
      if (action === 'stats') {
        wx.switchTab({
          url: routes[action]
        });
      } else {
        wx.navigateTo({
          url: routes[action]
        });
      }
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
      // 这里调用API更新状态
      // await api.updateTicketStatus(ticketId, status);
      
      wx.showToast({
        title: '操作成功',
        icon: 'success'
      });
      
      // 刷新数据
      this.loadDashboardData();
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  // 切换工作状态
  onStatusChange(e) {
    const newStatus = e.detail.value;
    this.setData({
      'engineerInfo.status': newStatus,
      statusPopupVisible: false
    });
    
    // 这里调用API更新状态
    wx.showToast({
      title: `已切换至${this.data.statusText[newStatus]}`,
      icon: 'success'
    });
  },

  // 处理状态弹窗变化
  handleStatusPopupChange(e) {
    this.setData({
      statusPopupVisible: e.detail.visible
    });
  },

  // 关闭状态弹窗
  closeStatusPopup() {
    this.setData({
      statusPopupVisible: false
    });
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

  // 获取模拟数据
  getMockDashboardData() {
    return {
      engineerInfo: {
        name: '张工程师',
        avatar: '',
        status: 'online',
        currentTasks: 5,
        maxTasks: 10,
        location: '行政楼2楼'
      },
      todayStats: [
        { key: 'pending', label: '待处理', value: 3, colorClass: 'text-orange' },
        { key: 'processing', label: '进行中', value: 5, colorClass: 'text-blue' },
        { key: 'resolved', label: '已完成', value: 2, colorClass: 'text-green' },
        { key: 'urgent', label: '紧急', value: 1, colorClass: 'text-red' }
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