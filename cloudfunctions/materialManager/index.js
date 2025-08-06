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
      case 'recordUsage':
        return await recordMaterialUsage(event, wxContext)
      case 'getCommonMaterials':
        return await getCommonMaterials(event, wxContext)
      case 'getPersonalStats':
        return await getPersonalStats(event, wxContext)
      case 'getTeamStats':
        return await getTeamStats(event, wxContext)
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

// 记录耗材使用
async function recordMaterialUsage(event, wxContext) {
  const { ticketId, actionType, description, timeSpent, materials } = event
  
  if (!ticketId) {
    return { code: 400, message: '工单ID不能为空' }
  }
  
  if (!actionType || !['complete', 'pause', 'record'].includes(actionType)) {
    return { code: 400, message: '无效的操作类型' }
  }
  
  try {
    // 检查工单是否存在且分配给当前用户
    const ticketResult = await db.collection('tickets')
      .doc(ticketId)
      .get()
    
    if (!ticketResult.data) {
      return { code: 404, message: '工单不存在' }
    }
    
    if (ticketResult.data.assignedTo !== wxContext.OPENID) {
      return { code: 403, message: '此工单未分配给您' }
    }
    
    // 记录工作日志
    await db.collection('worklog').add({
      data: {
        _openid: wxContext.OPENID,
        ticketId: ticketId,
        action: actionType,
        description: description || '',
        timeSpent: timeSpent || 0,
        materialsUsed: materials || [],
        createTime: db.serverDate()
      }
    })
    
    // 根据操作类型更新工单状态
    let newStatus = ticketResult.data.status
    let updateData = {
      updateTime: db.serverDate()
    }
    
    if (actionType === 'complete') {
      newStatus = 'resolved'
      updateData.status = newStatus
      updateData.completeTime = db.serverDate()
      updateData.solution = description || '问题已解决'
    } else if (actionType === 'pause') {
      // 暂停处理时不改变状态，只记录日志
    }
    
    if (newStatus !== ticketResult.data.status) {
      await db.collection('tickets')
        .doc(ticketId)
        .update({
          data: updateData
        })
    }
    
    return {
      code: 200,
      message: '耗材使用记录已保存',
      data: {
        actionType: actionType,
        ticketStatus: newStatus
      }
    }
  } catch (error) {
    console.error('记录耗材使用失败:', error)
    return { code: 500, message: '记录耗材使用失败' }
  }
}

// 获取常用耗材列表
async function getCommonMaterials(event, wxContext) {
  try {
    const result = await db.collection('materials')
      .where({
        isActive: true
      })
      .orderBy('category', 'asc')
      .orderBy('materialName', 'asc')
      .get()
    
    return {
      code: 200,
      data: result.data
    }
  } catch (error) {
    console.error('获取常用耗材失败:', error)
    return { code: 500, message: '获取常用耗材失败' }
  }
}

// 获取个人耗材使用统计
async function getPersonalStats(event, wxContext) {
  const { timeRange = 'month' } = event
  
  try {
    // 计算时间范围
    const days = timeRange === 'week' ? 7 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    // 聚合查询个人耗材使用统计
    const result = await db.collection('worklog')
      .aggregate()
      .match({
        _openid: wxContext.OPENID,
        createTime: _.gte(startDate),
        'materialsUsed.0': _.exists(true)
      })
      .unwind('$materialsUsed')
      .group({
        _id: '$materialsUsed.materialName',
        totalQuantity: { $sum: '$materialsUsed.quantity' },
        unit: { $first: '$materialsUsed.unit' },
        ticketCount: { $addToSet: '$ticketId' }
      })
      .sort({ totalQuantity: -1 })
      .end()
    
    // 处理结果
    const topUsed = result.list.map(item => ({
      materialName: item._id,
      totalQuantity: item.totalQuantity,
      unit: item.unit
    }))
    
    // 获取涉及的工单数
    const ticketIds = new Set()
    result.list.forEach(item => {
      item.ticketCount.forEach(id => ticketIds.add(id))
    })
    
    return {
      code: 200,
      data: {
        totalTypes: result.list.length,
        totalTickets: ticketIds.size,
        topUsed: topUsed.slice(0, 5)
      }
    }
  } catch (error) {
    console.error('获取个人统计失败:', error)
    return { code: 500, message: '获取个人统计失败' }
  }
}

