const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    const { action } = event
    
    switch (action) {
      case 'getUserProfile':
        return await getUserProfile(event, wxContext)
      case 'updateUserProfile':
        return await updateUserProfile(event, wxContext)
      case 'syncProfileFromTicket':
        return await syncProfileFromTicket(event, wxContext)
      default:
        return {
          code: 400,
          message: '无效的操作类型'
        }
    }
  } catch (error) {
    console.error('用户信息管理云函数执行错误:', error)
    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message
    }
  }
}

// 获取用户信息
async function getUserProfile(event, wxContext) {
  try {
    const result = await db.collection('users')
      .where({
        openid: wxContext.OPENID
      })
      .get()
    
    if (result.data.length > 0) {
      const profile = result.data[0]
      // 添加默认角色和工程师信息
      if (!profile.role) {
        profile.role = 'engineer' // 默认为工程师
      }
      if (!profile.engineerInfo) {
        profile.engineerInfo = {
          employeeId: '',
          skills: [],
          certifications: [],
          workingStatus: 'available', // available, busy, offline
          currentTasks: 0,
          maxTasks: 5
        }
      }
      return {
        code: 200,
        data: {
          company: profile.company || '',
          department: profile.department || '',
          phone: profile.phone || '',
          name: profile.name || '',
          email: profile.email || '',
          employeeId: profile.employeeId || '',
          avatar: profile.avatar || '',
          roleGroup: profile.roleGroup || '用户',
          lastUpdateTime: profile.updateTime,
          createTime: profile.createTime
        }
      }
    } else {
      // 用户信息不存在，返回空信息
      return {
        code: 200,
        data: {
          company: '',
          department: '',
          phone: '',
          name: '',
          email: '',
          employeeId: '',
          avatar: '',
          roleGroup: '用户',
          lastUpdateTime: null,
          createTime: null
        }
      }
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return {
      code: 500,
      message: '获取用户信息失败'
    }
  }
}

// 更新用户信息
async function updateUserProfile(event, wxContext) {
  const { company, department, phone, name, email, employeeId, source = 'manual' } = event
  
  try {
    console.log('更新用户信息请求:', {
      openid: wxContext.OPENID,
      company,
      department,
      phone,
      name,
      email,
      employeeId,
      source
    })
    
    // 检查是否已存在用户信息
    const existResult = await db.collection('users')
      .where({
        openid: wxContext.OPENID
      })
      .get()
    
    console.log('查询现有用户信息结果:', existResult)
    
    if (existResult.data.length > 0) {
      // 更新现有记录
      const userId = existResult.data[0]._id
      console.log('更新现有记录，ID:', userId)
      
      const updateData = {
        updateTime: db.serverDate()
      }
      
      // 只更新非空字段
      if (company !== undefined) updateData.company = company || ''
      if (department !== undefined) updateData.department = department || ''
      if (phone !== undefined) updateData.phone = phone || ''
      if (name !== undefined) updateData.name = name || ''
      if (email !== undefined) updateData.email = email || ''
      if (employeeId !== undefined) updateData.employeeId = employeeId || ''
      
      const updateResult = await db.collection('users')
        .doc(userId)
        .update({
          data: updateData
        })
      
      console.log('更新结果:', updateResult)
      
      // 获取更新后的完整用户信息
      const updatedUser = await db.collection('users')
        .doc(userId)
        .get()
      
      return {
        code: 200,
        message: '用户信息更新成功',
        data: updatedUser.data
      }
    } else {
      // 用户不存在，这种情况不应该发生（用户应该先通过login云函数创建）
      console.error('用户不存在，无法更新信息')
      return {
        code: 404,
        message: '用户不存在，请先登录'
      }
    }
  } catch (error) {
    console.error('更新用户信息失败，详细错误:', error)
    console.error('错误堆栈:', error.stack)
    return {
      code: 500,
      message: `更新用户信息失败: ${error.message}`,
      error: error.message
    }
  }
}

// 从工单信息同步到用户信息
async function syncProfileFromTicket(event, wxContext) {
  const { company, department, phone, updateMode = 'fill_empty' } = event
  
  if (!company && !department && !phone) {
    return {
      code: 400,
      message: '没有可同步的信息'
    }
  }
  
  try {
    // 获取当前用户信息
    const existResult = await db.collection('users')
      .where({
        openid: wxContext.OPENID
      })
      .get()
    
    if (existResult.data.length > 0) {
      // 用户信息已存在，根据更新模式决定是否更新
      const currentProfile = existResult.data[0]
      let shouldUpdate = false
      let updateData = {
        updateTime: db.serverDate()
      }
      
      if (updateMode === 'fill_empty') {
        // 只填充空字段
        if (!currentProfile.company && company && company.trim()) {
          updateData.company = company.trim()
          shouldUpdate = true
        }
        
        if (!currentProfile.department && department && department.trim()) {
          updateData.department = department.trim()
          shouldUpdate = true
        }
        
        if (!currentProfile.phone && phone && phone.trim()) {
          updateData.phone = phone.trim()
          shouldUpdate = true
        }
        
      } else if (updateMode === 'overwrite') {
        // 覆盖更新
        if (company) {
          updateData.company = company.trim()
          shouldUpdate = true
        }
        if (department) {
          updateData.department = department.trim()
          shouldUpdate = true
        }
        if (phone) {
          updateData.phone = phone.trim()
          shouldUpdate = true
        }
      }
      
      if (shouldUpdate) {
        await db.collection('users')
          .doc(currentProfile._id)
          .update({
            data: updateData
          })
      }
      
      return {
        code: 200,
        message: shouldUpdate ? '用户信息同步成功' : '无需更新',
        data: {
          updated: shouldUpdate,
          profile: { ...currentProfile, ...updateData }
        }
      }
    } else {
      // 用户信息不存在，这种情况不应该发生
      console.error('用户不存在，无法同步信息')
      return {
        code: 404,
        message: '用户不存在，请先登录'
      }
    }
  } catch (error) {
    console.error('同步用户信息失败:', error)
    return {
      code: 500,
      message: '同步用户信息失败'
    }
  }
} 