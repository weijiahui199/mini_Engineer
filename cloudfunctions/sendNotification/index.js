const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, ticketData, broadcastData } = event
  
  switch(type) {
    case 'new_ticket':
      return await notifyNewTicket(ticketData)
    case 'ticket_cancelled':
      return await notifyCancelled(ticketData)
    case 'manager_notice':
      return await notifyManagerMessage(broadcastData)
    case 'ticket_complete':
      // 如果需要通知用户工单完成（跨小程序场景需要其他方式）
      return await notifyComplete(ticketData)
    default:
      return { 
        code: 400,
        success: false,
        message: '无效的通知类型'
      }
  }
}

// 新工单通知（通知所有工程师）
async function notifyNewTicket(ticket) {
  try {
    // 获取所有工程师和经理
    const engineers = await db.collection('users')
      .where({
        roleGroup: db.command.in(['工程师', '经理'])
      })
      .get()
    
    if (engineers.data.length === 0) {
      return {
        code: 404,
        success: false,
        message: '没有找到工程师'
      }
    }
    
    // 批量发送通知（使用正确的模板字段）
    const results = await Promise.all(
      engineers.data.map(eng => 
        sendToEngineer(eng.openid, 'new_ticket', {
          ticketTitle: truncate(ticket.title || '新工单', 20),        // 工单标题
          ticketNo: ticket.ticketNo || '未知',                        // 工单编号
          contactName: truncate(ticket.submitterName || '用户', 20),  // 联系人
          contactPhone: ticket.phone || '未提供',                     // 联系电话
          address: truncate(ticket.location || ticket.company || '未提供', 20)  // 用户地址
        }, `pages/ticket-detail/index?id=${ticket._id}`)
      )
    )
    
    const successCount = results.filter(r => r.success).length
    
    return { 
      code: 200,
      success: true, 
      message: `通知发送完成`,
      total: engineers.data.length,
      successCount,
      failCount: engineers.data.length - successCount
    }
  } catch (error) {
    console.error('发送新工单通知失败:', error)
    return {
      code: 500,
      success: false,
      message: '发送通知失败',
      error: error.message
    }
  }
}

// 工单取消通知（通知已接单的工程师）
async function notifyCancelled(ticket) {
  if (!ticket.assigneeOpenid) {
    return { 
      code: 400,
      success: false, 
      message: '无指派工程师' 
    }
  }
  
  try {
    const result = await sendToEngineer(
      ticket.assigneeOpenid, 
      'ticket_cancelled',
      {
        serviceName: truncate(ticket.title || '工单服务', 20),  // 服务项目
        ticketNo: ticket.ticketNo || '未知'                     // 订单编号
      },
      `pages/ticket-detail/index?id=${ticket._id}`
    )
    
    return result
  } catch (error) {
    console.error('发送取消通知失败:', error)
    return {
      code: 500,
      success: false,
      message: '发送通知失败',
      error: error.message
    }
  }
}

