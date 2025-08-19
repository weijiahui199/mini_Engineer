// 更新耗材（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const {
    materialId,
    name,
    category,
    description,
    unit,
    variants,
    defaultImage,
    status
  } = event
  
  if (!materialId) {
    return {
      success: false,
      error: '缺少耗材ID'
    }
  }
  
  try {
    // 构建更新数据
    const updateData = {
      updateTime: db.serverDate(),
      updatedBy: wxContext.OPENID
    }
    
    // 可选更新字段
    if (name !== undefined) updateData.name = name
    if (category !== undefined) updateData.category = category
    if (description !== undefined) updateData.description = description
    if (unit !== undefined) updateData.unit = unit
    if (defaultImage !== undefined) updateData.defaultImage = defaultImage
    if (status !== undefined) updateData.status = status
    
    // 处理variants更新
    if (variants !== undefined) {
      let totalStock = 0
      const processedVariants = variants.map((v, index) => {
        totalStock += (v.stock || 0)
        // 保留原有variantId或生成新的
        return {
          variantId: v.variantId || `V${Date.now()}_${index}`,
          label: v.label,
          costPrice: v.costPrice || 0,
          salePrice: v.salePrice || 0,
          stock: v.stock || 0,
          safetyStock: v.safetyStock || 0,
          imageUrl: v.imageUrl || ''
        }
      })
      updateData.variants = processedVariants
      updateData.totalStock = totalStock
    }
    
    // 执行更新
    const result = await db.collection('materials')
      .doc(materialId)
      .update({
        data: updateData
      })
    
    if (result.stats.updated === 0) {
      return {
        success: false,
        error: '耗材不存在或更新失败'
      }
    }
    
    // 记录操作日志
    await db.collection('material_logs').add({
      data: {
        materialId,
        type: 'update',
        operatorOpenid: wxContext.OPENID,
        operatorName: event.operatorName || '',
        reason: '更新耗材信息',
        detail: updateData,
        createTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      data: {
        updated: result.stats.updated
      }
    }
  } catch (err) {
    console.error('[update] 更新失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}