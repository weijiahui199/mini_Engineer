// 工单列表页面
const RefreshManager = require('../../utils/refresh-manager');
const CacheManager = require('../../utils/cache-manager');

Page({
  data: {
    userRoleGroup: '', // 用户 | 工程师 | 经理 - 初始为空，等待获取实际角色
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
    
    // 时间范围筛选
    timeRangeFilter: 'month',  // 默认近1个月
    timeRangeOptions: [
      { label: '近7天', value: 'week' },
      { label: '近1月', value: 'month' },
      { label: '近6月', value: 'halfYear' },
      { label: '近1年', value: 'year' },
      { label: '一年以上', value: 'overYear' }
    ],
    
    // 已关闭工单的动态时间范围
    closedTimeRange: 'month',  // 初始1个月
    closedLoadStage: 0,  // 加载阶段：0=1月, 1=6月, 2=1年, 3=全部
    
    // 下拉面板状态
    timeDropdownOpen: false,
    statusDropdownOpen: false,
    
    // 状态文本
    statusText: {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
      cancelled: '已取消',
      closed: '已关闭',
      paused: '已暂停'
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
    
    // 负责人选项列表（保留但暂不使用）
    assigneeOptions: [],
    
    emptyText: '暂无工单',
    
    // 响应式布局
    screenWidth: 375,  // 默认屏幕宽度
    layoutMode: 'medium'  // 布局模式: compact(紧凑) | medium(中等) | comfortable(舒适)
  },

  onLoad(options) {
    // 获取app实例和数据库
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    
    // 注册页面到刷新管理器
    RefreshManager.setPageActive('ticket-list', true);
    
    // 获取系统信息，判断屏幕尺寸
    wx.getSystemInfo({
      success: (res) => {
        const screenWidth = res.windowWidth;
        let layoutMode = 'medium'; // 默认中等布局
        
        // 根据屏幕宽度设置布局模式
        if (screenWidth < 350) {
          layoutMode = 'compact'; // 紧凑布局（小屏）
        } else if (screenWidth >= 414) {
          layoutMode = 'comfortable'; // 舒适布局（大屏）
        }
        
        this.setData({ 
          screenWidth,
          layoutMode 
        });
        
        console.log(`屏幕宽度: ${screenWidth}px, 布局模式: ${layoutMode}`);
      }
    });
    
    // 获取用户角色
    this.getUserRole();
    
    // 处理路由参数
    if (options.filter) {
      this.setData({
        currentFilter: options.filter
      });
    }
    
    // 延迟加载数据，等待app初始化完成
    setTimeout(() => {
      this.smartRefreshList();
    }, 500);
  },

  async onShow() {
    // 页面显示时设置为活跃状态
    RefreshManager.setPageActive('ticket-list', true);
    
    // 重新获取用户角色（可能在其他页面或数据库中已更新）
    await this.refreshUserRole();
    
    // 智能刷新决策
    const decisions = RefreshManager.makeRefreshDecision('ticket-list', ['ticketList']);
    if (decisions.ticketList) {
      console.log('[工单列表] 根据智能刷新决策，需要刷新数据');
      this.smartRefreshList();
    } else {
      console.log('[工单列表] 数据仍在有效期内，无需刷新');
    }
  },
  
  onHide() {
    // 页面隐藏时设置为非活跃状态
    RefreshManager.setPageActive('ticket-list', false);
  },

  // 获取用户角色并设置权限相关UI
  getUserRole() {
    // 从全局用户信息获取角色
    const userInfo = this.app.globalData.userInfo;
    const openid = this.app.globalData.openid;
    const roleGroup = userInfo?.roleGroup || wx.getStorageSync('userRoleGroup') || '用户';
    
    console.log('[工单列表] 获取用户角色:', roleGroup, 'openid:', openid);
    
    // 根据角色设置UI控制
    this.setData({
      userRoleGroup: roleGroup,
      showAssigneeFilter: roleGroup === '经理',  // 只有经理显示负责人筛选
      currentAssignee: roleGroup === '工程师' ? 'pool' : 'all',  // 工程师默认看工单池视图
      openid: openid  // 保存openid用于页面判断
    });
  },
  
  // 刷新用户角色（强制从数据库获取最新信息）
  async refreshUserRole() {
    try {
      console.log('[工单列表] 开始刷新用户角色信息');
      
      // 如果有openid，尝试从数据库获取最新用户信息
      const openid = this.app.globalData.openid;
      if (openid) {
        const db = wx.cloud.database();
        const res = await db.collection('users')
          .where({ openid: openid })
          .get();
        
        if (res.data && res.data.length > 0) {
          const userData = res.data[0];
          const newRoleGroup = userData.roleGroup || '用户';
          
          // 检查角色是否发生变化
          const oldRoleGroup = this.data.userRoleGroup;
          
          console.log(`[工单列表] 数据库角色: ${newRoleGroup}, 当前角色: ${oldRoleGroup}`);
          
          if (!oldRoleGroup || oldRoleGroup !== newRoleGroup) {
            console.log(`[工单列表] 角色已更新: ${oldRoleGroup || '未设置'} -> ${newRoleGroup}`);
            
            // 更新全局数据
            if (this.app.globalData.userInfo) {
              this.app.globalData.userInfo.roleGroup = newRoleGroup;
            } else {
              this.app.globalData.userInfo = { roleGroup: newRoleGroup };
            }
            
            // 更新本地缓存
            wx.setStorageSync('userRoleGroup', newRoleGroup);
            
            // 更新页面数据
            this.setData({
              userRoleGroup: newRoleGroup,
              showAssigneeFilter: newRoleGroup === '经理',
              currentAssignee: newRoleGroup === '工程师' ? 'pool' : 'all'
            });
            
            // 角色变化后强制刷新工单列表
            console.log('[工单列表] 角色变化，强制刷新列表');
            RefreshManager.setForceRefreshFlag('ticketList');
            this.refreshList();
          } else {
            console.log('[工单列表] 角色未变化:', newRoleGroup);
          }
        } else {
          console.log('[工单列表] 未找到用户数据');
          // 没有找到用户数据，使用默认值
          this.getUserRole();
        }
      } else {
        console.log('[工单列表] 没有openid，使用缓存数据');
        // 没有openid时，使用原方法获取角色
        this.getUserRole();
      }
    } catch (error) {
      console.error('[工单列表] 刷新用户角色失败:', error);
      // 失败时使用原方法获取角色
      this.getUserRole();
    }
  },

  // 智能刷新列表
  smartRefreshList() {
    // 检查是否需要刷新
    if (RefreshManager.shouldRefresh('ticketList', { pageActive: true })) {
      console.log('[工单列表] 执行智能刷新');
      this.refreshList();
    } else {
      console.log('[工单列表] 使用缓存数据，无需刷新');
      // 尝试从缓存获取数据
      const cachedData = CacheManager.get('ticket_list', 'ticketList');
      if (cachedData && cachedData.list) {
        this.setData({
          ticketList: cachedData.list,
          hasMore: cachedData.hasMore || false
        });
        // 更新筛选计数
        this.updateFilterCounts();
      } else {
        // 缓存无效，强制刷新
        this.refreshList();
      }
    }
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
      // 优先按优先级排序，然后按更新时间排序（这样最近有动作的工单会排在前面）
      const res = await this.db.collection('tickets')
        .where(where)
        .orderBy('priority', 'desc')  // 紧急工单优先
        .orderBy('updateTime', 'desc')  // 最近更新的优先
        .skip(skip)
        .limit(this.data.pageSize)
        .get();
      
      // 处理查询结果
      const formattedList = res.data.map(ticket => {
        // 确保status字段是干净的字符串
        const cleanStatus = ticket.status ? String(ticket.status).trim() : 'pending';
        
        // 判断是否是暂停状态（pending但有assignee）
        let displayStatus = cleanStatus;
        if (cleanStatus === 'pending' && ticket.assigneeOpenid) {
          displayStatus = 'paused';  // UI显示为暂停
        }
        
        const formatted = {
          id: ticket._id,
          ticketNo: ticket.ticketNo,  // 去掉#前缀，在视图层添加
          title: ticket.title,
          category: ticket.category,
          priority: ticket.priority,
          status: displayStatus,  // 使用显示状态
          realStatus: cleanStatus,  // 保留真实状态
          submitter: ticket.submitterName,
          company: ticket.company || '',  // 新增公司字段
          location: ticket.location,
          createTime: this.formatTime(ticket.createTime),
          createTimeDisplay: this.formatTime(ticket.createTime),  // 专门用于显示创建时间
          updateTime: this.formatTime(ticket.updateTime || ticket.createTime),
          displayTime: this.formatTime(ticket.createTime),  // 改为显示创建时间
          assigned: !!ticket.assigneeOpenid,
          assigneeOpenid: ticket.assigneeOpenid || '',  // 添加assigneeOpenid字段
          assigneeName: ticket.assigneeName || '',  // 确保所有角色可见
          isPaused: cleanStatus === 'pending' && !!ticket.assigneeOpenid  // 标记是否为暂停状态
        };
        
        return formatted;
      });
      
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
      
      // 记录刷新时间和缓存数据（只在非追加模式下）
      if (!append) {
        RefreshManager.recordRefresh('ticketList');
        CacheManager.set('ticket_list', {
          list: formattedList,
          hasMore: res.data.length === this.data.pageSize,
          timestamp: Date.now()
        }, 'ticketList');
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
    
    // 重置已关闭工单的加载阶段
    if (value === 'closed') {
      this.setData({
        closedLoadStage: 0,
        closedTimeRange: 'month'
      });
    }
    
    this.setData({
      currentFilter: value,
      page: 1
    });
    this.loadTicketList();
  },
  
  // 时间范围筛选点击
  onTimeRangeClick(e) {
    const value = e.currentTarget.dataset.value;
    
    // 已关闭工单不响应时间范围筛选
    if (this.data.currentFilter === 'closed') {
      wx.showToast({
        title: '已关闭工单自动扩展时间范围',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      timeRangeFilter: value,
      page: 1
    });
    this.loadTicketList();
  },
  
  // 切换状态选择下拉面板
  toggleStatusDropdown() {
    this.setData({
      statusDropdownOpen: !this.data.statusDropdownOpen,
      timeDropdownOpen: false  // 关闭时间下拉
    });
  },
  
  // 选择状态筛选
  selectStatus(e) {
    const value = e.currentTarget.dataset.value;
    
    // 设置新的状态筛选并关闭下拉面板
    this.setData({
      currentFilter: value,
      statusDropdownOpen: false,
      page: 1
    });
    
    // 如果选择了已关闭，重置已关闭相关状态
    if (value === 'closed') {
      this.setData({
        closedTimeRange: 'month',
        closedLoadStage: 0
      });
    }
    
    // 重新加载工单列表
    this.loadTicketList();
    this.updateFilterCounts();
  },
  
  // 获取当前筛选标签文字
  getCurrentFilterLabel() {
    const current = this.data.filterOptions.find(item => item.value === this.data.currentFilter);
    if (current) {
      return current.value === 'urgent' ? `🔥 ${current.label}` : current.label;
    }
    return '全部';
  },
  
  // 切换时间选择下拉面板
  toggleTimeDropdown() {
    // 如果是已关闭状态，不允许打开时间筛选
    if (this.data.currentFilter === 'closed') {
      wx.showToast({
        title: '已关闭工单自动管理时间范围',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      timeDropdownOpen: !this.data.timeDropdownOpen,
      statusDropdownOpen: false  // 关闭状态下拉
    });
  },
  
  // 选择时间范围
  selectTimeRange(e) {
    const value = e.currentTarget.dataset.value;
    
    // 设置新的时间范围并关闭下拉面板
    this.setData({
      timeRangeFilter: value,
      timeDropdownOpen: false,
      page: 1
    });
    
    // 重新加载工单列表
    this.loadTicketList();
  },
  
  // 防止点击下拉面板内部时关闭
  preventClose() {
    // 空函数，仅用于阻止事件冒泡
    return;
  },


  // 下拉刷新
  async onPullDownRefresh() {
    console.log('[工单列表] 用户触发下拉刷新');
    
    // 下拉刷新时也刷新用户角色
    await this.refreshUserRole();
    
    // 设置强制刷新标记
    RefreshManager.setForceRefreshFlag('ticketList');
    
    this.setData({
      refreshing: true,
      page: 1
    });
    
    // 强制刷新数据
    await this.loadTicketList();
    
    // 记录刷新时间
    RefreshManager.recordRefresh('ticketList');
    
    // 确保刷新状态被重置
    this.setData({
      refreshing: false
    });
    
    // 显示刷新成功提示
    wx.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1000
    });
  },

  // 加载更多
  onLoadMore() {
    if (this.data.currentFilter === 'closed') {
      // 已关闭工单：扩大时间范围
      if (!this.data.hasMore && this.data.closedLoadStage < 3) {
        this.expandClosedTimeRange();
        return;
      }
    }
    
    // 其他状态：正常分页
    if (this.data.hasMore && !this.data.loadingMore) {
      console.log('加载更多，当前页码:', this.data.page);
      this.loadTicketList(true);
    }
  },
  
  // 扩大已关闭工单时间范围
  expandClosedTimeRange() {
    const stages = ['month', 'halfYear', 'year', 'all'];
    const stageLabels = ['近1个月', '近6个月', '近1年', '全部'];
    const nextStage = this.data.closedLoadStage + 1;
    
    if (nextStage < stages.length) {
      this.setData({
        closedLoadStage: nextStage,
        closedTimeRange: stages[nextStage],
        hasMore: true,  // 重置加载标志
        page: 1  // 重置页码
      });
      
      wx.showToast({
        title: `扩展到${stageLabels[nextStage]}`,
        icon: 'none'
      });
      
      // 重新加载数据
      this.loadTicketList(false);
    }
  },

  // 刷新列表
  refreshList() {
    this.setData({
      page: 1,  // 修复：page 应该从 1 开始，而不是 0
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

  // 安全接单方法（解决并发问题）
  async acceptTicketSafely(e) {
    // 安全地调用 stopPropagation（如果存在）
    if (e && typeof e.stopPropagation === 'function') {
      e.stopPropagation();
    }
    
    // 获取工单ID
    const ticketId = e.currentTarget?.dataset?.id || e.detail?.id;
    
    if (!ticketId) {
      wx.showToast({
        title: '参数错误',
        icon: 'error'
      });
      return false;
    }
    
    wx.showLoading({ title: '处理中...' });
    
    try {
      // 1. 先查询工单最新状态
      const res = await this.db.collection('tickets').doc(ticketId).get();
      const ticket = res.data;
      
      // 2. 检查是否已被分配
      if (ticket.assigneeOpenid && ticket.assigneeOpenid !== '') {
        wx.hideLoading();
        
        if (ticket.assigneeOpenid === this.app.globalData.openid) {
          wx.showToast({ 
            title: '您已开始处理', 
            icon: 'success' 
          });
        } else {
          wx.showModal({
            title: '无法处理',
            content: '该工单已被其他工程师处理',
            showCancel: false,
            confirmText: '知道了',
            success: () => {
              // 触发工单更新事件
              this.app.eventBus.emit(this.app.EVENTS.TICKET_UPDATED, { ticketId });
              
              // 设置强制刷新标记并刷新列表
              RefreshManager.setForceRefreshFlag('ticketList');
              this.refreshList();
            }
          });
        }
        return false;
      }
      
      // 3. 直接调用云函数执行接单（使用事务确保原子性）
      const cloudResult = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: {
          action: 'acceptTicket',
          ticketId: ticketId
        }
      });
      
      // 检查云函数执行结果
      if (cloudResult.result && cloudResult.result.code === 200) {
        
        wx.hideLoading();
        wx.showToast({ 
          title: '开始处理', 
          icon: 'success' 
        });
        
        // 触发工单接单事件
        this.app.eventBus.emit(this.app.EVENTS.TICKET_ACCEPTED, { ticketId });
        
        // 刷新列表和统计
        setTimeout(() => {
          RefreshManager.setForceRefreshFlag('ticketList');
          this.refreshList();
          this.updateFilterCounts();
        }, 500);
        
        return true;
      } else if (cloudResult.result && cloudResult.result.code === 400) {
        // 工单已被其他人接单
        wx.hideLoading();
        wx.showModal({
          title: '无法处理',
          content: cloudResult.result.message || '该工单已被其他工程师处理',
          showCancel: false,
          confirmText: '知道了',
          success: () => {
            RefreshManager.setForceRefreshFlag('ticketList');
            this.refreshList();
          }
        });
        return false;
      } else {
        // 其他错误
        throw new Error(cloudResult.result?.message || '接单失败');
      }
      
    } catch (error) {
      console.error('接单失败:', error);
      wx.hideLoading();
      
      // 显示详细错误信息
      wx.showModal({
        title: '处理失败',
        content: error.message || '请稍后重试',
        showCancel: false,
        confirmText: '确定'
      });
      
      return false;
    }
  },
  
  // 兼容旧的acceptTicket方法
  acceptTicket(e) {
    // 调用新的安全接单方法
    return this.acceptTicketSafely(e);
  },

  // 完成工单 - 统一使用云函数版本
  async completeTicket(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    const ticketId = e.currentTarget.dataset.id;
    const that = this;
    
    console.log('[completeTicket] 从列表完成工单:', ticketId);
    
    // 使用输入框让用户填写解决方案
    wx.showModal({
      title: '完成工单',
      editable: true,
      placeholderText: '请简述解决方案（可选）',
      confirmText: '完成',
      cancelText: '取消',
      success: async function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          try {
            // 准备解决方案内容
            const solution = res.content || '工单已处理完成';
            console.log('[completeTicket] 解决方案:', solution);
            
            // 直接使用云函数更新（避免权限问题）
            const cloudResult = await wx.cloud.callFunction({
              name: 'submitTicket',
              data: {
                action: 'updateStatus',
                ticketId: ticketId,
                status: 'resolved',
                solution: solution
              }
            });
            
            console.log('[completeTicket] 云函数返回:', cloudResult);
            
            if (cloudResult.result && cloudResult.result.code === 200) {
              wx.hideLoading();
              wx.showToast({
                title: '工单已完成',
                icon: 'success',
                duration: 2000
              });
              
              // 刷新列表
              setTimeout(() => {
                RefreshManager.setForceRefreshFlag('ticketList');
                that.refreshList();
                that.updateFilterCounts();
              }, 1500);
            } else {
              throw new Error(cloudResult.result?.message || '更新失败');
            }
          } catch (error) {
            console.error('[completeTicket] 错误:', error);
            wx.hideLoading();
            wx.showToast({
              title: '操作失败',
              icon: 'error'
            });
          }
        }
      }
    });
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


  // 刷新按钮点击
  async onRefresh() {
    console.log('[工单列表] 用户点击刷新按钮');
    
    // 刷新用户角色
    await this.refreshUserRole();
    
    RefreshManager.setForceRefreshFlag('ticketList');
    this.refreshList();
    
    wx.showToast({
      title: '刷新中...',
      icon: 'loading',
      duration: 500
    });
  },

  // 构建查询条件 - 重构版本
  async buildQueryCondition() {
    const _ = this.db.command;
    const openid = this.app.globalData.openid;
    const roleGroup = this.data.userRoleGroup;
    
    let conditions = [];
    
    // 根据角色构建基础查询条件
    switch(roleGroup) {
      case '经理':
        // 经理：可以看到所有工单，支持负责人筛选
        if (this.data.currentAssignee === 'my') {
          // 只看我负责的
          conditions.push({ assigneeOpenid: openid });
        }
        // 'all' 时不添加限制，看所有工单
        break;
        
      case '工程师':
        // 工程师：看工单池（未分配）+ 自己负责的
        conditions.push(_.or([
          // 工单池：未分配的待处理工单
          _.and([
            { status: 'pending' },
            _.or([
              { assigneeOpenid: _.exists(false) },
              { assigneeOpenid: '' },
              { assigneeOpenid: null }
            ])
          ]),
          // 自己负责的所有工单（所有状态）
          { assigneeOpenid: openid }
        ]));
        break;
        
      default:  // 普通用户
        // 只能看自己创建的工单
        conditions.push({ openid: openid });
        break;
    }
    
    // 状态筛选（改进）
    if (this.data.currentFilter === 'all') {
      // "全部"排除已关闭
      conditions.push({ status: _.neq('closed') });
      // 默认添加1个月时间限制
      if (!this.data.timeRangeFilter || this.data.timeRangeFilter === 'month') {
        conditions.push(this.getTimeRangeCondition('month'));
      }
    } else if (this.data.currentFilter === 'closed') {
      // 已关闭工单特殊处理
      conditions.push({ status: 'closed' });
      // 使用动态时间范围
      conditions.push(this.getTimeRangeCondition(this.data.closedTimeRange));
    } else if (this.data.currentFilter === 'urgent') {
      // 紧急工单筛选
      conditions.push({ priority: 'urgent' });
    } else {
      // 其他状态正常筛选
      conditions.push({ status: this.data.currentFilter });
    }
    
    // 时间范围筛选（新增，但不应用于已关闭工单）
    if (this.data.timeRangeFilter && this.data.timeRangeFilter !== 'month' && this.data.currentFilter !== 'closed') {
      conditions.push(this.getTimeRangeCondition(this.data.timeRangeFilter));
    }
    
    // 关键词搜索（搜索工单号、标题或提交人）
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.trim();
      if (keyword) {
        conditions.push(_.or([
          { ticketNo: this.db.RegExp({
            regexp: keyword,
            options: 'i'
          })},
          { title: this.db.RegExp({
            regexp: keyword,
            options: 'i'
          })},
          { submitterName: this.db.RegExp({
            regexp: keyword,
            options: 'i'
          })}
        ]));
      }
    }
    
    // 应用高级筛选
    
    // 高级筛选中的时间范围（已移至主筛选）
    
    // 如果有多个条件，使用and连接
    if (conditions.length === 0) {
      return {};
    } else if (conditions.length === 1) {
      return conditions[0];
    } else {
      return _.and(conditions);
    }
  },
  
  // 获取时间范围标签文字（供WXML使用）
  获取时间范围标签(range) {
    const labels = {
      'week': '近7天',
      'month': '近1月',
      'halfYear': '近6月',
      'year': '近1年',
      'overYear': '一年以上',
      'all': '全部时间'
    };
    return labels[range] || '近1月';
  },
  
  // 获取时间范围条件
  getTimeRangeCondition(range) {
    const _ = this.db.command;
    const now = new Date();
    let startTime, endTime;
    
    switch(range) {
      case 'week':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startTime = monthAgo;
        break;
      case 'halfYear':
        const halfYearAgo = new Date();
        halfYearAgo.setMonth(halfYearAgo.getMonth() - 6);
        startTime = halfYearAgo;
        break;
      case 'year':
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        startTime = yearAgo;
        break;
      case 'overYear':
        const overYearAgo = new Date();
        overYearAgo.setFullYear(overYearAgo.getFullYear() - 1);
        endTime = overYearAgo;
        return _.or([
          { createTime: _.lt(endTime) },
          { createdAt: _.lt(endTime) }
        ]);
    }
    
    if (startTime) {
      return _.or([
        { createTime: _.gte(startTime) },
        { createdAt: _.gte(startTime) }
      ]);
    }
    return {};
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
  
  // 删除负责人列表函数
  /* async loadAssigneeList() {
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
          currentAssignee: 'my'
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
          currentAssignee: 'my'
        });
      }
    }
  }, */

  // 继续处理暂停的工单
  async continueProcessing(e) {
    // 阻止事件冒泡
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    const ticketId = e.currentTarget.dataset.id;
    
    wx.showLoading({ title: '处理中...' });
    
    try {
      // 使用专门的继续处理云函数
      const cloudResult = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: {
          action: 'continueTicket',
          ticketId: ticketId
        }
      });
      
      if (cloudResult.result && cloudResult.result.code === 200) {
        wx.hideLoading();
        wx.showToast({
          title: '继续处理',
          icon: 'success'
        });
        
        // 触发工单更新事件
        this.app.eventBus.emit(this.app.EVENTS.TICKET_UPDATED, { ticketId });
        
        // 刷新列表
        setTimeout(() => {
          RefreshManager.setForceRefreshFlag('ticketList');
          this.refreshList();
        }, 500);
      } else {
        throw new Error(cloudResult.result?.message || '操作失败');
      }
    } catch (error) {
      console.error('[continueProcessing] 错误:', error);
      wx.hideLoading();
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
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
          assigned: false,
          assigneeOpenid: '',  // 未分配
          assigneeName: ''
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
          assigned: true,
          assigneeOpenid: 'mock_engineer_001',  // 模拟已分配
          assigneeName: '工程师A'
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
          assigned: true,
          assigneeOpenid: 'mock_engineer_002',  // 模拟已分配给其他工程师
          assigneeName: '工程师B'
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
          assigned: true,
          assigneeOpenid: 'mock_engineer_001',  // 模拟已完成的工单
          assigneeName: '工程师A'
        }
      ],
      hasMore: true
    };
  }
});