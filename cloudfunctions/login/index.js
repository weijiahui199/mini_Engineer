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
  const { action, code, loginType, cloudID, encryptedData, iv } = event
  
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
      // 生成默认昵称
      const randomSuffix = Math.random().toString(36).substr(2, 4).toUpperCase();
      const defaultNickname = '用户' + randomSuffix;
      
      userData = {
        _openid: openid,  // 添加 _openid 字段用于权限控制
        openid: openid,
        appid: appid,
        nickName: defaultNickname,  // 默认昵称
        avatar: '',  // 空头像，让用户后续上传
        gender: 0,
        country: '',
        province: '',
        city: '',
        language: 'zh_CN',
        createTime: now,
        lastLoginTime: now,
        loginCount: 1,
        roleGroup: '用户', // 默认角色组：普通用户
        department: '信息技术部',
        status: 'active',
        avatarUpdateTime: now,
        loginType: loginType || 'normal'  // 记录登录类型
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
      
      // 不再自动更新用户信息，让用户在个人中心手动更新
      
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