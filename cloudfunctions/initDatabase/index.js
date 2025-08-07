// 云函数：数据库初始化
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 初始化数据库集合和数据
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  
  try {
    // 创建集合（如果不存在）
    await createCollections();
    
    // 初始化基础数据
    await initializeData();
    
    return {
      success: true,
      message: '数据库初始化成功',
      openid: wxContext.OPENID
    };
  } catch (error) {
    console.error('数据库初始化失败：', error);
    return {
      success: false,
      message: '数据库初始化失败',
      error: error.toString()
    };
  }
};

// 创建集合
async function createCollections() {
  const collections = ['users', 'tickets', 'materials', 'notifications'];
  
  for (const collectionName of collections) {
    try {
      await db.createCollection(collectionName);
      console.log(`集合 ${collectionName} 创建成功`);
      
      // 为集合创建索引
      await createIndexes(collectionName);
    } catch (error) {
      if (error.errCode === -502005 || error.errMsg.includes('already exists')) {
        console.log(`集合 ${collectionName} 已存在`);
      } else {
        throw error;
      }
    }
  }
}

// 创建索引
async function createIndexes(collectionName) {
  const collection = db.collection(collectionName);
  
  switch(collectionName) {
    case 'users':
      // 用户表索引
      try {
        await collection.createIndex({
          name: 'openid_index',
          keys: { openid: 1 },
          unique: true
        });
      } catch (e) {
        console.log('索引可能已存在:', e);
      }
      break;
      
    case 'tickets':
      // 工单表索引
      try {
        await collection.createIndex({
          name: 'status_index',
          keys: { status: 1 }
        });
        await collection.createIndex({
          name: 'assignee_index',
          keys: { assigneeOpenid: 1 }
        });
        await collection.createIndex({
          name: 'createTime_index',
          keys: { createTime: -1 }
        });
      } catch (e) {
        console.log('索引可能已存在:', e);
      }
      break;
      
    case 'materials':
      // 物料表索引
      try {
        await collection.createIndex({
          name: 'category_index',
          keys: { category: 1 }
        });
      } catch (e) {
        console.log('索引可能已存在:', e);
      }
      break;
      
    case 'notifications':
      // 通知表索引
      try {
        await collection.createIndex({
          name: 'userOpenid_index',
          keys: { userOpenid: 1 }
        });
        await collection.createIndex({
          name: 'isRead_index',
          keys: { isRead: 1 }
        });
      } catch (e) {
        console.log('索引可能已存在:', e);
      }
      break;
  }
}

