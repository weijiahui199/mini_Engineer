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
      // 原有功能
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
      // 新增工程师端功能
      case 'assign':
        return await assignTicket(event, wxContext)
      case 'listForEngineer':
        return await getEngineerTicketList(event, wxContext)
      case 'listForManager':
        return await getManagerTicketList(event, wxContext)
      case 'startProcess':
        return await startProcessTicket(event, wxContext)
      case 'completeTicket':
        return await completeTicket(event, wxContext)
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

// 原有功能保持不变...（这里省略原有代码）

// 新增：分配工单（经理专用）
async function assignTicket(event, wxContext) {
  const { ticketId, assignedTo, notes } = event
  
  if (!ticketId) {
    return { code: 400, message: '工单ID不能为空' }
  }
  
  if (!assignedTo) {
    return { code: 400, message: '被分配工程师不能为空' }
  }
  
  try {
    // 检查用户权限
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    if (!userResult.data.length || userResult.data[0].role !== 'manager') {
      return { code: 403, message: '无权限执行此操作' }
    }
    
    // 检查工单状态
    const ticketResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!ticketResult.data) {
      return { code: 404, message: '工单不存在' }
    }
    
    if (ticketResult.data.status !== 'pending') {
      return { code: 400, message: '只能分配待处理的工单' }
    }
    
    // 更新工单
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          status: 'assigned',
          assignedTo: assignedTo,
          assignedBy: wxContext.OPENID,
          assignTime: db.serverDate(),
          assignNotes: notes || '',
          updateTime: db.serverDate()
        }
      })
    
    return {
      code: 200,
      message: '工单分配成功'
    }
  } catch (error) {
    console.error('分配工单失败:', error)
    return { code: 500, message: '分配工单失败' }
  }
}

// 新增：获取工程师工单列表
async function getEngineerTicketList(event, wxContext) {
  const { page = 1, limit = 20, status = 'all' } = event
  
  try {
    let query = db.collection('tickets').where({
      assignedTo: wxContext.OPENID
    })
    
    // 状态筛选
    if (status && status !== 'all') {
      query = query.where({ status: status })
    }
    
    // 分页和排序
    const result = await query
      .orderBy('assignTime', 'desc')
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
    console.error('获取工程师工单列表失败:', error)
    return { code: 500, message: '获取工单列表失败' }
  }
}

// 新增：获取经理工单列表（所有工单）
async function getManagerTicketList(event, wxContext) {
  const { page = 1, limit = 20, status = 'all', assignee = 'all' } = event
  
  try {
    // 检查权限
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    if (!userResult.data.length || userResult.data[0].role !== 'manager') {
      return { code: 403, message: '无权限执行此操作' }
    }
    
    let query = db.collection('tickets')
    
    // 状态筛选
    if (status && status !== 'all') {
      query = query.where({ status: status })
    }
    
    // 分配人筛选
    if (assignee && assignee !== 'all') {
      if (assignee === 'unassigned') {
        query = query.where({
          assignedTo: db.command.or(db.command.eq(null), db.command.eq(''))
        })
      } else {
        query = query.where({ assignedTo: assignee })
      }
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
    console.error('获取经理工单列表失败:', error)
    return { code: 500, message: '获取工单列表失败' }
  }
}

// 新增：开始处理工单
async function startProcessTicket(event, wxContext) {
  const { ticketId } = event
  
  if (!ticketId) {
    return { code: 400, message: '工单ID不能为空' }
  }
  
  try {
    // 检查工单是否分配给当前用户
    const ticketResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!ticketResult.data) {
      return { code: 404, message: '工单不存在' }
    }
    
    if (ticketResult.data.assignedTo !== wxContext.OPENID) {
      return { code: 403, message: '此工单未分配给您' }
    }
    
    if (!['assigned', 'processing'].includes(ticketResult.data.status)) {
      return { code: 400, message: '工单状态不允许开始处理' }
    }
    
    // 更新工单状态
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          status: 'processing',
          startTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    
    return {
      code: 200,
      message: '开始处理工单'
    }
  } catch (error) {
    console.error('开始处理工单失败:', error)
    return { code: 500, message: '开始处理工单失败' }
  }
}

// 新增：完成工单
async function completeTicket(event, wxContext) {
  const { ticketId, solution } = event
  
  if (!ticketId) {
    return { code: 400, message: '工单ID不能为空' }
  }
  
  try {
    // 检查工单是否分配给当前用户
    const ticketResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!ticketResult.data) {
      return { code: 404, message: '工单不存在' }
    }
    
    if (ticketResult.data.assignedTo !== wxContext.OPENID) {
      return { code: 403, message: '此工单未分配给您' }
    }
    
    if (ticketResult.data.status !== 'processing') {
      return { code: 400, message: '只能完成处理中的工单' }
    }
    
    // 更新工单状态
    await db.collection('tickets')
      .doc(ticketId)
      .update({
        data: {
          status: 'resolved',
          solution: solution || '',
          completeTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
    
    return {
      code: 200,
      message: '工单已完成'
    }
  } catch (error) {
    console.error('完成工单失败:', error)
    return { code: 500, message: '完成工单失败' }
  }
}

// 这里需要包含原有的所有函数...
// submitTicket, getTicketList, getTicketDetail, updateTicket, updateTicketStatus