// 经理群发通知
async function notifyManagerMessage(data) {
  const { targetType, title, content, priority, targets, page, params } = data
  
  try {
    // 获取目标用户列表
    let targetList = []
    if (targetType === 'all_engineers') {
      const engineers = await db.collection('users')
        .where({ 
          roleGroup: db.command.in(['工程师', '经理']) 
        })
        .field({ openid: true })
        .get()
      targetList = engineers.data.map(e => e.openid)
    } else if (targets && targets.length > 0) {
      targetList = targets // 指定人员列表
    } else {
      return {
        code: 400,
        success: false,
        message: '未指定通知目标'
      }
    }
    
    // 构建跳转页面路径
    let targetPage = page || 'pages/dashboard/index'  // 默认跳转到首页
    if (params) {
      // 如果有参数，拼接到URL中
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${value}`)
        .join('&')
      targetPage = `${targetPage}?${queryString}`
    }
    
    // 批量发送
    const results = await Promise.all(
      targetList.map(openid => 
        sendToEngineer(openid, 'manager_notice', {
          title: truncate(title, 20),
          sendTime: formatTime(new Date()),
          content: truncate(content, 20),
          priority: priority === 'high' ? '紧急' : '普通'
        }, targetPage)
      )
    )
    
    const successCount = results.filter(r => r.success).length
    
    return {
      code: 200,
      success: true,
      message: '群发完成',
      total: targetList.length,
      successCount,
      failCount: targetList.length - successCount
    }
  } catch (error) {
    console.error('经理群发失败:', error)
    return {
      code: 500,
      success: false,
      message: '群发失败',
      error: error.message
    }
  }
}

// 工单完成通知（预留接口，跨小程序场景可能需要其他实现方式）
async function notifyComplete(ticket) {
  // 工程师端一般不需要发送完成通知给用户
  // 如果是同一个小程序，可以实现
  // 如果是不同小程序，需要通过服务器中转或其他方式
  return {
    code: 200,
    success: true,
    message: '工单完成通知（需要配置用户端模板）'
  }
}

// 发送通知给工程师的通用函数
async function sendToEngineer(openid, type, data, page) {
  try {
    // 检查是否有可用的订阅次数
    const hasQuota = await checkSubscriptionQuota(openid, type)
    if (!hasQuota) {
      console.log(`用户 ${openid} 没有 ${type} 类型的订阅配额`)
      return { success: false, reason: 'no_quota' }
    }
    
    // 获取模板ID（实际使用时需要替换为真实的模板ID）
    const templateId = getTemplateId(type)
    if (!templateId) {
      return { success: false, reason: 'no_template' }
    }
    
    // 构建消息数据
    const messageData = buildMessageData(type, data)
    
    // 发送订阅消息
    const result = await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: templateId,
      page: page || 'pages/dashboard/index',
      data: messageData,
      miniprogramState: 'developer' // 开发版，正式发布改为 'formal'
    })
    
    // 消耗一次订阅配额
    await consumeSubscription(openid, type)
    
    return { success: true }
  } catch (error) {
    console.error(`发送通知失败 [${type}]:`, error)
    return { success: false, error: error.message }
  }
}

// 检查订阅配额
async function checkSubscriptionQuota(openid, type) {
  try {
    const result = await db.collection('user_subscriptions')
      .where({
        openid: openid,
        type: type,
        used: false
      })
      .limit(1)
      .get()
    
    return result.data.length > 0
  } catch (error) {
    console.error('检查订阅配额失败:', error)
    return false
  }
}

// 消耗订阅配额
async function consumeSubscription(openid, type) {
  try {
    // 查找一条未使用的订阅记录
    const result = await db.collection('user_subscriptions')
      .where({
        openid: openid,
        type: type,
        used: false
      })
      .limit(1)
      .get()
    
    if (result.data.length > 0) {
      // 标记为已使用
      await db.collection('user_subscriptions')
        .doc(result.data[0]._id)
        .update({
          data: {
            used: true,
            usedAt: db.serverDate()
          }
        })
    }
  } catch (error) {
    console.error('消耗订阅配额失败:', error)
  }
}

// 获取模板ID（已配置实际的模板ID）
function getTemplateId(type) {
  const templates = {
    'new_ticket': 'A5RmnL45TNMGA7a7MYeL7jSPOHuIVprbbVKqwvZsZ2c',      // 待接单提醒
    'ticket_cancelled': 'CHwAIAdTsyFcH1yP108bo3M3oCQccy2MmkDA82UhRYQ',  // 服务取消通知
    'manager_notice': 'TEMPLATE_ID_MANAGER',      // 经理通知模板ID（待申请）
    'ticket_complete': 'TEMPLATE_ID_COMPLETE'     // 完成通知模板ID（如果需要）
  }
  return templates[type] || null
}

// 构建消息数据（根据实际模板字段）
function buildMessageData(type, data) {
  switch(type) {
    case 'new_ticket':
      // 待接单提醒模板字段
      return {
        thing4: { value: data.ticketTitle },           // 工单标题
        character_string21: { value: data.ticketNo },  // 工单编号
        thing14: { value: data.contactName },          // 联系人
        phone_number1: { value: data.contactPhone },   // 联系电话
        thing2: { value: data.address }                // 用户地址
      }
    case 'ticket_cancelled':
      // 服务取消通知模板字段
      return {
        thing1: { value: data.serviceName },           // 服务项目
        character_string4: { value: data.ticketNo }    // 订单编号
      }
    case 'manager_notice':
      // 经理通知（待申请模板）
      return {
        thing1: { value: data.title },
        time2: { value: data.sendTime },
        thing3: { value: data.content },
        phrase4: { value: data.priority }
      }
    default:
      return {}
  }
}

// 工具函数：格式化时间
function formatTime(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

// 工具函数：截断字符串
function truncate(str, maxLength) {
  if (!str) return ''
  // 处理thing类型（20字符限制）
  let len = 0
  let result = ''
  for (let i = 0; i < str.length; i++) {
    // 中文字符算2个，英文算1个
    len += str.charCodeAt(i) > 127 ? 2 : 1
    if (len <= maxLength) {
      result += str[i]
    } else {
      return result.length > 0 ? result : str.substring(0, 1)
    }
  }
  return result
}