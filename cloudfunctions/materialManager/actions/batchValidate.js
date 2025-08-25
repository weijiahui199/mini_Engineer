// 批量验证库存和价格
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const { items } = event
  
  // 参数验证
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      error: '验证清单不能为空'
    }
  }
  
  const openid = wxContext.OPENID
  const errors = []
  const validatedItems = []
  
  try {
    // 获取用户信息以确定角色
    const userResult = await db.collection('users')
      .where({ openid })
      .get()
    
    if (userResult.data.length === 0) {
      return {
        success: false,
        error: '用户信息不存在'
      }
    }
    
    const user = userResult.data[0]
    const isManager = user.roleGroup === '经理' || user.roleGroup === 'Manager'
    
    // 批量验证每个物料
    for (const item of items) {
      const { 
        materialId, 
        variantId, 
        quantity, 
        priceSnapshot,
        stockSnapshot 
      } = item
      
      if (!materialId || !variantId || !quantity) {
        errors.push({
          materialId,
          variantId,
          error: '参数不完整',
          errorCode: 'INVALID_PARAMS'
        })
        continue
      }
      
      try {
        // 查询物料信息
        const materialResult = await db.collection('materials')
          .doc(materialId)
          .get()
        
        if (!materialResult.data) {
          errors.push({
            materialId,
            variantId,
            error: '耗材不存在',
            errorCode: 'MATERIAL_NOT_FOUND'
          })
          continue
        }
        
        const material = materialResult.data
        const variant = material.variants.find(v => v.variantId === variantId)
        
        if (!variant) {
          errors.push({
            materialId,
            variantId,
            error: '规格不存在',
            errorCode: 'VARIANT_NOT_FOUND'
          })
          continue
        }
        
        // 验证库存
        if (variant.stock < quantity) {
          errors.push({
            materialId,
            variantId,
            materialName: material.name,
            variantLabel: variant.label,
            error: `库存不足，当前库存: ${variant.stock}，申领数量: ${quantity}`,
            errorCode: 'INSUFFICIENT_STOCK',
            available: variant.stock,
            requested: quantity
          })
        }
        
        // 验证价格是否变化（如果提供了快照价格）
        if (priceSnapshot !== undefined) {
          const currentPrice = isManager ? variant.costPrice : variant.salePrice
          if (Math.abs(currentPrice - priceSnapshot) > 0.01) {
            errors.push({
              materialId,
              variantId,
              materialName: material.name,
              variantLabel: variant.label,
              error: '价格已变更',
              errorCode: 'PRICE_CHANGED',
              oldPrice: priceSnapshot,
              newPrice: currentPrice,
              severity: 'warning' // 价格变化只是警告，不是错误
            })
          }
        }
        
        // 验证库存是否变化（如果提供了库存快照）
        if (stockSnapshot !== undefined && stockSnapshot !== variant.stock) {
          errors.push({
            materialId,
            variantId,
            materialName: material.name,
            variantLabel: variant.label,
            error: '库存已变化',
            errorCode: 'STOCK_CHANGED',
            oldStock: stockSnapshot,
            newStock: variant.stock,
            severity: 'info' // 库存变化只是信息提示
          })
        }
        
        // 检查是否接近安全库存
        if (variant.safetyStock && variant.stock - quantity <= variant.safetyStock) {
          const warningThreshold = variant.stockWarningThreshold || 0.8
          if (variant.stock - quantity <= variant.safetyStock * warningThreshold) {
            errors.push({
              materialId,
              variantId,
              materialName: material.name,
              variantLabel: variant.label,
              error: '库存即将低于安全库存',
              errorCode: 'LOW_STOCK_WARNING',
              safetyStock: variant.safetyStock,
              afterStock: variant.stock - quantity,
              severity: 'warning'
            })
          }
        }
        
        // 添加到验证通过的项目列表
        validatedItems.push({
          materialId,
          variantId,
          materialNo: material.materialNo,
          materialName: material.name,
          variantLabel: variant.label,
          quantity,
          currentStock: variant.stock,
          afterStock: variant.stock - quantity,
          price: isManager ? variant.costPrice : variant.salePrice,
          safetyStock: variant.safetyStock,
          unit: material.unit,
          valid: !errors.find(e => 
            e.materialId === materialId && 
            e.variantId === variantId && 
            e.errorCode !== 'PRICE_CHANGED' && 
            e.errorCode !== 'STOCK_CHANGED' &&
            e.errorCode !== 'LOW_STOCK_WARNING'
          )
        })
        
      } catch (err) {
        console.error(`[batchValidate] 验证物料失败 ${materialId}:`, err)
        errors.push({
          materialId,
          variantId,
          error: '验证失败: ' + err.toString(),
          errorCode: 'VALIDATION_ERROR'
        })
      }
    }
    
    // 分离错误和警告
    const criticalErrors = errors.filter(e => 
      !e.severity || e.severity === 'error'
    )
    const warnings = errors.filter(e => 
      e.severity === 'warning' || e.severity === 'info'
    )
    
    return {
      success: true,
      data: {
        valid: criticalErrors.length === 0,
        items: validatedItems,
        errors: criticalErrors,
        warnings: warnings,
        summary: {
          totalItems: items.length,
          validItems: validatedItems.filter(i => i.valid).length,
          errorCount: criticalErrors.length,
          warningCount: warnings.length
        }
      }
    }
    
  } catch (err) {
    console.error('[batchValidate] 批量验证失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}