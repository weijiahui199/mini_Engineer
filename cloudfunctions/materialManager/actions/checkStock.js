// 检查库存
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const { items } = event // items: [{materialId, variantId, quantity}]
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      error: '缺少物品信息'
    }
  }
  
  try {
    const checkResults = []
    
    for (const item of items) {
      const { materialId, variantId, quantity } = item
      
      // 查询耗材信息
      const materialResult = await db.collection('materials')
        .doc(materialId)
        .get()
      
      if (!materialResult.data) {
        checkResults.push({
          materialId,
          variantId,
          available: false,
          reason: '耗材不存在'
        })
        continue
      }
      
      const material = materialResult.data
      
      // 查找对应规格
      const variant = material.variants.find(v => v.variantId === variantId)
      if (!variant) {
        checkResults.push({
          materialId,
          variantId,
          available: false,
          reason: '规格不存在'
        })
        continue
      }
      
      // 检查库存
      if (variant.stock < quantity) {
        checkResults.push({
          materialId,
          variantId,
          materialName: material.name,
          variantLabel: variant.label,
          requested: quantity,
          available: variant.stock,
          sufficient: false,
          reason: `库存不足，仅剩${variant.stock}${material.unit}`
        })
      } else {
        checkResults.push({
          materialId,
          variantId,
          materialName: material.name,
          variantLabel: variant.label,
          requested: quantity,
          available: variant.stock,
          sufficient: true
        })
      }
    }
    
    // 判断整体是否通过
    const allSufficient = checkResults.every(r => r.sufficient !== false)
    
    return {
      success: true,
      data: {
        allSufficient,
        details: checkResults
      }
    }
  } catch (err) {
    console.error('[checkStock] 检查失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}