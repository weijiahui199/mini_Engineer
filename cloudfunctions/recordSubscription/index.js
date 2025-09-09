const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { acceptedTemplateIds = [], typeMap = {} } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  try {
    // 批量创建订阅记录（每个模板ID一条）
    const records = []
    acceptedTemplateIds.forEach(templateId => {
      records.push({
        openid,
        type: typeMap[templateId] || 'unknown',
        templateId: templateId,
        used: false,
        subscribedAt: new Date(),
        createTime: db.serverDate()
      })
    })
    
    if (records.length === 0) {
      return { 
        code: 400,
        message: '没有需要记录的订阅',
        success: false 
      }
    }
    
    // 批量插入订阅记录
    const promises = records.map(record => {
      return db.collection('user_subscriptions').add({
        data: record
      })
    })
    
    await Promise.all(promises)
    
    // 记录订阅统计信息
    await updateSubscriptionStats(openid, records)
    
    return { 
      code: 200,
      message: '订阅记录成功',
      success: true, 
      added: records.length 
    }
  } catch (error) {
    console.error('记录订阅失败:', error)
    return { 
      code: 500,
      message: '记录订阅失败',
      success: false, 
      error: error.message 
    }
  }
}

// 更新订阅统计信息
async function updateSubscriptionStats(openid, records) {
  try {
    // 检查用户是否存在统计记录
    const statsResult = await db.collection('subscription_stats')
      .where({ openid })
      .get()
    
    if (statsResult.data.length === 0) {
      // 创建新的统计记录
      await db.collection('subscription_stats').add({
        data: {
          openid,
          totalSubscriptions: records.length,
          subscriptionsByType: countByType(records),
          lastSubscribeAt: new Date(),
          createTime: db.serverDate()
        }
      })
    } else {
      // 更新现有统计记录
      const stats = statsResult.data[0]
      const newStats = {
        totalSubscriptions: db.command.inc(records.length),
        lastSubscribeAt: new Date(),
        updateTime: db.serverDate()
      }
      
      // 更新分类统计
      const typeCount = countByType(records)
      Object.keys(typeCount).forEach(type => {
        newStats[`subscriptionsByType.${type}`] = db.command.inc(typeCount[type])
      })
      
      await db.collection('subscription_stats')
        .doc(stats._id)
        .update({
          data: newStats
        })
    }
  } catch (error) {
    console.error('更新订阅统计失败:', error)
    // 统计失败不影响主流程
  }
}

// 按类型统计数量
function countByType(records) {
  const count = {}
  records.forEach(record => {
    if (!count[record.type]) {
      count[record.type] = 0
    }
    count[record.type]++
  })
  return count
}