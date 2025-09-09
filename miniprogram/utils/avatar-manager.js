/**
 * 头像管理工具
 * 统一处理头像上传、更新、缓存
 * 使用固定文件名实现覆盖更新，节省存储空间
 */

const NetworkHandler = require('./network-handler');
const UserCache = require('./user-cache');

class AvatarManager {
  /**
   * 更新用户头像
   * @param {string} tempFilePath - 临时文件路径
   * @param {string} openid - 用户openid
   * @returns {Promise<{success: boolean, fileID?: string, error?: string}>}
   */
  static async updateAvatar(tempFilePath, openid) {
    if (!tempFilePath || !openid) {
      return {
        success: false,
        error: '缺少必要参数'
      };
    }

    try {
      // 1. 检查网络状态
      if (!NetworkHandler.isNetworkConnected()) {
        throw new Error('网络未连接');
      }

      // 2. 上传到云存储（覆盖模式）
      const cloudPath = `avatars/${openid}.png`;
      console.log('[AvatarManager] 上传头像，使用覆盖模式:', cloudPath);
      
      const uploadRes = await NetworkHandler.uploadFileWithRetry({
        cloudPath,
        filePath: tempFilePath
      });

      if (!uploadRes || !uploadRes.fileID) {
        throw new Error('上传失败，未获得文件ID');
      }

      // 3. 更新数据库（通过云函数）
      const updateRes = await NetworkHandler.callFunctionWithRetry({
        name: 'userProfile',
        data: {
          action: 'updateUserProfile',
          avatar: uploadRes.fileID
        }
      });

      if (!updateRes.result || updateRes.result.code !== 200) {
        throw new Error(updateRes.result?.message || '数据库更新失败');
      }

      // 获取版本号
      const avatarVersion = updateRes.result.data?.avatarVersion || Date.now();

      // 4. 更新本地缓存（包含版本号）
      await UserCache.updateAvatarCache(uploadRes.fileID);

      // 5. 更新全局数据
      const app = getApp();
      if (app.globalData.userInfo) {
        app.globalData.userInfo.avatar = uploadRes.fileID;
        app.globalData.userInfo.avatarVersion = avatarVersion;
      }

      // 6. 更新本地存储
      const userInfo = wx.getStorageSync('userInfo') || {};
      userInfo.avatar = uploadRes.fileID;
      userInfo.avatarVersion = avatarVersion;
      wx.setStorageSync('userInfo', userInfo);

      console.log('[AvatarManager] 头像更新成功:', uploadRes.fileID, '版本:', avatarVersion);

      // 生成用于展示的临时URL（统一工具函数，带版本参数）
      const { getDisplayUrl } = require('./display-url');
      const displayUrl = await getDisplayUrl(uploadRes.fileID, avatarVersion);
      
      return {
        success: true,
        fileID: uploadRes.fileID,
        avatarVersion: avatarVersion,
        avatarUrlWithVersion: displayUrl
      };

    } catch (error) {
      console.error('[AvatarManager] 头像更新失败:', error);
      return {
        success: false,
        error: error.message || '更新失败'
      };
    }
  }

  /**
   * 处理头像选择事件
   * @param {object} event - 微信选择头像事件
   * @param {object} options - 配置选项
   * @returns {Promise<{success: boolean, fileID?: string}>}
   */
  static async handleChooseAvatar(event, options = {}) {
    const { avatarUrl } = event.detail;
    const { 
      openid,
      onSuccess = () => {},
      onError = () => {},
      showLoading = true
    } = options;

    if (!avatarUrl) {
      console.error('[AvatarManager] 未选择头像');
      return { success: false };
    }

    if (!openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return { success: false };
    }

    if (showLoading) {
      wx.showLoading({ title: '上传中...' });
    }

    try {
      // 处理临时文件
      let filePath = avatarUrl;
      if (avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp/')) {
        try {
          const savedFile = await wx.saveFile({
            tempFilePath: avatarUrl
          });
          filePath = savedFile.savedFilePath;
        } catch (e) {
          console.warn('[AvatarManager] 保存临时文件失败，使用原路径');
        }
      }

      // 更新头像
      const result = await this.updateAvatar(filePath, openid);
      
      if (result.success) {
        if (showLoading) {
          wx.hideLoading();
        }
        wx.showToast({
          title: '头像更新成功',
          icon: 'success'
        });
        onSuccess(result.avatarUrlWithVersion || result.fileID);
      } else {
        throw new Error(result.error);
      }

      return result;

    } catch (error) {
      if (showLoading) {
        wx.hideLoading();
      }
      
      // 显示错误提示
      NetworkHandler.showErrorDialog(error, {
        title: '头像更新失败',
        confirmText: '重试',
        cancelText: '取消',
        onConfirm: () => {
          // 重试
          this.handleChooseAvatar(event, options);
        },
        onCancel: onError
      });

      return { success: false };
    }
  }

