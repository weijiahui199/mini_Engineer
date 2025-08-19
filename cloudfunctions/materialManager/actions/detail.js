// 获取耗材详情
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
    // 查询耗材详情
    const result = await db.collection('materials')
      .doc(materialId)
      .get()
    
    if (!result.data) {
      return {
        success: false,
        error: '耗材不存在'
      }
    }
    
    // 获取用户角色
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    const isManager = userResult.data.length > 0 && 
                     userResult.data[0].roleGroup === '经理'
    
    // 处理数据，非Manager过滤价格信息
    let material = result.data
    if (!isManager) {
      // 过滤variants中的价格信息
      if (material.variants) {
        material.variants = material.variants.map(v => {
          const { costPrice, salePrice, ...rest } = v
          return rest
        })
      }
    }
    
    return {
      success: true,
      data: material
    }
  } catch (err) {
    console.error('[detail] 查询失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}