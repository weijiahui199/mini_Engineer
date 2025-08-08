// 工单列表页面
Page({
  data: {
    userRoleGroup: '工程师', // 用户 | 工程师 | 经理
    searchKeyword: '',
    currentFilter: 'all',
    currentAssignee: 'all', // 当前选中的负责人筛选：all | my | openid
    
    // 筛选选项
    filterOptions: [
      { label: '全部', value: 'all', count: 0 },
      { label: '待处理', value: 'pending', count: 3 },
      { label: '处理中', value: 'processing', count: 5 },
      { label: '已解决', value: 'resolved', count: 2 },
      { label: '已关闭', value: 'closed', count: 0 },
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
      timeRange: 'all',
      assignee: 'all' // 负责人筛选
    },
    
    // 负责人选项列表
    assigneeOptions: [],
    
    
    timeRangeOptions: [
      { label: '全部', value: 'all' },
      { label: '今天', value: 'today' },
      { label: '本周', value: 'week' },
      { label: '本月', value: 'month' }
    ],
    
    emptyText: '暂无工单'
  },

  onLoad(options) {
    // 获取app实例和数据库
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    
    // 获取用户角色
    this.getUserRole();
    
    // 加载负责人列表
    this.loadAssigneeList();
    
    // 处理路由参数
    if (options.filter) {
      this.setData({
        currentFilter: options.filter
      });
    }
    
    // 延迟加载数据，等待app初始化完成
    setTimeout(() => {
      this.loadTicketList();
    }, 500);
  },

  onShow() {
    // 页面显示时刷新数据
    this.refreshList();
  },

  // 获取用户角色
  getUserRole() {
    // 从全局用户信息获取角色
    const userInfo = this.app.globalData.userInfo;
    const roleGroup = userInfo?.roleGroup || wx.getStorageSync('userRoleGroup') || '用户';
    this.setData({
      userRoleGroup: roleGroup
    });
  },

  // 加载工单列表
  async loadTicketList(append = false) {
    if (this.data.loadingMore) return;
    
    this.setData({
      loadingMore: true
    });

    try {
      // 构建查询条件
      const where = await this.buildQueryCondition();
      
      // 计算跳过的记录数
      const skip = append ? (this.data.page - 1) * this.data.pageSize : 0;
      
      // 查询工单数据
      const res = await this.db.collection('tickets')
        .where(where)
        .orderBy('createTime', 'desc')
        .skip(skip)
        .limit(this.data.pageSize)
        .get();
      
      // 处理查询结果
      const formattedList = res.data.map(ticket => ({
        id: ticket._id,
        ticketNo: '#' + ticket.ticketNo,
        title: ticket.title,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        submitter: ticket.submitterName,
        location: ticket.location,
        createTime: this.formatTime(ticket.createTime),
        assigned: !!ticket.assigneeOpenid,
        assigneeName: ticket.assigneeName || ''
      }));
      
      // 更新统计数据
      await this.updateFilterCounts();
      
      if (append) {
        // 过滤掉重复的工单(以id为唯一标识)
        const existingIds = new Set(this.data.ticketList.map(item => item.id));
        const newItems = formattedList.filter(item => !existingIds.has(item.id));
        
        if (newItems.length > 0) {
          this.setData({
            ticketList: [...this.data.ticketList, ...newItems],
            hasMore: res.data.length === this.data.pageSize,
            page: this.data.page + 1
          });
        } else {
          // 没有新数据，说明已经到底了
          this.setData({
            hasMore: false
          });
        }
      } else {
        this.setData({
          ticketList: formattedList,
          hasMore: res.data.length === this.data.pageSize,
          page: 0
        });
      }
    } catch (error) {
      console.error('加载工单列表失败:', error);
      // 加载失败时使用模拟数据
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
        timeRange: 'all',
        assignee: this.data.currentAssignee // 保持当前选中的负责人
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
    // 确保刷新状态被重置
    this.setData({
      refreshing: false
    });
  },

  // 加载更多
  onLoadMore() {
    if (this.data.hasMore && !this.data.loadingMore) {
      console.log('加载更多，当前页码:', this.data.page);
      this.loadTicketList(true);
    }
  },

  // 刷新列表
  refreshList() {
    this.setData({
      page: 0,
      ticketList: [],
      hasMore: true
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


  // 更新工单状态
  async updateTicketStatus(ticketId) {
    wx.showLoading({
      title: '处理中...'
    });

    try {
      const userInfo = this.app.globalData.userInfo;
      
      // 更新工单分配
      await this.db.collection('tickets').doc(ticketId).update({
        data: {
          assigneeOpenid: userInfo?.openid || this.app.globalData.openid,
          assigneeName: userInfo?.nickName || '工程师',
          status: 'processing',
          updateTime: new Date()
        }
      });
      
      wx.showToast({
        title: '接受成功',
        icon: 'success'
      });
      this.refreshList();
    } catch (error) {
      console.error('更新工单分配失败:', error);
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
      const updateData = {
        status: status,
        updateTime: new Date()
      };
      
      // 如果是解决状态，记录解决时间
      if (status === 'resolved') {
        updateData.resolveTime = new Date();
      }
      
      // 更新工单状态
      await this.db.collection('tickets').doc(ticketId).update({
        data: updateData
      });
      
      wx.showToast({
        title: '操作成功',
        icon: 'success'
      });
      this.refreshList();
    } catch (error) {
      console.error('更新工单状态失败:', error);
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
        timeRange: 'all',
        assignee: this.data.userRoleGroup === '工程师' ? 'my' : 'all'
      }
    });
  },

  // 应用筛选
  applyFilters() {
    this.setData({
      filterPopupVisible: false,
      currentAssignee: this.data.tempFilters.assignee,
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

  // 构建查询条件
  async buildQueryCondition() {
    const _ = this.db.command;
    let conditions = [];
    
    // 根据用户角色和负责人筛选过滤
    if (this.data.userRoleGroup === '工程师') {
      // 工程师只能看到分配给自己的工单
      const openid = this.app.globalData.openid;
      if (openid) {
        conditions.push(_.or([
          { assignedTo: openid },
          { assigneeOpenid: openid }
        ]));
      }
    } else if (this.data.userRoleGroup === '经理') {
      // 经理根据负责人筛选
      if (this.data.currentAssignee === 'my') {
        // "我负责的"：只看分配给自己的工单
        const openid = this.app.globalData.openid;
        if (openid) {
          conditions.push(_.or([
            { assignedTo: openid },
            { assigneeOpenid: openid }
          ]));
        }
      } else if (this.data.currentAssignee !== 'all') {
        // 选择了具体的工程师
        conditions.push(_.or([
          { assignedTo: this.data.currentAssignee },
          { assigneeOpenid: this.data.currentAssignee }
        ]));
      }
      // "全部"：不添加用户过滤条件，可以看到所有工单
    }
    
    // 根据筛选条件过滤
    if (this.data.currentFilter === 'all') {
      // "全部"筛选：不添加任何状态过滤，显示所有工单
      // 不需要添加任何条件
    } else if (this.data.currentFilter === 'urgent') {
      // 紧急筛选：显示所有紧急优先级的工单
      conditions.push({ priority: 'urgent' });
    } else {
      // 其他状态筛选：只显示特定状态的工单
      conditions.push({ status: this.data.currentFilter });
    }
    
    // 根据搜索关键词过滤
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword;
      // 搜索工单号、标题或描述
      conditions.push(_.or([
        { ticketNo: this.db.RegExp({
          regexp: keyword,
          options: 'i'
        })},
        { title: this.db.RegExp({
          regexp: keyword,
          options: 'i'
        })},
        { description: this.db.RegExp({
          regexp: keyword,
          options: 'i'
        })}
      ]));
    }
    
    // 应用高级筛选
    if (this.data.tempFilters.status && this.data.tempFilters.status.length > 0) {
      conditions.push({ status: _.in(this.data.tempFilters.status) });
    }
    if (this.data.tempFilters.priority && this.data.tempFilters.priority.length > 0) {
      conditions.push({ priority: _.in(this.data.tempFilters.priority) });
    }
    if (this.data.tempFilters.timeRange && this.data.tempFilters.timeRange !== 'all') {
      const now = new Date();
      let startTime;
      
      switch(this.data.tempFilters.timeRange) {
        case 'today':
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }
      
      if (startTime) {
        conditions.push(_.or([
          { createTime: _.gte(startTime) },
          { createdAt: _.gte(startTime) }
        ]));
      }
    }
    
    // 如果有多个条件，使用and连接
    if (conditions.length === 0) {
      return {};
    } else if (conditions.length === 1) {
      return conditions[0];
    } else {
      return _.and(conditions);
    }
  },
  
  // 更新筛选项的计数
  async updateFilterCounts() {
    try {
      const openid = this.app.globalData.openid;
      if (!openid && this.data.userRoleGroup === '工程师') {
        console.log('等待用户openid...');
        return;
      }
      
      const _ = this.db.command;
      let baseWhere = {};
      
      // 根据角色和负责人筛选设置基础查询条件
      if (this.data.userRoleGroup === '工程师') {
        if (openid) {
          baseWhere = _.or([
            { assignedTo: openid },
            { assigneeOpenid: openid }
          ]);
        }
      } else if (this.data.userRoleGroup === '经理') {
        if (this.data.currentAssignee === 'my') {
          if (openid) {
            baseWhere = _.or([
              { assignedTo: openid },
              { assigneeOpenid: openid }
            ]);
          }
        } else if (this.data.currentAssignee !== 'all') {
          baseWhere = _.or([
            { assignedTo: this.data.currentAssignee },
            { assigneeOpenid: this.data.currentAssignee }
          ]);
        }
      }
      // 经理选择"全部"时不设置基础条件
      
      // 并行获取各种状态的计数
      const [total, pending, processing, resolved, closed, urgent] = await Promise.all([
        // 全部工单：不设置状态过滤
        this.db.collection('tickets').where(
          baseWhere || {}
        ).count(),
        this.db.collection('tickets').where(
          baseWhere ? _.and([baseWhere, { status: 'pending' }]) : { status: 'pending' }
        ).count(),
        this.db.collection('tickets').where(
          baseWhere ? _.and([baseWhere, { status: 'processing' }]) : { status: 'processing' }
        ).count(),
        this.db.collection('tickets').where(
          baseWhere ? _.and([baseWhere, { status: 'resolved' }]) : { status: 'resolved' }
        ).count(),
        this.db.collection('tickets').where(
          baseWhere ? _.and([baseWhere, { status: 'closed' }]) : { status: 'closed' }
        ).count(),
        this.db.collection('tickets').where(
          baseWhere ? _.and([baseWhere, { priority: 'urgent' }]) : { priority: 'urgent' }
        ).count()
      ]);
      
      this.setData({
        filterOptions: [
          { label: '全部', value: 'all', count: total.total || 0 },
          { label: '待处理', value: 'pending', count: pending.total || 0 },
          { label: '处理中', value: 'processing', count: processing.total || 0 },
          { label: '已解决', value: 'resolved', count: resolved.total || 0 },
          { label: '已关闭', value: 'closed', count: closed.total || 0 },
          { label: '紧急', value: 'urgent', count: urgent.total || 0 }
        ]
      });
    } catch (error) {
      console.error('更新筛选计数失败:', error);
      // 设置默认计数
      this.setData({
        filterOptions: [
          { label: '全部', value: 'all', count: 0 },
          { label: '待处理', value: 'pending', count: 0 },
          { label: '处理中', value: 'processing', count: 0 },
          { label: '已解决', value: 'resolved', count: 0 },
          { label: '已关闭', value: 'closed', count: 0 },
          { label: '紧急', value: 'urgent', count: 0 }
        ]
      });
    }
  },
  
  // 格式化时间
  formatTime(date) {
    if (!date) return '';
    
    const now = new Date();
    const time = new Date(date);
    const diff = now - time;
    
    if (diff < 60000) {
      return '刚刚';
    } else if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前';
    } else if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前';
    } else if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前';
    } else {
      return time.toLocaleDateString('zh-CN');
    }
  },
  
  // 负责人筛选变化
  onAssigneeFilterChange(e) {
    this.setData({
      'tempFilters.assignee': e.detail.value
    });
  },
  
  // 加载负责人列表
  async loadAssigneeList() {
    try {
      const _ = this.db.command;
      const userRoleGroup = this.data.userRoleGroup;
      const currentUserOpenid = this.app.globalData.openid;
      const currentUserName = this.app.globalData.userInfo?.nickName || '我';
      
      let options = [];
      
      if (userRoleGroup === '经理') {
        // 经理可以看到所有选项
        options.push({ label: '全部', value: 'all' });
        options.push({ label: '我负责的', value: 'my' });
        
        // 获取所有工程师列表
        const res = await this.db.collection('users')
          .where({
            roleGroup: _.in(['工程师', '经理'])
          })
          .get();
        
        // 添加其他工程师选项
        res.data.forEach(user => {
          if (user.openid !== currentUserOpenid) {
            options.push({
              label: user.nickName || '未命名',
              value: user.openid
            });
          }
        });
      } else {
        // 工程师只能看到"我负责的"
        options.push({ label: '我负责的', value: 'my' });
        // 设置默认选中为"我负责的"
        this.setData({
          currentAssignee: 'my',
          'tempFilters.assignee': 'my'
        });
      }
      
      this.setData({
        assigneeOptions: options
      });
    } catch (error) {
      console.error('加载负责人列表失败:', error);
      // 设置默认选项
      const defaultOptions = this.data.userRoleGroup === '经理' 
        ? [
            { label: '全部', value: 'all' },
            { label: '我负责的', value: 'my' }
          ]
        : [
            { label: '我负责的', value: 'my' }
          ];
      
      this.setData({
        assigneeOptions: defaultOptions
      });
      
      if (this.data.userRoleGroup === '工程师') {
        this.setData({
          currentAssignee: 'my',
          'tempFilters.assignee': 'my'
        });
      }
    }
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