  /**
   * 获取头像URL（处理缓存问题）
   * @param {string} fileID - 云存储文件ID
   * @param {number} version - 头像版本号
   * @returns {string}
   */
  static getAvatarURL(fileID, version) {
    if (!fileID) return '';
    
    // 如果有版本号，添加版本参数
    if (version) {
      const separator = fileID.includes('?') ? '&' : '?';
      return `${fileID}${separator}v=${version}`;
    }
    
    return fileID;
  }

  /**
   * 从用户信息构建头像URL
   * @param {object} userInfo - 用户信息对象
   * @returns {string}
   */
  static getAvatarFromUserInfo(userInfo) {
    if (!userInfo || !userInfo.avatar) return '';
    
    // 如果有版本号，使用版本号
    if (userInfo.avatarVersion) {
      return this.getAvatarURL(userInfo.avatar, userInfo.avatarVersion);
    }
    
    // 否则直接返回
    return userInfo.avatar;
  }
}

module.exports = AvatarManager;
// 处理头像选择、压缩、上传等功能

/**
 * 选择并上传头像
 * @param {Object} options 配置选项
 * @returns {Promise} 返回上传结果
 */
async function chooseAndUploadAvatar(options = {}) {
  const {
    maxSize = 400,        // 最大尺寸（宽高）
    quality = 0.8,        // 压缩质量
    sourceType = ['album', 'camera']  // 图片来源
  } = options
  
  try {
    // 1. 选择图片
    const chooseResult = await wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: sourceType
    })
    
    if (!chooseResult.tempFilePaths || chooseResult.tempFilePaths.length === 0) {
      throw new Error('未选择图片')
    }
    
    const tempFilePath = chooseResult.tempFilePaths[0]
    
    // 2. 获取图片信息
    const imageInfo = await wx.getImageInfo({
      src: tempFilePath
    })
    
    // 3. 压缩图片
    const compressedPath = await compressImage(tempFilePath, {
      maxSize: maxSize,
      quality: quality,
      width: imageInfo.width,
      height: imageInfo.height
    })
    
    // 4. 上传到云存储
    const uploadResult = await uploadToCloud(compressedPath)
    
    // 5. 触发头像更新事件
    const app = getApp()
    if (app && app.eventBus) {
      // 获取临时URL以便立即显示
      const tempUrl = await getTempAvatarUrl(uploadResult.fileID)
      
      app.eventBus.emit(app.EVENTS.AVATAR_UPDATED, {
        fileID: uploadResult.fileID,
        tempUrl: tempUrl,
        localPath: compressedPath,
        timestamp: Date.now()
      })
      console.log('[AvatarManager] 已触发头像更新事件')
    }
    
    return {
      success: true,
      fileID: uploadResult.fileID,
      tempFilePath: compressedPath,
      originalInfo: imageInfo
    }
    
  } catch (error) {
    console.error('选择并上传头像失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 压缩图片
 * @param {String} filePath 原始图片路径
 * @param {Object} options 压缩选项
 * @returns {Promise} 返回压缩后的图片路径
 */
function compressImage(filePath, options = {}) {
  return new Promise((resolve, reject) => {
    const {
      maxSize = 400,
      quality = 0.8,
      width = 0,
      height = 0
    } = options
    
    // 计算压缩后的尺寸
    let targetWidth = width
    let targetHeight = height
    
    if (width > maxSize || height > maxSize) {
      const ratio = Math.min(maxSize / width, maxSize / height)
      targetWidth = Math.floor(width * ratio)
      targetHeight = Math.floor(height * ratio)
    }
    
    // 如果图片已经很小，直接返回
    if (targetWidth === width && targetHeight === height) {
      resolve(filePath)
      return
    }
    
    // 压缩图片
    wx.compressImage({
      src: filePath,
      quality: quality * 100,
      compressedWidth: targetWidth,
      compressedHeight: targetHeight,
      success: (res) => {
        console.log('图片压缩成功:', {
          原始尺寸: `${width}x${height}`,
          压缩后尺寸: `${targetWidth}x${targetHeight}`,
          原始路径: filePath,
          压缩后路径: res.tempFilePath
        })
        resolve(res.tempFilePath)
      },
      fail: (error) => {
        console.error('图片压缩失败:', error)
        // 压缩失败时返回原图
        resolve(filePath)
      }
    })
  })
}

/**
 * 上传图片到云存储
 * @param {String} filePath 图片本地路径
 * @returns {Promise} 返回上传结果
 */
async function uploadToCloud(filePath) {
  const app = getApp()
  const openid = app.globalData.openid
  const db = app.globalData.db
  
  if (!openid) {
    throw new Error('用户未登录')
  }
  
  try {
    // 获取用户信息以获取用户ID
    const userResult = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (userResult.data.length === 0) {
      throw new Error('用户信息不存在')
    }
    
    const userId = userResult.data[0]._id
    const oldAvatarUrl = userResult.data[0].avatar
    
    // 使用用户ID作为文件名，避免重复存储
    const ext = filePath.split('.').pop().toLowerCase() || 'jpg'
    const cloudPath = `user-avatars/${userId}.${ext}`
    
    // 如果存在旧头像且路径不同，先删除旧头像
    if (oldAvatarUrl && oldAvatarUrl.startsWith('cloud://')) {
      // 提取旧文件的路径
      const oldCloudPath = oldAvatarUrl.split('/').slice(3).join('/')
      if (oldCloudPath !== cloudPath) {
        console.log('删除旧头像:', oldAvatarUrl)
        try {
          await wx.cloud.deleteFile({
            fileList: [oldAvatarUrl]
          })
        } catch (error) {
          console.error('删除旧头像失败:', error)
          // 删除失败不影响上传
        }
      }
    }
    
    // 上传新头像（会覆盖同名文件）
    const uploadResult = await wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath
    })
    
    console.log('上传成功:', {
      userId: userId,
      cloudPath: cloudPath,
      fileID: uploadResult.fileID
    })
    
    // 更新用户数据库记录
    await updateUserAvatar(uploadResult.fileID)
    
    return {
      success: true,
      fileID: uploadResult.fileID,
      cloudPath: cloudPath
    }
  } catch (error) {
    console.error('上传到云存储失败:', error)
    throw error
  }
}

