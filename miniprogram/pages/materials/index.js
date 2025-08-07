// 耗材管理页面
Page({
  data: {
    // 用户信息
    userInfo: {
      isManager: false  // 从缓存或全局状态获取
    },
    
    // Tab相关
    activeTab: 'quick',
    
    // 月度统计
    monthlyStats: {
      total: 156,
      types: 12
    },
    
    // 常用耗材
    commonMaterials: [
      { id: 1, name: '网线', type: 'network', spec: 'CAT6 超六类', photo: '', quantity: 0, unit: '米', stock: 100, minStock: 20 },
      { id: 2, name: '电源线', type: 'cable', spec: '1.5米', photo: '', quantity: 0, unit: '根', stock: 50, minStock: 10 },
      { id: 3, name: '鼠标', type: 'computer', spec: '无线', photo: '', quantity: 0, unit: '个', stock: 30, minStock: 5 },
      { id: 4, name: '键盘', type: 'computer', spec: '有线', photo: '', quantity: 0, unit: '个', stock: 25, minStock: 5 },
      { id: 5, name: '内存条', type: 'computer', spec: 'DDR4 8G', photo: '', quantity: 0, unit: '条', stock: 15, minStock: 3 },
      { id: 6, name: '硬盘', type: 'computer', spec: 'SSD 256G', photo: '', quantity: 0, unit: '个', stock: 10, minStock: 2 }
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
    recordRemark: '',
    
    // 管理功能相关
    manageDialogVisible: false,
    editingMaterial: null,
    newMaterialName: '',
    newMaterialSpec: '',
    newMaterialType: 'network',
    newMaterialMinStock: 10,
    newMaterialMaxStock: 100,
    newMaterialUnit: '个',
    newMaterialPhoto: '',
    newMaterialTypeLabel: '网络设备',  // 默认类型标签
    newMaterialStock: 0,
    materialTypes: [
      { label: '网络设备', value: 'network' },
      { label: '电脑配件', value: 'computer' },
      { label: '办公用品', value: 'office' },
      { label: '线材耗材', value: 'cable' }
    ],
    materialUnits: ['个', '根', '米', '条', '套', '台', 'GB']
  },

  onLoad() {
    // 获取app实例和数据库
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    
    // 检查用户角色
    const userInfo = this.app.globalData.userInfo;
    const userRoleGroup = userInfo?.roleGroup || wx.getStorageSync('userRoleGroup') || '工程师';
    this.setData({
      'userInfo.isManager': userRoleGroup === '经理'
    });
    
    this.loadUserInfo();
    this.loadInitialData();
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
      
      this.setData({
        userInfo: {
          isManager: userInfo?.roleGroup === '经理' || false
        }
      });
    } catch (error) {
      console.error('加载用户信息失败:', error);
      this.setData({
        userInfo: { isManager: false }
      });
    }
  },

  // 加载初始数据
  async loadInitialData() {
    // 从数据库加载物料数据
    await this.loadMaterialsFromDB();
    
    this.loadRecordList();
    this.loadInventoryList();
    this.loadTopMaterials();
  },
  
  // 从数据库加载物料列表
  async loadMaterialsFromDB() {
    try {
      const res = await this.db.collection('materials').limit(20).get();
      
      if (res.data.length > 0) {
        const materials = res.data.map(item => ({
          id: item._id,
          name: item.name,
          type: item.type || 'network',
          spec: item.spec || '',
          photo: item.photo || '',
          quantity: 0,
          unit: item.unit || '个',
          stock: item.stock || 0,
          minStock: item.minStock || 10,
          maxStock: item.maxStock || 100
        }));
        
        this.setData({ commonMaterials: materials });
      } else {
        // 如果数据库为空，使用默认数据并保存到数据库
        await this.initDefaultMaterials();
      }
    } catch (error) {
      console.error('加载物料数据失败:', error);
      // 使用默认数据
      this.setData({ commonMaterials: this.getDefaultMaterials() });
    }
  },
  
  // 初始化默认物料数据
  async initDefaultMaterials() {
    const defaultMaterials = this.getDefaultMaterials();
    
    try {
      // 批量添加到数据库
      for (const material of defaultMaterials) {
        await this.db.collection('materials').add({
          data: {
            name: material.name,
            type: material.type,
            spec: material.spec,
            unit: material.unit,
            stock: material.stock,
            minStock: material.minStock,
            maxStock: material.maxStock || 100,
            photo: material.photo || '',
            createTime: new Date(),
            updateTime: new Date()
          }
        });
      }
      
      console.log('初始化默认物料成功');
      this.setData({ commonMaterials: defaultMaterials });
    } catch (error) {
      console.error('初始化默认物料失败:', error);
    }
  },
  
  // 获取默认物料数据
  getDefaultMaterials() {
    return [
      { id: 1, name: '网线', type: 'network', spec: 'CAT6 超六类', photo: '', quantity: 0, unit: '米', stock: 100, minStock: 20, maxStock: 500 },
      { id: 2, name: '电源线', type: 'cable', spec: '1.5米', photo: '', quantity: 0, unit: '根', stock: 50, minStock: 10, maxStock: 200 },
      { id: 3, name: '鼠标', type: 'computer', spec: '无线', photo: '', quantity: 0, unit: '个', stock: 30, minStock: 5, maxStock: 100 },
      { id: 4, name: '键盘', type: 'computer', spec: '有线', photo: '', quantity: 0, unit: '个', stock: 25, minStock: 5, maxStock: 100 },
      { id: 5, name: '内存条', type: 'computer', spec: 'DDR4 8G', photo: '', quantity: 0, unit: '条', stock: 15, minStock: 3, maxStock: 50 },
      { id: 6, name: '硬盘', type: 'computer', spec: 'SSD 256G', photo: '', quantity: 0, unit: '个', stock: 10, minStock: 2, maxStock: 30 }
    ];
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
      const app = getApp();
      const openid = app.globalData.openid;
      const userInfo = app.globalData.userInfo;
      
      // 创建工作日志记录
      const worklog = {
        type: 'material',  // 物料使用记录
        engineerOpenid: openid,
        engineerName: userInfo?.name || '工程师',
        ticketId: this.data.relatedTicket?._id || null,
        materials: materials.map(m => ({
          id: m.id,
          name: m.name,
          spec: m.spec,
          quantity: m.quantity,
          unit: m.unit
        })),
        remark: this.data.recordRemark || '',
        createTime: new Date(),
        updateTime: new Date()
      };
      
      // 保存到数据库
      await this.db.collection('worklog').add({
        data: worklog
      });
      
      // 更新物料库存
      for (const material of materials) {
        if (material.id && material.quantity > 0) {
          try {
            // 查找物料
            const res = await this.db.collection('materials').doc(material.id).get();
            if (res.data) {
              const currentStock = res.data.stock || 0;
              const newStock = Math.max(0, currentStock - material.quantity);
              
              // 更新库存
              await this.db.collection('materials').doc(material.id).update({
                data: {
                  stock: newStock,
                  updateTime: new Date()
                }
              });
            }
          } catch (err) {
            console.error('更新物料库存失败:', err);
          }
        }
      }
      
      // 重置选择
      const resetMaterials = this.data.commonMaterials.map(item => {
        item.quantity = 0;
        return item;
      });
      
      this.setData({
        commonMaterials: resetMaterials,
        hasSelectedMaterials: false,
        relatedTicket: null,
        recordRemark: ''
      });
      
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });
      
      // 刷新记录列表
      if (this.data.activeTab === 'history') {
        this.loadRecordList();
      }
      // 刷新库存列表
      if (this.data.activeTab === 'inventory') {
        this.loadInventoryList();
      }
    } catch (error) {
      console.error('提交物料记录失败:', error);
      wx.hideLoading();
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
  async loadRecordList() {
    try {
      const app = getApp();
      const openid = app.globalData.openid;
      
      if (!openid) {
        console.log('等待用户openid...');
        this.setData({ recordList: [] });
        return;
      }
      
      // 从 worklog 集合加载物料使用记录
      const res = await this.db.collection('worklog')
        .where({
          engineerOpenid: openid,
          type: 'material'  // 筛选物料类型的记录
        })
        .orderBy('createTime', 'desc')
        .limit(20)
        .get();
      
      if (res.data.length > 0) {
        const records = res.data.map(log => ({
          id: log._id,
          date: this.formatDate(log.createTime),
          time: this.formatTimeOnly(log.createTime),
          ticketNo: log.ticketId ? '#' + log.ticketId.slice(-6).toUpperCase() : null,
          materials: log.materials || [],
          remark: log.remark || ''
        }));
        
        this.setData({ recordList: records });
      } else {
        // 如果没有记录，显示空状态
        this.setData({ recordList: [] });
      }
    } catch (error) {
      console.error('加载使用记录失败:', error);
      // 使用默认数据
      this.setData({
        recordList: []
      });
    }
  },
  
  // 格式化日期
  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  
  // 格式化时间
  formatTimeOnly(date) {
    if (!date) return '';
    const d = new Date(date);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
  async loadInventoryList() {
    try {
      // 构建查询条件
      let where = {};
      if (this.data.currentCategory !== 'all') {
        where.type = this.data.currentCategory;
      }
      
      // 从数据库加载物料库存
      const res = await this.db.collection('materials')
        .where(where)
        .orderBy('updateTime', 'desc')
        .limit(50)
        .get();
      
      if (res.data.length > 0) {
        const inventory = res.data.map(item => ({
          id: item._id,
          name: item.name,
          spec: item.spec || '',
          stock: item.stock || 0,
          minStock: item.minStock || 10,
          maxStock: item.maxStock || 100,
          unit: item.unit || '个',
          type: item.type || 'network',
          photo: item.photo || '',
          icon: '/assets/icons/unknown.png'
        }));
        
        this.setData({ inventoryList: inventory });
      } else {
        this.setData({ inventoryList: [] });
      }
    } catch (error) {
      console.error('加载库存列表失败:', error);
      // 使用默认数据
      this.setData({ inventoryList: [] });
    }
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
  async loadTopMaterials() {
    try {
      // 获取时间范围
      const now = new Date();
      let startTime;
      
      switch(this.data.analysisTimeRange) {
        case '本周':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '本月':
          startTime = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case '本季度':
          const quarter = Math.floor(now.getMonth() / 3);
          startTime = new Date(now.getFullYear(), quarter * 3, 1);
          break;
        case '本年':
          startTime = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startTime = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      // 从 worklog 集合统计物料使用情况
      const _ = this.db.command;
      const res = await this.db.collection('worklog')
        .where({
          type: 'material',
          createTime: _.gte(startTime)
        })
        .limit(100)
        .get();
      
      // 统计各物料使用量
      const materialStats = {};
      
      res.data.forEach(log => {
        if (log.materials && Array.isArray(log.materials)) {
          log.materials.forEach(material => {
            const key = material.name;
            if (!materialStats[key]) {
              materialStats[key] = {
                name: material.name,
                spec: material.spec || '',
                quantity: 0,
                unit: material.unit || '个'
              };
            }
            materialStats[key].quantity += material.quantity || 0;
          });
        }
      });
      
      // 排序并取前5名
      const topMaterials = Object.values(materialStats)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map((item, index) => ({ ...item, id: index + 1 }));
      
      this.setData({ topMaterials });
    } catch (error) {
      console.error('加载TOP耗材失败:', error);
      // 使用默认数据
      this.setData({
        topMaterials: []
      });
    }
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
  },
  
  // ========== 管理员功能 ==========
  
  // 显示管理弹窗
  showManageDialog() {
    this.setData({
      manageDialogVisible: true,
      editingMaterial: null,
      newMaterialName: '',
      newMaterialSpec: '',
      newMaterialType: 'network',
      newMaterialMinStock: 10,
      newMaterialMaxStock: 100,
      newMaterialUnit: '个',
      newMaterialPhoto: ''
    });
  },
  
  // 关闭管理弹窗
  closeManageDialog() {
    this.setData({
      manageDialogVisible: false
    });
  },
  
  // 处理管理弹窗变化
  handleManageDialogChange(e) {
    this.setData({
      manageDialogVisible: e.detail.visible
    });
  },
  
  // 编辑耗材
  editMaterial(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      manageDialogVisible: true,
      editingMaterial: item,
      newMaterialName: item.name,
      newMaterialSpec: item.spec,
      newMaterialType: item.type,
      newMaterialMinStock: item.minStock,
      newMaterialMaxStock: item.maxStock,
      newMaterialUnit: item.unit,
      newMaterialPhoto: item.photo || ''
    });
  },
  
  // 删除耗材
  deleteMaterial(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${item.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          const inventoryList = this.data.inventoryList.filter(material => material.id !== item.id);
          this.setData({ inventoryList });
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },
  
  // 调整库存
  adjustStock(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '调整库存',
      editable: true,
      placeholderText: `当前库存：${item.stock} ${item.unit}`,
      success: (res) => {
        if (res.confirm && res.content) {
          const newStock = parseInt(res.content);
          if (!isNaN(newStock) && newStock >= 0) {
            const inventoryList = this.data.inventoryList.map(material => {
              if (material.id === item.id) {
                material.stock = newStock;
              }
              return material;
            });
            this.setData({ inventoryList });
            wx.showToast({
              title: '调整成功',
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: '请输入有效数字',
              icon: 'none'
            });
          }
        }
      }
    });
  },
  
  // 选择耗材照片
  chooseMaterialPhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          newMaterialPhoto: tempFilePath
        });
      }
    });
  },
  
  // 选择耗材类型
  selectMaterialType() {
    const typeLabels = this.data.materialTypes.map(type => type.label);
    wx.showActionSheet({
      itemList: typeLabels,
      success: (res) => {
        this.setData({
          newMaterialType: this.data.materialTypes[res.tapIndex].value
        });
      }
    });
  },
  
  // 选择单位
  selectMaterialUnit() {
    wx.showActionSheet({
      itemList: this.data.materialUnits,
      success: (res) => {
        this.setData({
          newMaterialUnit: this.data.materialUnits[res.tapIndex]
        });
      }
    });
  },
  
  // 显示添加耗材弹窗
  showAddMaterialDialog() {
    this.setData({
      manageDialogVisible: true,
      editingMaterial: null,
      newMaterialName: '',
      newMaterialSpec: '',
      newMaterialType: 'network',
      newMaterialTypeLabel: '网络设备',
      newMaterialUnit: '个',
      newMaterialStock: 0,
      newMaterialMinStock: 10,
      newMaterialMaxStock: 100,
      newMaterialPhoto: ''
    });
  },
  
  // 编辑耗材
  editMaterial(e) {
    const item = e.currentTarget.dataset.item;
    const typeLabel = this.data.materialTypes.find(t => t.value === item.type)?.label || '网络设备';
    this.setData({
      manageDialogVisible: true,
      editingMaterial: item,
      newMaterialName: item.name,
      newMaterialSpec: item.spec,
      newMaterialType: item.type,
      newMaterialTypeLabel: typeLabel,
      newMaterialUnit: item.unit,
      newMaterialStock: item.stock || 0,
      newMaterialMinStock: item.minStock || 10,
      newMaterialMaxStock: item.maxStock || 100,
      newMaterialPhoto: item.photo || ''
    });
  },
  
  // 删除耗材
  deleteMaterial(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该耗材吗？',
      success: (res) => {
        if (res.confirm) {
          const materials = this.data.commonMaterials.filter(item => item.id !== id);
          this.setData({ commonMaterials: materials });
          wx.setStorageSync('materials', materials);
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },
  
  // 选择耗材图片
  chooseMaterialPhoto() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        // 在实际应用中，这里应该上传到服务器
        // 现在仅保存到本地
        this.setData({
          newMaterialPhoto: tempFilePath
        });
      }
    });
  },
  
  // 点击耗材图片上传（管理列表中）
  uploadMaterialPhoto(e) {
    const id = e.currentTarget.dataset.id;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        const materials = this.data.commonMaterials.map(item => {
          if (item.id === id) {
            return { ...item, photo: tempFilePath };
          }
          return item;
        });
        this.setData({ commonMaterials: materials });
        wx.setStorageSync('materials', materials);
        wx.showToast({
          title: '图片更新成功',
          icon: 'success'
        });
      }
    });
  },
  
  // 选择耗材类型
  selectMaterialType() {
    wx.showActionSheet({
      itemList: this.data.materialTypes.map(item => item.label),
      success: (res) => {
        const type = this.data.materialTypes[res.tapIndex];
        this.setData({
          newMaterialType: type.value,
          newMaterialTypeLabel: type.label
        });
      }
    });
  },
  
  // 关闭管理弹窗
  closeManageDialog() {
    this.setData({
      manageDialogVisible: false
    });
  },
  
  // 弹窗状态变化
  handleManageDialogChange(e) {
    this.setData({
      manageDialogVisible: e.detail.visible
    });
  },
  
  // 确认保存耗材
  confirmManageMaterial() {
    const { 
      newMaterialName, 
      newMaterialSpec, 
      newMaterialType, 
      newMaterialUnit,
      newMaterialStock,
      newMaterialMinStock, 
      newMaterialMaxStock, 
      newMaterialPhoto, 
      editingMaterial 
    } = this.data;
    
    if (!newMaterialName.trim()) {
      wx.showToast({
        title: '请输入耗材名称',
        icon: 'none'
      });
      return;
    }
    
    if (newMaterialMinStock >= newMaterialMaxStock) {
      wx.showToast({
        title: '最低库存应小于最高库存',
        icon: 'none'
      });
      return;
    }
    
    const materialData = {
      name: newMaterialName.trim(),
      spec: newMaterialSpec.trim(),
      type: newMaterialType,
      unit: newMaterialUnit,
      stock: newMaterialStock,
      minStock: newMaterialMinStock,
      maxStock: newMaterialMaxStock,
      photo: newMaterialPhoto || '',
      quantity: 0
    };
    
    let materials = [...this.data.commonMaterials];
    
    if (editingMaterial) {
      // 编辑模式
      materials = materials.map(item => {
        if (item.id === editingMaterial.id) {
          return { ...item, ...materialData };
        }
        return item;
      });
    } else {
      // 新增模式
      const newMaterial = {
        ...materialData,
        id: Date.now()
      };
      materials.push(newMaterial);
    }
    
    this.setData({ 
      commonMaterials: materials,
      manageDialogVisible: false
    });
    
    // 保存到本地存储
    wx.setStorageSync('materials', materials);
    
    wx.showToast({
      title: editingMaterial ? '编辑成功' : '添加成功',
      icon: 'success'
    });
  },
  
  // 调整库存
  adjustStock(e) {
    const item = e.currentTarget.dataset.item;
    wx.showModal({
      title: '调整库存',
      content: `当前库存: ${item.stock} ${item.unit}`,
      editable: true,
      placeholderText: '请输入新的库存数量',
      success: (res) => {
        if (res.confirm && res.content) {
          const newStock = parseInt(res.content);
          if (!isNaN(newStock) && newStock >= 0) {
            const materials = this.data.commonMaterials.map(m => {
              if (m.id === item.id) {
                return { ...m, stock: newStock };
              }
              return m;
            });
            this.setData({ commonMaterials: materials });
            wx.setStorageSync('materials', materials);
            wx.showToast({
              title: '库存调整成功',
              icon: 'success'
            });
          }
        }
      }
    });
  }
});