// 初始化基础数据
async function initializeData() {
  const wxContext = cloud.getWXContext();
  const now = new Date();
  
  // 1. 初始化用户数据
  const usersCollection = db.collection('users');
  const userCount = await usersCollection.count();
  
  if (userCount.total === 0) {
    // 创建测试用户
    const testUsers = [
      {
        openid: wxContext.OPENID || 'test_engineer_001',
        name: '张工程师',
        roleGroup: '工程师',
        avatar: '',
        status: 'online',
        department: '技术部',
        phone: '13800138001',
        email: 'zhang@company.com',
        skills: ['硬件维修', '软件安装', '网络配置'],
        createTime: now,
        updateTime: now
      },
      {
        openid: 'test_engineer_002',
        name: '李工程师',
        roleGroup: '工程师',
        avatar: '',
        status: 'online',
        department: '技术部',
        phone: '13800138002',
        email: 'li@company.com',
        skills: ['打印机维修', '系统维护'],
        createTime: now,
        updateTime: now
      },
      {
        openid: 'test_manager_001',
        name: '王经理',
        roleGroup: '经理',
        avatar: '',
        status: 'online',
        department: '技术部',
        phone: '13800138003',
        email: 'wang@company.com',
        createTime: now,
        updateTime: now
      }
    ];
    
    for (const user of testUsers) {
      try {
        await usersCollection.add({ data: user });
        console.log(`用户 ${user.name} 创建成功`);
      } catch (e) {
        console.log(`用户 ${user.name} 创建失败:`, e);
      }
    }
  }
  
  // 2. 初始化工单数据
  const ticketsCollection = db.collection('tickets');
  const ticketCount = await ticketsCollection.count();
  
  if (ticketCount.total === 0) {
    const testTickets = [
      {
        ticketNo: 'TK' + Date.now() + '001',
        title: '电脑无法开机',
        description: '早上来办公室发现电脑无法开机，按电源键没有反应',
        category: '硬件故障',
        priority: 'urgent',
        status: 'pending',
        submitterName: '张三',
        submitterPhone: '13900139001',
        location: '财务部3楼302室',
        assigneeOpenid: '',
        assigneeName: '',
        createTime: new Date(now.getTime() - 10 * 60 * 1000), // 10分钟前
        updateTime: now,
        images: [],
        solution: '',
        feedback: ''
      },
      {
        ticketNo: 'TK' + Date.now() + '002',
        title: '打印机无法连接',
        description: '打印机显示离线状态，无法打印文档',
        category: '设备问题',
        priority: 'high',
        status: 'processing',
        submitterName: '李四',
        submitterPhone: '13900139002',
        location: '人事部2楼201室',
        assigneeOpenid: wxContext.OPENID || 'test_engineer_001',
        assigneeName: '张工程师',
        createTime: new Date(now.getTime() - 30 * 60 * 1000), // 30分钟前
        updateTime: now,
        images: [],
        solution: '',
        feedback: ''
      },
      {
        ticketNo: 'TK' + Date.now() + '003',
        title: '网络连接不稳定',
        description: '网络经常断开，影响正常办公',
        category: '网络问题',
        priority: 'medium',
        status: 'pending',
        submitterName: '王五',
        submitterPhone: '13900139003',
        location: '市场部4楼405室',
        assigneeOpenid: 'test_engineer_002',
        assigneeName: '李工程师',
        createTime: new Date(now.getTime() - 60 * 60 * 1000), // 1小时前
        updateTime: now,
        images: [],
        solution: '',
        feedback: ''
      },
      {
        ticketNo: 'TK' + Date.now() + '004',
        title: '软件安装请求',
        description: '需要安装Office 2021版本',
        category: '软件服务',
        priority: 'low',
        status: 'resolved',
        submitterName: '赵六',
        submitterPhone: '13900139004',
        location: '研发部5楼501室',
        assigneeOpenid: wxContext.OPENID || 'test_engineer_001',
        assigneeName: '张工程师',
        createTime: new Date(now.getTime() - 120 * 60 * 1000), // 2小时前
        updateTime: now,
        resolveTime: new Date(now.getTime() - 30 * 60 * 1000), // 30分钟前解决
        images: [],
        solution: '已成功安装Office 2021专业版',
        feedback: '安装很快，服务很好！'
      },
      {
        ticketNo: 'TK' + Date.now() + '005',
        title: '投影仪故障',
        description: '会议室投影仪无法显示画面',
        category: '硬件故障',
        priority: 'urgent',
        status: 'pending',
        submitterName: '孙七',
        submitterPhone: '13900139005',
        location: '会议室A',
        assigneeOpenid: '',
        assigneeName: '',
        createTime: new Date(now.getTime() - 5 * 60 * 1000), // 5分钟前
        updateTime: now,
        images: [],
        solution: '',
        feedback: ''
      }
    ];
    
    for (const ticket of testTickets) {
      try {
        await ticketsCollection.add({ data: ticket });
        console.log(`工单 ${ticket.title} 创建成功`);
      } catch (e) {
        console.log(`工单 ${ticket.title} 创建失败:`, e);
      }
    }
  }
  
  // 3. 初始化物料数据
  const materialsCollection = db.collection('materials');
  const materialCount = await materialsCollection.count();
  
  if (materialCount.total === 0) {
    const testMaterials = [
      {
        name: '网线',
        category: '网络设备',
        unit: '米',
        quantity: 100,
        minStock: 20,
        location: '仓库A-1',
        description: 'CAT6网线',
        createTime: now,
        updateTime: now
      },
      {
        name: '鼠标',
        category: '外设',
        unit: '个',
        quantity: 50,
        minStock: 10,
        location: '仓库A-2',
        description: '有线USB鼠标',
        createTime: now,
        updateTime: now
      },
      {
        name: '键盘',
        category: '外设',
        unit: '个',
        quantity: 30,
        minStock: 10,
        location: '仓库A-2',
        description: '有线USB键盘',
        createTime: now,
        updateTime: now
      },
      {
        name: '硒鼓',
        category: '打印耗材',
        unit: '个',
        quantity: 20,
        minStock: 5,
        location: '仓库B-1',
        description: 'HP LaserJet硒鼓',
        createTime: now,
        updateTime: now
      },
      {
        name: 'A4纸',
        category: '打印耗材',
        unit: '包',
        quantity: 100,
        minStock: 20,
        location: '仓库B-2',
        description: '80g A4打印纸',
        createTime: now,
        updateTime: now
      },
      {
        name: '内存条',
        category: '电脑配件',
        unit: '条',
        quantity: 10,
        minStock: 3,
        location: '仓库C-1',
        description: 'DDR4 8GB内存',
        createTime: now,
        updateTime: now
      },
      {
        name: '硬盘',
        category: '电脑配件',
        unit: '个',
        quantity: 5,
        minStock: 2,
        location: '仓库C-2',
        description: '500GB SSD固态硬盘',
        createTime: now,
        updateTime: now
      }
    ];
    
    for (const material of testMaterials) {
      try {
        await materialsCollection.add({ data: material });
        console.log(`物料 ${material.name} 创建成功`);
      } catch (e) {
        console.log(`物料 ${material.name} 创建失败:`, e);
      }
    }
  }
  
  // 4. 初始化通知数据
  const notificationsCollection = db.collection('notifications');
  const notificationCount = await notificationsCollection.count();
  
  if (notificationCount.total === 0) {
    const testNotifications = [
      {
        userOpenid: wxContext.OPENID || 'test_engineer_001',
        type: 'ticket_new',
        title: '新工单提醒',
        content: '您有一个新的紧急工单待处理：投影仪故障',
        ticketId: '',
        isRead: false,
        createTime: new Date(now.getTime() - 5 * 60 * 1000),
        readTime: null
      },
      {
        userOpenid: wxContext.OPENID || 'test_engineer_001',
        type: 'system',
        title: '系统维护通知',
        content: '系统将于今晚22:00-23:00进行维护升级',
        isRead: false,
        createTime: new Date(now.getTime() - 60 * 60 * 1000),
        readTime: null
      },
      {
        userOpenid: wxContext.OPENID || 'test_engineer_001',
        type: 'material_low',
        title: '物料库存预警',
        content: '硬盘库存不足，当前数量：5个，请及时补充',
        isRead: true,
        createTime: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        readTime: new Date(now.getTime() - 20 * 60 * 60 * 1000)
      }
    ];
    
    for (const notification of testNotifications) {
      try {
        await notificationsCollection.add({ data: notification });
        console.log('通知创建成功');
      } catch (e) {
        console.log('通知创建失败:', e);
      }
    }
  }
  
  console.log('数据库初始化完成');
}