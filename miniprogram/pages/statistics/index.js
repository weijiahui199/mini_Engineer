// 统计页面
Page({
  data: {
    // 当前统计周期
    currentPeriod: '本月',
    
    // 是否为管理员
    isManager: false,
    
    // 个人统计数据
    personalStats: {
      completed: 128,
      avgTime: 2.5,
      rating: 4.8,
      efficiency: 95
    },
    
    // 工单类型分布
    typeDistribution: [
      { type: 'hardware', label: '硬件故障', percentage: 35, color: '#0ea5e9' },
      { type: 'software', label: '软件问题', percentage: 28, color: '#10b981' },
      { type: 'network', label: '网络故障', percentage: 20, color: '#f59e0b' },
      { type: 'account', label: '账号权限', percentage: 12, color: '#8b5cf6' },
      { type: 'other', label: '其他', percentage: 5, color: '#6b7280' }
    ],
    
    // 趋势类型
    trendTypes: [
      { label: '日', value: 'daily' },
      { label: '周', value: 'weekly' },
      { label: '月', value: 'monthly' }
    ],
    currentTrendType: 'daily',
    
    // 团队排行榜
    teamRanking: [],
    
    // 详细数据
    detailData: [],
    
    // 导出选项
    exportOptions: ['personal', 'charts'],
    
    // 筛选相关
    filterVisible: false,
    filterTimeRange: 'month',
    filterTicketTypes: ['hardware', 'software', 'network', 'account', 'other'],
    filterDimension: 'personal'
  },

  onLoad(options) {
    // 检查用户角色
    this.checkUserRole();
    // 加载统计数据
    this.loadStatisticsData();
    // 加载详细数据
    this.loadDetailData();
  },

  // 检查用户角色
  checkUserRole() {
    // 从缓存或服务器获取用户角色
    const userInfo = wx.getStorageSync('userInfo') || {};
    this.setData({
      isManager: userInfo.roleGroup === '经理'
    });
    
    // 如果是管理员，加载团队数据
    if (userInfo.roleGroup === '经理') {
      this.loadTeamRanking();
    }
  },

  // 加载统计数据
  loadStatisticsData() {
    wx.showLoading({
      title: '加载中...'
    });
    
    // 模拟加载数据
    setTimeout(() => {
      this.setData({
        personalStats: {
          completed: 128,
          avgTime: 2.5,
          rating: 4.8,
          efficiency: 95
        }
      });
      wx.hideLoading();
    }, 500);
  },

  // 加载团队排行榜
  loadTeamRanking() {
    // 模拟数据
    const mockRanking = [
      {
        id: 1,
        name: '张工程师',
        avatar: '',
        completed: 156,
        rating: 4.9,
        score: 98
      },
      {
        id: 2,
        name: '李工程师',
        avatar: '',
        completed: 142,
        rating: 4.8,
        score: 95
      },
      {
        id: 3,
        name: '王工程师',
        avatar: '',
        completed: 128,
        rating: 4.7,
        score: 92
      },
      {
        id: 4,
        name: '刘工程师',
        avatar: '',
        completed: 115,
        rating: 4.6,
        score: 88
      },
      {
        id: 5,
        name: '陈工程师',
        avatar: '',
        completed: 102,
        rating: 4.5,
        score: 85
      }
    ];
    
    this.setData({
      teamRanking: mockRanking
    });
  },

  // 加载详细数据
  loadDetailData() {
    // 模拟数据
    const mockData = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      
      mockData.push({
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        completed: Math.floor(Math.random() * 10) + 5,
        processing: Math.floor(Math.random() * 5) + 2,
        overtime: Math.floor(Math.random() * 3)
      });
    }
    
    this.setData({
      detailData: mockData
    });
  },

  // 选择统计周期
  selectPeriod() {
    const periods = ['本日', '本周', '本月', '本季度', '本年', '自定义'];
    
    wx.showActionSheet({
      itemList: periods,
      success: (res) => {
        if (res.tapIndex === 5) {
          // 自定义时间范围
          this.showCustomDatePicker();
        } else {
          this.setData({
            currentPeriod: periods[res.tapIndex]
          });
          this.loadStatisticsData();
        }
      }
    });
  },

  // 显示自定义日期选择器
  showCustomDatePicker() {
    wx.showToast({
      title: '自定义日期功能开发中',
      icon: 'none'
    });
  },

  // 显示类型说明
  showTypeInfo() {
    wx.showModal({
      title: '工单类型说明',
      content: '硬件故障：电脑、打印机等硬件设备问题\n软件问题：系统、应用软件相关问题\n网络故障：网络连接、访问相关问题\n账号权限：账号申请、权限变更等\n其他：不属于以上类别的问题',
      showCancel: false
    });
  },

  // 切换趋势类型
  switchTrendType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      currentTrendType: type
    });
    
    // 重新加载对应的趋势数据
    this.loadTrendData(type);
  },

  // 加载趋势数据
  loadTrendData(type) {
    // 根据类型加载对应的趋势数据
    wx.showToast({
      title: `加载${type === 'daily' ? '日' : type === 'weekly' ? '周' : '月'}趋势`,
      icon: 'none'
    });
  },

  // 查看全部详细数据
  viewAllDetails() {
    wx.navigateTo({
      url: '/pages/statistics-detail/index'
    });
  },

  // 导出选项变化
  onExportOptionsChange(e) {
    this.setData({
      exportOptions: e.detail.value
    });
  },

  // 导出报表
  exportReport() {
    const options = this.data.exportOptions;
    
    wx.showModal({
      title: '确认导出',
      content: `将导出${options.includes('personal') ? '个人数据' : ''}${options.includes('team') ? '、团队数据' : ''}${options.includes('charts') ? '（含图表）' : ''}`,
      success: (res) => {
        if (res.confirm) {
          this.doExport();
        }
      }
    });
  },

  // 执行导出
  doExport() {
    wx.showLoading({
      title: '生成报表中...'
    });
    
    // 模拟导出过程
    setTimeout(() => {
      wx.hideLoading();
      wx.showModal({
        title: '导出成功',
        content: '报表已生成，是否发送到邮箱？',
        confirmText: '发送',
        cancelText: '下载',
        success: (res) => {
          if (res.confirm) {
            this.sendToEmail();
          } else {
            this.downloadReport();
          }
        }
      });
    }, 2000);
  },

  // 发送到邮箱
  sendToEmail() {
    wx.showToast({
      title: '已发送到邮箱',
      icon: 'success'
    });
  },

  // 下载报表
  downloadReport() {
    wx.showToast({
      title: '开始下载',
      icon: 'success'
    });
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

  // 处理筛选弹窗变化
  handleFilterChange(e) {
    this.setData({
      filterVisible: e.detail.visible
    });
  },

  // 时间范围变化
  onFilterTimeChange(e) {
    this.setData({
      filterTimeRange: e.detail.value
    });
  },

  // 工单类型变化
  onFilterTypesChange(e) {
    this.setData({
      filterTicketTypes: e.detail.value
    });
  },

  // 数据维度变化
  onFilterDimensionChange(e) {
    this.setData({
      filterDimension: e.detail.value
    });
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      filterTimeRange: 'month',
      filterTicketTypes: ['hardware', 'software', 'network', 'account', 'other'],
      filterDimension: 'personal'
    });
  },

  // 应用筛选
  applyFilter() {
    const { filterTimeRange, filterTicketTypes, filterDimension } = this.data;
    
    wx.showLoading({
      title: '应用筛选...'
    });
    
    // 根据筛选条件重新加载数据
    setTimeout(() => {
      this.loadStatisticsData();
      this.loadDetailData();
      if (this.data.isManager && filterDimension !== 'personal') {
        this.loadTeamRanking();
      }
      
      wx.hideLoading();
      this.closeFilter();
      
      wx.showToast({
        title: '筛选已应用',
        icon: 'success'
      });
    }, 500);
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '数据统计报表',
      path: '/pages/statistics/index'
    };
  }
});