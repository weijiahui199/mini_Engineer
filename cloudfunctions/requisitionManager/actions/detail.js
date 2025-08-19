// 获取申领单详情
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

module.exports = async (event, wxContext) => {
  const { requisitionId } = event
  
  if (!requisitionId) {
    return {
      success: false,
      error: '缺少申领单ID'
    }
  }
  
  const openid = wxContext.OPENID
  
  try {
    // 查询申领单详情
    const result = await db.collection('requisitions')
      .doc(requisitionId)
      .get()
    
    if (!result.data) {
      return {
        success: false,
        error: '申领单不存在'
      }
    }
    
    const requisition = result.data
    
    // 获取用户信息，判断权限
    const userResult = await db.collection('users')
      .where({ openid })
      .get()
    
    const isManager = userResult.data.length > 0 && 
                     userResult.data[0].roleGroup === '经理'
    
    // 权限检查：只能查看自己的申领单，除非是Manager
    if (!isManager && requisition.applicantOpenid !== openid) {
      return {
        success: false,
        error: '无权限查看此申领单'
      }
    }
    
    // 处理数据，非Manager过滤价格信息
    let data = requisition
    if (!isManager) {
      // 过滤金额信息
      delete data.totalAmount
      // 过滤items中的价格信息
      if (data.items) {
        data.items = data.items.map(item => {
          const { costPrice, salePrice, subtotal, ...rest } = item
          return rest
        })
      }
    }
    
    // 如果有关联工单，获取工单信息
    if (data.ticketId) {
      try {
        const ticketResult = await db.collection('tickets')
          .doc(data.ticketId)
          .field({
            ticketNo: true,
            title: true,
            status: true
          })
          .get()
        
        if (ticketResult.data) {
          data.ticketInfo = ticketResult.data
        }
      } catch (err) {
        console.log('[detail] 获取工单信息失败:', err)
      }
    }
    
    return {
      success: true,
      data
    }
  } catch (err) {
    console.error('[detail] 查询申领单详情失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}