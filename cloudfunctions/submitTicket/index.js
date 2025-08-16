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
      case 'getTicketListByRole':
        return await getTicketListByRole(event, wxContext)
      default:
        return {
          code: 400,
          message: '无效的操作类型'
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
        createTime: db.serverDate(),
        updateTime: db.serverDate()
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
  const { page = 1, limit = 20, status, roleGroup, filter } = event
  const _ = db.command
  
  let query
  
  // 根据角色构建查询条件
  if (roleGroup === '经理') {
    // 经理查看所有或筛选
    if (filter === 'my') {
      query = { assigneeOpenid: wxContext.OPENID }
    } else {
      query = {}
    }
  } else if (roleGroup === '工程师') {
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

// 更新工单
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
  
  try {
    // 先检查工单是否存在且属于当前用户
    const existResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!existResult.data || existResult.data.openid !== wxContext.OPENID) {
      return {
        code: 403,
        message: '无权修改此工单'
      }
    }
    
    // 检查工单状态是否允许修改
    if (existResult.data.status !== 'pending') {
      return {
        code: 400,
        message: '只能修改待处理状态的工单'
      }
    }
    
    // 更新工单
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
    
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: updateData
      })
    
    return {
      code: 200,
      message: '工单更新成功'
    }
  } catch (error) {
    console.error('更新工单失败:', error)
    return {
      code: 500,
      message: '工单更新失败'
    }
  }
}

