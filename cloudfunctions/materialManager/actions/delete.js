// 删除耗材（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

module.exports = async (event, wxContext) => {
  const { materialId } = event
  
  if (!materialId) {
    return {
      success: false,
      error: '缺少耗材ID'
    }
  }
  
  try {
    // 先查询耗材信息（用于日志记录）
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
    
    // 软删除：更新状态为deleted
    const result = await db.collection('materials')
      .doc(materialId)
      .update({
        data: {
          status: 'deleted',
          updateTime: db.serverDate(),
          updatedBy: wxContext.OPENID,
          deletedTime: db.serverDate(),
          deletedBy: wxContext.OPENID
        }
      })
    
    // 记录操作日志
    await db.collection('material_logs').add({
      data: {
        materialId,
        type: 'delete',
        operatorOpenid: wxContext.OPENID,
        operatorName: event.operatorName || '',
        reason: event.reason || '删除耗材',
        detail: {
          materialNo: material.materialNo,
          name: material.name
        },
        createTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      data: {
        deleted: result.stats.updated > 0
      }
    }
  } catch (err) {
    console.error('[delete] 删除失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}