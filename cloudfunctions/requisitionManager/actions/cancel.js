// 取消申领单（仅限刚提交的订单，需要恢复库存）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const { requisitionId, reason } = event
  
  if (!requisitionId) {
    return {
      success: false,
      error: '缺少申领单ID'
    }
  }
  
  const openid = wxContext.OPENID
  
  try {
    // 开始事务
    const transaction = await db.startTransaction()
    
    try {
      // 查询申领单
      const requisitionResult = await transaction.collection('requisitions')
        .doc(requisitionId)
        .get()
      
      if (!requisitionResult.data) {
        await transaction.rollback()
        return {
          success: false,
          error: '申领单不存在'
        }
      }
      
      const requisition = requisitionResult.data
      
      // 权限检查：只能取消自己的申领单
      if (requisition.applicantOpenid !== openid) {
        // 获取用户信息，Manager可以取消任何申领单
        const userResult = await db.collection('users')
          .where({ openid })
          .get()
        
        const isManager = userResult.data.length > 0 && 
                         userResult.data[0].roleGroup === '经理'
        
        if (!isManager) {
          await transaction.rollback()
          return {
            success: false,
            error: '无权限取消此申领单'
          }
        }
      }
      
      // 状态检查：只能取消已完成的申领单
      if (requisition.status !== 'completed') {
        await transaction.rollback()
        return {
          success: false,
          error: '申领单状态不允许取消'
        }
      }
      
      // 时间检查：检查是否在可撤销时间内
      const now = new Date()
      
      // 优先使用canCancelBefore字段（新版本）
      if (requisition.canCancelBefore) {
        const canCancelBefore = new Date(requisition.canCancelBefore)
        if (now > canCancelBefore) {
          await transaction.rollback()
          return {
            success: false,
            error: '超过5分钟撤销时限，无法取消'
          }
        }
      } else {
        // 兼容旧版本：24小时内可撤销
        const createTime = new Date(requisition.createTime)
        const hoursDiff = (now - createTime) / (1000 * 60 * 60)
        
        if (hoursDiff > 24) {
          await transaction.rollback()
          return {
            success: false,
            error: '申领单已超过24小时，无法取消'
          }
        }
      }
      
      // 恢复库存
      for (const item of requisition.items) {
        const { materialId, variantId, quantity } = item
        
        // 查询当前耗材信息
        const materialResult = await transaction.collection('materials')
          .doc(materialId)
          .get()
        
        if (!materialResult.data) {
          console.error(`[cancel] 耗材不存在: ${materialId}`)
          continue
        }
        
        const material = materialResult.data
        const variantIndex = material.variants.findIndex(v => v.variantId === variantId)
        
        if (variantIndex === -1) {
          console.error(`[cancel] 规格不存在: ${variantId}`)
          continue
        }
        
        // 恢复库存
        material.variants[variantIndex].stock += quantity
        const newTotalStock = material.variants.reduce((sum, v) => sum + v.stock, 0)
        
        // 更新耗材库存（使用乐观锁）
        const updateResult = await transaction.collection('materials')
          .doc(materialId)
          .update({
            data: {
              variants: material.variants,
              totalStock: newTotalStock,
              version: _.inc(1), // 递增版本号
              updateTime: db.serverDate()
            }
          })
        
        // 检查更新是否成功
        if (updateResult.stats.updated === 0) {
          // 版本冲突，说明有并发修改
          await transaction.rollback()
          return {
            success: false,
            error: '库存数据已变更，请重试'
          }
        }
        
        // 记录库存变动日志
        await transaction.collection('material_logs').add({
          data: {
            materialId,
            variantId,
            type: 'in',
            quantity: quantity,
            beforeStock: material.variants[variantIndex].stock - quantity,
            afterStock: material.variants[variantIndex].stock,
            requisitionId: requisition.requisitionNo,
            operatorOpenid: openid,
            operatorName: event.operatorName || '',
            reason: `取消申领单 ${requisition.requisitionNo}`,
            createTime: db.serverDate()
          }
        })
      }
      
      // 更新申领单状态
      await transaction.collection('requisitions')
        .doc(requisitionId)
        .update({
          data: {
            status: 'cancelled',
            cancelledTime: db.serverDate(),
            cancelledBy: openid,
            cancelReason: reason || '用户取消',
            updateTime: db.serverDate()
          }
        })
      
      // 提交事务
      await transaction.commit()
      
      console.log(`[cancel] 申领单取消成功: ${requisition.requisitionNo}`)
      
      return {
        success: true,
        data: {
          requisitionNo: requisition.requisitionNo,
          restoredItems: requisition.items.length
        }
      }
      
    } catch (err) {
      // 回滚事务
      await transaction.rollback()
      throw err
    }
    
  } catch (err) {
    console.error('[cancel] 取消申领单失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}