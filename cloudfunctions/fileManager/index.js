const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { action } = event
    
    switch (action) {
      case 'getTicketFiles':
        return await getTicketFiles(event, wxContext)
      case 'deleteFile':
        return await deleteFile(event, wxContext)
      case 'generateThumbnail':
        return await generateThumbnail(event, wxContext)
      case 'getFileInfo':
        return await getFileInfo(event, wxContext)
      case 'uploadSolution':
        return await uploadSolution(event, wxContext)
      case 'getStorageStats':
        return await getStorageStats(event, wxContext)
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        }
    }
  } catch (error) {
    console.error('文件管理云函数执行错误:', error)
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

// 获取工单相关文件
async function getTicketFiles(event, wxContext) {
  const { ticketId, fileType = 'all' } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  try {
    // 先验证工单权限
    const ticketResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!ticketResult.data || ticketResult.data.openid !== wxContext.OPENID) {
      return {
        code: 403,
        message: '无权访问此工单文件'
      }
    }
    
    const ticket = ticketResult.data
    let files = []
    
    // 获取工单附件
    if (fileType === 'all' || fileType === 'attachments') {
      files = files.concat(ticket.attachments || [])
    }
    
    // 获取解决方案文件
    if (fileType === 'all' || fileType === 'solutions') {
      const solutions = ticket.solutions || []
      solutions.forEach(solution => {
        solution.files?.forEach(file => {
          files.push({
            ...file,
            category: 'solution',
            engineerId: solution.engineerId,
            engineerName: solution.engineerName
          })
        })
      })
    }
    
    // 按上传时间倒序
    files.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime))
    
    return {
      code: 200,
      data: {
        ticketNo: ticket.ticketNo,
        files: files,
        statistics: {
          total: files.length,
          attachments: (ticket.attachments || []).length,
          solutions: files.filter(f => f.category === 'solution').length,
          totalSize: files.reduce((sum, file) => sum + (file.size || 0), 0)
        }
      }
    }
  } catch (error) {
    console.error('获取工单文件失败:', error)
    return {
      code: 500,
      message: '获取文件列表失败'
    }
  }
}

// 删除文件
async function deleteFile(event, wxContext) {
  const { ticketId, fileId } = event
  
  if (!ticketId || !fileId) {
    return {
      code: 400,
      message: '参数不完整'
    }
  }
  
  try {
    // 验证权限
    const ticketResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!ticketResult.data || ticketResult.data.openid !== wxContext.OPENID) {
      return {
        code: 403,
        message: '无权删除此文件'
      }
    }
    
    const ticket = ticketResult.data
    let fileToDelete = null
    let updatedAttachments = [...(ticket.attachments || [])]
    
    // 在附件中查找文件
    const attachmentIndex = updatedAttachments.findIndex(file => file.id === fileId)
    if (attachmentIndex >= 0) {
      fileToDelete = updatedAttachments[attachmentIndex]
      updatedAttachments.splice(attachmentIndex, 1)
    }
    
    if (!fileToDelete) {
      return {
        code: 404,
        message: '文件不存在'
      }
    }
    
    // 删除云存储文件
    try {
      await cloud.deleteFile({
        fileList: [fileToDelete.cloudPath]
      })
    } catch (deleteError) {
      console.warn('删除云存储文件失败:', deleteError)
      // 继续执行，更新数据库记录
    }
    
    // 更新数据库
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          attachments: updatedAttachments,
          updateTime: db.serverDate()
        }
      })
    
    return {
      code: 200,
      message: '文件删除成功'
    }
  } catch (error) {
    console.error('删除文件失败:', error)
    return {
      code: 500,
      message: '删除文件失败'
    }
  }
}

// 获取文件信息
async function getFileInfo(event, wxContext) {
  const { fileId } = event
  
  if (!fileId) {
    return {
      code: 400,
      message: '文件ID不能为空'
    }
  }
  
  try {
    // 通过cloudPath获取文件信息
    const result = await cloud.getTempFileURL({
      fileList: [fileId]
    })
    
    if (result.fileList && result.fileList.length > 0) {
      const fileInfo = result.fileList[0]
      return {
        code: 200,
        data: {
          fileID: fileInfo.fileID,
          tempFileURL: fileInfo.tempFileURL,
          maxAge: fileInfo.maxAge
        }
      }
    } else {
      return {
        code: 404,
        message: '文件不存在'
      }
    }
  } catch (error) {
    console.error('获取文件信息失败:', error)
    return {
      code: 500,
      message: '获取文件信息失败'
    }
  }
}

