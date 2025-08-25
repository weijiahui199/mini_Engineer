// 申领管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 导入各个action处理函数
const submitRequisition = require('./actions/submit')
const listRequisitions = require('./actions/list')
const getRequisitionDetail = require('./actions/detail')
const cancelRequisition = require('./actions/cancel')
const getStatistics = require('./actions/statistics')

// 权限验证中间件
async function checkPermission(openid, requiredRole) {
  try {
    const userResult = await db.collection('users')
      .where({ openid })
      .get()
    
    if (userResult.data.length === 0) {
      return false
    }
    
    const user = userResult.data[0]
    
    // 角色权限级别：经理 > 工程师 > 用户
    const roleLevel = {
      '经理': 3,
      '工程师': 2,
      '用户': 1,
      // 兼容英文（如果有旧数据）
      'Manager': 3,
      'Engineer': 2,
      'User': 1
    }
    
    const userLevel = roleLevel[user.roleGroup] || 0
    const requiredLevel = roleLevel[requiredRole] || 0
    
    return userLevel >= requiredLevel
  } catch (err) {
    console.error('[checkPermission] 权限检查失败:', err)
    return false
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event
  
  console.log(`[requisitionManager] action: ${action}, openid: ${openid}`)
  
  try {
    // 根据action分发处理
    switch (action) {
      case 'submit':
        // 提交申领单（工程师及以上）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限操作'
          }
        }
        return await submitRequisition(event, wxContext)
        
      case 'list':
        // 获取申领单列表（工程师及以上）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限访问'
          }
        }
        return await listRequisitions(event, wxContext)
        
      case 'detail':
        // 获取申领单详情（工程师及以上）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限访问'
          }
        }
        return await getRequisitionDetail(event, wxContext)
        
      case 'cancel':
        // 取消申领单（仅限刚提交的订单）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限操作'
          }
        }
        return await cancelRequisition(event, wxContext)
        
      // ========== 以下为经理端专用功能，已移至独立的经理端小程序 ==========
      // 详细文档见: /docs/cloud-functions-manager-only.md
      
      // case 'statistics':
      //   // 统计分析（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限访问'
      //     }
      //   }
      //   return await getStatistics(event, wxContext)
      
      // ========== 经理端专用功能结束 ==========
        
      default:
        return {
          success: false,
          error: '未知操作'
        }
    }
  } catch (err) {
    console.error(`[requisitionManager] ${action} 执行失败:`, err)
    return {
      success: false,
      error: err.toString()
    }
  }
}