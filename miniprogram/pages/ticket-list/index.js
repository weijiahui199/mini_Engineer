// 工单列表页面
Page({
  data: {
    userRole: 'engineer', // engineer | manager
    searchKeyword: '',
    currentFilter: 'all',
    
    // 筛选选项
    filterOptions: [
      { label: '全部', value: 'all', count: 0 },
      { label: '待处理', value: 'pending', count: 3 },
      { label: '处理中', value: 'processing', count: 5 },
      { label: '已解决', value: 'resolved', count: 2 },
      { label: '紧急', value: 'urgent', count: 1 }
    ],
    
    // 状态文本
    statusText: {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
      cancelled: '已取消',
      closed: '已关闭'
    },
    
    // 统计信息
    showStats: true,
    todayStats: {
      assigned: 8,
      completionRate: 75
    },
    
    // 工单列表
    ticketList: [],
    
    // 分页相关
    page: 1,
    pageSize: 10,
    hasMore: true,
    loadingMore: false,
    refreshing: false,
    
    // 高级筛选
    filterPopupVisible: false,
    tempFilters: {
      status: [],
      priority: [],
      timeRange: 'all'
    },
    
    statusOptions: [
      { label: '待处理', value: 'pending' },
      { label: '处理中', value: 'processing' },
      { label: '已解决', value: 'resolved' }
    ],
    
    priorityOptions: [
      { label: '紧急', value: 'urgent' },
      { label: '高', value: 'high' },
      { label: '中', value: 'medium' },
      { label: '低', value: 'low' }
    ],
    
    timeRangeOptions: [
      { label: '全部', value: 'all' },
      { label: '今天', value: 'today' },
      { label: '本周', value: 'week' },
      { label: '本月', value: 'month' }
    ],
    
    emptyText: '暂无工单'
  },

  onLoad(options) {
    // 获取用户角色
    this.getUserRole();
    
    // 处理路由参数
    if (options.filter) {
      this.setData({
        currentFilter: options.filter
      });
    }
    
    // 加载数据
    this.loadTicketList();
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshList();
  },

  // 获取用户角色
  getUserRole() {
    // 从缓存或API获取用户角色
    const role = wx.getStorageSync('userRole') || 'engineer';
    this.setData({
      userRole: role
    });
  },

  // 加载工单列表
  async loadTicketList(append = false) {
    if (this.data.loadingMore) return;
    
    this.setData({
      loadingMore: true
    });

    try {
      // 模拟API调用
      const data = this.getMockTicketData();
      
      if (append) {
        this.setData({
          ticketList: [...this.data.ticketList, ...data.list],
          hasMore: data.hasMore,
          page: this.data.page + 1
        });
      } else {
        this.setData({
          ticketList: data.list,
          hasMore: data.hasMore,
          page: 1
        });
      }
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      this.setData({
        loadingMore: false,
        refreshing: false
      });
    }
  },

  // 搜索变化
  onSearchChange(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
  },

  // 执行搜索
  onSearch() {
    this.setData({
      page: 1
    });
    this.loadTicketList();
  },

  // 筛选点击
  onFilterClick(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      currentFilter: value,
      page: 1
    });
    this.loadTicketList();
  },

  // 显示更多筛选
  showMoreFilters() {
    this.setData({
      filterPopupVisible: true,
      tempFilters: {
        status: [],
        priority: [],
        timeRange: 'all'
      }
    });
  },

  // 下拉刷新
  async onPullDownRefresh() {
    this.setData({
      refreshing: true,
      page: 1
    });
    await this.loadTicketList();
  },

  // 加载更多
  onLoadMore() {
    if (this.data.hasMore && !this.data.loadingMore) {
      this.loadTicketList(true);
    }
  },

  // 刷新列表
  refreshList() {
    this.setData({
      page: 1
    });
    this.loadTicketList();
  },

  // 导航到详情
  navigateToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-detail/index?id=${id}`
    });
  },

  // 接受工单
  acceptTicket(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认接受',
      content: '确定要接受这个工单吗？',
      success: (res) => {
        if (res.confirm) {
          this.updateTicketAssignment(id);
        }
      }
    });
  },

  // 开始处理
  startProcessing(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '开始处理',
      content: '确定要开始处理这个工单吗？',
      success: (res) => {
        if (res.confirm) {
          this.updateTicketStatus(id, 'processing');
        }
      }
    });
  },

  // 继续处理
  continueProcessing(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-detail/index?id=${id}`
    });
  },

  // 分配工单（经理功能）
  assignTicket(e) {
    e.stopPropagation();
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-assign/index?id=${id}`
    });
  },

  // 更新工单分配
  async updateTicketAssignment(ticketId) {
    wx.showLoading({
      title: '处理中...'
    });

    try {
      // 调用API更新
      wx.showToast({
        title: '接受成功',
        icon: 'success'
      });
      this.refreshList();
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  // 更新工单状态
  async updateTicketStatus(ticketId, status) {
    wx.showLoading({
      title: '处理中...'
    });

    try {
      // 调用API更新
      wx.showToast({
        title: '操作成功',
        icon: 'success'
      });
      this.refreshList();
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  // 获取滑动操作
  getSwipeActions(item) {
    const actions = [];
    
    if (item.status === 'pending') {
      actions.push({
        text: '接受',
        className: 'swipe-accept'
      });
    }
    
    if (item.status === 'processing') {
      actions.push({
        text: '暂停',
        className: 'swipe-pause'
      });
    }
    
    return actions;
  },

  // 获取状态主题
  getStatusTheme(status) {
    const themes = {
      pending: 'warning',
      processing: 'primary',
      resolved: 'success',
      cancelled: 'default',
      closed: 'default'
    };
    return themes[status] || 'default';
  },

  // 状态筛选变化
  onStatusFilterChange(e) {
    this.setData({
      'tempFilters.status': e.detail.value
    });
  },

  // 优先级筛选变化
  onPriorityFilterChange(e) {
    this.setData({
      'tempFilters.priority': e.detail.value
    });
  },

  // 时间范围变化
  onTimeRangeChange(e) {
    this.setData({
      'tempFilters.timeRange': e.detail.value
    });
  },

  // 重置筛选
  resetFilters() {
    this.setData({
      tempFilters: {
        status: [],
        priority: [],
        timeRange: 'all'
      }
    });
  },

  // 应用筛选
  applyFilters() {
    this.setData({
      filterPopupVisible: false,
      page: 1
    });
    this.loadTicketList();
  },

  // 处理筛选弹窗变化
  handleFilterPopupChange(e) {
    this.setData({
      filterPopupVisible: e.detail.visible
    });
  },

  // 刷新
  onRefresh() {
    this.refreshList();
  },

  // 获取模拟数据
  getMockTicketData() {
    return {
      list: [
        {
          id: 'TK001215',
          ticketNo: '#TK001215',
          title: '电脑无法开机',
          category: '硬件故障',
          priority: 'urgent',
          status: 'pending',
          submitter: '张三',
          location: '财务部3楼',
          createTime: '10分钟前',
          assigned: false
        },
        {
          id: 'TK001214',
          ticketNo: '#TK001214',
          title: '打印机无法连接',
          category: '设备问题',
          priority: 'high',
          status: 'processing',
          submitter: '李四',
          location: '人事部2楼',
          createTime: '30分钟前',
          assigned: true
        },
        {
          id: 'TK001213',
          ticketNo: '#TK001213',
          title: '网络连接不稳定',
          category: '网络问题',
          priority: 'medium',
          status: 'pending',
          submitter: '王五',
          location: '市场部4楼',
          createTime: '1小时前',
          assigned: true
        },
        {
          id: 'TK001212',
          ticketNo: '#TK001212',
          title: '软件安装请求',
          category: '软件服务',
          priority: 'low',
          status: 'resolved',
          submitter: '赵六',
          location: '研发部5楼',
          createTime: '2小时前',
          assigned: true
        }
      ],
      hasMore: true
    };
  }
});