// 上传解决方案文件（工程师端使用）
async function uploadSolution(event, wxContext) {
  const { ticketId, engineerId, engineerName, files, description } = event
  
  if (!ticketId || !engineerId || !files || files.length === 0) {
    return {
      code: 400,
      message: '参数不完整'
    }
  }
  
  try {
    // 获取工单信息
    const ticketResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!ticketResult.data) {
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    const ticket = ticketResult.data
    const solutions = [...(ticket.solutions || [])]
    
    // 创建新的解决方案记录
    const solutionId = `sol_${Date.now()}`
    const newSolution = {
      id: solutionId,
      engineerId,
      engineerName,
      files: files.map(file => ({
        ...file,
        uploadTime: new Date().toISOString()
      })),
      description: description || '',
      createTime: new Date().toISOString()
    }
    
    solutions.push(newSolution)
    
    // 更新数据库
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          solutions: solutions,
          updateTime: db.serverDate()
        }
      })
    
    return {
      code: 200,
      message: '解决方案上传成功',
      data: {
        solutionId: solutionId
      }
    }
  } catch (error) {
    console.error('上传解决方案失败:', error)
    return {
      code: 500,
      message: '上传解决方案失败'
    }
  }
}

// 获取存储统计信息
async function getStorageStats(event, wxContext) {
  const { ticketId, dateRange } = event
  
  try {
    let query = db.collection('tickets')
    
    if (ticketId) {
      // 单个工单统计
      const result = await query.doc(ticketId).get()
      if (!result.data || result.data.openid !== wxContext.OPENID) {
        return { code: 403, message: '无权访问' }
      }
      
      return {
        code: 200,
        data: calculateTicketStorageStats(result.data)
      }
    } else {
      // 用户所有工单统计
      const result = await query.where({
        openid: wxContext.OPENID
      }).get()
      
      let totalStats = {
        totalTickets: result.data.length,
        totalFiles: 0,
        totalSize: 0,
        byType: {
          images: { count: 0, size: 0 },
          videos: { count: 0, size: 0 },
          documents: { count: 0, size: 0 }
        },
        byCategory: {}
      }
      
      result.data.forEach(ticket => {
        const stats = calculateTicketStorageStats(ticket)
        totalStats.totalFiles += stats.totalFiles
        totalStats.totalSize += stats.totalSize
        
        // 按类型统计
        Object.keys(stats.byType).forEach(type => {
          totalStats.byType[type].count += stats.byType[type].count
          totalStats.byType[type].size += stats.byType[type].size
        })
      })
      
      return {
        code: 200,
        data: totalStats
      }
    }
  } catch (error) {
    console.error('获取存储统计失败:', error)
    return {
      code: 500,
      message: '获取存储统计失败'
    }
  }
}

// 计算单个工单的存储统计
function calculateTicketStorageStats(ticket) {
  const attachments = ticket.attachments || []
  const solutions = ticket.solutions || []
  
  let stats = {
    ticketNo: ticket.ticketNo,
    totalFiles: 0,
    totalSize: 0,
    attachments: { count: 0, size: 0 },
    solutions: { count: 0, size: 0 },
    byType: {
      images: { count: 0, size: 0 },
      videos: { count: 0, size: 0 },
      documents: { count: 0, size: 0 }
    }
  }
  
  // 统计附件
  attachments.forEach(file => {
    stats.totalFiles++
    stats.totalSize += file.size || 0
    stats.attachments.count++
    stats.attachments.size += file.size || 0
    
    const type = file.type || 'documents'
    if (stats.byType[type]) {
      stats.byType[type].count++
      stats.byType[type].size += file.size || 0
    }
  })
  
  // 统计解决方案文件
  solutions.forEach(solution => {
    solution.files?.forEach(file => {
      stats.totalFiles++
      stats.totalSize += file.size || 0
      stats.solutions.count++
      stats.solutions.size += file.size || 0
      
      const type = file.type || 'documents'
      if (stats.byType[type]) {
        stats.byType[type].count++
        stats.byType[type].size += file.size || 0
      }
    })
  })
  
  return stats
} 