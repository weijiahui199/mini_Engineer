// 用户信息缓存管理器
// 提供统一的用户信息缓存机制
// - 用户基本信息：24小时自动过期
// - 头像信息：仅在用户主动更新时刷新

class UserCache {
  // 缓存配置
  static CACHE_KEYS = {
    userInfo: 'cached_user_info',
    userAvatar: 'cached_user_avatar',  // 头像单独缓存
    avatarFileID: 'cached_avatar_file_id',  // 云存储文件ID
    cacheTime: 'user_cache_time',
    avatarCacheTime: 'avatar_cache_time'  // 头像缓存时间（用于判断是否需要更新）
  }
  
  // 缓存时长：24小时
  static CACHE_DURATION = 24 * 60 * 60 * 1000;
  
  /**
   * 获取用户信息（优先从缓存）
   * @param {Boolean} forceRefresh 是否强制刷新
   * @returns {Promise} 用户信息
   */
  static async getUserInfo(forceRefresh = false) {
    console.log('[UserCache.getUserInfo] 开始获取用户信息, forceRefresh:', forceRefresh);
    
    // 如果不是强制刷新，先检查缓存
    if (!forceRefresh) {
      const cachedData = this.getFromCache();
      if (cachedData) {
        console.log('[UserCache] 使用缓存的用户信息');
        console.log('[UserCache] 缓存中的头像:', cachedData.avatar);
        console.log('[UserCache] 缓存中的本地头像:', cachedData.localAvatar);
        return cachedData;
      }
      console.log('[UserCache] 缓存不存在或已过期');
    }
    
    console.log('[UserCache] 从数据库获取用户信息');
    // 从数据库获取最新数据
    const freshData = await this.fetchFromDatabase();
    console.log('[UserCache] 数据库中的头像:', freshData?.avatar);
    
    // 处理头像：如果数据库有云存储头像但本地没有缓存，下载并缓存
    if (freshData && freshData.avatar && freshData.avatar.startsWith('cloud://')) {
      const avatarCache = this.getAvatarFromCache();
      if (!avatarCache || !avatarCache.localPath || avatarCache.localPath.includes('thirdwx.qlogo.cn')) {
        console.log('[UserCache] 云存储头像未缓存或缓存是默认头像，开始下载');
        const localPath = await this.downloadAndCacheAvatar(freshData.avatar);
        if (localPath) {
          freshData.localAvatar = localPath;
          console.log('[UserCache] 云存储头像已下载并缓存到本地:', localPath);
        }
      }
    }
    
    // 保存到缓存
    if (freshData) {
      this.saveToCache(freshData);
    }
    
    return freshData;
  }
  
  /**
   * 从缓存读取数据
   * @returns {Object|null} 缓存的用户信息
   */
  static getFromCache() {
    try {
      // 检查缓存时间
      const cacheTime = wx.getStorageSync(this.CACHE_KEYS.cacheTime);
      if (!cacheTime) {
        return null;
      }
      
      // 检查是否过期（24小时）
      const now = Date.now();
      if (now - cacheTime > this.CACHE_DURATION) {
        console.log('[UserCache] 用户信息缓存已过期');
        this.clearUserInfoCache();
        return null;
      }
      
      // 读取缓存数据
      const userInfo = wx.getStorageSync(this.CACHE_KEYS.userInfo);
      console.log('[UserCache.getFromCache] 缓存的userInfo:', userInfo);
      
      if (userInfo) {
        // 头像单独处理，实现三级优先级
        const cachedAvatar = this.getAvatarFromCache();
        console.log('[UserCache.getFromCache] 单独的头像缓存:', cachedAvatar);
        
        // 1. 优先使用本地缓存的非默认头像
        if (cachedAvatar && cachedAvatar.localPath && !cachedAvatar.localPath.includes('thirdwx.qlogo.cn')) {
          userInfo.localAvatar = cachedAvatar.localPath;
          console.log('[UserCache.getFromCache] 使用本地缓存头像:', cachedAvatar.localPath);
        }
        // 2. 保留云存储文件ID信息
        if (cachedAvatar && cachedAvatar.fileID) {
          userInfo.avatar = cachedAvatar.fileID;
          console.log('[UserCache.getFromCache] 保留云存储fileID:', cachedAvatar.fileID);
        }
        
        console.log('[UserCache.getFromCache] 最终返回的userInfo.avatar:', userInfo.avatar);
        console.log('[UserCache.getFromCache] 最终返回的userInfo.localAvatar:', userInfo.localAvatar);
        return userInfo;
      }
    } catch (error) {
      console.error('[UserCache] 读取缓存失败:', error);
    }
    
    return null;
  }
  
