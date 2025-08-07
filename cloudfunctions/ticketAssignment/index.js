const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { action } = event
    
    switch (action) {
      case 'assignEngineer':
        return await assignEngineer(event, wxContext)
      case 'assignTicket':
        return await assignTicket(event, wxContext)
      case 'unassignTicket':
        return await unassignTicket(event, wxContext)
      case 'acceptTicket':
        return await acceptTicket(event, wxContext)
      case 'rejectTicket':
        return await rejectTicket(event, wxContext)
      case 'transferTicket':
        return await transferTicket(event, wxContext)
      case 'getAssignedTickets':
        return await getAssignedTickets(event, wxContext)
      case 'getAvailableEngineers':
        return await getAvailableEngineers(event, wxContext)
      default:
        return {
          success: false,
          code: 400,
          message: '无效的操作类型'
        }
    }
  } catch (error) {
    console.error('工单分配云函数执行错误:', error)
    return {
      success: false,
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

// 分配工单（简化版本，用于快速分配）
async function assignTicket(event, wxContext) {
  const { ticketId, engineerId, engineerName } = event
  
  try {
    // 检查权限（经理可以分配）
    const user = await getUserInfo(wxContext.OPENID)
    if (user.role !== 'manager' && user.roleGroup !== '经理') {
      return {
        success: false,
        code: 403,
        message: '无权限执行此操作'
      }
    }
    
    // 更新工单信息
    const result = await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          assignedTo: engineerId,
          assignedToName: engineerName,
          assignedBy: wxContext.OPENID,
          assignedTime: db.serverDate(),
          status: 'pending', // 保持pending状态，等待工程师接受
          updateTime: db.serverDate(),
          statusHistory: _.push({
            status: 'assigned',
            timestamp: db.serverDate(),
            operator: wxContext.OPENID,
            operatorName: user.name || user.displayName,
            comment: `分配给 ${engineerName}`
          })
        }
      })
    
    // 更新工程师任务数
    await updateEngineerTaskCount(engineerId, 1)
    
    // 发送通知给工程师
    await sendNotification(engineerId, {
      type: 'ticket_assigned',
      ticketId,
      message: `您有新的工单需要处理`
    })
    
    return {
      success: true,
      code: 200,
      message: '工单分配成功'
    }
  } catch (error) {
    console.error('分配工单失败:', error)
    return {
      success: false,
      code: 500,
      message: '分配失败',
      error: error.message
    }
  }
}

// 取消分配工单
async function unassignTicket(event, wxContext) {
  const { ticketId } = event
  
  try {
    // 检查权限
    const user = await getUserInfo(wxContext.OPENID)
    if (user.role !== 'manager' && user.roleGroup !== '经理') {
      return {
        success: false,
        code: 403,
        message: '无权限执行此操作'
      }
    }
    
    // 获取工单当前信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get()
    const ticket = ticketRes.data
    const previousEngineerId = ticket.assignedTo
    
    // 更新工单信息
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          assignedTo: _.remove(),
          assignedToName: _.remove(),
          assignedTime: _.remove(),
          updateTime: db.serverDate(),
          statusHistory: _.push({
            status: 'unassigned',
            timestamp: db.serverDate(),
            operator: wxContext.OPENID,
            operatorName: user.name || user.displayName,
            comment: '取消分配'
          })
        }
      })
    
    // 更新工程师任务数
    if (previousEngineerId) {
      await updateEngineerTaskCount(previousEngineerId, -1)
    }
    
    return {
      success: true,
      code: 200,
      message: '已取消分配'
    }
  } catch (error) {
    console.error('取消分配失败:', error)
    return {
      success: false,
      code: 500,
      message: '取消分配失败',
      error: error.message
    }
  }
}

