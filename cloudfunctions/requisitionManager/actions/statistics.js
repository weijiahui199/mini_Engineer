// 统计分析（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const {
    startDate,
    endDate,
    type = 'overview' // overview/department/material/trend
  } = event
  
  try {
    // 构建时间范围查询条件
    const where = {}
    if (startDate || endDate) {
      where.createTime = {}
      if (startDate) {
        where.createTime = _.gte(new Date(startDate))
      }
      if (endDate) {
        where.createTime = Object.assign(where.createTime || {}, 
          _.lte(new Date(endDate + ' 23:59:59')))
      }
    }
    
    // 只统计已完成的申领单
    where.status = 'completed'
    
    let result = {}
    
    switch (type) {
      case 'overview':
        // 总体统计
        result = await getOverviewStatistics(where)
        break
        
      case 'department':
        // 部门统计
        result = await getDepartmentStatistics(where)
        break
        
      case 'material':
        // 耗材统计
        result = await getMaterialStatistics(where)
        break
        
      case 'trend':
        // 趋势分析
        result = await getTrendStatistics(where, startDate, endDate)
        break
        
      default:
        return {
          success: false,
          error: '无效的统计类型'
        }
    }
    
    return {
      success: true,
      data: result
    }
  } catch (err) {
    console.error('[statistics] 统计失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}

// 总体统计
async function getOverviewStatistics(where) {
  const requisitions = await db.collection('requisitions')
    .where(where)
    .get()
  
  let totalOrders = requisitions.data.length
  let totalQuantity = 0
  let totalCost = 0
  let totalAmount = 0
  let materialTypes = new Set()
  let departments = new Set()
  
  requisitions.data.forEach(req => {
    totalQuantity += req.totalQuantity || 0
    totalAmount += req.totalAmount || 0
    
    if (req.department) departments.add(req.department)
    
    req.items.forEach(item => {
      totalCost += (item.costPrice || 0) * item.quantity
      materialTypes.add(item.materialNo)
    })
  })
  
  // 获取库存预警数
  const materials = await db.collection('materials')
    .where({ status: 'active' })
    .get()
  
  let warningCount = 0
  materials.data.forEach(m => {
    m.variants.forEach(v => {
      if (v.stock <= v.safetyStock) {
        warningCount++
      }
    })
  })
  
  return {
    totalOrders,
    totalQuantity,
    totalCost: totalCost.toFixed(2),
    totalAmount: totalAmount.toFixed(2),
    avgOrderValue: totalOrders > 0 ? (totalAmount / totalOrders).toFixed(2) : '0.00',
    materialTypes: materialTypes.size,
    departments: departments.size,
    warningCount
  }
}

// 部门统计
async function getDepartmentStatistics(where) {
  const requisitions = await db.collection('requisitions')
    .where(where)
    .get()
  
  const departmentStats = {}
  
  requisitions.data.forEach(req => {
    const dept = req.department || '未知部门'
    
    if (!departmentStats[dept]) {
      departmentStats[dept] = {
        orders: 0,
        quantity: 0,
        amount: 0,
        users: new Set()
      }
    }
    
    departmentStats[dept].orders++
    departmentStats[dept].quantity += req.totalQuantity || 0
    departmentStats[dept].amount += req.totalAmount || 0
    departmentStats[dept].users.add(req.applicantOpenid)
  })
  
  // 转换为数组并排序
  const result = Object.keys(departmentStats).map(dept => ({
    department: dept,
    orders: departmentStats[dept].orders,
    quantity: departmentStats[dept].quantity,
    amount: departmentStats[dept].amount.toFixed(2),
    users: departmentStats[dept].users.size
  })).sort((a, b) => b.amount - a.amount)
  
  return result
}

// 耗材统计
async function getMaterialStatistics(where) {
  const requisitions = await db.collection('requisitions')
    .where(where)
    .get()
  
  const materialStats = {}
  
  requisitions.data.forEach(req => {
    req.items.forEach(item => {
      const key = `${item.materialNo}_${item.variantId}`
      
      if (!materialStats[key]) {
        materialStats[key] = {
          materialNo: item.materialNo,
          name: item.name,
          variant: item.variantLabel,
          quantity: 0,
          cost: 0,
          amount: 0,
          orders: 0
        }
      }
      
      materialStats[key].quantity += item.quantity
      materialStats[key].cost += (item.costPrice || 0) * item.quantity
      materialStats[key].amount += item.subtotal || 0
      materialStats[key].orders++
    })
  })
  
  // 转换为数组并排序（按申领数量）
  const result = Object.values(materialStats)
    .map(stat => ({
      ...stat,
      cost: stat.cost.toFixed(2),
      amount: stat.amount.toFixed(2)
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 20) // 只返回前20个
  
  return result
}

// 趋势分析
async function getTrendStatistics(where, startDate, endDate) {
  const requisitions = await db.collection('requisitions')
    .where(where)
    .orderBy('createTime', 'asc')
    .get()
  
  // 按日期分组
  const dailyStats = {}
  
  requisitions.data.forEach(req => {
    const date = new Date(req.createTime)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    
    if (!dailyStats[dateKey]) {
      dailyStats[dateKey] = {
        date: dateKey,
        orders: 0,
        quantity: 0,
        amount: 0
      }
    }
    
    dailyStats[dateKey].orders++
    dailyStats[dateKey].quantity += req.totalQuantity || 0
    dailyStats[dateKey].amount += req.totalAmount || 0
  })
  
  // 转换为数组
  const result = Object.values(dailyStats)
    .map(stat => ({
      ...stat,
      amount: stat.amount.toFixed(2)
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
  
  return result
}