  /**
   * 保存到缓存
   * @param {Object} userInfo 用户信息
   */
  static saveToCache(userInfo) {
    try {
      // 保存用户信息（保留头像字段用于比较）
      const userInfoToCache = { ...userInfo };
      
      wx.setStorageSync(this.CACHE_KEYS.userInfo, userInfoToCache);
      
      // 保存缓存时间
      wx.setStorageSync(this.CACHE_KEYS.cacheTime, Date.now());
      
      // 头像单独处理
      // 如果没有头像缓存，或者头像已经更新，则缓存新头像
      const currentAvatarFileID = wx.getStorageSync(this.CACHE_KEYS.avatarFileID);
      console.log('[UserCache.saveToCache] 当前缓存的头像ID:', currentAvatarFileID);
      console.log('[UserCache.saveToCache] 新的头像ID:', userInfo.avatar);
      
      // 检查是否是微信默认头像
      const isWechatDefaultAvatar = userInfo.avatar && userInfo.avatar.includes('thirdwx.qlogo.cn');
      const isCloudAvatar = currentAvatarFileID && currentAvatarFileID.startsWith('cloud://');
      
      if (isWechatDefaultAvatar && isCloudAvatar) {
        // 如果新的是微信默认头像，但缓存中是云存储头像，保留云存储头像
        console.log('[UserCache] 保留云存储头像，不被微信默认头像覆盖');
        userInfo.avatar = currentAvatarFileID;
      } else if (userInfo.avatar && userInfo.avatar !== currentAvatarFileID) {
        console.log('[UserCache] 检测到头像更新，缓存新头像');
        this.cacheAvatar(userInfo.avatar);
      } else if (userInfo.avatar && !this.hasAvatarCache()) {
        console.log('[UserCache] 初始化头像缓存');
        this.cacheAvatar(userInfo.avatar);
      } else {
        console.log('[UserCache] 头像未变化，不需要更新缓存');
      }
      
      console.log('[UserCache] 用户信息已缓存');
    } catch (error) {
      console.error('[UserCache] 保存缓存失败:', error);
    }
  }
  
  /**
   * 缓存头像（仅在用户主动更新时调用）
   * @param {String} avatarUrl 头像URL
   */
  static async cacheAvatar(avatarUrl) {
    try {
      // 保存云存储文件ID
      wx.setStorageSync(this.CACHE_KEYS.avatarFileID, avatarUrl);
      wx.setStorageSync(this.CACHE_KEYS.avatarCacheTime, Date.now());
      
      // 如果是云存储URL，获取临时链接
      if (avatarUrl && avatarUrl.startsWith('cloud://')) {
        const tempUrlResult = await wx.cloud.getTempFileURL({
          fileList: [avatarUrl]
        });
        
        if (tempUrlResult.fileList && tempUrlResult.fileList.length > 0) {
          const tempUrl = tempUrlResult.fileList[0].tempFileURL;
          
          // 下载到本地
          const downloadResult = await wx.downloadFile({
            url: tempUrl
          });
          
          if (downloadResult.statusCode === 200) {
            // 保存到本地缓存
            const savedFile = await wx.saveFile({
              tempFilePath: downloadResult.tempFilePath
            });
            
            wx.setStorageSync(this.CACHE_KEYS.userAvatar, savedFile.savedFilePath);
            console.log('[UserCache] 头像已缓存到本地');
            return savedFile.savedFilePath;
          }
        }
      } else if (avatarUrl) {
        // 如果是普通URL，直接保存
        wx.setStorageSync(this.CACHE_KEYS.userAvatar, avatarUrl);
        return avatarUrl;
      }
    } catch (error) {
      console.error('[UserCache] 缓存头像失败:', error);
    }
    
    return avatarUrl;
  }
  
