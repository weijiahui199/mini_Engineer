const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { action } = event
    
    switch (action) {
      case 'getUploadUrl':
        return await getUploadUrl(event, wxContext)
      case 'deleteFile':
        return await deleteFile(event, wxContext)
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        }
    }
  } catch (error) {
    console.error('文件上传云函数执行错误:', error)
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

// 获取上传URL
async function getUploadUrl(event, wxContext) {
  const { fileName, fileType, contentType } = event
  
  if (!fileName) {
    return {
      code: 400,
      message: '文件名不能为空'
    }
  }
  
  try {
    // 生成唯一的文件路径
    const now = new Date()
    const dateFolder = now.toISOString().slice(0, 10) // YYYY-MM-DD
    const randomStr = Math.random().toString(36).substring(2, 8)
    const timestamp = now.getTime()
    const fileExtension = fileName.split('.').pop()
    const uniqueFileName = `${timestamp}_${randomStr}.${fileExtension}`
    const cloudPath = `tickets/${dateFolder}/${uniqueFileName}`
    
    // 获取临时上传URL
    const result = await cloud.getTempFileURL({
      fileList: [cloudPath]
    })
    
    return {
      code: 200,
      data: {
        cloudPath,
        uploadUrl: result.fileList[0].tempFileURL,
        fileName: uniqueFileName,
        originalName: fileName
      }
    }
  } catch (error) {
    console.error('获取上传URL失败:', error)
    return {
      code: 500,
      message: '获取上传URL失败'
    }
  }
}

// 删除文件
async function deleteFile(event, wxContext) {
  const { cloudPaths } = event
  
  if (!cloudPaths || !Array.isArray(cloudPaths) || cloudPaths.length === 0) {
    return {
      code: 400,
      message: '文件路径不能为空'
    }
  }
  
  try {
    // 删除云存储文件
    const result = await cloud.deleteFile({
      fileList: cloudPaths
    })
    
    return {
      code: 200,
      message: '文件删除成功',
      data: result
    }
  } catch (error) {
    console.error('删除文件失败:', error)
    return {
      code: 500,
      message: '删除文件失败'
    }
  }
} 