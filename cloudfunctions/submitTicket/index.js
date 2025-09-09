const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 获取用户角色 - 从数据库查询真实角色，不依赖前端传递
async function getUserRole(openid) {
  try {
    const userResult = await db.collection('users').where({
      openid: openid
    }).limit(1).get()
    
    if (userResult.data.length > 0) {
      return userResult.data[0].roleGroup || '用户'
    }
    return '用户' // 默认为普通用户
  } catch (error) {
    console.error('获取用户角色失败:', error)
    return '用户' // 出错时默认为普通用户
  }
}

// 检查用户是否有工程师或经理权限
async function checkEngineerPermission(openid) {
  const role = await getUserRole(openid)
  return role === '工程师' || role === '经理'
}

// 检查用户是否有经理权限
async function checkManagerPermission(openid) {
  const role = await getUserRole(openid)
  return role === '经理'
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  console.log('[submitTicket] 收到请求:', {
    action: event.action,
    ticketId: event.ticketId,
    openid: wxContext.OPENID
  })
  
  try {
    const { action } = event
    
    console.log('[submitTicket] 处理action:', action)
    
    switch (action) {
      case 'submit':
        return await submitTicket(event, wxContext)
      case 'list':
        return await getTicketList(event, wxContext)
      case 'detail':
        return await getTicketDetail(event, wxContext)
      case 'update':
        return await updateTicket(event, wxContext)
      case 'updateStatus':
        return await updateTicketStatus(event, wxContext)
      case 'acceptTicket':
        return await acceptTicket(event, wxContext)
      case 'rejectTicket':
        return await rejectTicket(event, wxContext)
      case 'pauseTicket':
        return await pauseTicket(event, wxContext)
      case 'continueTicket':
        return await continueTicket(event, wxContext)
      case 'getTicketListByRole':
        return await getTicketListByRole(event, wxContext)
      case 'addRating':
        return await addRating(event, wxContext)
      case 'closeByUser':
        return await closeTicketByUser(event, wxContext)
      case 'cancelTicket':
        return await cancelTicket(event, wxContext)
      case 'getSubscriptionQuota':
        return await getSubscriptionQuota(event, wxContext)
      case 'checkSubscriptionQuota':
        return await getSubscriptionQuota(event, wxContext)
      case 'completeTicket':
        return await completeTicket(event, wxContext)
      case 'reopenTicket':
        return await reopenTicket(event, wxContext)
      default:
        console.error('[submitTicket] 无效的操作类型:', action)
        return {
          code: 400,
          message: `无效的操作类型: ${action}`
        }
    }
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

// 提交工单
async function submitTicket(event, wxContext) {
  const { title, company, department, phone, location, category, description, attachments } = event
  
  // 参数验证
  if (!title || !title.trim()) {
    return {
      code: 400,
      message: '问题标题不能为空'
    }
  }
  
  if (!company || !company.trim()) {
    return {
      code: 400,
      message: '单位/公司不能为空'
    }
  }
  
  if (!department || !department.trim()) {
    return {
      code: 400,
      message: '所属部门不能为空'
    }
  }
  
  if (!location || !location.trim()) {
    return {
      code: 400,
      message: '具体位置不能为空'
    }
  }
  
  if (!category) {
    return {
      code: 400,
      message: '问题类型不能为空'
    }
  }
  
  // 生成工单号
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '')
  const timeStr = now.getTime().toString().slice(-6)
  const ticketNo = `TK${dateStr}${timeStr}`
  
  try {
    // 获取提交者信息
    const userResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).limit(1).get()
    
    const submitterName = userResult.data[0]?.nickName || '用户'
    
    // 创建初始历史记录
    const firstHistory = {
      id: `ph_${Date.now()}`,
      action: 'created',
      operator: submitterName,
      operatorId: wxContext.OPENID,
      timestamp: new Date().toISOString(),
      description: '提交工单',
      reason: null
    }
    
    // 保存工单到数据库
    const result = await db.collection('tickets').add({
      data: {
        ticketNo,
        title: title.trim(),
        company: company.trim(),
        department: department.trim(),
        phone: phone ? phone.trim() : '',
        location: location.trim(),
        category,
        description: description ? description.trim() : '',
        attachments: attachments || [],
        status: 'pending',
        openid: wxContext.OPENID,
        submitterName: submitterName,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        // 新增处理历史字段
        processHistory: [firstHistory]
      }
    })
    
    return {
      code: 200,
      message: '工单提交成功',
      data: {
        ticketId: result._id,
        ticketNo
      }
    }
  } catch (error) {
    console.error('保存工单失败:', error)
    return {
      code: 500,
      message: '工单保存失败'
    }
  }
}