  /**
   * 从数据库获取用户信息
   * @returns {Promise} 用户信息
   */
  static async fetchFromDatabase() {
    const app = getApp();
    const db = app.globalData.db;
    const openid = app.globalData.openid;
    
    if (!db || !openid) {
      console.error('[UserCache] 数据库或openid未初始化');
      return null;
    }
    
    try {
      // 查询用户信息
      const res = await db.collection('users').where({
        openid: openid
      }).get();
      
      if (res.data && res.data.length > 0) {
        const userInfo = res.data[0];
        
        // 更新全局数据
        app.globalData.userInfo = userInfo;
        
        return userInfo;
      } else {
        console.log('[UserCache] 用户信息不存在');
        return null;
      }
    } catch (error) {
      console.error('[UserCache] 获取用户信息失败:', error);
      return null;
    }
  }
  
  /**
   * 清除所有缓存
   */
  static clearCache() {
    try {
      // 清除所有缓存键
      Object.values(this.CACHE_KEYS).forEach(key => {
        wx.removeStorageSync(key);
      });
      
      console.log('[UserCache] 所有缓存已清除');
    } catch (error) {
      console.error('[UserCache] 清除缓存失败:', error);
    }
  }
  
  /**
   * 仅清除用户信息缓存（保留头像缓存）
   */
  static clearUserInfoCache() {
    try {
      wx.removeStorageSync(this.CACHE_KEYS.userInfo);
      wx.removeStorageSync(this.CACHE_KEYS.cacheTime);
      console.log('[UserCache] 用户信息缓存已清除（头像缓存保留）');
    } catch (error) {
      console.error('[UserCache] 清除用户信息缓存失败:', error);
    }
  }
  
  /**
   * 获取头像缓存
   * @returns {Object|null} 头像信息
   */
  static getAvatarFromCache() {
    try {
      const avatarFileID = wx.getStorageSync(this.CACHE_KEYS.avatarFileID);
      const localPath = wx.getStorageSync(this.CACHE_KEYS.userAvatar);
      
      if (avatarFileID || localPath) {
        return {
          fileID: avatarFileID,
          localPath: localPath
        };
      }
    } catch (error) {
      console.error('[UserCache] 获取头像缓存失败:', error);
    }
    return null;
  }
  
  /**
   * 检查是否有头像缓存
   * @returns {Boolean}
   */
  static hasAvatarCache() {
    return !!wx.getStorageSync(this.CACHE_KEYS.avatarFileID);
  }
  
  /**
   * 更新头像缓存（仅更新头像，不影响其他缓存）
   * @param {String} avatarFileID 新的头像文件ID
   */
  static async updateAvatarCache(avatarFileID) {
    try {
      console.log('[UserCache.updateAvatarCache] 开始更新头像缓存');
      console.log('[UserCache.updateAvatarCache] 新头像ID:', avatarFileID);
      
      // 缓存头像
      const localPath = await this.cacheAvatar(avatarFileID);
      
      // 触发全局头像更新事件
      const app = getApp();
      if (app && app.eventBus) {
        app.eventBus.emit(app.EVENTS.AVATAR_UPDATED, {
          fileID: avatarFileID,
          localPath: localPath,
          timestamp: Date.now(),
          source: 'UserCache'
        });
        console.log('[UserCache.updateAvatarCache] 已触发头像更新事件');
      }
      
      console.log('[UserCache.updateAvatarCache] 头像缓存更新完成');
    } catch (error) {
      console.error('[UserCache] 更新头像缓存失败:', error);
    }
  }
  
