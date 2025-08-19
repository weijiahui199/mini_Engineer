// 获取耗材列表
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

module.exports = async (event, wxContext) => {
  const {
    category = 'all',
    keyword = '',
    page = 1,
    pageSize = 20,
    status = 'active'
  } = event
  
  try {
    // 构建查询条件
    const where = {}
    
    // 状态筛选
    if (status !== 'all') {
      where.status = status
    }
    
    // 类目筛选
    if (category !== 'all') {
      where.category = category
    }
    
    // 关键词搜索（名称或描述）
    if (keyword) {
      where.name = db.RegExp({
        regexp: keyword,
        options: 'i'
      })
    }
    
    // 查询总数
    const countResult = await db.collection('materials')
      .where(where)
      .count()
    
    // 分页查询
    const skip = (page - 1) * pageSize
    const result = await db.collection('materials')
      .where(where)
      .orderBy('updateTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()
    
    // 获取用户角色，决定是否返回价格信息
    const userResult = await db.collection('users')
      .where({ openid: wxContext.OPENID })
      .get()
    
    const isManager = userResult.data.length > 0 && 
                     userResult.data[0].roleGroup === '经理'
    
    // 处理数据，非Manager过滤价格信息
    let materials = result.data
    if (!isManager) {
      materials = materials.map(item => {
        const filtered = { ...item }
        // 过滤variants中的价格信息
        if (filtered.variants) {
          filtered.variants = filtered.variants.map(v => {
            const { costPrice, salePrice, ...rest } = v
            return rest
          })
        }
        return filtered
      })
    }
    
    return {
      success: true,
      data: {
        list: materials,
        total: countResult.total,
        page,
        pageSize,
        hasMore: skip + materials.length < countResult.total
      }
    }
  } catch (err) {
    console.error('[list] 查询失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}