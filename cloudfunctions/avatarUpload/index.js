// 云函数：头像上传管理
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, fileID, avatar } = event
  
  try {
    switch (action) {
      case 'uploadAvatar':
        return await uploadAvatar(event, wxContext)
      case 'deleteOldAvatar':
        return await deleteOldAvatar(event, wxContext)
      case 'getAvatarUrl':
        return await getAvatarUrl(event, wxContext)
      default:
        return {
          success: false,
          message: '无效的操作类型'
        }
    }
  } catch (error) {
    console.error('头像处理失败:', error)
    return {
      success: false,
      message: error.message
    }
  }
}

// 上传头像到云存储
async function uploadAvatar(event, wxContext) {
  const { tempFilePath, fileName } = event
  const openid = wxContext.OPENID
  
  if (!tempFilePath) {
    return {
      success: false,
      message: '缺少图片文件'
    }
  }
  
  try {
    // 获取文件扩展名
    const ext = fileName ? fileName.split('.').pop().toLowerCase() : 'png'
    
    // 确保是支持的图片格式
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp']
    if (!allowedExts.includes(ext)) {
      return {
        success: false,
        message: '不支持的图片格式'
      }
    }
    
    // 使用固定路径，实现覆盖更新
    const cloudPath = `avatars/${openid}.${ext}`
    
    // 获取用户之前的头像
    const userResult = await db.collection('users').where({
      openid: openid
    }).get()
    
    let oldAvatarUrl = null
    if (userResult.data.length > 0) {
      oldAvatarUrl = userResult.data[0].avatar
    }
    
    // 上传新头像到云存储
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: Buffer.from(tempFilePath, 'base64') // 如果是base64
    })
    
    // 更新数据库中的用户头像URL
    if (userResult.data.length > 0) {
      await db.collection('users').doc(userResult.data[0]._id).update({
        data: {
          avatar: uploadResult.fileID,
          avatarUpdateTime: db.serverDate()
        }
      })
    } else {
      // 新用户，创建记录
      await db.collection('users').add({
        data: {
          openid: openid,
          avatar: uploadResult.fileID,
          avatarUpdateTime: db.serverDate(),
          createTime: db.serverDate()
        }
      })
    }
    
    // 由于使用固定文件名覆盖，不需要删除旧文件
    // 云存储会自动覆盖同名文件
    
    return {
      success: true,
      fileID: uploadResult.fileID,
      cloudPath: cloudPath,
      message: '头像上传成功'
    }
    
  } catch (error) {
    console.error('上传头像失败:', error)
    return {
      success: false,
      message: '上传失败: ' + error.message
    }
  }
}

// 删除旧头像
async function deleteOldAvatar(event, wxContext) {
  const { fileID } = event
  const openid = wxContext.OPENID
  
  if (!fileID || !fileID.startsWith('cloud://')) {
    return {
      success: false,
      message: '无效的文件ID'
    }
  }
  
  try {
    // 验证用户权限（只能删除自己的头像）
    const userResult = await db.collection('users').where({
      openid: openid,
      avatar: fileID
    }).get()
    
    if (userResult.data.length === 0) {
      return {
        success: false,
        message: '无权删除此文件'
      }
    }
    
    // 删除云存储文件
    await cloud.deleteFile({
      fileList: [fileID]
    })
    
    return {
      success: true,
      message: '头像删除成功'
    }
  } catch (error) {
    console.error('删除头像失败:', error)
    return {
      success: false,
      message: '删除失败: ' + error.message
    }
  }
}

// 获取头像URL（生成临时访问链接）
async function getAvatarUrl(event, wxContext) {
  const { fileID } = event
  
  if (!fileID || !fileID.startsWith('cloud://')) {
    return {
      success: false,
      message: '无效的文件ID'
    }
  }
  
  try {
    // 获取临时链接
    const result = await cloud.getTempFileURL({
      fileList: [fileID]
    })
    
    if (result.fileList && result.fileList.length > 0) {
      return {
        success: true,
        tempFileURL: result.fileList[0].tempFileURL,
        fileID: fileID
      }
    } else {
      return {
        success: false,
        message: '获取链接失败'
      }
    }
  } catch (error) {
    console.error('获取头像URL失败:', error)
    return {
      success: false,
      message: '获取失败: ' + error.message
    }
  }
}