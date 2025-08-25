// 获取库存预警列表（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  try {
    // 获取所有耗材
    const materialsResult = await db.collection('materials')
      .where({
        status: 'active'
      })
      .get()
    
    const alerts = []
    
    materialsResult.data.forEach(material => {
      if (material.variants && material.variants.length > 0) {
        material.variants.forEach(variant => {
          const stock = variant.stock || 0
          const safetyStock = variant.safetyStock || 20
          
          // 只返回库存不足的
          if (stock <= safetyStock) {
            alerts.push({
              materialId: material._id,
              materialNo: material.materialNo,
              name: material.name,
              variantId: variant.variantId,
              variantLabel: variant.label,
              currentStock: stock,
              safetyStock: safetyStock,
              unit: material.unit,
              category: material.category
            })
          }
        })
      }
    })
    
    // 按库存紧急程度排序（缺货的排前面）
    alerts.sort((a, b) => {
      if (a.currentStock === 0 && b.currentStock > 0) return -1
      if (a.currentStock > 0 && b.currentStock === 0) return 1
      return a.currentStock - b.currentStock
    })
    
    return {
      success: true,
      data: alerts
    }
  } catch (err) {
    console.error('[getStockAlerts] 获取库存预警失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}