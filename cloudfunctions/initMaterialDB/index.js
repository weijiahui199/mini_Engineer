// 耗材管理系统数据库初始化云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 生成物料编号
function generateMaterialNo() {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const random = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  return `MT${year}${month}${day}${random}`
}

// 生成规格ID
function generateVariantId() {
  return 'V' + Date.now() + Math.floor(Math.random() * 1000)
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { action = 'init' } = event
  
  console.log(`[initMaterialDB] action: ${action}`)
  
  try {
    switch (action) {
      case 'init':
        // 初始化数据库集合和测试数据
        return await initDatabase(wxContext)
        
      case 'fixVersion':
        // 修复现有物料的version字段
        return await fixVersionField()
        
      case 'checkStructure':
        // 检查数据库结构
        return await checkDatabaseStructure()
        
      default:
        return {
          success: false,
          error: '未知操作'
        }
    }
  } catch (err) {
    console.error(`[initMaterialDB] ${action} 执行失败:`, err)
    return {
      success: false,
      error: err.toString()
    }
  }
}

// 初始化数据库
async function initDatabase(wxContext) {
  try {
    console.log('[initMaterialDB] 开始初始化耗材管理数据库')
    
    // 创建集合（如果不存在会自动创建）
    const collections = ['materials', 'requisitions', 'material_logs']
    
    for (const collectionName of collections) {
      try {
        await db.createCollection(collectionName)
        console.log(`[initMaterialDB] 创建集合 ${collectionName} 成功`)
      } catch (err) {
        if (err.errCode === -502005) {
          console.log(`[initMaterialDB] 集合 ${collectionName} 已存在`)
        } else {
          throw err
        }
      }
    }
    
    // 初始化测试数据
    const testMaterials = [
      {
        materialNo: generateMaterialNo(),
        name: 'A4打印纸',
        category: 'paper',
        description: '80g A4规格打印纸，适用于日常办公打印',
        unit: '包',
        variants: [
          {
            variantId: generateVariantId(),
            label: '70g 500张/包',
            costPrice: 15.00,
            salePrice: 25.00,
            stock: 100,
            safetyStock: 20,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: '80g 500张/包',
            costPrice: 18.00,
            salePrice: 28.00,
            stock: 150,
            safetyStock: 30,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 250,
        status: 'active',
        version: 1, // 添加版本号字段
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '签字笔',
        category: 'writing',
        description: '办公用签字笔，书写流畅',
        unit: '支',
        variants: [
          {
            variantId: generateVariantId(),
            label: '0.5mm 黑色',
            costPrice: 2.00,
            salePrice: 3.50,
            stock: 200,
            safetyStock: 50,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: '0.5mm 蓝色',
            costPrice: 2.00,
            salePrice: 3.50,
            stock: 150,
            safetyStock: 30,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: '0.5mm 红色',
            costPrice: 2.00,
            salePrice: 3.50,
            stock: 80,
            safetyStock: 20,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 430,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '订书机',
        category: 'writing',
        description: '标准型订书机，可装订20页',
        unit: '个',
        variants: [
          {
            variantId: generateVariantId(),
            label: '标准型',
            costPrice: 12.00,
            salePrice: 20.00,
            stock: 30,
            safetyStock: 10,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 30,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '订书钉',
        category: 'writing',
        description: '24/6规格订书钉',
        unit: '盒',
        variants: [
          {
            variantId: generateVariantId(),
            label: '24/6规格 1000枚/盒',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 100,
            safetyStock: 20,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 100,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '墨盒',
        category: 'print',
        description: 'HP原装墨盒',
        unit: '个',
        variants: [
          {
            variantId: generateVariantId(),
            label: 'HP 803 黑色',
            costPrice: 80.00,
            salePrice: 120.00,
            stock: 20,
            safetyStock: 5,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: 'HP 803 彩色',
            costPrice: 100.00,
            salePrice: 150.00,
            stock: 15,
            safetyStock: 5,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 35,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '便利贴',
        category: 'paper',
        description: '3M便利贴，强粘性',
        unit: '本',
        variants: [
          {
            variantId: generateVariantId(),
            label: '76x76mm 黄色',
            costPrice: 5.00,
            salePrice: 8.00,
            stock: 200,
            safetyStock: 50,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: '76x76mm 混色',
            costPrice: 6.00,
            salePrice: 10.00,
            stock: 150,
            safetyStock: 30,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 350,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '文件夹',
        category: 'paper',
        description: '双夹文件夹，A4规格',
        unit: '个',
        variants: [
          {
            variantId: generateVariantId(),
            label: 'A4 蓝色',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 100,
            safetyStock: 20,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: 'A4 透明',
            costPrice: 4.00,
            salePrice: 6.00,
            stock: 80,
            safetyStock: 20,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 180,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '垃圾袋',
        category: 'clean',
        description: '加厚垃圾袋，办公室专用',
        unit: '卷',
        variants: [
          {
            variantId: generateVariantId(),
            label: '45x55cm 黑色 30只/卷',
            costPrice: 8.00,
            salePrice: 12.00,
            stock: 50,
            safetyStock: 10,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 50,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '抽纸',
        category: 'clean',
        description: '软抽面巾纸',
        unit: '包',
        variants: [
          {
            variantId: generateVariantId(),
            label: '200抽 3层',
            costPrice: 10.00,
            salePrice: 15.00,
            stock: 100,
            safetyStock: 20,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 100,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: generateMaterialNo(),
        name: '白板笔',
        category: 'writing',
        description: '可擦白板笔',
        unit: '支',
        variants: [
          {
            variantId: generateVariantId(),
            label: '黑色',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 50,
            safetyStock: 10,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: '红色',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 30,
            safetyStock: 10,
            imageUrl: ''
          },
          {
            variantId: generateVariantId(),
            label: '蓝色',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 30,
            safetyStock: 10,
            imageUrl: ''
          }
        ],
        defaultImage: '',
        totalStock: 110,
        status: 'active',
        version: 1,
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      }
    ]
    
    // 批量插入测试数据
    const materialsCollection = db.collection('materials')
    
    // 先检查是否已有数据
    const existingCount = await materialsCollection.count()
    if (existingCount.total === 0) {
      console.log('[initMaterialDB] 开始插入测试数据')
      
      for (const material of testMaterials) {
        await materialsCollection.add({
          data: material
        })
        console.log(`[initMaterialDB] 插入耗材: ${material.name}`)
      }
      
      console.log('[initMaterialDB] 测试数据插入完成')
    } else {
      console.log(`[initMaterialDB] 已有 ${existingCount.total} 条数据，跳过测试数据插入`)
    }
    
    return {
      success: true,
      message: '数据库初始化成功',
      collections: collections,
      testDataCount: testMaterials.length
    }
    
  } catch (err) {
    console.error('[initDatabase] 初始化失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}

// 修复现有物料的version字段
async function fixVersionField() {
  try {
    // 查询所有没有version字段的物料
    const materialsResult = await db.collection('materials')
      .where({
        version: _.exists(false)
      })
      .get()
    
    let fixedCount = 0
    
    for (const material of materialsResult.data) {
      try {
        await db.collection('materials')
          .doc(material._id)
          .update({
            data: {
              version: 1,
              updateTime: db.serverDate()
            }
          })
        fixedCount++
        console.log(`修复物料版本号: ${material.name}`)
      } catch (err) {
        console.error(`修复物料版本号失败 ${material.name}:`, err)
      }
    }
    
    return {
      success: true,
      data: {
        totalMaterials: materialsResult.data.length,
        fixedCount
      },
      message: `成功修复 ${fixedCount} 个物料的版本号`
    }
    
  } catch (err) {
    console.error('[fixVersionField] 修复版本号失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}

// 检查数据库结构
async function checkDatabaseStructure() {
  const report = {
    collections: {},
    issues: [],
    recommendations: []
  }
  
  try {
    // 检查materials集合
    const materialsCount = await db.collection('materials').count()
    report.collections.materials = {
      exists: true,
      count: materialsCount.total
    }
    
    // 获取一个样本检查结构
    const sampleMaterial = await db.collection('materials').limit(1).get()
    if (sampleMaterial.data.length > 0) {
      const sample = sampleMaterial.data[0]
      report.collections.materials.sampleData = {
        hasVersion: !!sample.version,
        hasVariants: !!sample.variants,
        hasTotalStock: !!sample.totalStock,
        variantsCount: sample.variants ? sample.variants.length : 0
      }
      
      if (!sample.version) {
        report.issues.push('物料缺少version字段，需要修复')
        report.recommendations.push('运行 action: fixVersion 来修复')
      }
    }
    
    // 检查requisitions集合
    const requisitionsCount = await db.collection('requisitions').count()
    report.collections.requisitions = {
      exists: true,
      count: requisitionsCount.total
    }
    
    // 检查material_logs集合
    const logsCount = await db.collection('material_logs').count()
    report.collections.material_logs = {
      exists: true,
      count: logsCount.total
    }
    
    // 总结
    if (report.issues.length === 0) {
      report.status = 'healthy'
      report.message = '数据库结构正常'
    } else {
      report.status = 'needs_attention'
      report.message = '数据库结构需要优化'
    }
    
    return {
      success: true,
      data: report
    }
    
  } catch (err) {
    console.error('[checkDatabaseStructure] 检查失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}