// 分配工程师（经理权限）
async function assignEngineer(event, wxContext) {
  const { ticketId, engineerId, reason } = event
  
  try {
    // 检查权限
    const user = await getUserInfo(wxContext.OPENID)
    if (user.role !== 'manager' && user.roleGroup !== '经理') {
      return {
        success: false,
        code: 403,
        message: '无权限执行此操作'
      }
    }
    
    // 更新工单信息
    const result = await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          assignedTo: engineerId,
          assignedBy: wxContext.OPENID,
          assignedTime: db.serverDate(),
          status: 'assigned',
          statusHistory: _.push({
            status: 'assigned',
            timestamp: db.serverDate(),
            operator: wxContext.OPENID,
            comment: reason || '已分配给工程师'
          })
        }
      })
    
    // 更新工程师任务数
    await updateEngineerTaskCount(engineerId, 1)
    
    // 发送通知给工程师
    await sendNotification(engineerId, {
      type: 'ticket_assigned',
      ticketId,
      message: '您有新的工单需要处理'
    })
    
    return {
      success: true,
      code: 200,
      message: '工单分配成功'
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '分配失败',
      error: error.message
    }
  }
}

// 接受工单
async function acceptTicket(event, wxContext) {
  const { ticketId } = event
  
  try {
    // 检查工单是否分配给当前工程师
    const ticket = await db.collection('tickets').doc(ticketId).get()
    if (ticket.data.assignedTo !== wxContext.OPENID) {
      return {
        success: false,
        code: 403,
        message: '此工单未分配给您'
      }
    }
    
    // 更新工单状态
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          status: 'processing',
          acceptedTime: db.serverDate(),
          statusHistory: _.push({
            status: 'processing',
            timestamp: db.serverDate(),
            operator: wxContext.OPENID,
            comment: '工程师已接受工单'
          })
        }
      })
    
    return {
      success: true,
      code: 200,
      message: '工单接受成功'
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '接受失败',
      error: error.message
    }
  }
}

// 退回工单
async function rejectTicket(event, wxContext) {
  const { ticketId, reason } = event
  
  try {
    // 检查工单是否分配给当前工程师
    const ticket = await db.collection('tickets').doc(ticketId).get()
    if (ticket.data.assignedTo !== wxContext.OPENID) {
      return {
        success: false,
        code: 403,
        message: '此工单未分配给您'
      }
    }
    
    // 更新工单状态
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          status: 'pending',
          assignedTo: null,
          rejectedBy: wxContext.OPENID,
          rejectedTime: db.serverDate(),
          rejectedReason: reason,
          statusHistory: _.push({
            status: 'rejected',
            timestamp: db.serverDate(),
            operator: wxContext.OPENID,
            comment: reason || '工程师退回工单'
          })
        }
      })
    
    // 更新工程师任务数
    await updateEngineerTaskCount(wxContext.OPENID, -1)
    
    // 通知经理
    await notifyManagers({
      type: 'ticket_rejected',
      ticketId,
      engineerId: wxContext.OPENID,
      reason
    })
    
    return {
      success: true,
      code: 200,
      message: '工单已退回'
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '退回失败',
      error: error.message
    }
  }
}

// 转派工单
async function transferTicket(event, wxContext) {
  const { ticketId, toEngineerId, reason } = event
  
  try {
    // 检查权限（原工程师或经理可以转派）
    const ticket = await db.collection('tickets').doc(ticketId).get()
    const user = await getUserInfo(wxContext.OPENID)
    
    if (ticket.data.assignedTo !== wxContext.OPENID && user.role !== 'manager' && user.roleGroup !== '经理') {
      return {
        success: false,
        code: 403,
        message: '无权限转派此工单'
      }
    }
    
    const fromEngineerId = ticket.data.assignedTo
    
    // 更新工单
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          assignedTo: toEngineerId,
          transferredBy: wxContext.OPENID,
          transferredFrom: fromEngineerId,
          transferredTime: db.serverDate(),
          statusHistory: _.push({
            status: 'transferred',
            timestamp: db.serverDate(),
            operator: wxContext.OPENID,
            comment: reason || `工单转派给其他工程师`
          })
        }
      })
    
    // 更新工程师任务数
    if (fromEngineerId) {
      await updateEngineerTaskCount(fromEngineerId, -1)
    }
    await updateEngineerTaskCount(toEngineerId, 1)
    
    // 发送通知
    await sendNotification(toEngineerId, {
      type: 'ticket_transferred',
      ticketId,
      message: '您收到一个转派的工单'
    })
    
    return {
      success: true,
      code: 200,
      message: '工单转派成功'
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '转派失败',
      error: error.message
    }
  }
}

