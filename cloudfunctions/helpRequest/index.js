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
      case 'createHelp':
        return await createHelp(event, wxContext)
      case 'listHelps':
        return await listHelps(event, wxContext)
      case 'respondHelp':
        return await respondHelp(event, wxContext)
      case 'closeHelp':
        return await closeHelp(event, wxContext)
      case 'getHelpDetail':
        return await getHelpDetail(event, wxContext)
      case 'getMyHelps':
        return await getMyHelps(event, wxContext)
      default:
        return {
          success: false,
          code: 400,
          message: '无效的操作类型'
        }
    }
  } catch (error) {
    console.error('求助管理云函数执行错误:', error)
    return {
      success: false,
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

// 创建求助
async function createHelp(event, wxContext) {
  const { 
    ticketId, 
    title, 
    description, 
    urgency = 'normal', // low, normal, high, urgent
    attachments = [],
    targetRole = 'all' // all, manager, engineer
  } = event
  
  try {
    // 获取求助者信息
    const userInfo = await getUserInfo(wxContext.OPENID)
    
    const helpData = {
      requesterId: wxContext.OPENID,
      requesterName: userInfo.name,
      requesterDepartment: userInfo.department,
      ticketId,
      title,
      description,
      urgency,
      targetRole,
      attachments,
      status: 'open', // open, responding, resolved, closed
      responses: [],
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }
    
    const result = await db.collection('helpRequests').add({
      data: helpData
    })
    
    // 发送通知给目标用户
    await notifyTargetUsers(targetRole, {
      type: 'new_help_request',
      helpId: result._id,
      title,
      urgency,
      requesterName: userInfo.name
    })
    
    return {
      success: true,
      code: 200,
      data: {
        helpId: result._id
      },
      message: '求助发送成功'
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '创建求助失败',
      error: error.message
    }
  }
}

// 获取求助列表
async function listHelps(event, wxContext) {
  const { 
    page = 1, 
    pageSize = 10, 
    status = 'all',
    urgency,
    onlyMine = false 
  } = event
  
  try {
    let whereCondition = {}
    
    // 筛选条件
    if (status !== 'all') {
      whereCondition.status = status
    }
    
    if (urgency) {
      whereCondition.urgency = urgency
    }
    
    if (onlyMine) {
      whereCondition.requesterId = wxContext.OPENID
    }
    
    // 获取用户角色，确定可见范围
    const userInfo = await getUserInfo(wxContext.OPENID)
    if (userInfo.role === 'engineer') {
      // 工程师只能看到发给所有人或工程师的求助
      whereCondition.targetRole = _.in(['all', 'engineer'])
    }
    
    // 获取总数
    const countResult = await db.collection('helpRequests')
      .where(whereCondition)
      .count()
    
    // 获取列表
    const result = await db.collection('helpRequests')
      .where(whereCondition)
      .orderBy('urgency', 'desc')
      .orderBy('createTime', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      code: 200,
      data: {
        helps: result.data,
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

// 响应求助
async function respondHelp(event, wxContext) {
  const { helpId, content, attachments = [] } = event
  
  try {
    // 获取响应者信息
    const userInfo = await getUserInfo(wxContext.OPENID)
    
    const response = {
      responderId: wxContext.OPENID,
      responderName: userInfo.name,
      responderRole: userInfo.role,
      content,
      attachments,
      createTime: db.serverDate()
    }
    
    // 更新求助记录
    const result = await db.collection('helpRequests')
      .doc(helpId)
      .update({
        data: {
          status: 'responding',
          responses: _.push(response),
          updateTime: db.serverDate()
        }
      })
    
    // 获取求助信息，通知求助者
    const help = await db.collection('helpRequests').doc(helpId).get()
    await sendNotification(help.data.requesterId, {
      type: 'help_response',
      helpId,
      responderName: userInfo.name,
      message: `${userInfo.name} 回复了您的求助`
    })
    
    return {
      success: true,
      code: 200,
      message: '回复成功'
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '回复失败',
      error: error.message
    }
  }
}

// 关闭求助
async function closeHelp(event, wxContext) {
  const { helpId, reason, resolved = true } = event
  
  try {
    // 检查权限（只有求助者可以关闭）
    const help = await db.collection('helpRequests').doc(helpId).get()
    if (help.data.requesterId !== wxContext.OPENID) {
      return {
        success: false,
        code: 403,
        message: '只有求助者可以关闭求助'
      }
    }
    
    // 更新状态
    await db.collection('helpRequests')
      .doc(helpId)
      .update({
        data: {
          status: resolved ? 'resolved' : 'closed',
          closeReason: reason,
          closeTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    
    // 通知所有响应者
    if (help.data.responses && help.data.responses.length > 0) {
      const responderIds = [...new Set(help.data.responses.map(r => r.responderId))]
      for (const responderId of responderIds) {
        await sendNotification(responderId, {
          type: 'help_closed',
          helpId,
          message: `求助"${help.data.title}"已${resolved ? '解决' : '关闭'}`
        })
      }
    }
    
    return {
      success: true,
      code: 200,
      message: '求助已关闭'
    }
  } catch (error) {
    return {
      success: false,
      code: 500,
      message: '关闭失败',
      error: error.message
    }
  }
}

// 获取求助详情
async function getHelpDetail(event, wxContext) {
  const { helpId } = event
  
  try {
    const result = await db.collection('helpRequests')
      .doc(helpId)
      .get()
    
    if (!result.data) {
      return {
        success: false,
        code: 404,
        message: '求助不存在'
      }
    }
    
    // 获取关联的工单信息
    let ticketInfo = null
    if (result.data.ticketId) {
      const ticket = await db.collection('tickets')
        .doc(result.data.ticketId)
        .field({
          ticketNumber: true,
          title: true,
          status: true
        })
        .get()
      ticketInfo = ticket.data
    }
    
    return {
      success: true,
      code: 200,
      data: {
        ...result.data,
        ticketInfo
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

// 获取我的求助（包括发出的和响应的）
async function getMyHelps(event, wxContext) {
  const { type = 'all' } = event // all, sent, responded
  
  try {
    let helps = []
    
    if (type === 'all' || type === 'sent') {
      // 获取我发出的求助
      const sentResult = await db.collection('helpRequests')
        .where({
          requesterId: wxContext.OPENID
        })
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()
      helps = helps.concat(sentResult.data.map(h => ({...h, type: 'sent'})))
    }
    
    if (type === 'all' || type === 'responded') {
      // 获取我响应过的求助
      const respondedResult = await db.collection('helpRequests')
        .where({
          'responses.responderId': wxContext.OPENID
        })
        .orderBy('updateTime', 'desc')
        .limit(20)
        .get()
      helps = helps.concat(respondedResult.data.map(h => ({...h, type: 'responded'})))
    }
    
    // 按时间排序
    helps.sort((a, b) => b.createTime - a.createTime)
    
    return {
      success: true,
      code: 200,
      data: helps
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
  return result.data[0] || { name: '未知用户', role: 'engineer' }
}

// 辅助函数：发送通知
async function sendNotification(toUserId, notification) {
  await db.collection('notifications').add({
    data: {
      toUser: toUserId,
      ...notification,
      read: false,
      createTime: db.serverDate()
    }
  })
}

// 辅助函数：通知目标用户群体
async function notifyTargetUsers(targetRole, notification) {
  let users = []
  
  if (targetRole === 'all') {
    // 通知所有用户
    users = await db.collection('users').get()
  } else if (targetRole === 'manager') {
    // 只通知经理
    users = await db.collection('users')
      .where({ role: 'manager' })
      .get()
  } else if (targetRole === 'engineer') {
    // 只通知工程师
    users = await db.collection('users')
      .where({ role: 'engineer' })
      .get()
  }
  
  // 批量发送通知
  for (const user of users.data) {
    await sendNotification(user.openid, notification)
  }
}