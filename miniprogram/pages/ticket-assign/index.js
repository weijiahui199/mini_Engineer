// 工单分配页面
Page({
  data: {
    // 统计数据
    stats: {
      unassigned: 0,
      todayAssigned: 0,
      avgWaitTime: 0
    },
    
    // Tab相关
    activeTab: 'unassigned',
    
    // 工单列表
    unassignedList: [],
    assigningList: [],
    assignedList: [],
    
    // 可用工程师列表
    availableEngineers: [],
    
    // 快速分配模式
    quickAssignMode: false,
    singleTicketId: null,
    quickAssignTicket: null,
    
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

  onLoad(options) {
    // 获取app实例和数据库
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    
    // 如果传入了工单ID，保存起来并设置为快速分配模式
    if (options.id) {
      this.ticketId = options.id;
      this.setData({
        quickAssignMode: true,
        singleTicketId: options.id
      });
    }
    
    this.loadTickets();
    this.loadEngineers();
    
    // 只有在列表模式下才自动刷新
    if (!options.id) {
      this.startAutoRefresh();
    }
  },

  onUnload() {
    this.stopAutoRefresh();
  },

  // 加载工单列表
  async loadTickets() {
    wx.showLoading({
      title: '加载工单...'
    });
    
    try {
      // 如果是快速分配模式，只加载单个工单
      if (this.ticketId) {
        await this.loadSingleTicket();
      } else {
        // 加载所有待分配、分配中和已分配的工单
        await Promise.all([
          this.loadUnassignedTickets(),
          this.loadAssigningTickets(),
          this.loadAssignedTickets()
        ]);
      }
      
      // 更新统计数据
      this.updateStats();
    } catch (error) {
      console.error('加载工单失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
    }
  },
  
  // 加载单个工单（快速分配模式）
  async loadSingleTicket() {
    try {
      const res = await this.db.collection('tickets')
        .doc(this.ticketId)
        .get();
      
      if (res.data) {
        const ticket = this.formatTicket(res.data);
        this.setData({
          unassignedList: [ticket],
          quickAssignTicket: ticket
        });
      }
    } catch (error) {
      console.error('加载工单详情失败:', error);
      wx.showToast({
        title: '工单不存在',
        icon: 'error'
      });
      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },
  
  // 加载未分配工单
  async loadUnassignedTickets() {
    try {
      const res = await this.db.collection('tickets')
        .where({
          status: 'pending',
          assignedTo: this.db.command.or(
            this.db.command.eq(null),
            this.db.command.eq(''),
            this.db.command.not(this.db.command.exists(true))
          )
        })
        .orderBy('priority', 'asc')  // 优先级升序（urgent=1最高）
        .orderBy('createTime', 'asc') // 创建时间升序
        .limit(20)
        .get();
      
      const unassigned = res.data.map(item => this.formatTicket(item));
      this.setData({
        unassignedList: unassigned
      });
    } catch (error) {
      console.error('加载未分配工单失败:', error);
    }
  },
  
  // 加载分配中工单（已分配但未接受）
  async loadAssigningTickets() {
    try {
      const res = await this.db.collection('tickets')
        .where({
          status: 'pending',
          assignedTo: this.db.command.exists(true),
          assignedTo: this.db.command.neq(null),
          assignedTo: this.db.command.neq(''),
          acceptedTime: this.db.command.not(this.db.command.exists(true))
        })
        .orderBy('assignedTime', 'desc')
        .limit(20)
        .get();
      
      const assigning = [];
      for (const item of res.data) {
        const ticket = await this.formatAssigningTicket(item);
        if (ticket) {
          assigning.push(ticket);
        }
      }
      
      this.setData({
        assigningList: assigning
      });
    } catch (error) {
      console.error('加载分配中工单失败:', error);
    }
  },
  
  // 加载已分配工单（已接受处理）
  async loadAssignedTickets() {
    try {
      const res = await this.db.collection('tickets')
        .where({
          status: this.db.command.in(['processing', 'in_progress']),
          assignedTo: this.db.command.exists(true),
          assignedTo: this.db.command.neq(null),
          assignedTo: this.db.command.neq('')
        })
        .orderBy('assignedTime', 'desc')
        .limit(20)
        .get();
      
      const assigned = [];
      for (const item of res.data) {
        const ticket = await this.formatAssignedTicket(item);
        if (ticket) {
          assigned.push(ticket);
        }
      }
      
      this.setData({
        assignedList: assigned
      });
    } catch (error) {
      console.error('加载已分配工单失败:', error);
    }
  },
  
  // 格式化工单数据
  formatTicket(data) {
    const priorityMap = {
      1: { text: '紧急', value: 'urgent' },
      2: { text: '高', value: 'high' },
      3: { text: '普通', value: 'normal' },
      4: { text: '低', value: 'low' }
    };
    
    const priority = priorityMap[data.priority] || priorityMap[3];
    const createTime = data.createTime ? new Date(data.createTime) : new Date();
    
    return {
      id: data._id,
      ticketNo: data.ticketNo || `#TK${data._id.substr(-6).toUpperCase()}`,
      priority: priority.value,
      priorityText: priority.text,
      userName: data.reporterName || data.contactName || '未知用户',
      department: data.department || '未知部门',
      location: data.location || '未知位置',
      issueType: data.issueType || data.category || '其他',
      description: data.description || '暂无描述',
      createTime: `${createTime.getHours()}:${String(createTime.getMinutes()).padStart(2, '0')}`,
      selectedEngineerId: null,
      rawData: data // 保留原始数据
    };
  },
  
  // 格式化分配中工单
  async formatAssigningTicket(data) {
    try {
      // 获取工程师信息
      const engineerInfo = await this.getEngineerInfo(data.assignedTo);
      if (!engineerInfo) return null;
      
      const assignedTime = data.assignedTime ? new Date(data.assignedTime) : new Date();
      const waitTime = Math.floor((Date.now() - assignedTime.getTime()) / 60000);
      
      return {
        id: data._id,
        ticketNo: data.ticketNo || `#TK${data._id.substr(-6).toUpperCase()}`,
        engineer: {
          id: data.assignedTo,
          name: engineerInfo.name,
          avatar: engineerInfo.avatar || ''
        },
        waitTime: `${waitTime}分钟`,
        rawData: data
      };
    } catch (error) {
      console.error('格式化分配中工单失败:', error);
      return null;
    }
  },
  
  // 格式化已分配工单
  async formatAssignedTicket(data) {
    try {
      // 获取工程师信息
      const engineerInfo = await this.getEngineerInfo(data.assignedTo);
      if (!engineerInfo) return null;
      
      const assignTime = data.assignedTime ? new Date(data.assignedTime) : new Date();
      const acceptTime = data.acceptedTime ? new Date(data.acceptedTime) : null;
      
      // 根据工单状态确定工程师状态
      let statusTheme = 'default';
      let statusText = '已分配';
      
      if (data.status === 'processing' || data.status === 'in_progress') {
        statusTheme = 'primary';
        statusText = '处理中';
      }
      
      return {
        id: data._id,
        ticketNo: data.ticketNo || `#TK${data._id.substr(-6).toUpperCase()}`,
        engineer: {
          id: data.assignedTo,
          name: engineerInfo.name,
          avatar: engineerInfo.avatar || '',
          statusTheme: statusTheme,
          statusText: statusText
        },
        assignTime: `${assignTime.getHours()}:${String(assignTime.getMinutes()).padStart(2, '0')}`,
        startTime: acceptTime ? `${acceptTime.getHours()}:${String(acceptTime.getMinutes()).padStart(2, '0')}` : null,
        rawData: data
      };
    } catch (error) {
      console.error('格式化已分配工单失败:', error);
      return null;
    }
  },
  
  // 获取工程师信息
  async getEngineerInfo(openid) {
    try {
      // 先从缓存中查找
      if (this.engineerCache && this.engineerCache[openid]) {
        return this.engineerCache[openid];
      }
      
      // 从数据库获取
      const res = await this.db.collection('users')
        .where({
          openid: openid
        })
        .limit(1)
        .get();
      
      if (res.data && res.data.length > 0) {
        const engineer = {
          id: openid,
          name: res.data[0].displayName || res.data[0].name || '未知工程师',
          avatar: res.data[0].avatar || ''
        };
        
        // 缓存工程师信息
        if (!this.engineerCache) {
          this.engineerCache = {};
        }
        this.engineerCache[openid] = engineer;
        
        return engineer;
      }
      
      return {
        id: openid,
        name: '未知工程师',
        avatar: ''
      };
    } catch (error) {
      console.error('获取工程师信息失败:', error);
      return null;
    }
  },
  
  // 更新统计数据
  updateStats() {
    const unassignedCount = this.data.unassignedList.length;
    const todayAssigned = this.data.assignedList.length + this.data.assigningList.length;
    
    // 计算平均等待时间
    let totalWaitTime = 0;
    let waitCount = 0;
    
    this.data.assigningList.forEach(item => {
      const waitTime = parseInt(item.waitTime) || 0;
      if (waitTime > 0) {
        totalWaitTime += waitTime;
        waitCount++;
      }
    });
    
    const avgWaitTime = waitCount > 0 ? Math.floor(totalWaitTime / waitCount) : 0;
    
    this.setData({
      'stats.unassigned': unassignedCount,
      'stats.todayAssigned': todayAssigned,
      'stats.avgWaitTime': avgWaitTime
    });
  },

  // 加载工程师列表
  async loadEngineers() {
    wx.showLoading({
      title: '加载中...'
    });
    
    try {
      // 调用云函数获取可用工程师列表（包括经理）
      const res = await wx.cloud.callFunction({
        name: 'ticketAssignment',
        data: {
          action: 'getAvailableEngineers'
        }
      });
      
      if (res.result.success) {
        // 处理返回的工程师列表
        const engineers = res.result.data.map(engineer => ({
          id: engineer.openid,
          name: engineer.displayName || engineer.name,
          avatar: engineer.avatar || '',
          currentTasks: engineer.engineerInfo?.currentTasks || 0,
          maxTasks: engineer.engineerInfo?.maxTasks || 10,
          statusClass: this.getStatusClass(engineer.engineerInfo?.workingStatus),
          distance: Math.random() * 5, // 模拟距离
          matchScore: Math.floor(100 - (engineer.workload * 100)),
          roleGroup: engineer.roleGroup,
          canAssign: engineer.canAssign
        }));
        
        this.setData({
          availableEngineers: engineers
        });
      } else {
        console.error('获取工程师列表失败:', res.result.message);
        // 使用模拟数据作为后备
        this.loadMockEngineers();
      }
    } catch (error) {
      console.error('调用云函数失败:', error);
      // 使用模拟数据作为后备
      this.loadMockEngineers();
    } finally {
      wx.hideLoading();
    }
  },
  
  // 加载模拟工程师数据
  loadMockEngineers() {
    const engineers = [
      {
        id: 'mock_1',
        name: '赵工',
        avatar: '',
        currentTasks: 2,
        maxTasks: 5,
        statusClass: 'online',
        distance: 1.2,
        matchScore: 90,
        roleGroup: '工程师',
        canAssign: true
      },
      {
        id: 'mock_2',
        name: '王经理 (经理)',
        avatar: '',
        currentTasks: 1,
        maxTasks: 5,
        statusClass: 'online',
        distance: 2.5,
        matchScore: 80,
        roleGroup: '经理',
        canAssign: true
      },
      {
        id: 'mock_3',
        name: '李工',
        avatar: '',
        currentTasks: 0,
        maxTasks: 5,
        statusClass: 'online',
        distance: 3.0,
        matchScore: 95,
        roleGroup: '工程师',
        canAssign: true
      }
    ];

    this.setData({
      availableEngineers: engineers
    });
  },
  
  // 获取状态样式类
  getStatusClass(status) {
    const statusMap = {
      'available': 'online',
      'busy': 'busy',
      'offline': 'offline'
    };
    return statusMap[status] || 'online';
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
  async confirmAssign(e) {
    const ticketId = e.currentTarget.dataset.id;
    const ticket = this.data.unassignedList.find(item => item.id === ticketId);
    
    if (!ticket.selectedEngineerId) {
      wx.showToast({
        title: '请选择工程师',
        icon: 'none'
      });
      return;
    }

    // 获取选中的工程师信息
    const engineer = this.data.availableEngineers.find(e => e.id === ticket.selectedEngineerId);
    
    wx.showModal({
      title: '确认分配',
      content: `确定将工单 ${ticket.ticketNo} 分配给 ${engineer.name} 吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doAssign(ticket, engineer);
        }
      }
    });
  },

  // 执行分配
  async doAssign(ticket, engineer) {
    wx.showLoading({
      title: '分配中...'
    });

    try {
      // 调用云函数进行分配
      const res = await wx.cloud.callFunction({
        name: 'ticketAssignment',
        data: {
          action: 'assignTicket',
          ticketId: ticket.id,
          engineerId: engineer.id,
          engineerName: engineer.name
        }
      });

      if (res.result.success) {
        // 从未分配列表移除
        const unassignedList = this.data.unassignedList.filter(item => item.id !== ticket.id);
        
        // 添加到分配中列表
        const assigningList = [...this.data.assigningList, {
          id: ticket.id,
          ticketNo: ticket.ticketNo,
          engineer: {
            id: engineer.id,
            name: engineer.name,
            avatar: engineer.avatar
          },
          waitTime: '0分钟',
          rawData: ticket.rawData
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
        await this.notifyEngineer(engineer, ticket);
        
        // 如果是快速分配模式，分配成功后返回
        if (this.data.quickAssignMode) {
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      } else {
        wx.hideLoading();
        wx.showToast({
          title: res.result.message || '分配失败',
          icon: 'error'
        });
      }
    } catch (error) {
      console.error('分配工单失败:', error);
      wx.hideLoading();
      
      // 如果云函数不存在，尝试直接更新数据库
      try {
        await this.directAssignTicket(ticket, engineer);
      } catch (dbError) {
        wx.showToast({
          title: '分配失败',
          icon: 'error'
        });
      }
    }
  },
  
  // 直接更新数据库分配工单（备用方案）
  async directAssignTicket(ticket, engineer) {
    try {
      // 更新工单的分配信息
      await this.db.collection('tickets')
        .doc(ticket.id)
        .update({
          data: {
            assignedTo: engineer.id,
            assignedToName: engineer.name,
            assignedTime: new Date(),
            status: 'pending', // 保持pending状态，等待工程师接受
            updateTime: new Date()
          }
        });
      
      // 从未分配列表移除
      const unassignedList = this.data.unassignedList.filter(item => item.id !== ticket.id);
      
      // 添加到分配中列表
      const assigningList = [...this.data.assigningList, {
        id: ticket.id,
        ticketNo: ticket.ticketNo,
        engineer: {
          id: engineer.id,
          name: engineer.name,
          avatar: engineer.avatar
        },
        waitTime: '0分钟',
        rawData: ticket.rawData
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
      await this.notifyEngineer(engineer, ticket);
      
      // 如果是快速分配模式，分配成功后返回
      if (this.data.quickAssignMode) {
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    } catch (error) {
      console.error('直接更新数据库失败:', error);
      throw error;
    }
  },

  // 通知工程师
  async notifyEngineer(engineer, ticket) {
    try {
      // 调用云函数发送通知
      await wx.cloud.callFunction({
        name: 'sendNotification',
        data: {
          type: 'ticketAssigned',
          targetUserId: engineer.id,
          ticketId: ticket.id,
          ticketNo: ticket.ticketNo,
          message: `您有新的工单 ${ticket.ticketNo} 需要处理`
        }
      });
      console.log(`已通知 ${engineer.name} 处理工单 ${ticket.ticketNo}`);
    } catch (error) {
      console.error('发送通知失败:', error);
      // 通知失败不影响主流程
    }
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
  async doCancelAssign(id) {
    const ticket = this.data.assigningList.find(item => item.id === id);
    if (!ticket) return;
    
    wx.showLoading({
      title: '取消中...'
    });
    
    try {
      // 调用云函数取消分配
      const res = await wx.cloud.callFunction({
        name: 'ticketAssignment',
        data: {
          action: 'unassignTicket',
          ticketId: id
        }
      });
      
      if (!res.result.success) {
        // 如果云函数失败，尝试直接更新数据库
        await this.directCancelAssign(id, ticket);
        return;
      }
      
      await this.updateListsAfterCancel(id, ticket);
    } catch (error) {
      console.error('取消分配失败:', error);
      // 尝试直接更新数据库
      try {
        await this.directCancelAssign(id, ticket);
      } catch (dbError) {
        wx.hideLoading();
        wx.showToast({
          title: '取消失败',
          icon: 'error'
        });
      }
    }
  },
  
  // 直接更新数据库取消分配
  async directCancelAssign(id, ticket) {
    try {
      // 清除工单的分配信息
      await this.db.collection('tickets')
        .doc(id)
        .update({
          data: {
            assignedTo: this.db.command.remove(),
            assignedToName: this.db.command.remove(),
            assignedTime: this.db.command.remove(),
            updateTime: new Date()
          }
        });
      
      await this.updateListsAfterCancel(id, ticket);
    } catch (error) {
      console.error('直接取消分配失败:', error);
      throw error;
    }
  },
  
  // 更新列表（取消分配后）
  async updateListsAfterCancel(id, ticket) {
    // 从分配中移除
    const assigningList = this.data.assigningList.filter(item => item.id !== id);
    
    // 重新格式化工单数据并添加回未分配列表
    const unassignedTicket = {
      id: ticket.id,
      ticketNo: ticket.ticketNo,
      priority: ticket.rawData?.priority ? this.getPriorityInfo(ticket.rawData.priority).value : 'normal',
      priorityText: ticket.rawData?.priority ? this.getPriorityInfo(ticket.rawData.priority).text : '普通',
      userName: ticket.rawData?.reporterName || ticket.rawData?.contactName || '未知用户',
      department: ticket.rawData?.department || '未知部门',
      location: ticket.rawData?.location || '未知位置',
      issueType: ticket.rawData?.issueType || ticket.rawData?.category || '其他',
      description: ticket.rawData?.description || '暂无描述',
      createTime: ticket.rawData?.createTime ? 
        new Date(ticket.rawData.createTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : 
        new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      selectedEngineerId: null,
      rawData: ticket.rawData
    };
    
    const unassignedList = [...this.data.unassignedList, unassignedTicket];
    
    this.setData({
      assigningList,
      unassignedList,
      'stats.unassigned': unassignedList.length
    });
    
    wx.hideLoading();
    wx.showToast({
      title: '已取消分配',
      icon: 'success'
    });
  },
  
  // 获取优先级信息
  getPriorityInfo(priority) {
    const priorityMap = {
      1: { text: '紧急', value: 'urgent' },
      2: { text: '高', value: 'high' },
      3: { text: '普通', value: 'normal' },
      4: { text: '低', value: 'low' }
    };
    return priorityMap[priority] || priorityMap[3];
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
  async executeAutoAssign() {
    wx.showLoading({
      title: '正在分配...'
    });

    try {
      const { assignPreview, unassignedList, availableEngineers } = this.data;
      let successCount = 0;
      let failCount = 0;
      
      // 批量分配工单
      for (const preview of assignPreview) {
        if (preview.engineerName === '暂无合适') continue;
        
        const ticket = unassignedList.find(t => t.id === preview.ticketId);
        const engineer = availableEngineers.find(e => e.name === preview.engineerName);
        
        if (ticket && engineer) {
          try {
            // 尝试使用云函数分配
            const res = await wx.cloud.callFunction({
              name: 'ticketAssignment',
              data: {
                action: 'assignTicket',
                ticketId: ticket.id,
                engineerId: engineer.id,
                engineerName: engineer.name
              }
            });
            
            if (res.result.success) {
              successCount++;
              // 发送通知
              await this.notifyEngineer(engineer, ticket);
            } else {
              // 云函数失败，尝试直接更新
              await this.db.collection('tickets')
                .doc(ticket.id)
                .update({
                  data: {
                    assignedTo: engineer.id,
                    assignedToName: engineer.name,
                    assignedTime: new Date(),
                    updateTime: new Date()
                  }
                });
              successCount++;
              await this.notifyEngineer(engineer, ticket);
            }
          } catch (error) {
            console.error(`分配工单 ${ticket.ticketNo} 失败:`, error);
            // 尝试直接更新数据库
            try {
              await this.db.collection('tickets')
                .doc(ticket.id)
                .update({
                  data: {
                    assignedTo: engineer.id,
                    assignedToName: engineer.name,
                    assignedTime: new Date(),
                    updateTime: new Date()
                  }
                });
              successCount++;
            } catch (dbError) {
              failCount++;
            }
          }
        }
      }
      
      wx.hideLoading();
      
      if (successCount > 0) {
        wx.showToast({
          title: `成功分配 ${successCount} 个工单`,
          icon: 'success',
          duration: 2000
        });
        
        // 重新加载列表
        setTimeout(() => {
          this.closeAutoAssign();
          this.loadTickets();
        }, 1500);
      } else {
        wx.showToast({
          title: '分配失败',
          icon: 'error'
        });
      }
      
      if (failCount > 0) {
        console.error(`${failCount} 个工单分配失败`);
      }
    } catch (error) {
      console.error('批量分配失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '分配失败',
        icon: 'error'
      });
    }
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