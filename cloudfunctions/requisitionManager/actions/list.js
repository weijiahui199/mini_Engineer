// 获取申领单列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const {
    page = 1,
    pageSize = 20,
    status = 'all',
    startDate,
    endDate,
    keyword = ''
  } = event
  
  const openid = wxContext.OPENID
  
  try {
    // 获取用户信息，判断是否为Manager
    const userResult = await db.collection('users')
      .where({ openid })
      .get()
    
    const isManager = userResult.data.length > 0 && 
                     userResult.data[0].roleGroup === '经理'
    
    // 构建查询条件
    const where = {}
    
    // Manager可以查看所有申领单，其他人只能查看自己的
    if (!isManager) {
      where.applicantOpenid = openid
    }
    
    // 状态筛选
    if (status !== 'all') {
      where.status = status
    }
    
    // 时间范围筛选
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
    
    // 关键词搜索（申领单号或申领人姓名）
    if (keyword) {
      where._ = _.or([
        { requisitionNo: db.RegExp({ regexp: keyword, options: 'i' }) },
        { applicantName: db.RegExp({ regexp: keyword, options: 'i' }) }
      ])
    }
    
    // 查询总数
    const countResult = await db.collection('requisitions')
      .where(where)
      .count()
    
    // 分页查询
    const skip = (page - 1) * pageSize
    const result = await db.collection('requisitions')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 处理数据，非Manager过滤价格信息
    let requisitions = result.data
    if (!isManager) {
      requisitions = requisitions.map(req => {
        const filtered = { ...req }
        // 过滤金额信息
        delete filtered.totalAmount
        // 过滤items中的价格信息
        if (filtered.items) {
          filtered.items = filtered.items.map(item => {
            const { costPrice, salePrice, subtotal, ...rest } = item
            return rest
          })
        }
        return filtered
      })
    }
    
    return {
      success: true,
      data: {
        list: requisitions,
        total: countResult.total,
        page,
        pageSize,
        hasMore: skip + requisitions.length < countResult.total
      }
    }
  } catch (err) {
    console.error('[list] 查询申领单失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}