// 获取分配给我的工单
async function getAssignedTickets(event, wxContext) {
  const { page = 1, pageSize = 10, status } = event
  
  try {
    let whereCondition = {
      assignedTo: wxContext.OPENID
    }
    
    if (status) {
      whereCondition.status = status
    }
    
    // 获取总数
    const countResult = await db.collection('tickets')
      .where(whereCondition)
      .count()
    
    // 获取列表
    const result = await db.collection('tickets')
      .where(whereCondition)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      code: 200,
      data: {
        tickets: result.data,
        total: countResult.total,
        page,
        pageSize,
        totalPages: Math.ceil(countResult.total / pageSize)
      }
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '查询失败',
      error: error.message
    }
  }
}

// 获取可用的工程师列表（经理权限）
async function getAvailableEngineers(event, wxContext) {
  try {
    // 检查权限 - 放宽权限，允许所有用户查看（用于分配页面）
    // 如果需要严格权限控制，可以恢复下面的检查
    /*
    const user = await getUserInfo(wxContext.OPENID)
    if (user.role !== 'manager' && user.roleGroup !== '经理') {
      return {
        success: false,
        code: 403,
        message: '无权限查看工程师列表'
      }
    }
    */
    
    // 获取所有工程师和经理（经理也可以被分配工单）
    const result = await db.collection('users')
      .where(_.or([
        {
          role: 'engineer',
          'engineerInfo.workingStatus': _.in(['available', 'busy'])
        },
        {
          roleGroup: '经理',
          'engineerInfo.workingStatus': _.in(['available', 'busy'])
        },
        {
          roleGroup: '工程师',
          'engineerInfo.workingStatus': _.in(['available', 'busy'])
        }
      ]))
      .field({
        openid: true,
        name: true,
        department: true,
        engineerInfo: true,
        avatar: true,
        roleGroup: true
      })
      .get()
    
    // 计算每个工程师的负载
    const engineers = result.data.map(engineer => {
      // 确保 engineerInfo 存在
      const engineerInfo = engineer.engineerInfo || {
        currentTasks: 0,
        maxTasks: 10
      }
      
      return {
        ...engineer,
        displayName: `${engineer.name}${engineer.roleGroup === '经理' ? ' (经理)' : ''}`,
        workload: engineerInfo.currentTasks / engineerInfo.maxTasks,
        canAssign: engineerInfo.currentTasks < engineerInfo.maxTasks
      }
    })
    
    // 按负载排序，负载低的优先
    engineers.sort((a, b) => a.workload - b.workload)
    
    return {
      success: true,
      code: 200,
      data: engineers
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '查询失败',
      error: error.message
    }
  }
}

// 辅助函数：获取用户信息
async function getUserInfo(openid) {
  const result = await db.collection('users')
    .where({ openid })
    .get()
  return result.data[0] || null
}

// 辅助函数：更新工程师任务数
async function updateEngineerTaskCount(engineerId, delta) {
  await db.collection('users')
    .where({ openid: engineerId })
    .update({
      data: {
        'engineerInfo.currentTasks': _.inc(delta)
      }
    })
}

// 辅助函数：发送通知
async function sendNotification(toUserId, notification) {
  // 这里可以集成微信订阅消息或其他通知方式
  await db.collection('notifications').add({
    data: {
      toUser: toUserId,
      ...notification,
      read: false,
      createTime: db.serverDate()
    }
  })
}

// 辅助函数：通知所有经理
async function notifyManagers(notification) {
  const managers = await db.collection('users')
    .where({ role: 'manager' })
    .get()
  
  for (const manager of managers.data) {
    await sendNotification(manager.openid, notification)
  }
}