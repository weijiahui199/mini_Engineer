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
      case 'pauseTicket':
        return await pauseTicket(event, wxContext)
      case 'continueTicket':
        return await continueTicket(event, wxContext)
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
  const validStatuses = ['pending', 'processing', 'resolved', 'rated', 'cancelled', 'closed']
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
      'resolved': ['rated', 'closed', 'processing'], // 允许重新打开
      'rated': ['closed'],
      'cancelled': ['pending'], // 允许重新打开
      'closed': []
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
  const { ticketId } = event
  const _ = db.command
  
  if (!ticketId) {
    return {
      code: 400,
      message: '工单ID不能为空'
    }
  }
  
  // 首先检查用户权限
  const hasPermission = await checkEngineerPermission(wxContext.OPENID)
  if (!hasPermission) {
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