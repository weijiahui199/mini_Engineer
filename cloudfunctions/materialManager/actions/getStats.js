// 获取统计数据（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  try {
    // 获取所有耗材
    const materialsResult = await db.collection('materials')
      .where({
        status: _.neq('deleted')
      })
      .get()
    
    const materials = materialsResult.data
    
    let totalTypes = 0
    let lowStock = 0
    let outOfStock = 0
    let totalValue = 0
    
    materials.forEach(material => {
      if (material.variants && material.variants.length > 0) {
        totalTypes += material.variants.length
        
        material.variants.forEach(variant => {
          // 计算库存状态
          const stock = variant.stock || 0
          const safetyStock = variant.safetyStock || 20
          
          if (stock === 0) {
            outOfStock++
          } else if (stock <= safetyStock) {
            lowStock++
          }
          
          // 计算总价值（成本价 * 库存）
          totalValue += (variant.costPrice || 0) * stock
        })
      }
    })
    
    return {
      success: true,
      data: {
        totalTypes,
        lowStock,
        outOfStock,
        totalValue: totalValue.toFixed(2)
      }
    }
  } catch (err) {
    console.error('[getStats] 获取统计数据失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}