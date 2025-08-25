// 提交申领单（使用事务，直接扣减库存）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 生成申领单号
function generateRequisitionNo() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `RQ${year}${month}${day}${random}`
}

module.exports = async (event, wxContext) => {
  const {
    items,        // [{materialId, variantId, quantity, ...}]
    ticketId,     // 关联工单ID（可选）
    ticketNo,     // 关联工单号（可选）
    note          // 备注（可选）
  } = event
  
  // 参数验证
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      error: '申领清单不能为空'
    }
  }
  
  const openid = wxContext.OPENID
  
  // 最大重试次数（处理乐观锁冲突）
  const MAX_RETRIES = 3
  let retryCount = 0
  
  while (retryCount < MAX_RETRIES) {
    try {
      // 获取用户信息
      const userResult = await db.collection('users')
        .where({ openid })
        .get()
      
      if (userResult.data.length === 0) {
        return {
          success: false,
          error: '用户信息不存在'
        }
      }
      
      const user = userResult.data[0]
      
      // 开始事务
      const transaction = await db.startTransaction()
      
      try {
        const requisitionNo = generateRequisitionNo()
        const processedItems = []
        let totalQuantity = 0
        let totalAmount = 0
        
        // 处理每个申领项
        for (const item of items) {
          const { materialId, variantId, quantity } = item
          
          if (!materialId || !variantId || !quantity || quantity <= 0) {
            await transaction.rollback()
            return {
              success: false,
              error: '申领项参数无效'
            }
          }
          
          // 查询耗材信息（包含版本号）
          const materialResult = await transaction.collection('materials')
            .doc(materialId)
            .get()
          
          if (!materialResult.data) {
            await transaction.rollback()
            return {
              success: false,
              error: `耗材不存在: ${materialId}`
            }
          }
          
          const material = materialResult.data
          const currentVersion = material.version || 0 // 兼容没有version的旧数据
          const variantIndex = material.variants.findIndex(v => v.variantId === variantId)
          
          if (variantIndex === -1) {
            await transaction.rollback()
            return {
              success: false,
              error: `规格不存在: ${variantId}`
            }
          }
          
          const variant = material.variants[variantIndex]
          
          // 检查库存
          if (variant.stock < quantity) {
            await transaction.rollback()
            return {
              success: false,
              error: `库存不足: ${material.name} ${variant.label}，当前库存${variant.stock}，申领数量${quantity}`
            }
          }
          
          // 扣减库存（内存中）
          material.variants[variantIndex].stock -= quantity
          const newTotalStock = material.variants.reduce((sum, v) => sum + v.stock, 0)
          
          // 使用乐观锁更新耗材库存
          const updateResult = await transaction.collection('materials')
            .doc(materialId)
            .update({
              data: {
                variants: material.variants,
                totalStock: newTotalStock,
                version: _.inc(1), // 递增版本号
                updateTime: db.serverDate()
              }
            })
          
          // 检查更新是否成功（版本号匹配）
          if (updateResult.stats.updated === 0) {
            // 版本号不匹配，说明有并发修改
            await transaction.rollback()
            throw new Error('VERSION_CONFLICT')
          }
          
          // 记录库存变动日志
          await transaction.collection('material_logs').add({
            data: {
              materialId,
              variantId,
              type: 'out',
              quantity: -quantity,
              beforeStock: variant.stock + quantity,
              afterStock: variant.stock,
              requisitionId: requisitionNo,
              ticketId: ticketId || '',
              operatorOpenid: openid,
              operatorName: user.nickName || '',
              reason: `申领出库 ${requisitionNo}`,
              createTime: db.serverDate()
            }
          })
          
          // 准备申领明细数据
          const subtotal = (variant.salePrice || 0) * quantity
          totalQuantity += quantity
          totalAmount += subtotal
          
          processedItems.push({
            materialId,
            materialNo: material.materialNo,
            name: material.name,
            variantId,
            variantLabel: variant.label,
            quantity,
            costPrice: variant.costPrice || 0,
            salePrice: variant.salePrice || 0,
            stockSnapshot: variant.stock, // 添加库存快照
            subtotal
          })
        }
      
        // 创建申领单（添加可撤销时间）
        const requisitionData = {
          requisitionNo,
          applicantOpenid: openid,
          applicantName: user.nickName || '',
          department: user.department || 'IT部',
          ticketId: ticketId || '',
          ticketNo: ticketNo || '',
          items: processedItems,
          totalQuantity,
          totalAmount,
          status: 'completed', // 直接完成，无需审批
          completedTime: db.serverDate(),
          canCancelBefore: new Date(Date.now() + 5 * 60 * 1000), // 5分钟内可撤销
          note: note || '',
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
        
        const requisitionResult = await transaction.collection('requisitions').add({
          data: requisitionData
        })
        
        // 提交事务
        await transaction.commit()
        
        console.log(`[submit] 申领单创建成功: ${requisitionNo}`)
        
        return {
          success: true,
          data: {
            requisitionId: requisitionResult._id,
            requisitionNo,
            totalQuantity,
            totalAmount,
            itemCount: processedItems.length,
            canCancelBefore: requisitionData.canCancelBefore
          }
        }
        
      } catch (err) {
        // 回滚事务
        await transaction.rollback()
        
        // 如果是版本冲突，重试
        if (err.message === 'VERSION_CONFLICT') {
          retryCount++
          console.log(`[submit] 版本冲突，重试第${retryCount}次`)
          
          if (retryCount >= MAX_RETRIES) {
            return {
              success: false,
              error: '系统繁忙，请稍后重试'
            }
          }
          
          // 短暂延迟后重试
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount))
          continue
        }
        
        // 其他错误直接返回
        throw err
      }
      
    } catch (err) {
      console.error('[submit] 提交申领单失败:', err)
      return {
        success: false,
        error: err.toString()
      }
    }
  }
  
  // 不应该到达这里，但为了安全起见
  return {
    success: false,
    error: '提交失败，请重试'
  }
}