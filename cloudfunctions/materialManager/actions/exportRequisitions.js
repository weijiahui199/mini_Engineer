// 导出申领记录CSV（Manager专用）
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

module.exports = async (event, wxContext) => {
  const {
    filters = {}
  } = event
  
  try {
    // 构建查询条件
    const where = {}
    
    // 时间范围筛选
    if (filters.startDate || filters.endDate) {
      where.createTime = {}
      if (filters.startDate) {
        where.createTime = _.gte(new Date(filters.startDate))
      }
      if (filters.endDate) {
        where.createTime = Object.assign(where.createTime || {}, 
          _.lte(new Date(filters.endDate + ' 23:59:59')))
      }
    }
    
    // 申领人筛选
    if (filters.applicant) {
      where.applicantName = db.RegExp({
        regexp: filters.applicant,
        options: 'i'
      })
    }
    
    // 状态筛选
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status
    }
    
    // 查询申领记录
    const result = await db.collection('requisitions')
      .where(where)
      .orderBy('createTime', 'desc')
      .limit(1000) // 最多导出1000条
      .get()
    
    if (result.data.length === 0) {
      return {
        success: false,
        error: '没有找到符合条件的申领记录'
      }
    }
    
    // 准备CSV数据
    const headers = [
      '申领单号',
      '申领时间',
      '申领人',
      '部门',
      '耗材编号',
      '耗材名称',
      '规格',
      '数量',
      '成本价',
      '销售价',
      '小计',
      '关联工单',
      '状态',
      '备注'
    ]
    
    const rows = []
    
    // 处理每个申领单的每个明细
    result.data.forEach(requisition => {
      requisition.items.forEach(item => {
        rows.push([
          requisition.requisitionNo,
          formatDate(requisition.createTime),
          requisition.applicantName,
          requisition.department || '',
          item.materialNo,
          item.name,
          item.variantLabel,
          item.quantity,
          item.costPrice ? item.costPrice.toFixed(2) : '0.00',
          item.salePrice ? item.salePrice.toFixed(2) : '0.00',
          item.subtotal ? item.subtotal.toFixed(2) : '0.00',
          requisition.ticketNo || '',
          requisition.status === 'completed' ? '已完成' : '已取消',
          requisition.note || ''
        ])
      })
    })
    
    // 添加汇总行
    const totalQuantity = rows.reduce((sum, row) => sum + Number(row[7]), 0)
    const totalCost = rows.reduce((sum, row) => sum + (Number(row[8]) * Number(row[7])), 0)
    const totalAmount = rows.reduce((sum, row) => sum + Number(row[10]), 0)
    
    rows.push([])
    rows.push([
      '汇总',
      '',
      '',
      '',
      '',
      '',
      '',
      totalQuantity,
      '',
      '',
      totalAmount.toFixed(2),
      '',
      `共${result.data.length}个申领单`,
      ''
    ])
    
    // 生成CSV内容
    const csvContent = generateCSV(rows, headers)
    
    // 生成文件名
    const fileName = `申领记录_${formatDate(new Date()).replace(/[:\s]/g, '_')}.csv`
    
    return {
      success: true,
      data: {
        csvContent,
        fileName,
        rowCount: rows.length - 2, // 不包括空行和汇总行
        summary: {
          totalOrders: result.data.length,
          totalQuantity,
          totalCost: totalCost.toFixed(2),
          totalAmount: totalAmount.toFixed(2)
        }
      }
    }
  } catch (err) {
    console.error('[exportRequisitions] 导出失败:', err)
    return {
      success: false,
      error: err.toString()
    }
  }
}