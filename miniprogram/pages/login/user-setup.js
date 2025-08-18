// 用户信息设置页面
const NetworkHandler = require('../../utils/network-handler');
const UserCache = require('../../utils/user-cache');

// 调试：检查模块是否正确加载
console.log('[UserSetup] UserCache module loaded:', typeof UserCache);
console.log('[UserSetup] UserCache methods:', Object.getOwnPropertyNames(UserCache).filter(name => typeof UserCache[name] === 'function'));

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    nickNameError: '',
    saving: false,
    openid: '',
    isFirstTime: true  // 是否首次设置
  },

  onLoad(options) {
    // 获取用户信息
    const app = getApp();
    const userInfo = wx.getStorageSync('userInfo') || {};
    
    this.setData({
      openid: app.globalData.openid || wx.getStorageSync('openid'),
      avatarUrl: userInfo.avatar || '',
      nickName: userInfo.nickName || '',
      isFirstTime: options.firstTime === 'true'
    });
    
    // 初始化数据库
    this.db = app.globalData.db || wx.cloud.database();
  },

  // 选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    console.log('选择的头像:', avatarUrl);
    
    this.setData({
      avatarUrl: avatarUrl
    });
  },

  // 昵称输入
  onNickNameInput(e) {
    const value = e.detail.value;
    this.setData({
      nickName: value,
      nickNameError: ''
    });
  },

  // 昵称失去焦点
  onNickNameBlur(e) {
    const value = e.detail.value;
    if (value && value.trim()) {
      this.setData({
        nickName: value.trim()
      });
    }
  },

  // 保存用户信息
  async saveUserInfo() {
    console.log('[UserSetup] 开始保存用户信息');
    console.log('[UserSetup] 当前数据:', {
      nickName: this.data.nickName,
      avatarUrl: this.data.avatarUrl,
      openid: this.data.openid
    });

    // 验证昵称
    if (!this.data.nickName || !this.data.nickName.trim()) {
      this.setData({
        nickNameError: '请输入昵称'
      });
      return;
    }

    const nickName = this.data.nickName.trim();
    
    // 昵称长度检查
    if (nickName.length < 2 || nickName.length > 20) {
      this.setData({
        nickNameError: '昵称长度应在2-20个字符之间'
      });
      return;
    }

    this.setData({
      saving: true
    });

    try {
      let finalAvatarUrl = this.data.avatarUrl;
      
      // 如果选择了头像，上传到云存储
      // wxfile:// 是微信临时文件，http:// 是网络图片，都需要上传
      if (this.data.avatarUrl && (this.data.avatarUrl.startsWith('wxfile://') || this.data.avatarUrl.startsWith('http'))) {
        wx.showLoading({ title: '上传头像中...' });
        
        try {
          // 使用固定文件名实现覆盖，节省存储空间
          const cloudPath = `avatars/${this.data.openid}.png`;
          console.log('[UserSetup] 准备上传头像到云存储（覆盖模式）:', {
            cloudPath: cloudPath,
            tempPath: this.data.avatarUrl
          });
          
          // 使用网络处理器上传（带重试）
          const uploadRes = await NetworkHandler.uploadFileWithRetry({
            cloudPath,
            filePath: this.data.avatarUrl
          });
          
          finalAvatarUrl = uploadRes.fileID;
          console.log('[UserSetup] 头像上传成功:', finalAvatarUrl);
          
          // 更新头像缓存并触发全局事件
          try {
            console.log('[UserSetup] 准备调用 UserCache.updateAvatarCache');
            console.log('[UserSetup] UserCache type:', typeof UserCache);
            console.log('[UserSetup] updateAvatarCache type:', typeof UserCache.updateAvatarCache);
            
            if (UserCache && typeof UserCache.updateAvatarCache === 'function') {
              await UserCache.updateAvatarCache(finalAvatarUrl);
              console.log('[UserSetup] 已更新头像缓存并触发全局事件');
            } else {
              console.error('[UserSetup] UserCache.updateAvatarCache 不可用');
              // 作为备用方案，直接保存到存储
              wx.setStorageSync('cached_avatar_fileID', finalAvatarUrl);
              wx.setStorageSync('cached_avatar_cache_time', Date.now());
            }
          } catch (cacheError) {
            console.error('[UserSetup] 更新头像缓存时出错:', cacheError);
            // 继续执行，不影响主流程
          }
        } catch (uploadError) {
          console.error('[UserSetup] 头像上传失败:', uploadError);
          
          // 显示错误对话框，让用户选择重试
          NetworkHandler.showErrorDialog(uploadError, {
            title: '头像上传失败',
            confirmText: '重试',
            cancelText: '跳过',
            onConfirm: () => {
              // 重试上传
              this.onCompleteSetup();
            },
            onCancel: () => {
              // 跳过头像上传，使用默认头像
              finalAvatarUrl = '';
            }
          });
          
          // 如果是弱网环境，给出提示
          if (NetworkHandler.isWeakNetwork()) {
            wx.showToast({
              title: '当前网络较慢，建议切换到WiFi',
              icon: 'none',
              duration: 3000
            });
          }
          
          // 如果上传失败，不阻塞流程，使用默认头像
          finalAvatarUrl = '';
        }
        
        wx.hideLoading();
      }

      // 更新数据库中的用户信息 - 使用云函数
      wx.showLoading({ title: '保存中...' });
      
      console.log('[UserSetup] 准备通过云函数更新用户信息:', {
        nickName: nickName,
        avatar: finalAvatarUrl
      });
      
      try {
        // 调用云函数更新用户信息（带重试）
        const cloudResult = await NetworkHandler.callFunctionWithRetry({
          name: 'userProfile',
          data: {
            action: 'updateUserProfile',
            nickName: nickName,
            avatar: finalAvatarUrl,
            source: 'user-setup'
          }
        });
        
        console.log('[UserSetup] 云函数返回结果:', cloudResult);
        
        if (cloudResult.result && cloudResult.result.code === 200) {
          console.log('[UserSetup] 用户信息更新成功');
        } else {
          throw new Error(cloudResult.result?.message || '更新失败');
        }
      } catch (error) {
        console.error('[UserSetup] 云函数调用失败:', error);
        // 如果云函数失败，尝试直接更新数据库
        console.log('[UserSetup] 尝试直接更新数据库');
        
        try {
          // 先查询用户是否存在
          const queryResult = await this.db.collection('users').where({
            openid: this.data.openid
          }).get();
          
          console.log('[UserSetup] 查询到的用户记录:', queryResult.data);
          
          if (queryResult.data && queryResult.data.length > 0) {
            // 用户存在，更新记录
            const userId = queryResult.data[0]._id;
            const updateResult = await this.db.collection('users').doc(userId).update({
              data: {
                nickName: nickName,
                avatar: finalAvatarUrl,
                hasSetupProfile: true,
                profileSetupTime: this.db.serverDate(),
                updateTime: this.db.serverDate()
              }
            });
            console.log('[UserSetup] 直接更新数据库成功:', updateResult);
          } else {
            // 用户不存在，创建新记录
            console.log('[UserSetup] 用户不存在，创建新记录');
            const addResult = await this.db.collection('users').add({
              data: {
                _openid: this.data.openid,  // 添加 _openid 字段用于权限控制
                openid: this.data.openid,
                nickName: nickName,
                avatar: finalAvatarUrl,
                hasSetupProfile: true,
                profileSetupTime: this.db.serverDate(),
                createTime: this.db.serverDate(),
                updateTime: this.db.serverDate(),
                roleGroup: '用户',
                department: '信息技术部',
                status: 'active'
              }
            });
            console.log('[UserSetup] 创建新用户记录成功:', addResult);
          }
        } catch (dbError) {
          console.error('[UserSetup] 直接数据库操作也失败:', dbError);
          throw dbError;
        }
      }

      // 更新本地缓存
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.nickName = nickName;
      userInfo.avatar = finalAvatarUrl;
      wx.setStorageSync('userInfo', userInfo);

      // 更新全局数据
      const app = getApp();
      if (app.globalData.userInfo) {
        app.globalData.userInfo.nickName = nickName;
        app.globalData.userInfo.avatar = finalAvatarUrl;
      }
      
      // 清除UserCache缓存，强制下次重新获取
      UserCache.clearUserInfoCache();
      console.log('[UserSetup] 已清除用户信息缓存');

      wx.hideLoading();
      
      wx.showToast({
        title: '设置成功',
        icon: 'success'
      });

      // 延迟跳转到主页
      setTimeout(() => {
        wx.reLaunch({
          url: '/pages/dashboard/index'
        });
      }, 1500);

    } catch (error) {
      console.error('保存用户信息失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({
        saving: false
      });
    }
  },

  // 跳过设置
  skipSetup() {
    if (this.data.isFirstTime) {
      wx.showModal({
        title: '提示',
        content: '您可以稍后在个人中心设置头像和昵称',
        confirmText: '跳过',
        cancelText: '继续设置',
        success: (res) => {
          if (res.confirm) {
            // 标记用户选择了跳过
            this.markSkipped();
            wx.reLaunch({
              url: '/pages/dashboard/index'
            });
          }
        }
      });
    } else {
      wx.navigateBack();
    }
  },

  // 标记用户跳过了设置
  async markSkipped() {
    try {
      await this.db.collection('users').where({
        openid: this.data.openid
      }).update({
        data: {
          hasSkippedSetup: true,
          skipSetupTime: new Date()
        }
      });
    } catch (error) {
      console.error('标记跳过失败:', error);
    }
  }
});