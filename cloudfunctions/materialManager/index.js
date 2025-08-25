// 耗材管理云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 导入各个action处理函数
const listMaterials = require('./actions/list')
const getMaterialDetail = require('./actions/detail')
const checkStock = require('./actions/checkStock')
const createMaterial = require('./actions/create')
const updateMaterial = require('./actions/update')
const deleteMaterial = require('./actions/delete')
const updateStock = require('./actions/updateStock')
const exportInventory = require('./actions/exportInventory')
const exportRequisitions = require('./actions/exportRequisitions')
const batchValidate = require('./actions/batchValidate')
const getStats = require('./actions/getStats')
const getStockAlerts = require('./actions/getStockAlerts')
const getRecentChanges = require('./actions/getRecentChanges')
const updatePrice = require('./actions/updatePrice')

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
  
  console.log(`[materialManager] action: ${action}, openid: ${openid}`)
  
  try {
    // 根据action分发处理
    switch (action) {
      case 'list':
        // 获取耗材列表（工程师及以上）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限访问'
          }
        }
        return await listMaterials(event, wxContext)
        
      case 'detail':
        // 获取耗材详情（工程师及以上）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限访问'
          }
        }
        return await getMaterialDetail(event, wxContext)
        
      case 'checkStock':
        // 检查库存（工程师及以上）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限访问'
          }
        }
        return await checkStock(event, wxContext)
        
      // ========== 以下为经理端专用功能，已移至独立的经理端小程序 ==========
      // 详细文档见: /docs/cloud-functions-manager-only.md
      
      // case 'create':
      //   // 创建耗材（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await createMaterial(event, wxContext)
        
      // case 'update':
      //   // 更新耗材（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await updateMaterial(event, wxContext)
        
      // case 'delete':
      //   // 删除耗材（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await deleteMaterial(event, wxContext)
        
      // case 'updateStock':
      //   // 更新库存（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await updateStock(event, wxContext)
        
      // case 'exportInventory':
      //   // 导出库存CSV（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await exportInventory(event, wxContext)
        
      // case 'exportRequisitions':
      //   // 导出申领记录CSV（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await exportRequisitions(event, wxContext)
        
      case 'batchValidate':
        // 批量验证库存和价格（工程师及以上）
        if (!await checkPermission(openid, '工程师')) {
          return {
            success: false,
            error: '无权限访问'
          }
        }
        return await batchValidate(event, wxContext)
        
      // case 'getStats':
      //   // 获取统计数据（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await getStats(event, wxContext)
        
      // case 'getStockAlerts':
      //   // 获取库存预警（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await getStockAlerts(event, wxContext)
        
      // case 'getRecentChanges':
      //   // 获取最近变动（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await getRecentChanges(event, wxContext)
        
      // case 'updatePrice':
      //   // 更新价格（仅经理）
      //   if (!await checkPermission(openid, '经理')) {
      //     return {
      //       success: false,
      //       error: '无权限操作'
      //     }
      //   }
      //   return await updatePrice(event, wxContext)
      
      // ========== 经理端专用功能结束 ==========
        
      default:
        return {
          success: false,
          error: '未知操作'
        }
    }
  } catch (err) {
    console.error(`[materialManager] ${action} 执行失败:`, err)
    return {
      success: false,
      error: err.toString()
    }
  }
}