// 获取团队耗材使用统计（仅经理可用）
async function getTeamStats(event, wxContext) {
  const { timeRange = 'month' } = event
  
  try {
    // 检查用户权限
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    if (!userResult.data.length || userResult.data[0].role !== 'manager') {
      return { code: 403, message: '无权限执行此操作' }
    }
    
    // 计算时间范围
    const days = timeRange === 'week' ? 7 : 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    // 聚合查询团队耗材使用统计
    const result = await db.collection('worklog')
      .aggregate()
      .match({
        createTime: _.gte(startDate),
        'materialsUsed.0': _.exists(true)
      })
      .unwind('$materialsUsed')
      .group({
        _id: {
          materialName: '$materialsUsed.materialName',
          engineer: '$_openid'
        },
        totalQuantity: { $sum: '$materialsUsed.quantity' },
        unit: { $first: '$materialsUsed.unit' },
        ticketCount: { $addToSet: '$ticketId' }
      })
      .end()
    
    // 处理数据，计算团队总计
    const materialTotals = {}
    const engineerStats = {}
    const ticketIds = new Set()
    
    result.list.forEach(item => {
      const { materialName, engineer } = item._id
      
      // 材料总计
      if (!materialTotals[materialName]) {
        materialTotals[materialName] = {
          materialName,
          totalQuantity: 0,
          unit: item.unit
        }
      }
      materialTotals[materialName].totalQuantity += item.totalQuantity
      
      // 工程师统计
      if (!engineerStats[engineer]) {
        engineerStats[engineer] = new Set()
      }
      
      // 收集所有工单ID
      item.ticketCount.forEach(id => ticketIds.add(id))
    })
    
    return {
      code: 200,
      data: {
        teamSummary: {
          totalTypes: Object.keys(materialTotals).length,
          totalTickets: ticketIds.size,
          activeEngineers: Object.keys(engineerStats).length
        },
        topMaterials: Object.values(materialTotals)
          .sort((a, b) => b.totalQuantity - a.totalQuantity)
          .slice(0, 5)
      }
    }
  } catch (error) {
    console.error('获取团队统计失败:', error)
    return { code: 500, message: '获取团队统计失败' }
  }
}

