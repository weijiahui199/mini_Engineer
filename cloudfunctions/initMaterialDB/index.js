// 耗材管理系统数据库初始化云函数
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
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
        materialNo: 'MT20250819001',
        name: 'A4打印纸',
        category: 'paper',
        description: '80g A4规格打印纸，适用于日常办公打印',
        unit: '包',
        variants: [
          {
            variantId: 'V001',
            label: '70g 500张/包',
            costPrice: 15.00,
            salePrice: 25.00,
            stock: 100,
            safetyStock: 20,
            imageUrl: ''
          },
          {
            variantId: 'V002',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819002',
        name: '签字笔',
        category: 'writing',
        description: '办公用签字笔，书写流畅',
        unit: '支',
        variants: [
          {
            variantId: 'V003',
            label: '0.5mm 黑色',
            costPrice: 2.00,
            salePrice: 3.50,
            stock: 200,
            safetyStock: 50,
            imageUrl: ''
          },
          {
            variantId: 'V004',
            label: '0.5mm 蓝色',
            costPrice: 2.00,
            salePrice: 3.50,
            stock: 150,
            safetyStock: 30,
            imageUrl: ''
          },
          {
            variantId: 'V005',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819003',
        name: '订书机',
        category: 'writing',
        description: '标准型订书机，可装订20页',
        unit: '个',
        variants: [
          {
            variantId: 'V006',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819004',
        name: '订书钉',
        category: 'writing',
        description: '24/6规格订书钉',
        unit: '盒',
        variants: [
          {
            variantId: 'V007',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819005',
        name: '墨盒',
        category: 'print',
        description: 'HP原装墨盒',
        unit: '个',
        variants: [
          {
            variantId: 'V008',
            label: 'HP 803 黑色',
            costPrice: 80.00,
            salePrice: 120.00,
            stock: 20,
            safetyStock: 5,
            imageUrl: ''
          },
          {
            variantId: 'V009',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819006',
        name: '便利贴',
        category: 'paper',
        description: '3M便利贴，强粘性',
        unit: '本',
        variants: [
          {
            variantId: 'V010',
            label: '76x76mm 黄色',
            costPrice: 5.00,
            salePrice: 8.00,
            stock: 200,
            safetyStock: 50,
            imageUrl: ''
          },
          {
            variantId: 'V011',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819007',
        name: '文件夹',
        category: 'paper',
        description: '双夹文件夹，A4规格',
        unit: '个',
        variants: [
          {
            variantId: 'V012',
            label: 'A4 蓝色',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 100,
            safetyStock: 20,
            imageUrl: ''
          },
          {
            variantId: 'V013',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819008',
        name: '垃圾袋',
        category: 'clean',
        description: '加厚垃圾袋，办公室专用',
        unit: '卷',
        variants: [
          {
            variantId: 'V014',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819009',
        name: '抽纸',
        category: 'clean',
        description: '软抽面巾纸',
        unit: '包',
        variants: [
          {
            variantId: 'V015',
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
        createTime: db.serverDate(),
        updateTime: db.serverDate(),
        createdBy: wxContext.OPENID || 'system',
        updatedBy: wxContext.OPENID || 'system'
      },
      {
        materialNo: 'MT20250819010',
        name: '白板笔',
        category: 'writing',
        description: '可擦白板笔',
        unit: '支',
        variants: [
          {
            variantId: 'V016',
            label: '黑色',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 50,
            safetyStock: 10,
            imageUrl: ''
          },
          {
            variantId: 'V017',
            label: '红色',
            costPrice: 3.00,
            salePrice: 5.00,
            stock: 30,
            safetyStock: 10,
            imageUrl: ''
          },
          {
            variantId: 'V018',
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
    console.error('[initMaterialDB] 初始化失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}