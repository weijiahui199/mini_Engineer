// 头像管理工具
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
  
  if (!openid) {
    throw new Error('用户未登录')
  }
  
  // 生成云存储路径
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const timestamp = date.getTime()
  const ext = filePath.split('.').pop().toLowerCase() || 'jpg'
  
  const cloudPath = `user-avatars/${year}/${month}/${openid}_${timestamp}.${ext}`
  
  try {
    // 直接上传文件到云存储
    const uploadResult = await wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath
    })
    
    console.log('上传成功:', {
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
      
      // 删除旧头像（如果是云存储文件）
      if (oldAvatarUrl && oldAvatarUrl.startsWith('cloud://')) {
        deleteOldAvatar(oldAvatarUrl)
      }
      
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