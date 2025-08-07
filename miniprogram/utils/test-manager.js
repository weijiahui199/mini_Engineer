// 测试经理角色功能的工具函数
// 用于快速将当前用户切换为经理角色进行测试

/**
 * 将当前用户设置为经理角色
 * 使用方法：在需要测试的页面调用 testSetAsManager()
 */
async function testSetAsManager() {
  const app = getApp();
  const db = app.globalData.db || wx.cloud.database();
  const openid = app.globalData.openid;
  
  if (!openid) {
    console.error('请先登录');
    return;
  }
  
  try {
    // 更新数据库中的用户角色
    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        roleGroup: '经理',
        name: '测试经理',
        department: '管理部',
        engineerInfo: {
          workingStatus: 'available',
          currentTasks: 0,
          maxTasks: 10
        },
        updateTime: new Date()
      }
    });
    
    // 更新全局用户信息
    app.globalData.userInfo = {
      ...app.globalData.userInfo,
      roleGroup: '经理',
      name: '测试经理',
      department: '管理部'
    };
    
    // 更新本地存储
    wx.setStorageSync('userRoleGroup', '经理');
    
    console.log('成功设置为经理角色');
    wx.showToast({
      title: '已切换为经理',
      icon: 'success'
    });
    
    // 刷新当前页面
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.onLoad) {
      currentPage.onLoad(currentPage.options);
    }
    
    return true;
  } catch (error) {
    console.error('设置经理角色失败：', error);
    wx.showToast({
      title: '设置失败',
      icon: 'error'
    });
    return false;
  }
}

/**
 * 将当前用户设置为工程师角色
 * 使用方法：在需要测试的页面调用 testSetAsEngineer()
 */
async function testSetAsEngineer() {
  const app = getApp();
  const db = app.globalData.db || wx.cloud.database();
  const openid = app.globalData.openid;
  
  if (!openid) {
    console.error('请先登录');
    return;
  }
  
  try {
    // 更新数据库中的用户角色
    await db.collection('users').where({
      openid: openid
    }).update({
      data: {
        roleGroup: '工程师',
        name: '测试工程师',
        department: '技术部',
        engineerInfo: {
          workingStatus: 'available',
          currentTasks: 0,
          maxTasks: 10
        },
        updateTime: new Date()
      }
    });
    
    // 更新全局用户信息
    app.globalData.userInfo = {
      ...app.globalData.userInfo,
      roleGroup: '工程师',
      name: '测试工程师',
      department: '技术部'
    };
    
    // 更新本地存储
    wx.setStorageSync('userRoleGroup', '工程师');
    
    console.log('成功设置为工程师角色');
    wx.showToast({
      title: '已切换为工程师',
      icon: 'success'
    });
    
    // 刷新当前页面
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.onLoad) {
      currentPage.onLoad(currentPage.options);
    }
    
    return true;
  } catch (error) {
    console.error('设置工程师角色失败：', error);
    wx.showToast({
      title: '设置失败',
      icon: 'error'
    });
    return false;
  }
}

/**
 * 创建测试工单数据
 */
async function createTestTickets() {
  const app = getApp();
  const db = app.globalData.db || wx.cloud.database();
  const openid = app.globalData.openid;
  
  try {
    const testTickets = [
      {
        ticketNo: 'TK' + Date.now().toString().slice(-6),
        title: '测试工单 - 待分配',
        description: '这是一个待分配的测试工单',
        category: '硬件故障',
        priority: 'urgent',
        status: 'pending',
        submitterOpenid: 'test_user_001',
        submitterName: '张三',
        location: '办公楼3楼',
        department: '财务部',
        createTime: new Date(),
        updateTime: new Date()
      },
      {
        ticketNo: 'TK' + (Date.now() + 1).toString().slice(-6),
        title: '测试工单 - 分配给经理',
        description: '这是分配给经理的测试工单',
        category: '软件问题',
        priority: 'high',
        status: 'pending',
        submitterOpenid: 'test_user_002',
        submitterName: '李四',
        location: '办公楼2楼',
        department: '人事部',
        assigneeOpenid: openid, // 分配给当前用户（经理）
        assigneeName: app.globalData.userInfo?.name || '测试经理',
        createTime: new Date(),
        updateTime: new Date()
      },
      {
        ticketNo: 'TK' + (Date.now() + 2).toString().slice(-6),
        title: '测试工单 - 处理中',
        description: '这是经理正在处理的测试工单',
        category: '网络问题',
        priority: 'medium',
        status: 'processing',
        submitterOpenid: 'test_user_003',
        submitterName: '王五',
        location: '办公楼4楼',
        department: '市场部',
        assigneeOpenid: openid, // 分配给当前用户（经理）
        assigneeName: app.globalData.userInfo?.name || '测试经理',
        createTime: new Date(),
        updateTime: new Date()
      }
    ];
    
    // 批量创建工单
    for (const ticket of testTickets) {
      await db.collection('tickets').add({
        data: ticket
      });
    }
    
    console.log('成功创建测试工单');
    wx.showToast({
      title: '创建成功',
      icon: 'success'
    });
    
    return true;
  } catch (error) {
    console.error('创建测试工单失败：', error);
    wx.showToast({
      title: '创建失败',
      icon: 'error'
    });
    return false;
  }
}

// 导出测试函数
module.exports = {
  testSetAsManager,
  testSetAsEngineer,
  createTestTickets
};