// 获取工单列表 - 支持新的权限模型
async function getTicketListByRole(event, wxContext) {
  const { page = 1, limit = 20, status, filter } = event
  const _ = db.command
  
  // 从数据库获取用户真实角色，不依赖前端传递
  const userRole = await getUserRole(wxContext.OPENID)
  
  let query
  
  // 根据真实角色构建查询条件
  if (userRole === '经理') {
    // 经理查看所有或筛选
    if (filter === 'my') {
      query = { assigneeOpenid: wxContext.OPENID }
    } else {
      query = {}
    }
  } else if (userRole === '工程师') {
    // 工程师查看工单池 + 自己的
    query = _.or([
      _.and([
        { status: 'pending' },
        _.or([
          { assigneeOpenid: _.exists(false) },
          { assigneeOpenid: '' }
        ])
      ]),
      { assigneeOpenid: wxContext.OPENID }
    ])
  } else {
    // 用户只看自己创建的
    query = { openid: wxContext.OPENID }
  }
  
  // 状态筛选
  if (status && status !== 'all') {
    query = _.and([query, { status: status }])
  }
  
  // 执行查询
  try {
    const countResult = await db.collection('tickets').where(query).count()
    const result = await db.collection('tickets')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    return {
      code: 200,
      data: {
        list: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('查询工单失败:', error)
    return {
      code: 500,
      message: '查询失败'
    }
  }
}

// 原始的获取工单列表方法（保留以便兼容）
async function getTicketList(event, wxContext) {
  const { page = 1, limit = 20, status = 'all', keyword = '' } = event
  
  try {
    let query = db.collection('tickets').where({
      openid: wxContext.OPENID
    })
    
    // 状态筛选
    if (status && status !== 'all') {
      query = query.where({
        status: status
      })
    }
    
    // 关键词搜索
    if (keyword && keyword.trim()) {
      query = query.where({
        title: db.RegExp({
          regexp: keyword.trim(),
          options: 'i'
        })
      })
    }
    
    // 分页和排序
    const result = await query
      .orderBy('createTime', 'desc')
      .skip((page - 1) * limit)
      .limit(limit)
      .get()
    
    // 获取总数
    const countResult = await query.count()
    
    return {
      code: 200,
      data: {
        list: result.data,
        total: countResult.total,
        page,
        limit
      }
    }
  } catch (error) {
    console.error('获取工单列表失败:', error)
    return {
      code: 500,
      message: '获取工单列表失败'
    }
  }
}

// 获取工单详情
async function getTicketDetail(event, wxContext) {
  const { ticketId } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  try {
    const result = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    // 验证工单所有权
    if (result.data.openid !== wxContext.OPENID) {
      return {
        code: 403,
        message: '无权访问此工单'
      }
    }
    
    return {
      code: 200,
      data: result.data
    }
  } catch (error) {
    console.error('获取工单详情失败:', error)
    return {
      code: 500,
      message: '获取工单详情失败'
    }
  }
}

// 更新工单（添加事务保护）
async function updateTicket(event, wxContext) {
  const { ticketId, title, company, department, phone, location, category, description, attachments } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  // 参数验证
  if (!title || !title.trim()) {
    return {
      code: 400,
      message: '问题标题不能为空'
    }
  }
  
  // 使用事务确保原子性操作
  const transaction = await db.startTransaction()
  
  try {
    // 在事务中检查工单是否存在且属于当前用户
    const existResult = await transaction.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!existResult.data) {
      await transaction.rollback()
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    if (existResult.data.openid !== wxContext.OPENID) {
      await transaction.rollback()
      return {
        code: 403,
        message: '无权修改此工单'
      }
    }
    
    // 检查工单状态是否允许修改
    // 只有待处理且未分配的工单才能修改基本信息
    if (existResult.data.status !== 'pending' || existResult.data.assigneeOpenid) {
      await transaction.rollback()
      return {
        code: 400,
        message: '只能修改待处理且未分配的工单'
      }
    }
    
    // 准备更新数据
    const updateData = {
      title: title.trim(),
      company: company.trim(),
      department: department.trim(),
      phone: phone ? phone.trim() : '',
      location: location.trim(),
      category,
      description: description ? description.trim() : '',
      attachments: attachments || [],
      updateTime: db.serverDate()
    }
    
    // 在事务中更新工单
    await transaction.collection('tickets')
      .doc(ticketId)
      .update({
        data: updateData
      })
    
    // 提交事务
    await transaction.commit()
    
    return {
      code: 200,
      message: '工单更新成功'
    }
    
  } catch (error) {
    // 回滚事务
    await transaction.rollback()
    console.error('更新工单失败:', error)
    return {
      code: 500,
      message: '工单更新失败',
      error: error.message
    }
  }
}

// 更新工单状态 - 增强版，支持更多场景（添加事务保护）
async function updateTicketStatus(event, wxContext) {
  const { ticketId, status, solution, reason, assigneeName } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  if (!status) {
    return {
      code: 400,
      message: '状态不能为空'
    }
  }
  
  // 验证状态值
  const validStatuses = ['pending', 'processing', 'resolved', 'cancelled', 'closed']
  if (!validStatuses.includes(status)) {
    return {
      code: 400,
      message: '无效的状态值'
    }
  }
  
  // 使用事务确保原子性操作
  const transaction = await db.startTransaction()
  
  try {
    // 在事务中检查工单是否存在
    const existResult = await transaction.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!existResult.data) {
      await transaction.rollback()
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    const ticket = existResult.data
    const currentStatus = ticket.status
    
    // 获取用户真实角色
    const userRole = await getUserRole(wxContext.OPENID)
    
    // 权限检查 - 根据不同场景判断
    // 1. 工单创建者可以取消
    // 2. 负责人可以更新状态
    // 3. 工程师/经理可以接单（pending -> processing）
    // 4. 经理可以操作任何工单
    const isOwner = ticket.openid === wxContext.OPENID
    const isAssignee = ticket.assigneeOpenid === wxContext.OPENID
    const isManager = userRole === '经理'
    const isEngineer = userRole === '工程师'
    
    // 特殊处理：状态转换权限
    if (currentStatus === 'pending' && status === 'processing') {
      if (!ticket.assigneeOpenid) {
        // 这是接单操作，只有工程师或经理可以接单
        if (!isEngineer && !isManager) {
          await transaction.rollback()
          return {
            code: 403,
            message: '只有工程师或经理可以接单'
          }
        }
      } else if (ticket.assigneeOpenid === wxContext.OPENID) {
        // 这是继续处理操作（从暂停恢复），只有负责人可以继续
      } else {
        // 其他人不能接已分配的工单，除非是经理
        if (!isManager) {
          await transaction.rollback()
          return {
            code: 403,
            message: '此工单已分配给其他工程师'
          }
        }
      }
    } else if (!isOwner && !isAssignee && !isManager) {
      // 其他情况需要是创建者、负责人或经理
      await transaction.rollback()
      return {
        code: 403,
        message: '无权修改此工单'
      }
    }
    
    // 检查状态转换是否合法 - 放宽限制
    const allowedTransitions = {
      'pending': ['processing', 'cancelled', 'resolved'], // 允许直接解决
      'processing': ['pending', 'resolved', 'cancelled'], // 允许暂停（回到pending）
      'resolved': ['closed', 'processing'], // 允许关闭或重新打开
      'cancelled': ['pending'], // 允许重新打开
      'closed': [] // 已关闭不能再转换
    }
    
    if (!allowedTransitions[currentStatus]?.includes(status)) {
      await transaction.rollback()
      return {
        code: 400,
        message: `无法从${currentStatus}状态转换为${status}状态`
      }
    }
    
    // 准备更新数据
    const updateData = {
      status: status,
      updateTime: db.serverDate()
    }
    
    // 根据不同状态添加相应字段
    if (status === 'processing') {
      // 只有第一次进入处理状态时才设置processTime
      if (!ticket.processTime) {
        updateData.processTime = db.serverDate()
      }
      
      // 如果是从pending接单（未分配的），添加负责人信息
      if (currentStatus === 'pending' && !ticket.assigneeOpenid) {
        updateData.assigneeOpenid = wxContext.OPENID
        updateData.assigneeName = assigneeName || '工程师'
        updateData.acceptTime = db.serverDate()
      }
      // 如果是从暂停状态恢复（pending但有assignee），只更新状态
      // 不需要更新assignee信息，保持原有的负责人
      
    } else if (status === 'pending' && currentStatus === 'processing') {
      // 暂停操作：从processing到pending，保留负责人信息
      // 不清空assigneeOpenid和assigneeName，这样可以区分暂停和真正的待处理
      updateData.pauseTime = db.serverDate()
      // 注意：不要清空assignee信息
      
    } else if (status === 'resolved') {
      // 获取操作者信息
      const userResult = await db.collection('users').where({
        openid: wxContext.OPENID
      }).limit(1).get()
      
      const operatorName = userResult.data[0]?.nickName || ticket.assigneeName || '工程师'
      
      // 创建解决历史记录
      const resolveHistory = {
        id: `ph_${Date.now()}`,
        action: 'resolved',
        operator: operatorName,
        operatorId: wxContext.OPENID,
        timestamp: new Date().toISOString(),
        description: '问题已解决',
        reason: null,
        solution: solution || null
      }
      
      updateData.resolveTime = db.serverDate()
      updateData.processHistory = db.command.push(resolveHistory)
      if (solution) {
        updateData.solution = solution
      }
    } else if (status === 'closed') {
      // 获取操作者信息
      const userResult = await db.collection('users').where({
        openid: wxContext.OPENID
      }).limit(1).get()
      
      const operatorName = userResult.data[0]?.nickName || ticket.assigneeName || '用户'
      
      // 创建关闭历史记录
      const closeHistory = {
        id: `ph_${Date.now()}`,
        action: 'closed',
        operator: operatorName,
        operatorId: wxContext.OPENID,
        timestamp: new Date().toISOString(),
        description: '工单已关闭',
        reason: null
      }
      
      updateData.closeTime = db.serverDate()
      updateData.processHistory = db.command.push(closeHistory)
    } else if (status === 'cancelled' && reason) {
      updateData.cancelReason = reason
      updateData.cancelTime = db.serverDate()
    }
    
    // 在事务中更新数据库
    await transaction.collection('tickets')
      .doc(ticketId)
      .update({
        data: updateData
      })
    
    // 提交事务
    await transaction.commit()
    
    return {
      code: 200,
      message: '状态更新成功',
      data: updateData
    }
  } catch (error) {
    // 回滚事务
    await transaction.rollback()
    console.error('更新工单状态失败:', error)
    return {
      code: 500,
      message: '状态更新失败',
      error: error.message
    }
  }
}

// 新增：安全接单方法
async function acceptTicket(event, wxContext) {
  console.log('[acceptTicket] 开始处理接单:', {
    ticketId: event.ticketId,
    openid: wxContext.OPENID
  })
  
  const { ticketId } = event
  const _ = db.command
  
  if (!ticketId) {
    console.error('[acceptTicket] 工单ID为空')
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  // 首先检查用户权限
  console.log('[acceptTicket] 检查用户权限...')
  const hasPermission = await checkEngineerPermission(wxContext.OPENID)
  console.log('[acceptTicket] 用户权限检查结果:', hasPermission)
  
  if (!hasPermission) {
    console.error('[acceptTicket] 用户无权限')
    return {
      code: 403,
      message: '只有工程师或经理可以接单'
    }
  }
  
  try {
    // 使用事务确保原子性
    const transaction = await db.startTransaction()
    
    try {
      // 查询当前状态
      const ticket = await transaction.collection('tickets').doc(ticketId).get()
      
      if (!ticket.data) {
        await transaction.rollback()
        return { code: 404, message: '工单不存在' }
      }
      
      // 检查是否已被分配
      if (ticket.data.assigneeOpenid) {
        await transaction.rollback()
        
        if (ticket.data.assigneeOpenid === wxContext.OPENID) {
          return { code: 200, message: '您已接单' }
        } else {
          return { code: 400, message: '工单已被其他工程师接单' }
        }
      }
      
      // 获取用户信息
      const userResult = await db.collection('users').where({
        openid: wxContext.OPENID
      }).limit(1).get()
      
      const userInfo = userResult.data[0] || {}
      const operatorName = userInfo.nickName || '工程师'
      
      // 创建接单历史记录
      const acceptHistory = {
        id: `ph_${Date.now()}`,
        action: 'accepted',
        operator: operatorName,
        operatorId: wxContext.OPENID,
        timestamp: new Date().toISOString(),
        description: '接单处理',
        reason: null
      }
      
      // 执行接单
      await transaction.collection('tickets').doc(ticketId).update({
        data: {
          assigneeOpenid: wxContext.OPENID,
          assigneeName: operatorName,
          status: 'processing',
          acceptTime: db.serverDate(),
          processTime: db.serverDate(),  // 接单时也是开始处理的时间
          updateTime: db.serverDate(),
          // 追加历史记录
          processHistory: db.command.push(acceptHistory)
        }
      })
      
      await transaction.commit()
      
      console.log('[acceptTicket] 接单成功:', {
        ticketId: ticketId,
        assigneeOpenid: wxContext.OPENID,
        assigneeName: operatorName
      })
      
      return {
        code: 200,
        message: '接单成功'
      }
      
    } catch (error) {
      await transaction.rollback()
      throw error
    }
    
  } catch (error) {
    console.error('接单失败:', error)
    return {
      code: 500,
      message: '接单失败',
      error: error.message
    }
  }
}

// 退回工单方法（添加事务保护）
async function rejectTicket(event, wxContext) {
  const { ticketId, reason } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  // 使用事务确保原子性操作
  const transaction = await db.startTransaction()
  
  try {
    // 在事务中查询工单确认状态和权限
    const ticketResult = await transaction.collection('tickets').doc(ticketId).get()
    
    if (!ticketResult.data) {
      await transaction.rollback()
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    const ticket = ticketResult.data
    
    // 检查是否是工单负责人
    if (ticket.assigneeOpenid !== wxContext.OPENID) {
      await transaction.rollback()
      return {
        code: 403,
        message: '只有工单负责人才能退回工单'
      }
    }
    
    // 检查工单状态，避免在已完成或已关闭的工单上执行退回
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      await transaction.rollback()
      return {
        code: 400,
        message: '已完成或已关闭的工单不能退回'
      }
    }
    
    // 获取操作者信息
    const userResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).limit(1).get()
    
    const operatorName = userResult.data[0]?.nickName || ticket.assigneeName || '工程师'
    
    // 创建退回历史记录
    const rejectHistory = {
      id: `ph_${Date.now()}`,
      action: 'rejected',
      operator: operatorName,
      operatorId: wxContext.OPENID,
      timestamp: new Date().toISOString(),
      description: '退回工单',
      reason: reason && reason.trim() ? reason.trim() : '未说明原因'
    }
    
    // 准备退回操作数据 - 清空负责人信息
    const updateData = {
      status: 'pending',
      assigneeOpenid: db.command.remove(),
      assigneeName: db.command.remove(),
      acceptTime: db.command.remove(),
      rejectTime: db.serverDate(),
      updateTime: db.serverDate(),
      // 追加历史记录
      processHistory: db.command.push(rejectHistory)
    }
    
    // 只有提供了退回原因才添加这个字段
    if (reason && reason.trim()) {
      updateData.rejectReason = reason.trim()
    }
    
    // 在事务中执行更新
    await transaction.collection('tickets').doc(ticketId).update({
      data: updateData
    })
    
    // 提交事务
    await transaction.commit()
    
    return {
      code: 200,
      message: '退回成功',
      data: {
        ticketId: ticketId,
        status: 'pending'
      }
    }
    
  } catch (error) {
    // 回滚事务
    await transaction.rollback()
    console.error('退回工单失败:', error)
    return {
      code: 500,
      message: '退回失败',
      error: error.message
    }
  }
}

// 暂停工单（添加事务保护）
async function pauseTicket(event, wxContext) {
  const { ticketId } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  // 使用事务确保原子性操作
  const transaction = await db.startTransaction()
  
  try {
    // 在事务中检查工单状态
    const ticket = await transaction.collection('tickets').doc(ticketId).get()
    
    if (!ticket.data) {
      await transaction.rollback()
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    // 检查权限：只有负责人或经理可以暂停
    const userRole = await getUserRole(wxContext.OPENID)
    const isAssignee = ticket.data.assigneeOpenid === wxContext.OPENID
    const isManager = userRole === '经理'
    
    if (!isAssignee && !isManager) {
      await transaction.rollback()
      return {
        code: 403,
        message: '只有负责人或经理可以暂停工单'
      }
    }
    
    // 检查状态：只有processing状态可以暂停
    if (ticket.data.status !== 'processing') {
      await transaction.rollback()
      return {
        code: 400,
        message: '只有处理中的工单可以暂停'
      }
    }
    
    // 获取操作者信息
    const userResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).limit(1).get()
    
    const operatorName = userResult.data[0]?.nickName || ticket.data.assigneeName || '工程师'
    
    // 创建暂停历史记录
    const pauseHistory = {
      id: `ph_${Date.now()}`,
      action: 'paused',
      operator: operatorName,
      operatorId: wxContext.OPENID,
      timestamp: new Date().toISOString(),
      description: '暂停处理',
      reason: null
    }
    
    // 在事务中更新为pending状态，但保留assignee信息
    await transaction.collection('tickets').doc(ticketId).update({
      data: {
        status: 'pending',
        pauseTime: db.serverDate(),
        updateTime: db.serverDate(),
        // 追加历史记录
        processHistory: db.command.push(pauseHistory)
        // 注意：保留assigneeOpenid和assigneeName
      }
    })
    
    // 提交事务
    await transaction.commit()
    
    return {
      code: 200,
      message: '工单已暂停'
    }
    
  } catch (error) {
    // 回滚事务
    await transaction.rollback()
    console.error('暂停工单失败:', error)
    return {
      code: 500,
      message: '暂停失败',
      error: error.message
    }
  }
}

// 继续处理工单（添加事务保护）
async function continueTicket(event, wxContext) {
  const { ticketId } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  // 使用事务确保原子性操作
  const transaction = await db.startTransaction()
  
  try {
    // 在事务中检查工单状态
    const ticket = await transaction.collection('tickets').doc(ticketId).get()
    
    if (!ticket.data) {
      await transaction.rollback()
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    // 检查权限：只有负责人或经理可以继续
    const userRole = await getUserRole(wxContext.OPENID)
    const isAssignee = ticket.data.assigneeOpenid === wxContext.OPENID
    const isManager = userRole === '经理'
    
    if (!isAssignee && !isManager) {
      await transaction.rollback()
      return {
        code: 403,
        message: '只有负责人或经理可以继续处理工单'
      }
    }
    
    // 检查状态：只有暂停状态（pending但有assignee）可以继续
    if (ticket.data.status !== 'pending' || !ticket.data.assigneeOpenid) {
      await transaction.rollback()
      return {
        code: 400,
        message: '只有暂停的工单可以继续处理'
      }
    }
    
    // 获取操作者信息
    const userResult = await db.collection('users').where({
      openid: wxContext.OPENID
    }).limit(1).get()
    
    const operatorName = userResult.data[0]?.nickName || ticket.data.assigneeName || '工程师'
    
    // 创建继续处理历史记录
    const continueHistory = {
      id: `ph_${Date.now()}`,
      action: 'processing',
      operator: operatorName,
      operatorId: wxContext.OPENID,
      timestamp: new Date().toISOString(),
      description: '继续处理',
      reason: null
    }
    
    // 准备更新数据
    const updateData = {
      status: 'processing',
      continueTime: db.serverDate(),
      updateTime: db.serverDate(),
      // 追加历史记录
      processHistory: db.command.push(continueHistory)
    }
    
    // 如果之前没有processTime，添加它
    if (!ticket.data.processTime) {
      updateData.processTime = db.serverDate()
    }
    
    // 在事务中更新为processing状态
    await transaction.collection('tickets').doc(ticketId).update({
      data: updateData
    })
    
    // 提交事务
    await transaction.commit()
    
    return {
      code: 200,
      message: '继续处理工单'
    }
    
  } catch (error) {
    // 回滚事务
    await transaction.rollback()
    console.error('继续处理工单失败:', error)
    return {
      code: 500,
      message: '操作失败',
      error: error.message
    }
  }
}

// ============ 以下是新增的评价、关闭、取消相关函数 ============

// 添加评价函数
async function addRating(event, wxContext) {
  const { ticketId, rating } = event
  const openid = wxContext.OPENID
  
  try {
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get()
    const ticket = ticketRes.data
    
    if (!ticket) {
      return { code: 404, message: '工单不存在' }
    }
    
    // 验证权限：必须是工单提交者
    if (ticket.openid !== openid) {
      return { code: 403, message: '只有工单提交者可以评价' }
    }
    
    // 验证工单状态
    if (ticket.status !== 'resolved') {
      return { code: 400, message: '只能评价已解决的工单' }
    }
    
    // 验证是否已评价
    if (ticket.rating && ticket.rating.ratedAt) {
      return { code: 400, message: '工单已评价，不能重复评价' }
    }
    
    // 构建评价数据
    const ratingData = {
      overall: rating.overall || 5,
      speed: rating.speed || 5,
      quality: rating.quality || 5,
      resolution: rating.resolution || 5,
      comment: rating.comment || '',
      ratedAt: new Date(),
      raterId: openid
    }
    
    // 更新工单评价信息并自动关闭工单
    await db.collection('tickets').doc(ticketId).update({
      data: {
        rating: ratingData,
        status: 'closed',  // 评价后自动关闭工单
        closedAt: db.serverDate(),
        closedBy: openid,
        closedReason: '用户评价后自动关闭',
        updateTime: db.serverDate()
      }
    })
    
    // 记录操作历史 - 包含评价和关闭两个事件
    await db.collection('tickets').doc(ticketId).update({
      data: {
        processHistory: db.command.push([
          {
            id: `ph_${Date.now()}`,
            action: 'rated',
            operator: '用户',
            operatorId: openid,
            description: `评分：${ratingData.overall}星`,
            timestamp: new Date().toISOString()
          },
          {
            id: `ph_${Date.now() + 1}`,
            action: 'closed',
            operator: '系统',
            operatorId: 'system',
            description: '评价完成后自动关闭',
            timestamp: new Date().toISOString()
          }
        ])
      }
    })
    
    return { 
      code: 200, 
      message: '评价成功，工单已自动关闭', 
      data: {
        ...ratingData,
        status: 'closed'
      }
    }
  } catch (error) {
    console.error('评价失败:', error)
    return { code: 500, message: '评价失败', error: error.message }
  }
}

// 用户关闭工单函数
async function closeTicketByUser(event, wxContext) {
  const { ticketId, skipRating = false } = event
  const openid = wxContext.OPENID
  
  try {
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get()
    const ticket = ticketRes.data
    
    if (!ticket) {
      return { code: 404, message: '工单不存在' }
    }
    
    // 验证权限
    if (ticket.openid !== openid) {
      return { code: 403, message: '只有工单提交者可以关闭工单' }
    }
    
    // 验证工单状态
    if (ticket.status !== 'resolved') {
      return { code: 400, message: '只能关闭已解决的工单' }
    }
    
    // 如果未评价且不跳过评价，则提示先评价
    if (!ticket.rating && !skipRating) {
      return { code: 400, message: '请先评价后再关闭工单' }
    }
    
    // 更新工单状态
    const updateData = {
      status: 'closed',
      closedAt: db.serverDate(),
      closedBy: openid,
      closedReason: skipRating ? '用户跳过评价' : '用户确认并评价',
      updateTime: db.serverDate()
    }
    
    // 如果跳过评价，添加默认评价
    if (skipRating && !ticket.rating) {
      updateData.rating = {
        overall: 5,
        speed: 5,
        quality: 5,
        resolution: 5,
        comment: '用户未评价',
        ratedAt: new Date(),
        isSkipped: true
      }
    }
    
    await db.collection('tickets').doc(ticketId).update({
      data: updateData
    })
    
    // 添加历史记录
    await db.collection('tickets').doc(ticketId).update({
      data: {
        processHistory: db.command.push({
          id: `ph_${Date.now()}`,
          action: 'closed',
          operator: '用户',
          operatorId: openid,
          description: skipRating ? '用户确认解决（未评价）' : '用户确认解决并已评价',
          timestamp: new Date().toISOString()
        })
      }
    })
    
    return { code: 200, message: '工单已关闭' }
  } catch (error) {
    console.error('关闭工单失败:', error)
    return { code: 500, message: '关闭失败', error: error.message }
  }
}

// 用户取消工单函数
async function cancelTicket(event, wxContext) {
  const { ticketId, reason } = event
  const openid = wxContext.OPENID
  
  try {
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get()
    const ticket = ticketRes.data
    
    if (!ticket) {
      return { code: 404, message: '工单不存在' }
    }
    
    // 验证权限：必须是工单提交者
    if (ticket.openid !== openid) {
      return { code: 403, message: '只有工单提交者可以取消' }
    }
    
    // 验证工单状态：只能取消pending或processing状态
    if (!['pending', 'processing'].includes(ticket.status)) {
      return { code: 400, message: '该状态的工单不能取消' }
    }
    
    // 更新工单状态
    await db.collection('tickets').doc(ticketId).update({
      data: {
        status: 'cancelled',
        cancelledAt: db.serverDate(),
        cancelledBy: openid,
        cancelReason: reason || '用户取消',
        updateTime: db.serverDate()
      }
    })
    
    // 记录操作历史
    await db.collection('tickets').doc(ticketId).update({
      data: {
        processHistory: db.command.push({
          id: `ph_${Date.now()}`,
          action: 'cancelled',
          operator: '用户',
          operatorId: openid,
          description: reason || '用户取消工单',
          timestamp: new Date().toISOString()
        })
      }
    })
    
    // 触发取消通知（如果有指派工程师）
    if (ticket.assigneeOpenid) {
      cloud.callFunction({
        name: 'sendNotification',
        data: {
          type: 'ticket_cancelled',
          ticketData: {
            title: ticket.title,  // 添加标题作为服务项目
            ticketNo: ticket.ticketNo,
            assigneeOpenid: ticket.assigneeOpenid,
            cancelReason: reason
          }
        }
      }).catch(err => {
        console.log('取消通知发送失败:', err)
      })
    }
    
    return { code: 200, message: '工单已取消' }
  } catch (error) {
    console.error('取消工单失败:', error)
    return { code: 500, message: '取消失败', error: error.message }
  }
}

// 完成工单函数（包装 updateStatus）
async function completeTicket(event, wxContext) {
  const { ticketId, solution } = event
  const openid = wxContext.OPENID
  
  try {
    // 检查工程师权限
    const hasPermission = await checkEngineerPermission(openid)
    if (!hasPermission) {
      return {
        code: 403,
        message: '只有工程师或经理可以完成工单'
      }
    }
    
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get()
    const ticket = ticketRes.data
    
    if (!ticket) {
      return { code: 404, message: '工单不存在' }
    }
    
    // 检查是否是负责人
    if (ticket.assigneeOpenid !== openid) {
      // 检查是否是经理
      const isManager = await checkManagerPermission(openid)
      if (!isManager) {
        return { code: 403, message: '只有工单负责人或经理可以完成工单' }
      }
    }
    
    // 检查工单状态
    if (!['pending', 'processing'].includes(ticket.status)) {
      return { code: 400, message: '只能完成待处理或处理中的工单' }
    }
    
    // 获取操作者信息
    const userResult = await db.collection('users').where({
      openid: openid
    }).limit(1).get()
    
    const operatorName = userResult.data[0]?.nickName || ticket.assigneeName || '工程师'
    
    // 使用 updateStatus 更新为 resolved
    const updateData = {
      status: 'resolved',
      resolveTime: db.serverDate(),
      updateTime: db.serverDate()
    }
    
    // 如果提供了解决方案，添加到更新数据中
    if (solution) {
      updateData.solution = solution
    }
    
    // 创建解决历史记录
    const resolveHistory = {
      id: `ph_${Date.now()}`,
      action: 'resolved',
      operator: operatorName,
      operatorId: openid,
      timestamp: new Date().toISOString(),
      description: '工单已解决',
      reason: null,
      solution: solution || null
    }
    
    // 更新工单
    await db.collection('tickets').doc(ticketId).update({
      data: {
        ...updateData,
        processHistory: db.command.push(resolveHistory)
      }
    })
    
    // 触发新工单通知给所有工程师（标记为resolved时通知）
    try {
      await cloud.callFunction({
        name: 'sendNotification',
        data: {
          type: 'new_ticket',
          ticketData: {
            ...ticket,
            _id: ticketId,
            title: ticket.title,
            ticketNo: ticket.ticketNo,
            submitterName: ticket.submitterName,
            phone: ticket.phone,
            location: ticket.location,
            company: ticket.company,
            solution: solution
          }
        }
      })
    } catch (notifyError) {
      console.log('通知发送失败，但不影响主流程:', notifyError)
    }
    
    return {
      code: 200,
      message: '工单已标记为解决',
      data: {
        status: 'resolved',
        solution: solution
      }
    }
  } catch (error) {
    console.error('完成工单失败:', error)
    return {
      code: 500,
      message: '完成工单失败',
      error: error.message
    }
  }
}

// 重新打开工单函数（包装 updateStatus）
async function reopenTicket(event, wxContext) {
  const { ticketId, reason } = event
  const openid = wxContext.OPENID
  
  try {
    // 检查工程师权限
    const hasPermission = await checkEngineerPermission(openid)
    if (!hasPermission) {
      return {
        code: 403,
        message: '只有工程师或经理可以重新打开工单'
      }
    }
    
    // 获取工单信息
    const ticketRes = await db.collection('tickets').doc(ticketId).get()
    const ticket = ticketRes.data
    
    if (!ticket) {
      return { code: 404, message: '工单不存在' }
    }
    
    // 检查是否是负责人
    if (ticket.assigneeOpenid !== openid) {
      // 检查是否是经理
      const isManager = await checkManagerPermission(openid)
      if (!isManager) {
        return { code: 403, message: '只有工单负责人或经理可以重新打开工单' }
      }
    }
    
    // 检查工单状态 - 只有 resolved 状态可以重新打开
    if (ticket.status !== 'resolved') {
      return { code: 400, message: '只能重新打开已解决的工单' }
    }
    
    // 获取操作者信息
    const userResult = await db.collection('users').where({
      openid: openid
    }).limit(1).get()
    
    const operatorName = userResult.data[0]?.nickName || ticket.assigneeName || '工程师'
    
    // 创建重新打开历史记录
    const reopenHistory = {
      id: `ph_${Date.now()}`,
      action: 'reopened',
      operator: operatorName,
      operatorId: openid,
      timestamp: new Date().toISOString(),
      description: '重新打开工单',
      reason: reason || '需要进一步处理'
    }
    
    // 更新工单状态为 processing
    await db.collection('tickets').doc(ticketId).update({
      data: {
        status: 'processing',
        reopenTime: db.serverDate(),
        updateTime: db.serverDate(),
        processHistory: db.command.push(reopenHistory)
      }
    })
    
    return {
      code: 200,
      message: '工单已重新打开',
      data: {
        status: 'processing'
      }
    }
  } catch (error) {
    console.error('重新打开工单失败:', error)
    return {
      code: 500,
      message: '重新打开工单失败',
      error: error.message
    }
  }
}

// 查询当前用户的订阅配额（未使用数量），供工程师端订阅提醒使用
async function getSubscriptionQuota(event, wxContext) {
  try {
    const where = {
      openid: wxContext.OPENID,
      used: false
    }

    // 总剩余配额
    const countResult = await db.collection('user_subscriptions').where(where).count()

    // 可选：按类型的明细（限制最多取前100条做统计，避免过大数据量）
    let breakdown = {}
    if (countResult.total > 0) {
      const limit = Math.min(100, countResult.total)
      const listRes = await db.collection('user_subscriptions')
        .where(where)
        .limit(limit)
        .get()
      listRes.data.forEach(rec => {
        const t = rec.type || 'unknown'
        breakdown[t] = (breakdown[t] || 0) + 1
      })
    }

    return {
      code: 200,
      message: '查询成功',
      quota: countResult.total || 0,
      breakdown
    }
  } catch (error) {
    console.error('查询订阅配额失败:', error)
    return {
      code: 500,
      message: '查询订阅配额失败',
      error: error.message
    }
  }
}