// 获取材料列表
async function listMaterials(event, wxContext) {
  const { category, page = 1, pageSize = 20 } = event
  
  try {
    let whereCondition = { isActive: true }
    if (category && category !== 'all') {
      whereCondition.category = category
    }
    
    // 获取总数
    const countResult = await db.collection('materials')
      .where(whereCondition)
      .count()
    
    // 获取列表
    const result = await db.collection('materials')
      .where(whereCondition)
      .orderBy('category', 'asc')
      .orderBy('materialName', 'asc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()
    
    return {
      success: true,
      code: 200,
      data: {
        materials: result.data,
        total: countResult.total,
        page,
        pageSize,
        totalPages: Math.ceil(countResult.total / pageSize)
      }
    }
  } catch (error) {
    console.error('获取材料列表失败:', error)
    return { success: false, code: 500, message: '获取材料列表失败' }
  }
}

// 添加新材料（经理权限）
async function addMaterial(event, wxContext) {
  const { 
    materialName, 
    spec, 
    category, 
    unit, 
    stock = 0, 
    minStock = 10, 
    maxStock = 100,
    photo = ''
  } = event
  
  try {
    // 检查权限
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    if (!userResult.data.length || userResult.data[0].role !== 'manager') {
      return { success: false, code: 403, message: '无权限执行此操作' }
    }
    
    // 检查材料是否已存在
    const existCheck = await db.collection('materials')
      .where({
        materialName,
        spec
      })
      .get()
    
    if (existCheck.data.length > 0) {
      return { success: false, code: 409, message: '该材料已存在' }
    }
    
    // 添加材料
    const result = await db.collection('materials').add({
      data: {
        materialName,
        spec,
        category,
        unit,
        stock,
        minStock,
        maxStock,
        photo,
        isActive: true,
        createdBy: wxContext.OPENID,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      code: 200,
      data: { materialId: result._id },
      message: '材料添加成功'
    }
  } catch (error) {
    console.error('添加材料失败:', error)
    return { success: false, code: 500, message: '添加材料失败' }
  }
}

// 更新材料信息（经理权限）
async function updateMaterial(event, wxContext) {
  const { materialId, updates } = event
  
  try {
    // 检查权限
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    if (!userResult.data.length || userResult.data[0].role !== 'manager') {
      return { success: false, code: 403, message: '无权限执行此操作' }
    }
    
    // 更新材料
    await db.collection('materials')
      .doc(materialId)
      .update({
        data: {
          ...updates,
          updateTime: db.serverDate()
        }
      })
    
    return {
      success: true,
      code: 200,
      message: '材料更新成功'
    }
  } catch (error) {
    console.error('更新材料失败:', error)
    return { success: false, code: 500, message: '更新材料失败' }
  }
}

// 删除材料（经理权限）
async function deleteMaterial(event, wxContext) {
  const { materialId } = event
  
  try {
    // 检查权限
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    if (!userResult.data.length || userResult.data[0].role !== 'manager') {
      return { success: false, code: 403, message: '无权限执行此操作' }
    }
    
    // 软删除（标记为不活跃）
    await db.collection('materials')
      .doc(materialId)
      .update({
        data: {
          isActive: false,
          deletedBy: wxContext.OPENID,
          deleteTime: db.serverDate()
        }
      })
    
    return {
      success: true,
      code: 200,
      message: '材料删除成功'
    }
  } catch (error) {
    console.error('删除材料失败:', error)
    return { success: false, code: 500, message: '删除材料失败' }
  }
}

// 更新库存（经理权限）
async function updateStock(event, wxContext) {
  const { materialId, newStock, reason } = event
  
  try {
    // 检查权限
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    if (!userResult.data.length || userResult.data[0].role !== 'manager') {
      return { success: false, code: 403, message: '无权限执行此操作' }
    }
    
    // 获取当前库存
    const material = await db.collection('materials').doc(materialId).get()
    const oldStock = material.data.stock
    
    // 更新库存
    await db.collection('materials')
      .doc(materialId)
      .update({
        data: {
          stock: newStock,
          updateTime: db.serverDate()
        }
      })
    
    // 记录库存变更
    await db.collection('stockHistory').add({
      data: {
        materialId,
        materialName: material.data.materialName,
        oldStock,
        newStock,
        changeAmount: newStock - oldStock,
        reason: reason || '库存调整',
        operatedBy: wxContext.OPENID,
        createTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      code: 200,
      message: '库存更新成功'
    }
  } catch (error) {
    console.error('更新库存失败:', error)
    return { success: false, code: 500, message: '更新库存失败' }
  }
}

// 获取库存情况
async function getInventory(event, wxContext) {
  const { filterLowStock = false } = event
  
  try {
    let whereCondition = { isActive: true }
    
    // 获取所有材料
    const result = await db.collection('materials')
      .where(whereCondition)
      .get()
    
    let materials = result.data
    
    // 筛选低库存
    if (filterLowStock) {
      materials = materials.filter(m => m.stock < m.minStock)
    }
    
    // 计算统计数据
    const stats = {
      totalTypes: materials.length,
      lowStockCount: materials.filter(m => m.stock < m.minStock).length,
      outOfStockCount: materials.filter(m => m.stock === 0).length,
      adequateStockCount: materials.filter(m => m.stock >= m.minStock).length
    }
    
    return {
      success: true,
      code: 200,
      data: {
        materials,
        stats
      }
    }
  } catch (error) {
    console.error('获取库存情况失败:', error)
    return { success: false, code: 500, message: '获取库存情况失败' }
  }
}

// 获取材料统计数据
async function getMaterialStatistics(event, wxContext) {
  const { timeRange = 'month', materialId } = event
  
  try {
    // 计算时间范围
    const days = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 365
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    let matchCondition = {
      createTime: _.gte(startDate),
      'materialsUsed.0': _.exists(true)
    }
    
    if (materialId) {
      matchCondition['materialsUsed.materialId'] = materialId
    }
    
    // 统计材料使用
    const usageResult = await db.collection('worklog')
      .aggregate()
      .match(matchCondition)
      .unwind('$materialsUsed')
      .group({
        _id: '$materialsUsed.materialName',
        totalQuantity: { $sum: '$materialsUsed.quantity' },
        usageCount: { $sum: 1 },
        unit: { $first: '$materialsUsed.unit' },
        engineers: { $addToSet: '$_openid' },
        tickets: { $addToSet: '$ticketId' }
      })
      .sort({ totalQuantity: -1 })
      .limit(10)
      .end()
    
    // 处理结果
    const topMaterials = usageResult.list.map(item => ({
      materialName: item._id,
      totalQuantity: item.totalQuantity,
      unit: item.unit,
      usageCount: item.usageCount,
      engineerCount: item.engineers.length,
      ticketCount: item.tickets.length
    }))
    
    return {
      success: true,
      code: 200,
      data: {
        timeRange,
        topMaterials,
        totalUsageTypes: usageResult.list.length
      }
    }
  } catch (error) {
    console.error('获取材料统计失败:', error)
    return { success: false, code: 500, message: '获取材料统计失败' }
  }
}