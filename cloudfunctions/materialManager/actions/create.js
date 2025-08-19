// 创建耗材（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 生成耗材编号
function generateMaterialNo() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `MT${year}${month}${day}${random}`
}

module.exports = async (event, wxContext) => {
  const {
    name,
    category,
    description,
    unit,
    variants,
    defaultImage
  } = event
  
  // 参数验证
  if (!name || !category || !unit || !variants || variants.length === 0) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }
  
  try {
    // 计算总库存
    let totalStock = 0
    const processedVariants = variants.map((v, index) => {
      totalStock += (v.stock || 0)
      return {
        variantId: `V${Date.now()}_${index}`,
        label: v.label,
        costPrice: v.costPrice || 0,
        salePrice: v.salePrice || 0,
        stock: v.stock || 0,
        safetyStock: v.safetyStock || 0,
        imageUrl: v.imageUrl || ''
      }
    })
    
    // 创建耗材记录
    const materialData = {
      materialNo: generateMaterialNo(),
      name,
      category,
      description: description || '',
      unit,
      variants: processedVariants,
      defaultImage: defaultImage || '',
      totalStock,
      status: 'active',
      createTime: db.serverDate(),
      updateTime: db.serverDate(),
      createdBy: wxContext.OPENID,
      updatedBy: wxContext.OPENID
    }
    
    const result = await db.collection('materials').add({
      data: materialData
    })
    
    // 记录操作日志
    await db.collection('material_logs').add({
      data: {
        materialId: result._id,
        type: 'create',
        operatorOpenid: wxContext.OPENID,
        operatorName: event.operatorName || '',
        reason: '新增耗材',
        detail: materialData,
        createTime: db.serverDate()
      }
    })
    
    return {
      success: true,
      data: {
        _id: result._id,
        materialNo: materialData.materialNo
      }
    }
  } catch (err) {
    console.error('[create] 创建失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}