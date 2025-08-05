// 耗材管理页面
Page({
  data: {
    // Tab相关
    activeTab: 'quick',
    
    // 月度统计
    monthlyStats: {
      total: 156,
      types: 12
    },
    
    // 常用耗材
    commonMaterials: [
      { id: 1, name: '网线', type: 'network', spec: 'CAT6 超六类', icon: '🔌', quantity: 0, unit: '米' },
      { id: 2, name: '电源线', type: 'cable', spec: '1.5米', icon: '🔋', quantity: 0, unit: '根' },
      { id: 3, name: '鼠标', type: 'computer', spec: '无线', icon: '🖱️', quantity: 0, unit: '个' },
      { id: 4, name: '键盘', type: 'computer', spec: '有线', icon: '⌨️', quantity: 0, unit: '个' },
      { id: 5, name: '内存条', type: 'computer', spec: 'DDR4 8G', icon: '💾', quantity: 0, unit: '条' },
      { id: 6, name: '硬盘', type: 'computer', spec: 'SSD 256G', icon: '💿', quantity: 0, unit: '个' }
    ],
    
    hasSelectedMaterials: false,
    relatedTicket: null,
    
    // 使用记录
    searchKeyword: '',
    currentTimeFilter: 'all',
    timeFilters: [
      { label: '全部', value: 'all' },
      { label: '今天', value: 'today' },
      { label: '本周', value: 'week' },
      { label: '本月', value: 'month' }
    ],
    recordList: [],
    hasMoreRecords: false,
    loadingMore: false,
    
    // 库存查询
    currentCategory: 'all',
    categories: [
      { label: '全部', value: 'all', icon: '📦' },
      { label: '网络设备', value: 'network', icon: '🌐' },
      { label: '电脑配件', value: 'computer', icon: '💻' },
      { label: '办公用品', value: 'office', icon: '📎' },
      { label: '线材耗材', value: 'cable', icon: '🔌' }
    ],
    inventoryList: [],
    
    // 统计分析
    analysisTimeRange: '本月',
    topMaterials: [],
    
    // 新增弹窗
    addDialogVisible: false,
    materialSearchKeyword: '',
    searchedMaterials: [],
    recordRemark: ''
  },

  onLoad() {
    this.loadInitialData();
  },

  // 加载初始数据
  loadInitialData() {
    this.loadRecordList();
    this.loadInventoryList();
    this.loadTopMaterials();
  },

  // Tab切换
  onTabChange(e) {
    this.setData({
      activeTab: e.detail.value
    });
    
    // 根据tab加载对应数据
    if (e.detail.value === 'history') {
      this.loadRecordList();
    } else if (e.detail.value === 'inventory') {
      this.loadInventoryList();
    } else if (e.detail.value === 'analysis') {
      this.loadTopMaterials();
    }
  },

  // 快速记录 - 数量变化
  onQuantityChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value;
    
    const materials = this.data.commonMaterials.map(item => {
      if (item.id === id) {
        item.quantity = value;
      }
      return item;
    });
    
    // 检查是否有选中的耗材
    const hasSelected = materials.some(item => item.quantity > 0);
    
    this.setData({
      commonMaterials: materials,
      hasSelectedMaterials: hasSelected
    });
  },

  // 选择关联工单
  selectTicket() {
    // 跳转到工单选择页面或显示工单选择弹窗
    wx.showToast({
      title: '选择工单功能开发中',
      icon: 'none'
    });
  },

  // 快速提交
  quickSubmit() {
    const selectedMaterials = this.data.commonMaterials.filter(item => item.quantity > 0);
    
    if (selectedMaterials.length === 0) {
      wx.showToast({
        title: '请选择耗材',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认提交',
      content: `确定要提交${selectedMaterials.length}项耗材记录吗？`,
      success: (res) => {
        if (res.confirm) {
          this.submitMaterialRecord(selectedMaterials);
        }
      }
    });
  },

  // 提交耗材记录
  async submitMaterialRecord(materials) {
    wx.showLoading({
      title: '提交中...'
    });

    try {
      // 调用API提交记录
      // await api.submitMaterialRecord(materials);
      
      // 重置选择
      const resetMaterials = this.data.commonMaterials.map(item => {
        item.quantity = 0;
        return item;
      });
      
      this.setData({
        commonMaterials: resetMaterials,
        hasSelectedMaterials: false,
        relatedTicket: null
      });
      
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });
      
      // 刷新记录列表
      if (this.data.activeTab === 'history') {
        this.loadRecordList();
      }
    } catch (error) {
      wx.showToast({
        title: '提交失败',
        icon: 'error'
      });
    }
  },

  // 管理常用耗材
  manageCommon() {
    wx.showToast({
      title: '管理功能开发中',
      icon: 'none'
    });
  },

  // 搜索变化
  onSearchChange(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.loadRecordList();
  },

  // 时间筛选变化
  onTimeFilterChange(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      currentTimeFilter: value
    });
    this.loadRecordList();
  },

  // 加载使用记录
  loadRecordList() {
    // 模拟数据
    const mockRecords = [
      {
        id: 1,
        date: '2024-01-15',
        time: '14:30',
        ticketNo: '#TK001215',  // 关联的工单ID
        materials: [
          { id: 1, name: '网线', type: 'network', quantity: 10, unit: '米' },
          { id: 2, name: '电源线', type: 'cable', quantity: 2, unit: '根' }
        ]
      },
      {
        id: 2,
        date: '2024-01-15',
        time: '10:20',
        ticketNo: '#TK001214',  // 关联的工单ID
        materials: [
          { id: 3, name: '鼠标', type: 'computer', quantity: 1, unit: '个' },
          { id: 4, name: '键盘', type: 'computer', quantity: 1, unit: '个' },
          { id: 5, name: '内存条', type: 'computer', quantity: 2, unit: '条' }
        ]
      },
      {
        id: 3,
        date: '2024-01-14',
        time: '16:45',
        ticketNo: null,  // 未关联工单
        materials: [
          { id: 6, name: '硬盘', type: 'computer', quantity: 1, unit: '个' }
        ]
      }
    ];
    
    this.setData({
      recordList: mockRecords
    });
  },

  // 查看记录详情
  viewRecordDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.showToast({
      title: '详情功能开发中',
      icon: 'none'
    });
  },

  // 分类切换
  onCategoryChange(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      currentCategory: value
    });
    this.loadInventoryList();
  },

  // 加载库存列表
  loadInventoryList() {
    // 模拟数据
    const mockInventory = [
      {
        id: 1,
        name: '网线',
        spec: 'CAT6 超六类',
        stock: 200,
        minStock: 100,
        maxStock: 500,
        unit: '米'
      },
      {
        id: 2,
        name: '电源线',
        spec: '1.5米',
        stock: 15,
        minStock: 20,
        maxStock: 100,
        unit: '根'
      },
      {
        id: 3,
        name: '鼠标',
        spec: '无线',
        stock: 8,
        minStock: 10,
        maxStock: 50,
        unit: '个'
      },
      {
        id: 4,
        name: '键盘',
        spec: '有线',
        stock: 12,
        minStock: 10,
        maxStock: 50,
        unit: '个'
      }
    ];
    
    this.setData({
      inventoryList: mockInventory
    });
  },

  // 获取库存状态
  getStockStatus(stock, minStock) {
    if (stock === 0) return '缺货';
    if (stock < minStock) return '库存不足';
    return '库存充足';
  },

  // 获取库存主题
  getStockTheme(stock, minStock) {
    if (stock === 0) return 'danger';
    if (stock < minStock) return 'warning';
    return 'success';
  },

  // 获取库存百分比
  getStockPercentage(stock, maxStock) {
    return Math.min(100, Math.round((stock / maxStock) * 100));
  },

  // 申请领用
  applyMaterial(e) {
    const item = e.currentTarget.dataset.item;
    wx.showToast({
      title: '申请功能开发中',
      icon: 'none'
    });
  },

  // 报告缺货
  reportShortage(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '报告缺货',
      content: `确定要报告"${item.name}"缺货吗？`,
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '已报告',
            icon: 'success'
          });
        }
      }
    });
  },

  // 选择时间范围
  selectTimeRange() {
    const options = ['本周', '本月', '本季度', '本年'];
    wx.showActionSheet({
      itemList: options,
      success: (res) => {
        this.setData({
          analysisTimeRange: options[res.tapIndex]
        });
        this.loadTopMaterials();
      }
    });
  },

  // 加载TOP耗材
  loadTopMaterials() {
    // 模拟数据
    const mockTop = [
      { id: 1, name: '网线', spec: 'CAT6', quantity: 320, unit: '米' },
      { id: 2, name: '鼠标', spec: '无线', quantity: 25, unit: '个' },
      { id: 3, name: '键盘', spec: '有线', quantity: 18, unit: '个' },
      { id: 4, name: '内存条', spec: 'DDR4 8G', quantity: 12, unit: '条' },
      { id: 5, name: '硬盘', spec: 'SSD 256G', quantity: 8, unit: '个' }
    ];
    
    this.setData({
      topMaterials: mockTop
    });
  },

  // 导出报表
  exportReport() {
    wx.showModal({
      title: '导出报表',
      content: '确定要导出本月耗材统计报表吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '导出中...'
          });
          
          setTimeout(() => {
            wx.hideLoading();
            wx.showToast({
              title: '导出成功',
              icon: 'success'
            });
          }, 1500);
        }
      }
    });
  },

  // 显示新增弹窗
  showAddDialog() {
    this.setData({
      addDialogVisible: true,
      materialSearchKeyword: '',
      searchedMaterials: this.getAllMaterials(),
      recordRemark: ''
    });
  },

  // 关闭新增弹窗
  closeAddDialog() {
    this.setData({
      addDialogVisible: false
    });
  },

  // 获取所有耗材
  getAllMaterials() {
    return [
      { id: 1, name: '网线', spec: 'CAT6 超六类', selected: false, quantity: 1 },
      { id: 2, name: '电源线', spec: '1.5米', selected: false, quantity: 1 },
      { id: 3, name: '鼠标', spec: '无线', selected: false, quantity: 1 },
      { id: 4, name: '键盘', spec: '有线', selected: false, quantity: 1 },
      { id: 5, name: '内存条', spec: 'DDR4 8G', selected: false, quantity: 1 },
      { id: 6, name: '硬盘', spec: 'SSD 256G', selected: false, quantity: 1 }
    ];
  },

  // 耗材搜索
  onMaterialSearch(e) {
    const keyword = e.detail.value;
    this.setData({
      materialSearchKeyword: keyword
    });
    
    // 过滤耗材
    if (keyword) {
      const filtered = this.getAllMaterials().filter(item => 
        item.name.includes(keyword) || item.spec.includes(keyword)
      );
      this.setData({
        searchedMaterials: filtered
      });
    } else {
      this.setData({
        searchedMaterials: this.getAllMaterials()
      });
    }
  },

  // 切换耗材选择
  toggleMaterialSelect(e) {
    const id = e.currentTarget.dataset.id;
    const materials = this.data.searchedMaterials.map(item => {
      if (item.id === id) {
        item.selected = !item.selected;
      }
      return item;
    });
    
    this.setData({
      searchedMaterials: materials
    });
  },

  // 选择数量变化
  onSelectQuantityChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value;
    
    const materials = this.data.searchedMaterials.map(item => {
      if (item.id === id) {
        item.quantity = value;
      }
      return item;
    });
    
    this.setData({
      searchedMaterials: materials
    });
  },

  // 确认新增记录
  confirmAddRecord() {
    const selected = this.data.searchedMaterials.filter(item => item.selected);
    
    if (selected.length === 0) {
      wx.showToast({
        title: '请选择耗材',
        icon: 'none'
      });
      return;
    }
    
    this.submitMaterialRecord(selected);
    this.closeAddDialog();
  },

  // 处理弹窗变化
  handleAddDialogChange(e) {
    this.setData({
      addDialogVisible: e.detail.visible
    });
  }
});