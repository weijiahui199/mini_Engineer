// 导出库存CSV（Manager专用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 格式化日期
function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

// 生成CSV内容
function generateCSV(data, headers) {
  const BOM = '\uFEFF' // UTF-8 BOM，解决中文乱码
  let csv = BOM + headers.join(',') + '\n'
  
  data.forEach(row => {
    csv += row.map(cell => {
      // 处理特殊字符
      if (cell === null || cell === undefined) {
        return ''
      }
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',') + '\n'
  })
  
  return csv
}

// 获取类目中文名
function getCategoryName(category) {
  const categoryMap = {
    'paper': '纸张',
    'writing': '书写',
    'office': '办公',
    'print': '打印耗材',
    'clean': '清洁用品'
  }
  return categoryMap[category] || category
}

module.exports = async (event, wxContext) => {
  const {
    filters = {}
  } = event
  
  try {
    // 构建查询条件
    const where = {
      status: filters.status || 'active'
    }
    
    if (filters.category && filters.category !== 'all') {
      where.category = filters.category
    }
    
    // 查询所有符合条件的耗材
    const result = await db.collection('materials')
      .where(where)
      .orderBy('materialNo', 'asc')
      .limit(1000) // 最多导出1000条
      .get()
    
    if (result.data.length === 0) {
      return {
        success: false,
        error: '没有找到符合条件的耗材'
      }
    }
    
    // 准备CSV数据
    const headers = [
      '耗材编号',
      '耗材名称',
      '类目',
      '规格',
      '单位',
      '当前库存',
      '安全库存',
      '库存状态',
      '成本价',
      '销售价',
      '更新时间'
    ]
    
    const rows = []
    
    // 处理每个耗材的每个规格
    result.data.forEach(material => {
      material.variants.forEach(variant => {
        const stockStatus = variant.stock <= variant.safetyStock ? '预警' : '正常'
        rows.push([
          material.materialNo,
          material.name,
          getCategoryName(material.category),
          variant.label,
          material.unit,
          variant.stock,
          variant.safetyStock,
          stockStatus,
          variant.costPrice.toFixed(2),
          variant.salePrice.toFixed(2),
          formatDate(material.updateTime)
        ])
      })
    })
    
    // 生成CSV内容
    const csvContent = generateCSV(rows, headers)
    
    // 生成文件名
    const fileName = `库存导出_${formatDate(new Date()).replace(/[:\s]/g, '_')}.csv`
    
    return {
      success: true,
      data: {
        csvContent,
        fileName,
        rowCount: rows.length
      }
    }
  } catch (err) {
    console.error('[exportInventory] 导出失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}