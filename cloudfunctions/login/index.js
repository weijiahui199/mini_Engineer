// 云函数：用户登录
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 生成token
function generateToken(openid) {
  const secret = 'mini-engineer-secret-2024'; // 密钥
  const hash = crypto.createHash('sha256');
  hash.update(openid + secret + Date.now());
  return hash.digest('hex');
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action, code, userInfo, cloudID, encryptedData, iv, isQuickLogin } = event
  
  try {
    // 处理获取手机号
    if (action === 'getPhoneNumber') {
      // 如果传入了cloudID，使用开放数据
      if (cloudID) {
        const res = await cloud.getOpenData({
          list: [cloudID]
        })
        return {
          success: true,
          data: res.list[0]
        }
      }
      
      return {
        success: false,
        message: '获取手机号失败'
      }
    }
    
    // 默认登录流程
    const openid = wxContext.OPENID
    const appid = wxContext.APPID
    
    if (!openid) {
      return {
        success: false,
        message: '获取openid失败'
      }
    }
    
    // 查询用户是否存在
    const userCollection = db.collection('users')
    const userQuery = await userCollection.where({
      openid: openid
    }).get()
    
    let userData = {}
    const now = new Date()
    
    if (userQuery.data.length === 0) {
      // 新用户，创建用户记录
      userData = {
        openid: openid,
        appid: appid,
        nickName: userInfo?.nickName || '微信用户',  // 默认用户名
        avatar: userInfo?.avatarUrl || '',  // 保存微信头像URL
        gender: userInfo?.gender || 0,
        country: userInfo?.country || '',
        province: userInfo?.province || '',
        city: userInfo?.city || '',
        language: userInfo?.language || 'zh_CN',
        createTime: now,
        lastLoginTime: now,
        loginCount: 1,
        roleGroup: '用户', // 默认角色组：普通用户
        department: '信息技术部',
        status: 'active',
        avatarUpdateTime: now,  // 记录头像更新时间
        isQuickLogin: isQuickLogin || false,  // 标记是否快速登录
        hasAuthorized: !isQuickLogin  // 是否已授权用户信息
      }
      
      // 插入新用户
      const addResult = await userCollection.add({
        data: userData
      })
      
      userData._id = addResult._id
    } else {
      // 老用户，更新登录信息
      userData = userQuery.data[0]
      
      // 更新用户信息
      const updateData = {
        lastLoginTime: now,
        loginCount: db.command.inc(1)
      }
      
      // 如果传入了新的用户信息，更新它（但快速登录用户后续授权时才更新）
      if (userInfo && !userData.isQuickLogin) {
        updateData.nickName = userInfo.nickName || userData.nickName
        updateData.avatar = userInfo.avatarUrl || userData.avatar
        updateData.gender = userInfo.gender ?? userData.gender
        updateData.country = userInfo.country || userData.country
        updateData.province = userInfo.province || userData.province
        updateData.city = userInfo.city || userData.city
        updateData.language = userInfo.language || userData.language
      }
      
      // 如果之前是快速登录，现在授权了，更新授权状态
      if (userData.isQuickLogin && userInfo && userInfo.avatarUrl && userInfo.avatarUrl !== '/assets/default-avatar.png') {
        updateData.hasAuthorized = true
        updateData.isQuickLogin = false
        updateData.nickName = userInfo.nickName
        updateData.avatar = userInfo.avatarUrl
        updateData.gender = userInfo.gender
        updateData.country = userInfo.country
        updateData.province = userInfo.province
        updateData.city = userInfo.city
        updateData.language = userInfo.language
      }
      
      await userCollection.doc(userData._id).update({
        data: updateData
      })
      
      // 合并更新后的数据
      userData = { ...userData, ...updateData }
    }
    
    // 生成token
    const token = generateToken(openid)
    
    // 记录登录日志
    await db.collection('login_logs').add({
      data: {
        userId: userData._id,
        openid: openid,
        loginTime: now,
        loginType: 'wechat',
        ip: wxContext.CLIENTIP || '',
        source: wxContext.SOURCE || ''
      }
    })
    
    // 返回登录结果
    return {
      success: true,
      data: {
        openid: openid,
        token: token,
        userInfo: {
          id: userData._id,
          openid: userData.openid,
          nickName: userData.nickName,
          avatar: userData.avatar,
          roleGroup: userData.roleGroup,
          department: userData.department,
          status: userData.status
        }
      },
      message: '登录成功'
    }
    
  } catch (error) {
    console.error('登录失败:', error)
    return {
      success: false,
      message: error.message || '登录失败',
      error: error
    }
  }
}