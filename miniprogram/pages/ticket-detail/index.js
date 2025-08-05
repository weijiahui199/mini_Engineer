// 工单详情页面
Page({
  data: {
    ticketId: '',
    
    // 工单信息
    ticketInfo: {
      ticketNo: '#TK001215',
      title: '电脑无法开机',
      category: '硬件故障',
      priority: 'urgent',
      status: 'pending', // pending, processing, resolved, closed
      submitter: '张三',
      phone: '13812345678',
      location: '财务部3楼',
      description: '电脑按下电源键后没有任何反应，电源指示灯不亮，已尝试更换电源线但问题依旧。',
      createTime: '2024-01-15 09:30',
      attachments: []
    },
    
    // 状态文本映射
    statusText: {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
      closed: '已关闭'
    },
    
    // 处理时间线
    processTimeline: [
      {
        id: 1,
        title: '工单创建',
        time: '2024-01-15 09:30',
        description: '用户提交工单',
        isActive: true
      },
      {
        id: 2,
        title: '工单分配',
        time: '2024-01-15 09:35',
        description: '分配给张工程师',
        isActive: true
      },
      {
        id: 3,
        title: '开始处理',
        time: '',
        description: '',
        isActive: false
      },
      {
        id: 4,
        title: '完成',
        time: '',
        description: '',
        isActive: false
      }
    ],
    
    // 解决方案
    solutionText: '',
    
    // 耗材记录
    materials: [],
    
    // 常用耗材
    commonMaterials: [
      { id: 1, name: '网线', unit: '米' },
      { id: 2, name: '电源线', unit: '根' },
      { id: 3, name: '内存条', unit: '条' },
      { id: 4, name: '硬盘', unit: '个' },
      { id: 5, name: '鼠标', unit: '个' },
      { id: 6, name: '键盘', unit: '个' }
    ],
    
    // 耗材弹窗
    materialDialogVisible: false,
    selectedMaterial: {},
    materialQuantity: 1,
    materialRemark: '',
    
    // 协助弹窗
    helpDialogVisible: false,
    helpReason: '',
    selectedHelper: '',
    availableHelpers: [
      { id: 'manager1', name: '李经理', role: 'IT经理' },
      { id: 'engineer2', name: '王工程师', role: '高级工程师' },
      { id: 'engineer3', name: '赵工程师', role: '网络工程师' }
    ],
    
    // 显示操作按钮
    showActions: true
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        ticketId: options.id
      });
      this.loadTicketDetail(options.id);
    }
  },

  // 加载工单详情
  async loadTicketDetail(ticketId) {
    wx.showLoading({
      title: '加载中...'
    });

    try {
      // 模拟API调用
      // const data = await api.getTicketDetail(ticketId);
      
      // 这里使用模拟数据
      const mockData = this.getMockTicketData(ticketId);
      
      this.setData({
        ticketInfo: mockData.ticketInfo,
        processTimeline: mockData.timeline,
        materials: mockData.materials
      });
    } catch (error) {
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 返回
  handleGoBack() {
    wx.navigateBack();
  },

  // 开始处理
  startProcessing() {
    wx.showModal({
      title: '确认开始',
      content: '确定要开始处理这个工单吗？',
      success: (res) => {
        if (res.confirm) {
          this.updateTicketStatus('processing');
        }
      }
    });
  },

  // 暂停处理
  pauseProcessing() {
    wx.showModal({
      title: '暂停处理',
      content: '确定要暂停处理吗？',
      success: (res) => {
        if (res.confirm) {
          this.updateTicketStatus('pending');
        }
      }
    });
  },

  // 完成工单
  completeTicket() {
    if (!this.data.solutionText) {
      wx.showToast({
        title: '请填写解决方案',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认完成',
      content: '确定要完成这个工单吗？',
      success: (res) => {
        if (res.confirm) {
          this.updateTicketStatus('resolved');
        }
      }
    });
  },

  // 关闭工单
  closeTicket() {
    wx.showModal({
      title: '关闭工单',
      content: '确定要关闭这个工单吗？',
      success: (res) => {
        if (res.confirm) {
          this.updateTicketStatus('closed');
        }
      }
    });
  },

  // 退回工单
  rejectTicket() {
    const that = this;
    wx.showModal({
      title: '退回工单',
      content: '请输入退回原因',
      editable: true,
      placeholderText: '请输入退回原因...',
      success: function(res) {
        if (res.confirm) {
          if (!res.content || res.content.trim() === '') {
            wx.showToast({
              title: '请输入退回原因',
              icon: 'none'
            });
            return;
          }
          
          // 执行退回操作
          wx.showLoading({
            title: '退回中...'
          });
          
          // 模拟API调用
          setTimeout(() => {
            wx.hideLoading();
            
            // 更新工单状态为已退回
            that.setData({
              'ticketInfo.status': 'rejected',
              rejectReason: res.content
            });
            
            wx.showToast({
              title: '退回成功',
              icon: 'success'
            });
            
            // 1.5秒后返回上一页
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          }, 1000);
        }
      }
    });
  },

  // 更新工单状态
  async updateTicketStatus(newStatus) {
    wx.showLoading({
      title: '处理中...'
    });

    try {
      // 调用API更新状态
      // await api.updateTicketStatus(this.data.ticketId, newStatus);
      
      // 更新本地状态
      this.setData({
        'ticketInfo.status': newStatus
      });
      
      // 更新时间线
      this.updateTimeline(newStatus);
      
      wx.showToast({
        title: '操作成功',
        icon: 'success'
      });
    } catch (error) {
      wx.showToast({
        title: '操作失败',
        icon: 'error'
      });
    }
  },

  // 更新时间线
  updateTimeline(status) {
    const timeline = this.data.processTimeline;
    const now = new Date().toLocaleString('zh-CN');
    
    if (status === 'processing') {
      timeline[2].isActive = true;
      timeline[2].time = now;
      timeline[2].description = '工程师开始处理';
    } else if (status === 'resolved') {
      timeline[3].isActive = true;
      timeline[3].time = now;
      timeline[3].description = '工单已解决';
    }
    
    this.setData({
      processTimeline: timeline
    });
  },

  // 显示耗材弹窗
  showMaterialDialog() {
    this.setData({
      materialDialogVisible: true,
      selectedMaterial: {},
      materialQuantity: 1,
      materialRemark: ''
    });
  },

  // 关闭耗材弹窗
  closeMaterialDialog() {
    this.setData({
      materialDialogVisible: false
    });
  },

  // 选择耗材
  selectMaterial(e) {
    const item = e.currentTarget.dataset.item;
    this.setData({
      selectedMaterial: item
    });
  },

  // 确认添加耗材
  confirmAddMaterial() {
    const { selectedMaterial, materialQuantity, materialRemark } = this.data;
    
    if (!selectedMaterial.id) {
      wx.showToast({
        title: '请选择耗材',
        icon: 'none'
      });
      return;
    }

    const newMaterial = {
      id: Date.now(),
      name: selectedMaterial.name,
      quantity: materialQuantity,
      unit: selectedMaterial.unit,
      remark: materialRemark,
      time: new Date().toLocaleString('zh-CN')
    };

    this.setData({
      materials: [...this.data.materials, newMaterial],
      materialDialogVisible: false
    });

    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  // 移除耗材
  removeMaterial(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条耗材记录吗？',
      success: (res) => {
        if (res.confirm) {
          const materials = this.data.materials.filter(item => item.id !== id);
          this.setData({ materials });
        }
      }
    });
  },

  // 请求协助
  requestHelp() {
    this.setData({
      helpDialogVisible: true,
      helpReason: '',
      selectedHelper: ''
    });
  },

  // 关闭协助弹窗
  closeHelpDialog() {
    this.setData({
      helpDialogVisible: false
    });
  },

  // 选择协助人员
  onHelperChange(e) {
    this.setData({
      selectedHelper: e.detail.value
    });
  },

  // 确认请求协助
  confirmRequestHelp() {
    const { helpReason, selectedHelper } = this.data;
    
    if (!helpReason) {
      wx.showToast({
        title: '请填写协助原因',
        icon: 'none'
      });
      return;
    }
    
    if (!selectedHelper) {
      wx.showToast({
        title: '请选择协助人员',
        icon: 'none'
      });
      return;
    }

    // 发送协助请求
    wx.showLoading({
      title: '发送中...'
    });

    setTimeout(() => {
      wx.hideLoading();
      this.setData({
        helpDialogVisible: false
      });
      wx.showToast({
        title: '请求已发送',
        icon: 'success'
      });
    }, 1000);
  },

  // 预览附件
  previewAttachment(e) {
    const url = e.currentTarget.dataset.url;
    // 实现附件预览逻辑
    wx.showToast({
      title: '预览功能开发中',
      icon: 'none'
    });
  },

  // 处理弹窗变化
  handleMaterialDialogChange(e) {
    this.setData({
      materialDialogVisible: e.detail.visible
    });
  },

  handleHelpDialogChange(e) {
    this.setData({
      helpDialogVisible: e.detail.visible
    });
  },

  // 获取状态主题
  getStatusTheme(status) {
    const themes = {
      pending: 'warning',
      processing: 'primary',
      resolved: 'success',
      closed: 'default'
    };
    return themes[status] || 'default';
  },

  // 获取模拟数据
  getMockTicketData(ticketId) {
    return {
      ticketInfo: {
        ticketNo: '#' + ticketId,
        title: '电脑无法开机',
        category: '硬件故障',
        priority: 'urgent',
        status: 'pending',
        submitter: '张三',
        phone: '13812345678',
        location: '财务部3楼',
        description: '电脑按下电源键后没有任何反应，电源指示灯不亮，已尝试更换电源线但问题依旧。',
        createTime: '2024-01-15 09:30',
        attachments: []
      },
      timeline: [
        {
          id: 1,
          title: '工单创建',
          time: '2024-01-15 09:30',
          description: '用户提交工单',
          isActive: true
        },
        {
          id: 2,
          title: '工单分配',
          time: '2024-01-15 09:35',
          description: '分配给张工程师',
          isActive: true
        },
        {
          id: 3,
          title: '开始处理',
          time: '',
          description: '',
          isActive: false
        },
        {
          id: 4,
          title: '完成',
          time: '',
          description: '',
          isActive: false
        }
      ],
      materials: []
    };
  }
});