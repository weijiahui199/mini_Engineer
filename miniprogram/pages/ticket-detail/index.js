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
      time: createTimeFormatted,
      description: `${ticket.submitterName || '用户'}创建工单`,
      isActive: true
    });
    
    // 接单节点
    if (ticket.acceptTime) {
      const acceptTimeFormatted = this.formatDateTime(ticket.acceptTime);
      console.log('[buildTimeline] 接单时间格式化结果:', acceptTimeFormatted);
      timeline.push({
        id: 'accept',
        title: '工程师接单',
        time: acceptTimeFormatted,
        description: `${ticket.assigneeName || '工程师'}接单处理`,
        isActive: true
      });
    }
    
    // 处理中节点 - 只要有负责人就显示这个节点
    if (ticket.assigneeOpenid || ticket.status === 'processing' || ticket.status === 'resolved' || ticket.status === 'closed') {
      let processDescription = '工程师正在处理';
      let processTime = ticket.processTime ? this.formatDateTime(ticket.processTime) : '进行中';
      let isProcessingActive = ticket.status === 'processing';
      
      console.log('[buildTimeline] 处理节点 - processTime原始值:', ticket.processTime);
      console.log('[buildTimeline] 处理节点 - processTime格式化:', processTime);
      
      // 如果是暂停状态（pending但有负责人）
      if (ticket.status === 'pending' && ticket.assigneeOpenid) {
        processDescription = '已暂停';
        processTime = ticket.rejectTime ? this.formatDateTime(ticket.rejectTime) : '暂停中';
        isProcessingActive = false;
        console.log('[buildTimeline] 暂停状态 - rejectTime:', ticket.rejectTime);
        console.log('[buildTimeline] 暂停状态 - 格式化时间:', processTime);
      }
      
      timeline.push({
        id: 'processing',
        title: '处理中',
        time: processTime,
        description: processDescription,
        isActive: isProcessingActive
      });
    }
    
    // 已解决节点
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      const resolveTimeFormatted = ticket.resolveTime ? this.formatDateTime(ticket.resolveTime) : '';
      console.log('[buildTimeline] 解决时间格式化结果:', resolveTimeFormatted);
      timeline.push({
        id: 'resolved',
        title: '已解决',
        time: resolveTimeFormatted,
        description: ticket.solution || '问题已解决',
        isActive: ticket.status === 'resolved'
      });
    }
    
    // 已关闭节点
    if (ticket.status === 'closed') {
      const closeTimeFormatted = ticket.closeTime ? this.formatDateTime(ticket.closeTime) : '';
      console.log('[buildTimeline] 关闭时间格式化结果:', closeTimeFormatted);
      timeline.push({
        id: 'closed',
        title: '已关闭',
        time: closeTimeFormatted,
        description: '工单已关闭',
        isActive: true
      });
    }
    
    console.log('[buildTimeline] 最终时间线:', timeline);
    console.log('==================================');
    
    return timeline;
  },
  
  // 格式化日期时间
  formatDateTime(date) {
    console.log('[formatDateTime] 输入参数:', date, '类型:', typeof date);
    
    if (!date) {
      console.log('[formatDateTime] 日期为空，返回空字符串');
      return '';
    }
    
    // 处理不同的日期格式
    let d;
    if (date.$date) {
      // MongoDB日期格式 { $date: "2025-08-16T03:20:40.122Z" }
      console.log('[formatDateTime] 检测到MongoDB日期格式:', date.$date);
      d = new Date(date.$date);
    } else if (typeof date === 'string') {
      // 字符串日期
      console.log('[formatDateTime] 字符串日期:', date);
      d = new Date(date);
    } else if (date instanceof Date) {
      // Date对象
      console.log('[formatDateTime] Date对象:', date);
      d = date;
    } else {
      // 尝试直接转换
      console.log('[formatDateTime] 未知格式，尝试直接转换:', date);
      d = new Date(date);
    }
    
    // 检查日期是否有效
    if (isNaN(d.getTime())) {
      console.error('[formatDateTime] 无效日期:', date);
      return '时间格式错误';
    }
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    
    const result = `${year}-${month}-${day} ${hour}:${minute}`;
    console.log('[formatDateTime] 格式化结果:', result);
    
    return result;
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

  // 重新处理工单
  reopenTicket() {
    wx.showModal({
      title: '重新处理',
      content: '确定要重新处理这个工单吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          console.log('[reopenTicket] 重新处理工单');
          this.updateTicketStatus('processing');
        }
      }
    });
  },

  // 关闭工单
  closeTicket() {
    wx.showModal({
      title: '关闭工单',
      content: '工单关闭后将无法再进行任何操作，确定要关闭吗？',
      confirmText: '确定关闭',
      cancelText: '取消',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          console.log('[closeTicket] 关闭工单');
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
  
  // 退回工单 - 使用云函数清空负责人信息
  rejectTicket() {
    const that = this;
    wx.showModal({
      title: '退回工单',
      content: '退回后工单将重新进入待接单状态',
      editable: true,
      placeholderText: '请输入退回原因（选填）',
      success: async function(res) {
        if (res.confirm) {
          wx.showLoading({
            title: '退回中...'
          });
          
          try {
            const ticketId = that.data.ticketId;
            const rejectReason = res.content || '';  // 如果没有输入原因，保持为空
            
            console.log('[rejectTicket] 退回工单:', ticketId);
            console.log('[rejectTicket] 退回原因:', rejectReason || '(未填写)');
            
            // 调用云函数退回工单
            const result = await wx.cloud.callFunction({
              name: 'submitTicket',
              data: {
                action: 'rejectTicket',
                ticketId: ticketId,
                reason: rejectReason
              }
            });
            
            console.log('[rejectTicket] 云函数返回:', result);
            
            if (result.result && result.result.code === 200) {
              wx.hideLoading();
              wx.showToast({
                title: '退回成功',
                icon: 'success'
              });
              
              // 1.5秒后返回上一页
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            } else {
              throw new Error(result.result?.message || '退回失败');
            }
          } catch (error) {
            console.error('[rejectTicket] 错误:', error);
            wx.hideLoading();
            
            // 如果云函数没有rejectTicket方法，使用updateStatus方法
            try {
              console.log('[rejectTicket] 尝试使用updateStatus方法...');
              
              // 直接更新数据库，清空负责人信息
              const updateData = {
                status: 'pending',
                assigneeOpenid: that.db.command.remove(),
                assigneeName: that.db.command.remove(),
                acceptTime: that.db.command.remove(),
                rejectTime: that.db.serverDate(),
                updateTime: that.db.serverDate()
              };
              
              // 只有提供了退回原因才添加这个字段
              if (res.content && res.content.trim()) {
                updateData.rejectReason = res.content.trim();
              }
              
              const updateResult = await that.db.collection('tickets').doc(that.data.ticketId).update({
                data: updateData
              });
              
              console.log('[rejectTicket] 数据库更新结果:', updateResult);
              
              if (updateResult.stats.updated > 0) {
                wx.showToast({
                  title: '退回成功',
                  icon: 'success'
                });
                
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
              } else {
                wx.showToast({
                  title: '退回失败',
                  icon: 'error'
                });
              }
            } catch (dbError) {
              console.error('[rejectTicket] 数据库更新失败:', dbError);
              wx.showToast({
                title: '操作失败',
                icon: 'error'
              });
            }
          }
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
      console.log('[updateTicketStatus] result.result:', result.result);
      
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
        
        // 尝试更新时间线，如果失败不影响主流程
        try {
          this.updateTimeline(newStatus);
        } catch (timelineError) {
          console.error('[updateTicketStatus] 更新时间线失败:', timelineError);
          // 时间线更新失败不影响状态更新
        }
        
        // 1.5秒后重新加载
        setTimeout(() => {
          this.loadTicketDetail(ticketId);
        }, 1500);
      } else {
        const errorMsg = result.result?.message || '更新失败';
        console.error('[updateTicketStatus] 云函数错误:', errorMsg);
        console.error('[updateTicketStatus] 错误代码:', result.result?.code);
        throw new Error(errorMsg);
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
    const timeline = this.data.processTimeline || [];
    const now = this.formatDateTime(new Date());
    
    // 查找对应状态的时间线节点
    let updated = false;
    
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      
      if (status === 'processing') {
        // 更新处理中节点
        if (item.id === 'processing' || item.title === '处理中') {
          item.isActive = true;
          item.time = now;
          item.description = '工程师正在处理';
          updated = true;
          break;
        }
      } else if (status === 'resolved') {
        // 先确保处理中节点是激活的
        if (item.id === 'processing' || item.title === '处理中') {
          item.isActive = true;
          if (!item.time || item.time === '进行中') {
            item.time = now;
          }
        }
        // 更新已解决节点
        if (item.id === 'resolved' || item.title === '已解决') {
          item.isActive = true;
          item.time = now;
          item.description = '工单已解决';
          updated = true;
        }
      } else if (status === 'pending') {
        // 暂停时，取消处理中状态
        if (item.id === 'processing' || item.title === '处理中') {
          item.isActive = false;
          item.time = '暂停';
          item.description = '工程师暂停处理';
          updated = true;
          break;
        }
      }
    }
    
    // 如果没有找到对应节点，可能需要重新构建时间线
    if (!updated && status === 'processing') {
      // 添加处理中节点（如果不存在）
      const hasProcessing = timeline.some(item => item.id === 'processing' || item.title === '处理中');
      if (!hasProcessing) {
        // 在接单节点后插入处理中节点
        const acceptIndex = timeline.findIndex(item => item.id === 'accept' || item.title === '工程师接单');
        const insertIndex = acceptIndex >= 0 ? acceptIndex + 1 : timeline.length;
        
        timeline.splice(insertIndex, 0, {
          id: 'processing',
          title: '处理中',
          time: now,
          description: '工程师正在处理',
          isActive: true
        });
      }
    }
    
    this.setData({
      processTimeline: timeline
    });
  },



  // 预览附件
  async previewAttachment(e) {
    const index = e.currentTarget.dataset.index;
    const attachment = e.currentTarget.dataset.attachment;
    
    if (!attachment || !attachment.cloudPath) {
      wx.showToast({
        title: '附件信息错误',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '正在加载...'
    });
    
    try {
      // 获取云存储文件的临时链接
      const tempFileRes = await wx.cloud.getTempFileURL({
        fileList: [attachment.cloudPath]
      });
      
      if (!tempFileRes.fileList || tempFileRes.fileList.length === 0) {
        throw new Error('获取文件链接失败');
      }
      
      const tempFileURL = tempFileRes.fileList[0].tempFileURL;
      
      // 根据文件类型处理
      if (attachment.type === 'image' || attachment.mimeType?.startsWith('image/')) {
        // 图片类型 - 使用图片预览
        wx.hideLoading();
        
        // 获取所有图片附件的临时链接
        const imageAttachments = this.data.ticketInfo.attachments.filter(
          att => att.type === 'image' || att.mimeType?.startsWith('image/')
        );
        
        if (imageAttachments.length > 1) {
          // 多张图片，获取所有图片链接
          const imageCloudPaths = imageAttachments.map(img => img.cloudPath);
          const allTempRes = await wx.cloud.getTempFileURL({
            fileList: imageCloudPaths
          });
          
          const imageUrls = allTempRes.fileList.map(file => file.tempFileURL);
          const currentIndex = imageAttachments.findIndex(img => img.id === attachment.id);
          
          wx.previewImage({
            current: imageUrls[currentIndex >= 0 ? currentIndex : 0],
            urls: imageUrls,
            fail: (err) => {
              console.error('预览图片失败:', err);
              wx.showToast({
                title: '预览失败',
                icon: 'none'
              });
            }
          });
        } else {
          // 单张图片
          wx.previewImage({
            current: tempFileURL,
            urls: [tempFileURL],
            fail: (err) => {
              console.error('预览图片失败:', err);
              wx.showToast({
                title: '预览失败',
                icon: 'none'
              });
            }
          });
        }
        
      } else if (
        attachment.mimeType?.includes('pdf') ||
        attachment.mimeType?.includes('word') ||
        attachment.mimeType?.includes('document') ||
        attachment.mimeType?.includes('excel') ||
        attachment.mimeType?.includes('spreadsheet') ||
        attachment.mimeType?.includes('powerpoint') ||
        attachment.mimeType?.includes('presentation')
      ) {
        // 文档类型 - 下载后打开
        wx.downloadFile({
          url: tempFileURL,
          success: (res) => {
            wx.hideLoading();
            if (res.statusCode === 200) {
              const filePath = res.tempFilePath;
              
              // 根据文件类型设置正确的文件扩展名
              let fileType = 'pdf';
              if (attachment.mimeType?.includes('word') || attachment.mimeType?.includes('document')) {
                fileType = 'docx';
              } else if (attachment.mimeType?.includes('excel') || attachment.mimeType?.includes('spreadsheet')) {
                fileType = 'xlsx';
              } else if (attachment.mimeType?.includes('powerpoint') || attachment.mimeType?.includes('presentation')) {
                fileType = 'pptx';
              }
              
              wx.openDocument({
                filePath: filePath,
                fileType: fileType,
                showMenu: true,
                success: () => {
                  console.log('文档打开成功');
                },
                fail: (err) => {
                  console.error('打开文档失败:', err);
                  wx.showToast({
                    title: '打开文档失败',
                    icon: 'none'
                  });
                }
              });
            } else {
              wx.hideLoading();
              wx.showToast({
                title: '下载失败',
                icon: 'none'
              });
            }
          },
          fail: (err) => {
            wx.hideLoading();
            console.error('下载文件失败:', err);
            wx.showToast({
              title: '下载失败',
              icon: 'none'
            });
          }
        });
        
      } else {
        // 其他类型文件 - 提供下载选项
        wx.hideLoading();
        wx.showModal({
          title: '不支持预览',
          content: `文件类型: ${attachment.mimeType || '未知'}\n是否下载到本地？`,
          confirmText: '下载',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.showLoading({
                title: '下载中...'
              });
              
              wx.downloadFile({
                url: tempFileURL,
                success: (downloadRes) => {
                  if (downloadRes.statusCode === 200) {
                    // 保存到本地
                    wx.saveFile({
                      tempFilePath: downloadRes.tempFilePath,
                      success: (saveRes) => {
                        wx.hideLoading();
                        wx.showModal({
                          title: '下载成功',
                          content: `文件已保存到: ${saveRes.savedFilePath}`,
                          showCancel: false,
                          confirmText: '确定'
                        });
                      },
                      fail: () => {
                        wx.hideLoading();
                        wx.showToast({
                          title: '保存失败',
                          icon: 'none'
                        });
                      }
                    });
                  } else {
                    wx.hideLoading();
                    wx.showToast({
                      title: '下载失败',
                      icon: 'none'
                    });
                  }
                },
                fail: () => {
                  wx.hideLoading();
                  wx.showToast({
                    title: '下载失败',
                    icon: 'none'
                  });
                }
              });
            }
          }
        });
      }
      
    } catch (error) {
      wx.hideLoading();
      console.error('预览附件失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },
  
  // 格式化文件大小
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
  },
  
  // 格式化上传时间
  formatUploadTime(time) {
    if (!time) return '';
    
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;
    
    // 小于1小时
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return minutes <= 1 ? '刚刚' : `${minutes}分钟前`;
    }
    
    // 小于24小时
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}小时前`;
    }
    
    // 小于7天
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}天前`;
    }
    
    // 超过7天显示日期
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${month}-${day}`;
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