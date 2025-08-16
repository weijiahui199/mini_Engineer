// 工单详情页面
Page({
  data: {
    ticketId: '',
    
    // 工单信息 - 初始为空，等待加载真实数据
    ticketInfo: {
      ticketNo: '',
      title: '加载中...',
      category: '',
      priority: 'normal',
      status: 'pending',
      submitter: '',
      phone: '',
      location: '',
      description: '',
      createTime: '',
      attachments: []
    },
    
    // 状态文本映射
    statusText: {
      pending: '待处理',
      processing: '处理中',
      resolved: '已解决',
      closed: '已关闭'
    },
    
    // 处理时间线 - 初始为空，等待加载真实数据
    processTimeline: [],
    
    // 解决方案
    solutionText: '',
    
    
    // 显示操作按钮
    showActions: true
  },

  onLoad(options) {
    console.log('[TicketDetail] onLoad 开始执行');
    console.log('[TicketDetail] 接收到的参数:', options);
    
    // 获取app实例和数据库
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    
    console.log('[TicketDetail] app实例:', this.app);
    console.log('[TicketDetail] 数据库实例:', this.db);
    console.log('[TicketDetail] globalData:', this.app.globalData);
    
    if (options.id) {
      console.log('[TicketDetail] 工单ID:', options.id);
      this.setData({
        ticketId: options.id
      });
      this.loadTicketDetail(options.id);
    } else {
      console.error('[TicketDetail] 错误：缺少工单ID');
      // 没有工单ID，显示错误
      wx.showModal({
        title: '参数错误',
        content: '缺少工单ID参数',
        showCancel: false,
        confirmText: '返回',
        success: () => {
          wx.navigateBack();
        }
      });
    }
  },

  // 加载工单详情 - 添加权限控制
  async loadTicketDetail(ticketId) {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 获取工单详情
      const res = await this.db.collection('tickets').doc(ticketId).get();
      const ticket = res.data;
      
      // 权限检查
      const hasPermission = this.checkViewPermission(ticket);
      if (!hasPermission) {
        wx.hideLoading();
        wx.showModal({
          title: '无权查看',
          content: '您没有查看此工单的权限',
          showCancel: false,
          confirmText: '返回',
          success: () => wx.navigateBack()
        });
        return null;
      }
      
      // 操作权限判断
      const canOperate = this.checkOperatePermission(ticket);
      const isAssignee = ticket.assigneeOpenid === this.app.globalData.openid;
      
      // 构建时间线
      const timeline = this.buildTimeline(ticket);
      
      // 格式化工单信息
      const ticketInfo = {
        ticketNo: ticket.ticketNo ? '#' + ticket.ticketNo : '#' + ticket._id.slice(-6).toUpperCase(),
        title: ticket.title || ticket.description || '工单',
        category: ticket.category || '其他',
        priority: ticket.priority || 'normal',
        status: ticket.status || 'pending',
        submitter: ticket.submitterName || ticket.userName || '用户',
        phone: ticket.phone || ticket.submitterPhone || '',
        location: ticket.location || ticket.department || '未知位置',
        description: ticket.description || '暂无描述',
        createTime: this.formatDateTime(ticket.createTime || ticket.createdAt),
        attachments: ticket.attachments || [],
        assigneeName: ticket.assigneeName || '',
        assigneeOpenid: ticket.assigneeOpenid || '',
        solution: ticket.solution || ''
      };
      
      this.setData({
        ticketInfo: ticketInfo,
        processTimeline: timeline,
        showActions: canOperate,
        isAssignee: isAssignee,
        canAccept: !ticket.assigneeOpenid && canOperate && ticket.status === 'pending'
      });
      
      wx.hideLoading();
      return ticket;
      
    } catch (error) {
      console.error('[TicketDetail] 加载工单详情失败:', error);
      wx.hideLoading();
      
      // 显示错误提示
      wx.showModal({
        title: '加载失败',
        content: '工单详情加载出现问题，请稍后重试',
        showCancel: true,
        confirmText: '重试',
        cancelText: '返回',
        success: (res) => {
          if (res.confirm) {
            // 重试加载
            this.loadTicketDetail(ticketId);
          } else {
            // 返回上一页
            wx.navigateBack();
          }
        }
      });
      
      return null;
    }
  },
  
  // 查看权限检查
  checkViewPermission(ticket) {
    const openid = this.app.globalData.openid;
    const roleGroup = this.app.globalData.userInfo?.roleGroup || '用户';
    
    if (roleGroup === '经理') {
      return true;  // 经理可以查看所有
    } else if (roleGroup === '工程师') {
      // 工程师可以查看：工单池 或 自己负责的
      return !ticket.assigneeOpenid || ticket.assigneeOpenid === openid;
    } else {
      // 用户只能查看自己创建的
      return ticket.openid === openid || ticket.submitterOpenid === openid;
    }
  },
  
  // 操作权限检查
  checkOperatePermission(ticket) {
    const openid = this.app.globalData.openid;
    const roleGroup = this.app.globalData.userInfo?.roleGroup || '用户';
    
    if (roleGroup === '经理') {
      return true;  // 经理可以操作所有
    } else if (roleGroup === '工程师') {
      // 工程师可以操作：未分配的（可接单） 或 自己负责的
      if (!ticket.assigneeOpenid && ticket.status === 'pending') {
        return true;  // 可以接单
      }
      return ticket.assigneeOpenid === openid;  // 自己负责的
    } else {
      return false;  // 普通用户不能操作
    }
  },
  
  // 构建处理时间线
  buildTimeline(ticket) {
    const timeline = [];
    
    // 创建节点
    timeline.push({
      id: 'create',
      title: '工单创建',
      time: this.formatDateTime(ticket.createTime || ticket.createdAt),
      description: `${ticket.submitterName || '用户'}创建工单`,
      isActive: true
    });
    
    // 接单节点
    if (ticket.acceptTime) {
      timeline.push({
        id: 'accept',
        title: '工程师接单',
        time: this.formatDateTime(ticket.acceptTime),
        description: `${ticket.assigneeName || '工程师'}接单处理`,
        isActive: true
      });
    }
    
    // 处理中节点
    if (ticket.status === 'processing' || ticket.status === 'resolved' || ticket.status === 'closed') {
      timeline.push({
        id: 'processing',
        title: '处理中',
        time: ticket.processTime ? this.formatDateTime(ticket.processTime) : '进行中',
        description: '工程师正在处理',
        isActive: ticket.status === 'processing'
      });
    }
    
    // 已解决节点
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      timeline.push({
        id: 'resolved',
        title: '已解决',
        time: ticket.resolveTime ? this.formatDateTime(ticket.resolveTime) : '',
        description: ticket.solution || '问题已解决',
        isActive: ticket.status === 'resolved'
      });
    }
    
    // 已关闭节点
    if (ticket.status === 'closed') {
      timeline.push({
        id: 'closed',
        title: '已关闭',
        time: ticket.closeTime ? this.formatDateTime(ticket.closeTime) : '',
        description: '工单已关闭',
        isActive: true
      });
    }
    
    return timeline;
  },
  
  // 格式化日期时间
  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}`;
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
    console.log('==================================');
    console.log('[pauseProcessing] 暂停按钮被点击');
    console.log('[pauseProcessing] 当前工单状态:', this.data.ticketInfo.status);
    console.log('[pauseProcessing] isAssignee:', this.data.isAssignee);
    console.log('==================================');
    
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

  // 完成工单 - 统一使用云函数版本
  completeTicket() {
    console.log('[completeTicket] 开始执行完成工单');
    console.log('[completeTicket] 当前工单ID:', this.data.ticketId);
    console.log('[completeTicket] 当前工单状态:', this.data.ticketInfo.status);
    
    const that = this;
    
    // 使用输入框让用户填写解决方案（选填）
    wx.showModal({
      title: '完成工单',
      editable: true,
      placeholderText: '请简述解决方案（选填）',
      confirmText: '确认完成',
      cancelText: '取消',
      success: async function(res) {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          try {
            // 准备解决方案内容
            const solution = res.content || that.data.solutionText || '工单已处理完成';
            console.log('[completeTicket] 解决方案内容:', solution);
            
            // 直接使用云函数更新（避免权限问题）
            const cloudResult = await wx.cloud.callFunction({
              name: 'submitTicket',
              data: {
                action: 'updateStatus',
                ticketId: that.data.ticketId,
                status: 'resolved',
                solution: solution
              }
            });
            
            console.log('[completeTicket] 云函数返回结果:', cloudResult);
            
            if (cloudResult.result && cloudResult.result.code === 200) {
              wx.hideLoading();
              wx.showToast({
                title: '工单已完成',
                icon: 'success',
                duration: 2000
              });
              
              // 更新页面状态
              that.setData({
                'ticketInfo.status': 'resolved',
                'ticketInfo.solution': solution
              });
              
              // 延迟返回上一页
              setTimeout(() => {
                wx.navigateBack();
              }, 2000);
            } else {
              throw new Error(cloudResult.result?.message || '云函数更新失败');
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

  // 接受工单（工程师接单） - 使用云函数版本
  async acceptTicket() {
    const ticketId = this.data.ticketId;
    
    wx.showModal({
      title: '确认处理',
      content: '确定要开始处理这个工单吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          try {
            const userInfo = this.app.globalData.userInfo;
            
            // 使用云函数接单
            const result = await wx.cloud.callFunction({
              name: 'submitTicket',
              data: {
                action: 'acceptTicket',
                ticketId: ticketId
              }
            });
            
            console.log('[acceptTicket] 云函数返回:', result);
            
            if (result.result && result.result.code === 200) {
              wx.hideLoading();
              wx.showToast({ title: '开始处理', icon: 'success' });
              
              // 重新加载工单详情
              setTimeout(() => {
                this.loadTicketDetail(ticketId);
              }, 1500);
            } else {
              // 处理特定错误
              const message = result.result?.message || '处理失败';
              if (message.includes('已被接单')) {
                wx.showModal({
                  title: '无法处理',
                  content: '该工单已被其他工程师处理',
                  showCancel: false,
                  confirmText: '知道了',
                  success: () => {
                    this.loadTicketDetail(ticketId);
                  }
                });
              } else if (message === '您已接单') {
                wx.showToast({ title: '您已开始处理', icon: 'success' });
              } else {
                wx.showToast({ title: message, icon: 'none' });
              }
              wx.hideLoading();
            }
          } catch (error) {
            console.error('[acceptTicket] 错误:', error);
            wx.hideLoading();
            wx.showToast({ title: '处理失败', icon: 'error' });
          }
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

  // 更新工单状态 - 使用云函数版本
  async updateTicketStatus(newStatus, additionalData = {}) {
    wx.showLoading({
      title: '处理中...'
    });

    try {
      const ticketId = this.data.ticketId;
      const userInfo = this.app.globalData.userInfo;
      
      // 准备云函数参数
      const cloudData = {
        action: 'updateStatus',
        ticketId: ticketId,
        status: newStatus,
        assigneeName: userInfo?.nickName || '工程师',
        ...additionalData
      };
      
      console.log('[updateTicketStatus] 调用云函数:', cloudData);
      
      // 调用云函数
      const result = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: cloudData
      });
      
      console.log('[updateTicketStatus] 云函数返回:', result);
      
      if (result.result && result.result.code === 200) {
        wx.hideLoading();
        wx.showToast({
          title: '操作成功',
          icon: 'success'
        });
        
        // 更新本地状态
        this.setData({
          'ticketInfo.status': newStatus
        });
        
        // 更新时间线
        this.updateTimeline(newStatus);
        
        // 1.5秒后重新加载
        setTimeout(() => {
          this.loadTicketDetail(ticketId);
        }, 1500);
      } else {
        throw new Error(result.result?.message || '更新失败');
      }
    } catch (error) {
      console.error('[updateTicketStatus] 错误:', error);
      wx.hideLoading();
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



  // 预览附件
  previewAttachment(e) {
    const url = e.currentTarget.dataset.url;
    // 实现附件预览逻辑
    wx.showToast({
      title: '预览功能开发中',
      icon: 'none'
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

  // 模拟数据方法已移除，改为显示错误提示
  // 如果加载失败，会弹窗提示用户重试或返回
});