// 更新工单状态 - 增强版，支持更多场景
async function updateTicketStatus(event, wxContext) {
  const { ticketId, status, solution, reason, assigneeName } = event
  
  console.log('[updateTicketStatus] 开始执行')
  console.log('[updateTicketStatus] 参数:', {
    ticketId,
    status,
    solution,
    reason,
    assigneeName
  })
  
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
  const validStatuses = ['pending', 'processing', 'resolved', 'rated', 'cancelled', 'closed']
  if (!validStatuses.includes(status)) {
    return {
      code: 400,
      message: '无效的状态值'
    }
  }
  
  try {
    // 先检查工单是否存在
    const existResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!existResult.data) {
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    const ticket = existResult.data
    const currentStatus = ticket.status
    
    // 权限检查 - 根据不同场景判断
    // 1. 工单创建者可以取消
    // 2. 负责人可以更新状态
    // 3. 工程师可以接单（pending -> processing）
    const isOwner = ticket.openid === wxContext.OPENID
    const isAssignee = ticket.assigneeOpenid === wxContext.OPENID
    
    console.log('[updateTicketStatus] 权限检查:', {
      ticketId,
      currentStatus,
      newStatus: status,
      isOwner,
      isAssignee,
      ticketOpenid: ticket.openid,
      ticketAssignee: ticket.assigneeOpenid,
      requestOpenid: wxContext.OPENID
    })
    
    // 特殊处理：从pending到processing（接单操作）
    if (currentStatus === 'pending' && status === 'processing' && !ticket.assigneeOpenid) {
      // 这是接单操作，任何工程师都可以接
      console.log('[updateTicketStatus] 允许接单操作')
    } else if (!isOwner && !isAssignee) {
      // 其他情况需要是创建者或负责人
      console.log('[updateTicketStatus] 权限检查失败：不是创建者也不是负责人')
      return {
        code: 403,
        message: '无权修改此工单'
      }
    }
    
    // 检查状态转换是否合法 - 放宽限制
    const allowedTransitions = {
      'pending': ['processing', 'cancelled', 'resolved'], // 允许直接解决
      'processing': ['pending', 'resolved', 'cancelled'], // 允许暂停（回到pending）
      'resolved': ['rated', 'closed', 'processing'], // 允许重新打开
      'rated': ['closed'],
      'cancelled': ['pending'], // 允许重新打开
      'closed': []
    }
    
    if (!allowedTransitions[currentStatus]?.includes(status)) {
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
        console.log('[updateTicketStatus] 第一次进入处理状态，设置processTime')
      } else {
        console.log('[updateTicketStatus] 已有processTime，不覆盖:', ticket.processTime)
      }
      
      // 如果是从pending接单，添加负责人信息
      if (currentStatus === 'pending' && !ticket.assigneeOpenid) {
        updateData.assigneeOpenid = wxContext.OPENID
        updateData.assigneeName = assigneeName || '工程师'
        updateData.acceptTime = db.serverDate()
        console.log('[updateTicketStatus] 从pending接单，设置负责人信息')
      }
    } else if (status === 'resolved') {
      updateData.resolveTime = db.serverDate()
      if (solution) {
        updateData.solution = solution
      }
    } else if (status === 'closed') {
      updateData.closeTime = db.serverDate()
    } else if (status === 'cancelled' && reason) {
      updateData.cancelReason = reason
      updateData.cancelTime = db.serverDate()
    }
    
    console.log('[updateTicketStatus] 准备更新的数据:', updateData)
    
    // 更新数据库
    const updateResult = await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: updateData
      })
    
    console.log('[updateTicketStatus] 更新结果:', updateResult)
    console.log('[updateTicketStatus] 更新成功，返回数据:', updateData)
    
    return {
      code: 200,
      message: '状态更新成功',
      data: updateData
    }
  } catch (error) {
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
  const { ticketId } = event
  const _ = db.command
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
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
      
      // 执行接单
      await transaction.collection('tickets').doc(ticketId).update({
        data: {
          assigneeOpenid: wxContext.OPENID,
          assigneeName: userInfo.nickName || '工程师',
          status: 'processing',
          acceptTime: db.serverDate(),
          processTime: db.serverDate(),  // 接单时也是开始处理的时间
          updateTime: db.serverDate()
        }
      })
      
      await transaction.commit()
      
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

// 退回工单方法
async function rejectTicket(event, wxContext) {
  const { ticketId, reason } = event
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  console.log('[rejectTicket] 开始退回工单:', ticketId)
  console.log('[rejectTicket] 退回原因:', reason)
  console.log('[rejectTicket] 操作人:', wxContext.OPENID)
  
  try {
    // 先查询工单确认状态和权限
    const ticketResult = await db.collection('tickets').doc(ticketId).get()
    
    if (!ticketResult.data) {
      return {
        code: 404,
        message: '工单不存在'
      }
    }
    
    const ticket = ticketResult.data
    
    // 检查是否是工单负责人
    if (ticket.assigneeOpenid !== wxContext.OPENID) {
      console.log('[rejectTicket] 权限检查失败:', {
        assigneeOpenid: ticket.assigneeOpenid,
        currentOpenid: wxContext.OPENID
      })
      return {
        code: 403,
        message: '只有工单负责人才能退回工单'
      }
    }
    
    // 执行退回操作 - 清空负责人信息
    const updateData = {
      status: 'pending',
      assigneeOpenid: db.command.remove(),
      assigneeName: db.command.remove(),
      acceptTime: db.command.remove(),
      rejectTime: db.serverDate(),
      updateTime: db.serverDate()
    }
    
    // 只有提供了退回原因才添加这个字段
    if (reason && reason.trim()) {
      updateData.rejectReason = reason.trim()
    }
    
    console.log('[rejectTicket] 准备更新数据:', updateData)
    
    const updateResult = await db.collection('tickets').doc(ticketId).update({
      data: updateData
    })
    
    console.log('[rejectTicket] 更新结果:', updateResult)
    
    if (updateResult.stats.updated > 0) {
      return {
        code: 200,
        message: '退回成功',
        data: {
          ticketId: ticketId,
          status: 'pending'
        }
      }
    } else {
      return {
        code: 500,
        message: '退回失败，数据库更新失败'
      }
    }
    
  } catch (error) {
    console.error('[rejectTicket] 错误:', error)
    return {
      code: 500,
      message: '退回失败',
      error: error.message
    }
  }
} 