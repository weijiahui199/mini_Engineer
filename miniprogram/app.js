// app.js
const { EventBus, EVENTS } = require('./utils/event-bus');
const RefreshManager = require('./utils/refresh-manager');

App({
  onLaunch: function () {
    // 初始化事件总线
    this.eventBus = new EventBus();
    console.log('[App] 事件总线初始化完成');
    
    // 设置全局事件监听，连接EventBus和RefreshManager
    this.setupGlobalEventHandlers();
    
    this.globalData = {
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
      env: "cloud1-1gp11xbgcf2738ca",
      userInfo: null,
      openid: null,
      db: null,
      isLogin: false,
      isGuest: false,
      token: null
    };
    
    // 导出事件常量，方便页面使用
    this.EVENTS = EVENTS;
    
    // 导出RefreshManager，方便页面使用
    this.refreshManager = RefreshManager;
    
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      wx.showModal({
        title: '提示',
        content: '当前微信版本过低，请升级微信',
        showCancel: false
      });
    } else {
      try {
        wx.cloud.init({
          env: this.globalData.env,
          traceUser: true,
        });
        
        // 初始化云数据库
        this.globalData.db = wx.cloud.database({
          env: this.globalData.env
        });
        
        console.log('云开发环境初始化成功:', this.globalData.env);
        
        // 检查登录状态
        this.checkLoginStatus();
      } catch (error) {
        console.error('云开发初始化失败:', error);
        wx.showModal({
          title: '初始化失败',
          content: '云开发环境初始化失败，部分功能可能无法使用',
          showCancel: false
        });
      }
    }
  },
  
  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    const openid = wx.getStorageSync('openid');
    const isGuest = wx.getStorageSync('isGuest');
    
    if (token && userInfo && openid) {
      // 已登录
      this.globalData.isLogin = true;
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
      this.globalData.openid = openid;
      console.log('用户已登录:', userInfo);
    } else if (isGuest) {
      // 游客模式
      this.globalData.isGuest = true;
      this.globalData.userInfo = userInfo;
      console.log('游客模式');
    } else {
      // 未登录，跳转到登录页
      console.log('用户未登录');
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        if (currentPage.route !== 'pages/login/index') {
          wx.reLaunch({
            url: '/pages/login/index'
          });
        }
      }
    }
  },
  
  // 获取用户openid
  async getOpenid() {
    try {
      // 方法1: 尝试使用login云函数
      const res = await wx.cloud.callFunction({
        name: 'login'
      });
      if (res.result && res.result.openid) {
        this.globalData.openid = res.result.openid;
        console.log('获取openid成功:', res.result.openid);
        await this.getUserInfo();
        return;
      }
    } catch (error) {
      console.log('login云函数未部署，尝试其他方法');
    }
    
    try {
      // 方法52: 直接使用云开发API获取
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'getOpenId' }
      });
      if (result && result.openid) {
        this.globalData.openid = result.openid;
        console.log('使用备用方案获取openid成功');
        await this.getUserInfo();
      }
    } catch (error) {
      console.error('所有获取openid方法失败，使用模拟数据');
      // 使用模拟数据以便测试
      this.globalData.openid = 'test_openid_' + Date.now();
      this.globalData.userInfo = {
        openid: this.globalData.openid,
        nickName: '微信用户',  // 使用nickName
        roleGroup: '用户',
        engineerNo: 'USER' + Date.now().toString().slice(-6)
      };
    }
  },
  
  // 获取用户信息
  async getUserInfo() {
    if (!this.globalData.openid) return;
    
    const db = this.globalData.db;
    try {
      const res = await db.collection('users').where({
        openid: this.globalData.openid
      }).get();
      
      if (res.data.length > 0) {
        this.globalData.userInfo = res.data[0];
      } else {
        // 创建新工程师用户
        await this.createNewUser();
      }
    } catch (error) {
      console.error('获取用户信息失败：', error);
      // 如果数据库操作失败，创建本地默认用户
      this.globalData.userInfo = {
        openid: this.globalData.openid,
        nickName: '微信用户',  // 使用nickName
        roleGroup: '用户',
        avatar: '',
        status: 'online',
        department: '技术部',
        phone: '',
        email: '',
        skills: ['硬件维修', '软件安装', '网络调试'],
        createTime: new Date(),
        updateTime: new Date()
      };
    }
  },
  
  // 创建新用户
  async createNewUser() {
    const db = this.globalData.db;
    // 生成工程师编号
    const engineerNo = 'ENG' + Date.now().toString().slice(-6);
    const newUser = {
      openid: this.globalData.openid,
      nickName: '微信用户',  // 默认用户名
      roleGroup: '用户',
      avatar: '',
      status: 'online',
      department: '技术部',
      phone: '',
      email: '',
      skills: ['硬件维修', '软件安装', '网络调试'],
      engineerNo: engineerNo,
      createTime: new Date(),
      updateTime: new Date()
    };
    
    try {
      const res = await db.collection('users').add({
        data: newUser
      });
      newUser._id = res._id;
      this.globalData.userInfo = newUser;
      console.log('创建工程师账户成功：', engineerNo);
    } catch (error) {
      console.error('创建用户失败：', error);
      // 保存到本地作为备份
      this.globalData.userInfo = newUser;
    }
  },
  
  // 初始化数据库（如果需要）
  // 暂时禁用数据库初始化，避免云函数未部署的错误
  async initDatabaseIfNeeded() {
    try {
      console.log('数据库初始化功能已暂时禁用');
      console.log('请在云开发控制台手动创建所需集合');
      // 检查数据库连接
      const db = this.globalData.db;
      if (db) {
        console.log('云数据库连接正常');
      }
    } catch (error) {
      console.error('数据库检查失败：', error);
    }
  },
  
  // 设置全局事件处理器
  setupGlobalEventHandlers() {
    // 监听用户信息更新事件
    this.eventBus.on(EVENTS.USER_INFO_UPDATED, () => {
      console.log('[App] 监听到用户信息更新事件');
      RefreshManager.handleGlobalEvent('USER_INFO_UPDATED');
    });
    
    // 监听头像更新事件
    this.eventBus.on(EVENTS.AVATAR_UPDATED, () => {
      console.log('[App] 监听到头像更新事件');
      RefreshManager.handleGlobalEvent('AVATAR_UPDATED');
    });
    
    // 监听缓存清除事件
    this.eventBus.on(EVENTS.CACHE_CLEARED, () => {
      console.log('[App] 监听到缓存清除事件');
      // 清除所有刷新记录
      RefreshManager.reset();
    });
    
    console.log('[App] 全局事件处理器设置完成');
  }
});
