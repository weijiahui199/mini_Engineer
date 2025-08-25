// 更新价格（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const {
    materialId,
    variantId,
    costPrice,
    salePrice
  } = event
  
  if (!materialId || !variantId) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }
  
  try {
    // 获取当前耗材信息
    const materialResult = await db.collection('materials')
      .doc(materialId)
      .get()
    
    if (!materialResult.data) {
      return {
        success: false,
        error: '耗材不存在'
      }
    }
    
    const material = materialResult.data
    const variantIndex = material.variants.findIndex(v => v.variantId === variantId)
    
    if (variantIndex === -1) {
      return {
        success: false,
        error: '规格不存在'
      }
    }
    
    // 更新价格
    if (costPrice !== undefined && costPrice !== null) {
      material.variants[variantIndex].costPrice = parseFloat(costPrice)
    }
    
    if (salePrice !== undefined && salePrice !== null) {
      material.variants[variantIndex].salePrice = parseFloat(salePrice)
    }
    
    // 更新数据库
    const updateResult = await db.collection('materials')
      .doc(materialId)
      .update({
        data: {
          variants: material.variants,
          updateTime: db.serverDate(),
          updatedBy: wxContext.OPENID
        }
      })
    
    if (updateResult.stats.updated === 0) {
      throw new Error('更新失败')
    }
    
    // 记录价格变动日志
    await db.collection('material_logs').add({
      data: {
        materialId,
        variantId,
        type: 'price_change',
        beforePrice: {
          costPrice: material.variants[variantIndex].costPrice,
          salePrice: material.variants[variantIndex].salePrice
        },
        afterPrice: {
          costPrice: costPrice !== undefined ? costPrice : material.variants[variantIndex].costPrice,
          salePrice: salePrice !== undefined ? salePrice : material.variants[variantIndex].salePrice
        },
        operatorOpenid: wxContext.OPENID,
        operatorName: event.operatorName || '',
        reason: '价格调整',
        createTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      data: {
        materialId,
        variantId,
        costPrice: material.variants[variantIndex].costPrice,
        salePrice: material.variants[variantIndex].salePrice
      }
    }
  } catch (err) {
    console.error('[updatePrice] 更新价格失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}