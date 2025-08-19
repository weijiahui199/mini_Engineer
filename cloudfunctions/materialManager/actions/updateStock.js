// 更新库存（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const {
    materialId,
    variantId,
    type,        // in/out/adjust
    quantity,    // 变动数量（入库为正，出库为负）
    reason
  } = event
  
  if (!materialId || !variantId || !type || quantity === undefined) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }
  
  try {
    // 开始事务
    const transaction = await db.startTransaction()
    
    try {
      // 查询当前耗材信息
      const materialResult = await transaction.collection('materials')
        .doc(materialId)
        .get()
      
      if (!materialResult.data) {
        await transaction.rollback()
        return {
          success: false,
          error: '耗材不存在'
        }
      }
      
      const material = materialResult.data
      const variantIndex = material.variants.findIndex(v => v.variantId === variantId)
      
      if (variantIndex === -1) {
        await transaction.rollback()
        return {
          success: false,
          error: '规格不存在'
        }
      }
      
      const variant = material.variants[variantIndex]
      const beforeStock = variant.stock
      let afterStock = beforeStock
      
      // 计算新库存
      if (type === 'in') {
        afterStock = beforeStock + Math.abs(quantity)
      } else if (type === 'out') {
        afterStock = beforeStock - Math.abs(quantity)
        if (afterStock < 0) {
          await transaction.rollback()
          return {
            success: false,
            error: '库存不足，无法出库'
          }
        }
      } else if (type === 'adjust') {
        afterStock = quantity // 直接调整为指定数量
      } else {
        await transaction.rollback()
        return {
          success: false,
          error: '无效的操作类型'
        }
      }
      
      // 更新variant的库存
      material.variants[variantIndex].stock = afterStock
      
      // 重新计算总库存
      const totalStock = material.variants.reduce((sum, v) => sum + v.stock, 0)
      
      // 更新耗材记录
      await transaction.collection('materials')
        .doc(materialId)
        .update({
          data: {
            variants: material.variants,
            totalStock: totalStock,
            updateTime: db.serverDate(),
            updatedBy: wxContext.OPENID
          }
        })
      
      // 记录库存变动日志
      await transaction.collection('material_logs').add({
        data: {
          materialId,
          variantId,
          type,
          quantity: type === 'adjust' ? (afterStock - beforeStock) : (type === 'in' ? Math.abs(quantity) : -Math.abs(quantity)),
          beforeStock,
          afterStock,
          operatorOpenid: wxContext.OPENID,
          operatorName: event.operatorName || '',
          reason: reason || `${type === 'in' ? '入库' : type === 'out' ? '出库' : '调整'}操作`,
          createTime: db.serverDate()
        }
      })
      
      // 提交事务
      await transaction.commit()
      
      return {
        success: true,
        data: {
          materialId,
          variantId,
          beforeStock,
          afterStock,
          totalStock
        }
      }
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  } catch (err) {
    console.error('[updateStock] 更新库存失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}