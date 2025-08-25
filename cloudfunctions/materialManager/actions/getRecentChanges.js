// 获取最近库存变动（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const { limit = 10 } = event
  
  try {
    // 获取最近的库存变动日志
    const logsResult = await db.collection('material_logs')
      .orderBy('createTime', 'desc')
      .limit(limit)
      .get()
    
    const logs = logsResult.data
    
    // 批量获取相关的耗材信息
    const materialIds = [...new Set(logs.map(log => log.materialId))]
    const materialsResult = await db.collection('materials')
      .where({
        _id: _.in(materialIds)
      })
      .get()
    
    const materialsMap = {}
    materialsResult.data.forEach(m => {
      materialsMap[m._id] = m
    })
    
    // 组装返回数据
    const changes = logs.map(log => {
      const material = materialsMap[log.materialId] || {}
      const variant = material.variants?.find(v => v.variantId === log.variantId)
      
      return {
        ...log,
        materialName: material.name || '未知耗材',
        variantLabel: variant?.label || '',
        unit: material.unit || ''
      }
    })
    
    return {
      success: true,
      data: changes
    }
  } catch (err) {
    console.error('[getRecentChanges] 获取最近变动失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}