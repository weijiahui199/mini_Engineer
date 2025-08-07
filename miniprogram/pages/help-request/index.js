// 求助请求页面
Page({
  data: {
    // 用户角色
    isManager: false,
    currentUserId: 1,
    
    // 统计数据
    stats: {
      pending: 3,
      processing: 5,
      todayResolved: 12,
      avgResponseTime: 8
    },
    
    // Tab相关
    activeTab: 'my',
    
    // 列表数据
    myHelpList: [],
    pendingList: [],
    processingList: [],
    completedList: [],
    
    // 发起求助表单
    createHelpVisible: false,
    helpForm: {
      type: 'hardware',
      priority: 'normal',
      ticketNo: '',
      description: '',
      images: [],
      requiredSkills: []
    },
    
    // 可选技能
    availableSkills: [
      '网络配置', '硬件维修', '系统安装', 
      '数据恢复', '安全加固', '性能优化'
    ],
    
    // 评价弹窗
    rateDialogVisible: false,
    currentRateId: null,
    rateForm: {
      score: 5,
      comment: ''
    }
  },

  onLoad() {
    this.checkUserRole();
    this.loadHelpData();
  },

  // 检查用户角色
  checkUserRole() {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const isManager = userInfo.roleGroup === '经理';
    
    this.setData({
      isManager,
      activeTab: isManager ? 'pending' : 'my',
      currentUserId: userInfo.id || 1
    });
  },

  // 加载求助数据
  loadHelpData() {
    this.loadMyHelps();
    this.loadPendingHelps();
    this.loadProcessingHelps();
    this.loadCompletedHelps();
  },

  // 加载我的求助
  loadMyHelps() {
    const mockData = [
      {
        id: 1,
        helpNo: '#HP001234',
        status: 'pending',
        statusTheme: 'warning',
        statusText: '待响应',
        ticketNo: '#TK001234',
        description: '电脑无法开机，按电源键没有反应，需要紧急处理',
        createTime: '10分钟前',
        images: [],
        helper: null
      },
      {
        id: 2,
        helpNo: '#HP001233',
        status: 'processing',
        statusTheme: 'primary',
        statusText: '处理中',
        ticketNo: '#TK001233',
        description: '网络打印机无法连接，已尝试重启但问题依旧',
        createTime: '30分钟前',
        images: ['/assets/sample1.jpg'],
        helper: {
          id: 2,
          name: '李工程师',
          avatar: '',
          phone: '13800138001'
        },
        responseTime: '5分钟'
      }
    ];
    
    this.setData({
      myHelpList: mockData
    });
  },

  // 加载待响应求助
  loadPendingHelps() {
    const mockData = [
      {
        id: 3,
        helpNo: '#HP001235',
        priority: 'urgent',
        requester: {
          id: 3,
          name: '张三',
          department: '财务部',
          avatar: ''
        },
        problemType: '硬件故障',
        description: '服务器异常关机，无法重启，影响整个部门工作',
        location: 'A栋3楼机房',
        distance: 1.2,
        waitTime: '5分钟',
        requiredSkills: ['硬件维修', '系统安装']
      },
      {
        id: 4,
        helpNo: '#HP001236',
        priority: 'normal',
        requester: {
          id: 4,
          name: '李四',
          department: '人事部',
          avatar: ''
        },
        problemType: '软件问题',
        description: 'Office软件授权过期，无法正常使用',
        location: 'B栋2楼205',
        distance: 2.5,
        waitTime: '15分钟',
        requiredSkills: ['系统安装']
      }
    ];
    
    this.setData({
      pendingList: mockData
    });
  },

  // 加载处理中求助
  loadProcessingHelps() {
    const mockData = [
      {
        id: 5,
        helpNo: '#HP001232',
        requester: {
          id: 5,
          name: '王五',
          avatar: ''
        },
        helper: {
          id: 6,
          name: '赵工程师',
          avatar: ''
        },
        processTime: '20分钟',
        progress: 60,
        progressDesc: '正在重装系统驱动',
        lastMessage: {
          sender: '赵工程师',
          text: '驱动安装中，预计10分钟完成'
        },
        isHelper: false
      }
    ];
    
    this.setData({
      processingList: mockData
    });
  },

  // 加载已完成求助
  loadCompletedHelps() {
    const mockData = [
      {
        id: 6,
        helpNo: '#HP001231',
        requester: {
          id: 7,
          name: '孙六',
          avatar: ''
        },
        helper: {
          id: 8,
          name: '钱工程师',
          avatar: ''
        },
        resolveTime: '2024-01-15 14:30',
        duration: '45分钟',
        solution: '更换了故障的内存条，系统恢复正常',
        rating: 5,
        comment: '响应迅速，技术专业，问题解决得很好',
        canSaveToKnowledge: true
      }
    ];
    
    this.setData({
      completedList: mockData
    });
  },

  // Tab切换
  onTabChange(e) {
    this.setData({
      activeTab: e.detail.value
    });
  },

  // 创建紧急求助
  createEmergencyHelp() {
    this.setData({
      'helpForm.priority': 'urgent',
      createHelpVisible: true
    });
  },

  // 创建求助
  createHelp() {
    this.setData({
      createHelpVisible: true,
      helpForm: {
        type: 'hardware',
        priority: 'normal',
        ticketNo: '',
        description: '',
        images: [],
        requiredSkills: []
      }
    });
  },

  // 关闭创建求助弹窗
  closeCreateHelp() {
    this.setData({
      createHelpVisible: false
    });
  },

  handleCreateHelpChange(e) {
    this.setData({
      createHelpVisible: e.detail.visible
    });
  },

  // 表单变化处理
  onHelpTypeChange(e) {
    this.setData({
      'helpForm.type': e.detail.value
    });
  },

  onPriorityChange(e) {
    this.setData({
      'helpForm.priority': e.detail.value
    });
  },

  onTicketNoChange(e) {
    this.setData({
      'helpForm.ticketNo': e.detail.value
    });
  },

  onDescriptionChange(e) {
    this.setData({
      'helpForm.description': e.detail.value
    });
  },

  // 选择图片
  chooseImage() {
    wx.chooseImage({
      count: 4 - this.data.helpForm.images.length,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const images = [...this.data.helpForm.images, ...res.tempFilePaths];
        this.setData({
          'helpForm.images': images
        });
      }
    });
  },

  // 移除图片
  removeImage(e) {
    const index = e.currentTarget.dataset.index;
    const images = this.data.helpForm.images.filter((_, i) => i !== index);
    this.setData({
      'helpForm.images': images
    });
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url;
    wx.previewImage({
      current: url,
      urls: this.data.helpForm.images
    });
  },

  // 切换技能选择
  toggleSkill(e) {
    const skill = e.currentTarget.dataset.skill;
    const skills = [...this.data.helpForm.requiredSkills];
    const index = skills.indexOf(skill);
    
    if (index > -1) {
      skills.splice(index, 1);
    } else {
      skills.push(skill);
    }
    
    this.setData({
      'helpForm.requiredSkills': skills
    });
  },

  // 提交求助
  submitHelp() {
    const { type, description } = this.data.helpForm;
    
    if (!type || !description) {
      wx.showToast({
        title: '请填写必填项',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '提交中...'
    });
    
    // 模拟提交
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '提交成功',
        icon: 'success'
      });
      
      this.closeCreateHelp();
      this.loadMyHelps();
    }, 1500);
  },

  // 接受协助
  acceptHelp(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认接受',
      content: '确定要接受这个求助请求吗？',
      success: (res) => {
        if (res.confirm) {
          this.doAcceptHelp(id);
        }
      }
    });
  },

  // 执行接受协助
  doAcceptHelp(id) {
    wx.showLoading({
      title: '处理中...'
    });
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '已接受',
        icon: 'success'
      });
      
      // 刷新列表
      this.loadPendingHelps();
      this.loadProcessingHelps();
    }, 1000);
  },

  // 转发求助
  transferHelp(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showActionSheet({
      itemList: ['转发给其他工程师', '转发到群组', '生成求助链接'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.selectEngineerToTransfer(id);
        } else if (res.tapIndex === 1) {
          this.selectGroupToTransfer(id);
        } else {
          this.generateHelpLink(id);
        }
      }
    });
  },

  // 选择工程师转发
  selectEngineerToTransfer(id) {
    wx.navigateTo({
      url: `/pages/select-engineer/index?helpId=${id}`
    });
  },

  // 选择群组转发
  selectGroupToTransfer(id) {
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    });
  },

  // 生成求助链接
  generateHelpLink(id) {
    wx.showToast({
      title: '链接已复制',
      icon: 'success'
    });
  },

  // 打开聊天
  openChat(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/chat/index?helpId=${id}`
    });
  },

  // 拨打电话
  callHelper(e) {
    const helper = e.currentTarget.dataset.helper;
    if (helper && helper.phone) {
      wx.makePhoneCall({
        phoneNumber: helper.phone
      });
    }
  },

  // 取消求助
  cancelHelp(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '取消求助',
      content: '确定要取消这个求助请求吗？',
      success: (res) => {
        if (res.confirm) {
          this.doCancelHelp(id);
        }
      }
    });
  },

  // 执行取消求助
  doCancelHelp(id) {
    wx.showToast({
      title: '已取消',
      icon: 'success'
    });
    
    this.loadMyHelps();
  },

  // 确认已解决
  confirmResolved(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认解决',
      content: '问题已经解决了吗？',
      success: (res) => {
        if (res.confirm) {
          this.doConfirmResolved(id);
        }
      }
    });
  },

  // 执行确认解决
  doConfirmResolved(id) {
    wx.showToast({
      title: '已标记解决',
      icon: 'success'
    });
    
    // 显示评价弹窗
    this.setData({
      currentRateId: id,
      rateDialogVisible: true
    });
  },

  // 标记已解决（协助方）
  markResolved(e) {
    const id = e.currentTarget.dataset.id;
    this.doConfirmResolved(id);
  },

  // 查看详情
  viewDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/help-detail/index?id=${id}`
    });
  },

  // 查看进度
  viewProgress(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/help-progress/index?id=${id}`
    });
  },

  // 评价求助
  rateHelp(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({
      currentRateId: id,
      rateDialogVisible: true,
      rateForm: {
        score: 5,
        comment: ''
      }
    });
  },

  // 关闭评价弹窗
  closeRateDialog() {
    this.setData({
      rateDialogVisible: false
    });
  },

  handleRateDialogChange(e) {
    this.setData({
      rateDialogVisible: e.detail.visible
    });
  },

  // 评分变化
  onRateChange(e) {
    this.setData({
      'rateForm.score': e.detail.value
    });
  },

  // 评价内容变化
  onCommentChange(e) {
    this.setData({
      'rateForm.comment': e.detail.value
    });
  },

  // 提交评价
  submitRate() {
    wx.showLoading({
      title: '提交中...'
    });
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '评价成功',
        icon: 'success'
      });
      
      this.closeRateDialog();
      this.loadCompletedHelps();
    }, 1000);
  },

  // 保存为知识库
  saveToKnowledge(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '保存到知识库',
      content: '将此案例保存到知识库供其他人参考？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
        }
      }
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});