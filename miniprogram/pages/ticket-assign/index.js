// 工单分配页面
Page({
  data: {
    // 统计数据
    stats: {
      unassigned: 8,
      todayAssigned: 24,
      avgWaitTime: 15
    },
    
    // Tab相关
    activeTab: 'unassigned',
    
    // 工单列表
    unassignedList: [],
    assigningList: [],
    assignedList: [],
    
    // 可用工程师列表
    availableEngineers: [],
    
    // 智能分配
    autoAssignVisible: false,
    autoAssignStrategy: 'smart',
    priorityFirst: true,
    assignRange: ['online', 'available'],
    assignPreview: [],
    
    // 筛选
    filterVisible: false,
    filterPriority: ['urgent', 'high', 'normal', 'low'],
    filterType: ['hardware', 'software', 'network', 'account', 'other'],
    filterWaitTime: 'all'
  },

  onLoad() {
    this.loadTickets();
    this.loadEngineers();
    this.startAutoRefresh();
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  // 加载工单列表
  loadTickets() {
    // 模拟加载待分配工单
    const unassigned = [
      {
        id: 1,
        ticketNo: '#TK001234',
        priority: 'urgent',
        priorityText: '紧急',
        userName: '张三',
        department: '财务部',
        location: 'A栋3楼301',
        issueType: '电脑无法开机',
        description: '电脑按下电源键后没有任何反应，指示灯不亮',
        createTime: '10:30',
        selectedEngineerId: null
      },
      {
        id: 2,
        ticketNo: '#TK001235',
        priority: 'high',
        priorityText: '高',
        userName: '李四',
        department: '人事部',
        location: 'B栋2楼205',
        issueType: '网络连接异常',
        description: '无法访问内部系统，网页打不开',
        createTime: '10:45',
        selectedEngineerId: null
      },
      {
        id: 3,
        ticketNo: '#TK001236',
        priority: 'normal',
        priorityText: '普通',
        userName: '王五',
        department: '市场部',
        location: 'C栋4楼402',
        issueType: '打印机故障',
        description: '打印机卡纸，无法正常打印',
        createTime: '11:00',
        selectedEngineerId: null
      }
    ];

    // 模拟分配中工单
    const assigning = [
      {
        id: 4,
        ticketNo: '#TK001233',
        engineer: {
          id: 1,
          name: '赵工程师',
          avatar: ''
        },
        waitTime: '5分钟'
      }
    ];

    // 模拟已分配工单
    const assigned = [
      {
        id: 5,
        ticketNo: '#TK001232',
        engineer: {
          id: 2,
          name: '钱工程师',
          avatar: '',
          statusTheme: 'primary',
          statusText: '处理中'
        },
        assignTime: '09:30',
        startTime: '09:45'
      },
      {
        id: 6,
        ticketNo: '#TK001231',
        engineer: {
          id: 3,
          name: '孙工程师',
          avatar: '',
          statusTheme: 'warning',
          statusText: '前往中'
        },
        assignTime: '09:15',
        startTime: null
      }
    ];

    this.setData({
      unassignedList: unassigned,
      assigningList: assigning,
      assignedList: assigned
    });
  },

  // 加载工程师列表
  loadEngineers() {
    const engineers = [
      {
        id: 1,
        name: '赵工',
        avatar: '',
        currentTasks: 2,
        maxTasks: 5,
        statusClass: 'online',
        distance: 1.2,
        matchScore: 90
      },
      {
        id: 2,
        name: '钱工',
        avatar: '',
        currentTasks: 3,
        maxTasks: 5,
        statusClass: 'online',
        distance: 2.5,
        matchScore: 75
      },
      {
        id: 3,
        name: '孙工',
        avatar: '',
        currentTasks: 1,
        maxTasks: 5,
        statusClass: 'busy',
        distance: 0.8,
        matchScore: 85
      },
      {
        id: 4,
        name: '李工',
        avatar: '',
        currentTasks: 0,
        maxTasks: 5,
        statusClass: 'online',
        distance: 3.0,
        matchScore: 95
      },
      {
        id: 5,
        name: '周工',
        avatar: '',
        currentTasks: 4,
        maxTasks: 5,
        statusClass: 'busy',
        distance: 1.5,
        matchScore: 60
      }
    ];

    this.setData({
      availableEngineers: engineers
    });
  },

  // Tab切换
  onTabChange(e) {
    this.setData({
      activeTab: e.detail.value
    });
  },

  // 选择工程师
  selectEngineer(e) {
    const { ticketId, engineerId } = e.currentTarget.dataset;
    const list = this.data.unassignedList.map(item => {
      if (item.id === ticketId) {
        item.selectedEngineerId = engineerId;
      }
      return item;
    });
    
    this.setData({
      unassignedList: list
    });
  },

  // 确认分配
  confirmAssign(e) {
    const ticketId = e.currentTarget.dataset.id;
    const ticket = this.data.unassignedList.find(item => item.id === ticketId);
    
    if (!ticket.selectedEngineerId) {
      wx.showToast({
        title: '请选择工程师',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认分配',
      content: `确定将工单 ${ticket.ticketNo} 分配给所选工程师吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doAssign(ticket);
        }
      }
    });
  },

  // 执行分配
  doAssign(ticket) {
    wx.showLoading({
      title: '分配中...'
    });

    // 模拟分配过程
    setTimeout(() => {
      // 从未分配列表移除
      const unassignedList = this.data.unassignedList.filter(item => item.id !== ticket.id);
      
      // 添加到分配中列表
      const engineer = this.data.availableEngineers.find(e => e.id === ticket.selectedEngineerId);
      const assigningList = [...this.data.assigningList, {
        id: ticket.id,
        ticketNo: ticket.ticketNo,
        engineer: {
          id: engineer.id,
          name: engineer.name,
          avatar: engineer.avatar
        },
        waitTime: '0分钟'
      }];

      this.setData({
        unassignedList,
        assigningList,
        'stats.unassigned': unassignedList.length
      });

      wx.hideLoading();
      wx.showToast({
        title: '分配成功',
        icon: 'success'
      });

      // 发送通知给工程师
      this.notifyEngineer(engineer, ticket);
    }, 1000);
  },

  // 通知工程师
  notifyEngineer(engineer, ticket) {
    // 实际应用中发送推送通知
    console.log(`通知 ${engineer.name} 处理工单 ${ticket.ticketNo}`);
  },

  // 查看详情
  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-detail/index?id=${id}`
    });
  },

  // 延后处理
  postpone(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '延后处理',
      content: '确定要延后处理这个工单吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '已延后',
            icon: 'success'
          });
        }
      }
    });
  },

  // 取消分配
  cancelAssign(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '取消分配',
      content: '确定要取消分配吗？',
      success: (res) => {
        if (res.confirm) {
          this.doCancelAssign(id);
        }
      }
    });
  },

  // 执行取消分配
  doCancelAssign(id) {
    const ticket = this.data.assigningList.find(item => item.id === id);
    if (ticket) {
      // 从分配中移除
      const assigningList = this.data.assigningList.filter(item => item.id !== id);
      
      // 添加回未分配
      const unassignedList = [...this.data.unassignedList];
      
      this.setData({
        assigningList,
        unassignedList
      });

      wx.showToast({
        title: '已取消分配',
        icon: 'success'
      });
    }
  },

  // 重新分配
  reassign(e) {
    const id = e.currentTarget.dataset.id;
    this.doCancelAssign(id);
  },

  // 跟踪进度
  trackProgress(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/ticket-track/index?id=${id}`
    });
  },

  // 联系工程师
  contactEngineer(e) {
    const id = e.currentTarget.dataset.id;
    const ticket = this.data.assignedList.find(item => item.id === id);
    
    if (ticket) {
      wx.showActionSheet({
        itemList: ['拨打电话', '发送消息'],
        success: (res) => {
          if (res.tapIndex === 0) {
            wx.makePhoneCall({
              phoneNumber: '13800138000'
            });
          } else {
            wx.navigateTo({
              url: `/pages/chat/index?engineerId=${ticket.engineer.id}`
            });
          }
        }
      });
    }
  },

  // 智能分配
  autoAssign() {
    this.generateAssignPreview();
    this.setData({
      autoAssignVisible: true
    });
  },

  // 生成分配预览
  generateAssignPreview() {
    const preview = this.data.unassignedList.map(ticket => {
      // 根据策略推荐工程师
      const engineer = this.recommendEngineer(ticket);
      return {
        ticketId: ticket.id,
        ticketNo: ticket.ticketNo,
        engineerName: engineer ? engineer.name : '暂无合适'
      };
    });

    this.setData({
      assignPreview: preview
    });
  },

  // 推荐工程师
  recommendEngineer(ticket) {
    const { autoAssignStrategy } = this.data;
    let engineers = [...this.data.availableEngineers];

    // 根据策略排序
    switch (autoAssignStrategy) {
      case 'balance':
        engineers.sort((a, b) => a.currentTasks - b.currentTasks);
        break;
      case 'distance':
        engineers.sort((a, b) => a.distance - b.distance);
        break;
      case 'skill':
        engineers.sort((a, b) => b.matchScore - a.matchScore);
        break;
      case 'smart':
        // 综合评分
        engineers.sort((a, b) => {
          const scoreA = (100 - a.currentTasks * 20) + (5 - a.distance) * 10 + a.matchScore;
          const scoreB = (100 - b.currentTasks * 20) + (5 - b.distance) * 10 + b.matchScore;
          return scoreB - scoreA;
        });
        break;
    }

    // 返回最合适的工程师
    return engineers[0];
  },

  // 执行智能分配
  executeAutoAssign() {
    wx.showLoading({
      title: '正在分配...'
    });

    // 模拟批量分配
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '分配完成',
        icon: 'success'
      });
      
      this.closeAutoAssign();
      this.loadTickets();
    }, 2000);
  },

  // 关闭智能分配
  closeAutoAssign() {
    this.setData({
      autoAssignVisible: false
    });
  },

  handleAutoAssignChange(e) {
    this.setData({
      autoAssignVisible: e.detail.visible
    });
  },

  // 策略变化
  onStrategyChange(e) {
    this.setData({
      autoAssignStrategy: e.detail.value
    });
    this.generateAssignPreview();
  },

  // 优先级优先变化
  onPriorityFirstChange(e) {
    this.setData({
      priorityFirst: e.detail.value
    });
  },

  // 分配范围变化
  onAssignRangeChange(e) {
    this.setData({
      assignRange: e.detail.value
    });
  },

  // 刷新列表
  refreshList() {
    wx.showLoading({
      title: '刷新中...'
    });
    
    setTimeout(() => {
      this.loadTickets();
      this.loadEngineers();
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    }, 500);
  },

  // 显示筛选
  showFilter() {
    this.setData({
      filterVisible: true
    });
  },

  // 关闭筛选
  closeFilter() {
    this.setData({
      filterVisible: false
    });
  },

  handleFilterChange(e) {
    this.setData({
      filterVisible: e.detail.visible
    });
  },

  // 筛选条件变化
  onFilterPriorityChange(e) {
    this.setData({
      filterPriority: e.detail.value
    });
  },

  onFilterTypeChange(e) {
    this.setData({
      filterType: e.detail.value
    });
  },

  onFilterWaitTimeChange(e) {
    this.setData({
      filterWaitTime: e.detail.value
    });
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      filterPriority: ['urgent', 'high', 'normal', 'low'],
      filterType: ['hardware', 'software', 'network', 'account', 'other'],
      filterWaitTime: 'all'
    });
  },

  // 应用筛选
  applyFilter() {
    this.closeFilter();
    this.loadTickets();
    wx.showToast({
      title: '筛选已应用',
      icon: 'success'
    });
  },

  // 启动自动刷新
  startAutoRefresh() {
    this.refreshTimer = setInterval(() => {
      this.loadTickets();
    }, 30000); // 30秒刷新一次
  },

  // 停止自动刷新
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});