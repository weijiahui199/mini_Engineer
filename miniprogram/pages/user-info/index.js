// 个人信息编辑页面
const UserCache = require('../../utils/user-cache');
const avatarManager = require('../../utils/avatar-manager');
import Toast from 'tdesign-miniprogram/toast/index';

Page({
  data: {
    userInfo: {
      nickName: '',
      department: '',
      phone: '',
      email: '',
      avatar: '',
      status: 'online',
      roleGroup: '用户'
    },
    originalUserInfo: {}, // 保存原始数据用于比较
    roleText: '普通用户',
    statusText: '在线',
    hasChanges: false,
    saving: false
  },

  onLoad() {
    this.app = getApp();
    this.db = this.app.globalData.db || wx.cloud.database();
    this.loadUserInfo();
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      wx.showLoading({
        title: '加载中...'
      });

      // 从缓存或数据库获取用户信息
      const userInfo = await UserCache.getUserInfo();
      
      if (!userInfo) {
        wx.hideLoading();
        Toast({
          context: this,
          selector: '#t-toast',
          message: '获取用户信息失败',
          theme: 'error'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
        return;
      }

      // 设置角色文本
      let roleText = '普通用户';
      if (userInfo.roleGroup === '经理') {
        roleText = 'IT运维主管';
      } else if (userInfo.roleGroup === '工程师') {
        roleText = 'IT运维工程师';
      }

      // 设置状态文本
      const statusMap = {
        'online': '在线',
        'offline': '离线',
        'busy': '忙碌'
      };

      this.setData({
        userInfo: {
          nickName: userInfo.nickName || '',
          department: userInfo.department || '',
          phone: userInfo.phone || '',
          email: userInfo.email || '',
          avatar: userInfo.localAvatar || userInfo.avatar || '',
          status: userInfo.status || 'online',
          roleGroup: userInfo.roleGroup || '用户'
        },
        originalUserInfo: JSON.parse(JSON.stringify(userInfo)), // 深拷贝原始数据
        roleText: roleText,
        statusText: statusMap[userInfo.status] || '在线'
      });

      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('加载用户信息失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '加载失败',
        theme: 'error'
      });
    }
  },

  // 输入框变化处理
  onInputChange(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    
    this.setData({
      [`userInfo.${field}`]: value
    });
    
    this.checkChanges();
  },

  // 选择状态
  selectStatus() {
    const statusOptions = ['在线', '离线', '忙碌'];
    const statusValues = ['online', 'offline', 'busy'];
    
    wx.showActionSheet({
      itemList: statusOptions,
      success: (res) => {
        this.setData({
          'userInfo.status': statusValues[res.tapIndex],
          statusText: statusOptions[res.tapIndex]
        });
        this.checkChanges();
      }
    });
  },

  // 检查是否有修改
  checkChanges() {
    const current = this.data.userInfo;
    const original = this.data.originalUserInfo;
    
    // 比较各个字段是否有变化（不包括头像）
    const hasChanges = 
      current.nickName !== (original.nickName || '') ||
      current.department !== (original.department || '') ||
      current.phone !== (original.phone || '') ||
      current.email !== (original.email || '') ||
      current.status !== (original.status || 'online');
    
    this.setData({
      hasChanges: hasChanges
    });
  },

  // 更换头像
  async changeAvatar() {
    try {
      wx.showLoading({
        title: '处理中...',
        mask: true
      });
      
      // 使用头像管理器选择并上传头像
      const result = await avatarManager.chooseAndUploadAvatar({
        maxSize: 400,
        quality: 0.8,
        sourceType: ['album', 'camera']
      });
      
      wx.hideLoading();
      
      if (result.success) {
        // 获取临时URL用于显示
        const tempUrl = await avatarManager.getTempAvatarUrl(result.fileID);
        
        // 更新页面显示
        this.setData({
          'userInfo.avatar': tempUrl
        });
        
        // 立即更新数据库中的头像
        await this.updateAvatarInDatabase(result.fileID);
        
        // 只更新头像缓存，不更新其他信息的缓存
        await UserCache.updateAvatarCache(result.fileID);
        
        // 更新全局数据
        if (this.app.globalData.userInfo) {
          this.app.globalData.userInfo.avatar = result.fileID;
        }
        
        Toast({
          context: this,
          selector: '#t-toast',
          message: '头像更新成功',
          theme: 'success'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('更换头像失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: '更换头像失败',
        theme: 'error'
      });
    }
  },

  // 更新数据库中的头像
  async updateAvatarInDatabase(avatarFileID) {
    try {
      const openid = this.app.globalData.openid;
      if (!openid) {
        throw new Error('用户未登录');
      }

      await this.db.collection('users').where({
        openid: openid
      }).update({
        data: {
          avatar: avatarFileID,
          avatarUpdateTime: new Date()
        }
      });

      console.log('头像已更新到数据库');
    } catch (error) {
      console.error('更新数据库头像失败:', error);
      throw error;
    }
  },

  // 保存用户信息
  async saveUserInfo() {
    if (!this.data.hasChanges || this.data.saving) {
      return;
    }

    // 验证手机号
    if (this.data.userInfo.phone) {
      const phoneReg = /^1[3-9]\d{9}$/;
      if (!phoneReg.test(this.data.userInfo.phone)) {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '请输入正确的手机号',
          theme: 'error'
        });
        return;
      }
    }

    // 验证邮箱
    if (this.data.userInfo.email) {
      const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailReg.test(this.data.userInfo.email)) {
        Toast({
          context: this,
          selector: '#t-toast',
          message: '请输入正确的邮箱',
          theme: 'error'
        });
        return;
      }
    }

    this.setData({ saving: true });

    try {
      // 调用云函数更新
      const result = await wx.cloud.callFunction({
        name: 'userProfile',
        data: {
          action: 'updateUserProfile',
          nickName: this.data.userInfo.nickName,  // 统一使用nickName字段
          department: this.data.userInfo.department,
          phone: this.data.userInfo.phone,
          email: this.data.userInfo.email
        }
      });

      console.log('云函数更新结果:', result);

      if (result.result.code === 200) {
        // 更新本地数据库的status字段（nickName已通过云函数更新）
        const openid = this.app.globalData.openid;
        if (openid) {
          await this.db.collection('users').where({
            openid: openid
          }).update({
            data: {
              status: this.data.userInfo.status,
              updateTime: new Date()
            }
          });
        }

        // 强制刷新缓存（获取最新数据）
        await UserCache.getUserInfo(true);

        // 更新全局数据
        if (this.app.globalData.userInfo) {
          this.app.globalData.userInfo.nickName = this.data.userInfo.nickName;
          this.app.globalData.userInfo.department = this.data.userInfo.department;
          this.app.globalData.userInfo.phone = this.data.userInfo.phone;
          this.app.globalData.userInfo.email = this.data.userInfo.email;
          this.app.globalData.userInfo.status = this.data.userInfo.status;
        }

        Toast({
          context: this,
          selector: '#t-toast',
          message: '保存成功',
          theme: 'success'
        });

        // 延迟返回
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result.result.message || '更新失败');
      }

    } catch (error) {
      console.error('保存用户信息失败:', error);
      Toast({
        context: this,
        selector: '#t-toast',
        message: error.message || '保存失败，请重试',
        theme: 'error'
      });
    } finally {
      this.setData({ saving: false });
    }
  },

  // 取消编辑
  cancel() {
    if (this.data.hasChanges) {
      wx.showModal({
        title: '提示',
        content: '有未保存的修改，确定要离开吗？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateBack();
          }
        }
      });
    } else {
      wx.navigateBack();
    }
  }
});