/**
 * 更新用户头像记录
 * @param {String} avatar 新的头像URL
 * @returns {Promise}
 */
async function updateUserAvatar(avatar) {
  const app = getApp()
  const db = app.globalData.db
  const openid = app.globalData.openid
  
  if (!db || !openid) {
    throw new Error('数据库未初始化或用户未登录')
  }
  
  try {
    // 查询用户记录
    const userResult = await db.collection('users').where({
      openid: openid
    }).get()
    
    if (userResult.data.length > 0) {
      // 获取旧头像URL
      const oldAvatarUrl = userResult.data[0].avatar
      
      // 更新用户头像
      await db.collection('users').doc(userResult.data[0]._id).update({
        data: {
          avatar: avatar,
          avatarUpdateTime: db.serverDate()
        }
      })
      
      // 旧头像已在uploadToCloud中处理，这里不需要再删除
      
      console.log('用户头像更新成功')
    } else {
      console.error('用户记录不存在')
    }
  } catch (error) {
    console.error('更新用户头像失败:', error)
    throw error
  }
}

/**
 * 删除旧头像
 * @param {String} fileID 云存储文件ID
 */
async function deleteOldAvatar(fileID) {
  if (!fileID || !fileID.startsWith('cloud://')) {
    return
  }
  
  try {
    await wx.cloud.deleteFile({
      fileList: [fileID]
    })
    console.log('旧头像删除成功:', fileID)
  } catch (error) {
    console.error('删除旧头像失败:', error)
    // 删除失败不影响主流程
  }
}

/**
 * 获取头像临时URL
 * @param {String} fileID 云存储文件ID
 * @returns {Promise} 返回临时URL
 */
async function getTempAvatarUrl(fileID) {
  if (!fileID || !fileID.startsWith('cloud://')) {
    return fileID // 如果不是云存储文件，直接返回
  }
  
  try {
    const result = await wx.cloud.getTempFileURL({
      fileList: [fileID]
    })
    
    if (result.fileList && result.fileList.length > 0) {
      return result.fileList[0].tempFileURL
    }
    return fileID
  } catch (error) {
    console.error('获取临时URL失败:', error)
    return fileID
  }
}

// 导出函数
module.exports = {
  chooseAndUploadAvatar,
  compressImage,
  uploadToCloud,
  updateUserAvatar,
  deleteOldAvatar,
  getTempAvatarUrl
}