  /**
   * 更新缓存中的特定字段
   * @param {Object} updates 要更新的字段
   */
  static updateCache(updates) {
    const cachedData = this.getFromCache();
    if (cachedData) {
      // 合并更新
      const updatedData = { ...cachedData, ...updates };
      this.saveToCache(updatedData);
    }
  }
  
  /**
   * 检查缓存是否有效
   * @returns {Boolean}
   */
  static isCacheValid() {
    const cacheTime = wx.getStorageSync(this.CACHE_KEYS.cacheTime);
    if (!cacheTime) return false;
    
    const now = Date.now();
    return (now - cacheTime) <= this.CACHE_DURATION;
  }
  
  /**
   * 获取缓存剩余时间（分钟）
   * @returns {Number}
   */
  static getCacheRemainingTime() {
    const cacheTime = wx.getStorageSync(this.CACHE_KEYS.cacheTime);
    if (!cacheTime) return 0;
    
    const now = Date.now();
    const remaining = this.CACHE_DURATION - (now - cacheTime);
    
    return Math.max(0, Math.floor(remaining / (60 * 1000))); // 转换为分钟
  }
  
  /**
   * 下载并缓存云存储头像
   * @param {String} cloudFileID 云存储文件ID
   * @returns {Promise<String>} 本地缓存路径
   */
  static async downloadAndCacheAvatar(cloudFileID) {
    try {
      if (!cloudFileID || !cloudFileID.startsWith('cloud://')) {
        return null;
      }
      
      console.log('[UserCache.downloadAndCacheAvatar] 开始下载云存储头像:', cloudFileID);
      
      // 获取临时URL
      const tempUrlResult = await wx.cloud.getTempFileURL({
        fileList: [cloudFileID]
      });
      
      if (!tempUrlResult.fileList || tempUrlResult.fileList.length === 0) {
        console.error('[UserCache.downloadAndCacheAvatar] 获取临时URL失败');
        return null;
      }
      
      const tempUrl = tempUrlResult.fileList[0].tempFileURL;
      console.log('[UserCache.downloadAndCacheAvatar] 获取到临时URL:', tempUrl);
      
      // 下载文件
      const downloadResult = await wx.downloadFile({
        url: tempUrl
      });
      
      if (downloadResult.statusCode !== 200) {
        console.error('[UserCache.downloadAndCacheAvatar] 下载失败，状态码:', downloadResult.statusCode);
        return null;
      }
      
      console.log('[UserCache.downloadAndCacheAvatar] 下载成功，临时路径:', downloadResult.tempFilePath);
      
      // 保存到本地
      const savedFile = await wx.saveFile({
        tempFilePath: downloadResult.tempFilePath
      });
      
      console.log('[UserCache.downloadAndCacheAvatar] 保存到本地成功:', savedFile.savedFilePath);
      
      // 更新缓存
      wx.setStorageSync(this.CACHE_KEYS.avatarFileID, cloudFileID);
      wx.setStorageSync(this.CACHE_KEYS.userAvatar, savedFile.savedFilePath);
      wx.setStorageSync(this.CACHE_KEYS.avatarCacheTime, Date.now());
      
      // 触发全局头像更新事件
      const app = getApp();
      if (app && app.eventBus) {
        app.eventBus.emit(app.EVENTS.AVATAR_UPDATED, {
          fileID: cloudFileID,
          localPath: savedFile.savedFilePath,
          tempUrl: tempUrl,
          timestamp: Date.now(),
          source: 'UserCache.download'
        });
        console.log('[UserCache.downloadAndCacheAvatar] 已触发头像更新事件');
      }
      
      return savedFile.savedFilePath;
    } catch (error) {
      console.error('[UserCache.downloadAndCacheAvatar] 下载头像失败:', error);
      return null;
    }
  }
}

// 导出
module.exports = UserCache;