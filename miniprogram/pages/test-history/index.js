// 测试处理历史功能页面
Page({
  data: {
    testTicketId: '',
    testResults: [],
    currentTest: '',
    processHistory: [],
    isRunning: false
  },

  onLoad() {
    this.app = getApp();
    this.db = wx.cloud.database();
  },

  // 运行完整测试流程
  async runFullTest() {
    if (this.data.isRunning) return;
    
    this.setData({
      isRunning: true,
      testResults: [],
      processHistory: []
    });

    try {
      // 1. 创建测试工单
      await this.testCreateTicket();
      
      // 2. 接单测试
      await this.testAcceptTicket();
      
      // 3. 暂停测试
      await this.testPauseTicket();
      
      // 4. 继续测试
      await this.testContinueTicket();
      
      // 5. 退回测试（带原因）
      await this.testRejectTicket();
      
      // 6. 重新接单
      await this.testAcceptAgain();
      
      // 7. 解决测试
      await this.testResolveTicket();
      
      // 显示最终历史记录
      await this.loadProcessHistory();
      
      this.addTestResult('success', '✅ 所有测试完成！');
      
    } catch (error) {
      this.addTestResult('error', `❌ 测试失败: ${error.message}`);
    } finally {
      this.setData({ isRunning: false });
    }
  },

  // 1. 测试创建工单
  async testCreateTicket() {
    this.setData({ currentTest: '创建工单' });
    
    const result = await wx.cloud.callFunction({
      name: 'submitTicket',
      data: {
        action: 'submit',
        title: `测试工单 - ${new Date().toLocaleTimeString()}`,
        company: '测试公司',
        department: 'IT部',
        location: '办公室',
        category: 'network',
        description: '这是一个测试工单，用于验证处理历史功能',
        phone: '13800138000'
      }
    });

    if (result.result.code === 200) {
      const ticketId = result.result.data.ticketId;
      this.setData({ testTicketId: ticketId });
      
      // 检查是否有初始历史记录
      const ticket = await this.db.collection('tickets').doc(ticketId).get();
      const history = ticket.data.processHistory || [];
      
      if (history.length > 0 && history[0].action === 'created') {
        this.addTestResult('success', 
          `✅ 创建工单成功，初始历史记录已添加
          - ID: ${history[0].id}
          - 操作人: ${history[0].operator}
          - 描述: ${history[0].description}`
        );
      } else {
        this.addTestResult('warning', '⚠️ 创建工单成功，但未找到初始历史记录');
      }
    } else {
      throw new Error(result.result.message);
    }
  },

  // 2. 测试接单
  async testAcceptTicket() {
    this.setData({ currentTest: '接单处理' });
    await this.delay(1000);
    
    const result = await wx.cloud.callFunction({
      name: 'submitTicket',
      data: {
        action: 'acceptTicket',
        ticketId: this.data.testTicketId
      }
    });

    if (result.result.code === 200) {
      const ticket = await this.db.collection('tickets').doc(this.data.testTicketId).get();
      const history = ticket.data.processHistory || [];
      const acceptRecord = history.find(h => h.action === 'accepted');
      
      if (acceptRecord) {
        this.addTestResult('success', 
          `✅ 接单成功，历史记录已添加
          - 操作人: ${acceptRecord.operator}
          - 时间: ${acceptRecord.timestamp}`
        );
      } else {
        this.addTestResult('warning', '⚠️ 接单成功，但未找到接单历史记录');
      }
    } else {
      this.addTestResult('error', `❌ 接单失败: ${result.result.message}`);
    }
  },

  // 3. 测试暂停
  async testPauseTicket() {
    this.setData({ currentTest: '暂停处理' });
    await this.delay(1000);
    
    const result = await wx.cloud.callFunction({
      name: 'submitTicket',
      data: {
        action: 'pauseTicket',
        ticketId: this.data.testTicketId
      }
    });

    if (result.result.code === 200) {
      const ticket = await this.db.collection('tickets').doc(this.data.testTicketId).get();
      const history = ticket.data.processHistory || [];
      const pauseRecord = history.find(h => h.action === 'paused');
      
      if (pauseRecord) {
        this.addTestResult('success', 
          `✅ 暂停成功，历史记录已添加
          - 描述: ${pauseRecord.description}`
        );
      } else {
        this.addTestResult('warning', '⚠️ 暂停成功，但未找到暂停历史记录');
      }
    } else {
      this.addTestResult('error', `❌ 暂停失败: ${result.result.message}`);
    }
  },

  // 4. 测试继续
  async testContinueTicket() {
    this.setData({ currentTest: '继续处理' });
    await this.delay(1000);
    
    const result = await wx.cloud.callFunction({
      name: 'submitTicket',
      data: {
        action: 'continueTicket',
        ticketId: this.data.testTicketId
      }
    });

    if (result.result.code === 200) {
      const ticket = await this.db.collection('tickets').doc(this.data.testTicketId).get();
      const history = ticket.data.processHistory || [];
      const continueRecord = history.find(h => h.action === 'processing' && h.description === '继续处理');
      
      if (continueRecord) {
        this.addTestResult('success', 
          `✅ 继续处理成功，历史记录已添加`
        );
      } else {
        this.addTestResult('warning', '⚠️ 继续处理成功，但未找到相应历史记录');
      }
    } else {
      this.addTestResult('error', `❌ 继续处理失败: ${result.result.message}`);
    }
  },

  // 5. 测试退回（重点测试）
  async testRejectTicket() {
    this.setData({ currentTest: '退回工单（带原因）' });
    await this.delay(1000);
    
    const rejectReason = '需要网络管理员权限才能修改核心交换机配置';
    
    const result = await wx.cloud.callFunction({
      name: 'submitTicket',
      data: {
        action: 'rejectTicket',
        ticketId: this.data.testTicketId,
        reason: rejectReason
      }
    });

    if (result.result.code === 200) {
      const ticket = await this.db.collection('tickets').doc(this.data.testTicketId).get();
      const history = ticket.data.processHistory || [];
      const rejectRecord = history.find(h => h.action === 'rejected');
      
      if (rejectRecord) {
        if (rejectRecord.reason === rejectReason) {
          this.addTestResult('success', 
            `✅ 退回成功，历史记录已添加，原因已记录
            - 操作人: ${rejectRecord.operator}
            - 退回原因: ${rejectRecord.reason}`
          );
        } else {
          this.addTestResult('warning', 
            `⚠️ 退回成功，但原因不匹配
            - 期望: ${rejectReason}
            - 实际: ${rejectRecord.reason}`
          );
        }
      } else {
        this.addTestResult('error', '❌ 退回成功，但未找到退回历史记录');
      }
    } else {
      this.addTestResult('error', `❌ 退回失败: ${result.result.message}`);
    }
  },

  // 6. 重新接单
  async testAcceptAgain() {
    this.setData({ currentTest: '重新接单' });
    await this.delay(1000);
    
    const result = await wx.cloud.callFunction({
      name: 'submitTicket',
      data: {
        action: 'acceptTicket',
        ticketId: this.data.testTicketId
      }
    });

    if (result.result.code === 200) {
      this.addTestResult('success', '✅ 重新接单成功');
    } else {
      this.addTestResult('info', `ℹ️ 重新接单: ${result.result.message}`);
    }
  },

  // 7. 测试解决
  async testResolveTicket() {
    this.setData({ currentTest: '解决工单' });
    await this.delay(1000);
    
    const solution = '已修改交换机VLAN配置，问题解决';
    
    const result = await wx.cloud.callFunction({
      name: 'submitTicket',
      data: {
        action: 'updateStatus',
        ticketId: this.data.testTicketId,
        status: 'resolved',
        solution: solution
      }
    });

    if (result.result.code === 200) {
      const ticket = await this.db.collection('tickets').doc(this.data.testTicketId).get();
      const history = ticket.data.processHistory || [];
      const resolveRecord = history.find(h => h.action === 'resolved');
      
      if (resolveRecord) {
        this.addTestResult('success', 
          `✅ 解决成功，历史记录已添加
          - 解决方案: ${resolveRecord.solution || '未记录'}`
        );
      } else {
        this.addTestResult('warning', '⚠️ 解决成功，但未找到解决历史记录');
      }
    } else {
      this.addTestResult('error', `❌ 解决失败: ${result.result.message}`);
    }
  },

  // 加载并显示完整历史
  async loadProcessHistory() {
    if (!this.data.testTicketId) return;
    
    const ticket = await this.db.collection('tickets').doc(this.data.testTicketId).get();
    const history = ticket.data.processHistory || [];
    
    this.setData({ 
      processHistory: history.map(h => ({
        ...h,
        timeStr: this.formatTime(h.timestamp)
      }))
    });
    
    this.addTestResult('info', `📋 共记录了 ${history.length} 条历史`);
  },

  // 添加测试结果
  addTestResult(type, message) {
    const results = this.data.testResults;
    results.push({
      type,
      message,
      time: new Date().toLocaleTimeString()
    });
    this.setData({ testResults: results });
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  },

  // 延迟函数
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // 清除测试数据
  async clearTestData() {
    if (!this.data.testTicketId) {
      wx.showToast({ title: '无测试数据', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '是否删除测试工单？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await this.db.collection('tickets').doc(this.data.testTicketId).remove();
            this.setData({
              testTicketId: '',
              testResults: [],
              processHistory: []
            });
            wx.showToast({ title: '已删除', icon: 'success' });
          } catch (error) {
            wx.showToast({ title: '删除失败', icon: 'error' });
          }
        }
      }
    });
  }
});