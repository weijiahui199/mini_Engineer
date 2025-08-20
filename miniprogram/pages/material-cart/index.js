// 申领车页面
const app = getApp()

Page({
  data: {
    // 购物车数据
    cartItems: [],
    selectedCount: 0,
    totalPrice: '0.00',
    selectAll: false,
    manageMode: false,
    
    // 用户信息
    userInfo: null,
    isManager: false,
    
    // 工单相关
    selectedTicket: null,
    recentTickets: [],
    showTicketSelector: false,
    ticketTab: 'my',
    ticketSearchKeyword: '',
    allTickets: [],
    filteredTickets: [],
    
    // 备注
    note: '',
    
    // 占位图
    placeholderImage: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3E暂无图片%3C/text%3E%3C/svg%3E'
  },

  onLoad() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (!userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({
      userInfo,
      isManager: userInfo.roleGroup === '经理' || userInfo.roleGroup === 'Manager'
    })
    
    // 加载购物车数据
    this.loadCartData()
    
    // 加载最近工单
    this.loadRecentTickets()
  },

  onShow() {
    // 刷新购物车数据
    this.loadCartData()
  },

  // 加载购物车数据
  loadCartData() {
    try {
      const cart = wx.getStorageSync('materialCart') || {}
      const cartItems = []
      
      Object.keys(cart).forEach(cartKey => {
        const item = cart[cartKey]
        // 检查库存预警
        const stockWarning = item.quantity > item.stock * 0.8 // 申领数量超过库存80%时预警
        
        cartItems.push({
          ...item,
          cartKey,
          selected: true, // 默认选中
          stockWarning
        })
      })
      
      this.setData({ cartItems }, () => {
        this.calculateTotal()
      })
    } catch (e) {
      console.error('[material-cart] 加载购物车失败:', e)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 计算合计
  calculateTotal() {
    let selectedCount = 0
    let totalPrice = 0
    
    this.data.cartItems.forEach(item => {
      if (item.selected) {
        selectedCount += item.quantity
        if (this.data.isManager && item.salePrice) {
          totalPrice += item.salePrice * item.quantity
        }
      }
    })
    
    const selectAll = this.data.cartItems.length > 0 && 
                     this.data.cartItems.every(item => item.selected)
    
    this.setData({
      selectedCount,
      totalPrice: totalPrice.toFixed(2),
      selectAll
    })
  },

  // 切换全选
  toggleSelectAll() {
    const selectAll = !this.data.selectAll
    const cartItems = this.data.cartItems.map(item => ({
      ...item,
      selected: selectAll
    }))
    
    this.setData({ cartItems, selectAll }, () => {
      this.calculateTotal()
    })
  },

  // 切换选择
  toggleSelect(e) {
    const index = e.currentTarget.dataset.index
    const cartItems = [...this.data.cartItems]
    cartItems[index].selected = !cartItems[index].selected
    
    this.setData({ cartItems }, () => {
      this.calculateTotal()
    })
  },

  // 更新数量
  updateQuantity(e) {
    const { index, action } = e.currentTarget.dataset
    const item = this.data.cartItems[index]
    
    let newQuantity = item.quantity
    if (action === 'minus' && newQuantity > 1) {
      newQuantity--
    } else if (action === 'plus' && newQuantity < item.stock) {
      newQuantity++
    } else if (action === 'plus' && newQuantity >= item.stock) {
      wx.showToast({
        title: `库存仅剩${item.stock}${item.unit}`,
        icon: 'none'
      })
      return
    }
    
    this.updateItemQuantity(index, newQuantity)
  },

  // 输入数量
  onQuantityInput(e) {
    const index = e.currentTarget.dataset.index
    const value = parseInt(e.detail.value) || 0
    const item = this.data.cartItems[index]
    
    if (value > item.stock) {
      wx.showToast({
        title: `最多可申领${item.stock}${item.unit}`,
        icon: 'none'
      })
      this.updateItemQuantity(index, item.stock)
      return
    }
    
    this.updateItemQuantity(index, Math.max(1, value))
  },

  // 更新商品数量
  updateItemQuantity(index, quantity) {
    const cartItems = [...this.data.cartItems]
    const item = cartItems[index]
    item.quantity = quantity
    item.stockWarning = quantity > item.stock * 0.8
    
    // 更新本地存储
    const cart = wx.getStorageSync('materialCart') || {}
    cart[item.cartKey].quantity = quantity
    wx.setStorageSync('materialCart', cart)
    
    this.setData({ cartItems }, () => {
      this.calculateTotal()
    })
  },

  // 删除商品
  deleteItem(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.cartItems[index]
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${item.materialName}"吗？`,
      success: (res) => {
        if (res.confirm) {
          // 从购物车移除
          const cartItems = [...this.data.cartItems]
          cartItems.splice(index, 1)
          
          // 更新本地存储
          const cart = wx.getStorageSync('materialCart') || {}
          delete cart[item.cartKey]
          wx.setStorageSync('materialCart', cart)
          
          this.setData({ cartItems }, () => {
            this.calculateTotal()
          })
          
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
        }
      }
    })
  },

  // 切换管理模式
  toggleManageMode() {
    this.setData({
      manageMode: !this.data.manageMode
    })
  },

  // 加载最近工单
  async loadRecentTickets() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: {
          action: 'getMyTickets',
          status: 'processing',
          limit: 3
        }
      })
      
      if (res.result.success) {
        this.setData({
          recentTickets: res.result.data || []
        })
      }
    } catch (err) {
      console.error('[material-cart] 加载工单失败:', err)
    }
  },

  // 快速选择工单
  quickSelectTicket(e) {
    const ticket = e.currentTarget.dataset.ticket
    this.setData({
      selectedTicket: {
        ...ticket,
        statusText: this.getStatusText(ticket.status)
      }
    })
  },

  // 选择工单
  selectTicket() {
    this.setData({
      showTicketSelector: true,
      ticketTab: 'my'
    })
    this.loadTickets()
  },

  // 加载工单列表
  async loadTickets() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      let action = 'getMyTickets'
      let data = {}
      
      if (this.data.ticketTab === 'all') {
        action = 'getAllTickets'
        data.limit = 50
      } else if (this.data.ticketTab === 'recent') {
        action = 'getMyTickets'
        data.limit = 20
      } else {
        action = 'getMyTickets'
        data.status = 'processing'
        data.limit = 20
      }
      
      const res = await wx.cloud.callFunction({
        name: 'submitTicket',
        data: { action, ...data }
      })
      
      if (res.result.success) {
        const tickets = (res.result.data || []).map(ticket => ({
          ...ticket,
          statusText: this.getStatusText(ticket.status),
          createTimeText: this.formatTime(ticket.createTime)
        }))
        
        this.setData({
          allTickets: tickets,
          filteredTickets: this.filterTickets(tickets)
        })
      }
    } catch (err) {
      console.error('[material-cart] 加载工单失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 切换工单Tab
  switchTicketTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ ticketTab: tab })
    this.loadTickets()
  },

  // 搜索工单
  onTicketSearch(e) {
    const keyword = e.detail.value
    this.setData({
      ticketSearchKeyword: keyword,
      filteredTickets: this.filterTickets(this.data.allTickets, keyword)
    })
  },

  // 过滤工单
  filterTickets(tickets, keyword = '') {
    if (!keyword) return tickets
    
    keyword = keyword.toLowerCase()
    return tickets.filter(ticket => {
      return ticket.ticketNo.toLowerCase().includes(keyword) ||
             ticket.title.toLowerCase().includes(keyword) ||
             (ticket.customerName && ticket.customerName.toLowerCase().includes(keyword))
    })
  },

  // 选择工单
  onSelectTicket(e) {
    const ticket = e.currentTarget.dataset.ticket
    this.setData({
      selectedTicket: ticket,
      showTicketSelector: false
    })
  },

  // 不关联工单
  selectNoTicket() {
    this.setData({
      selectedTicket: null,
      showTicketSelector: false
    })
  },

  // 关闭工单选择器
  closeTicketSelector() {
    this.setData({
      showTicketSelector: false
    })
  },

  // 阻止冒泡
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 输入备注
  onNoteInput(e) {
    this.setData({
      note: e.detail.value
    })
  },

  // 提交申领
  async submitRequisition() {
    if (this.data.selectedCount === 0) {
      wx.showToast({
        title: '请选择要申领的耗材',
        icon: 'none'
      })
      return
    }
    
    // 获取选中的商品
    const selectedItems = this.data.cartItems.filter(item => item.selected)
    
    // 检查库存
    const insufficientItems = selectedItems.filter(item => item.quantity > item.stock)
    if (insufficientItems.length > 0) {
      wx.showModal({
        title: '库存不足',
        content: `${insufficientItems[0].materialName} 库存不足，请调整数量`,
        showCancel: false
      })
      return
    }
    
    wx.showModal({
      title: '确认提交',
      content: `确定要申领${this.data.selectedCount}件耗材吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '提交中...' })
          
          try {
            // 准备提交数据
            const items = selectedItems.map(item => ({
              materialId: item.materialId,
              variantId: item.variantId,
              quantity: item.quantity
            }))
            
            const submitData = {
              action: 'submit',
              items,
              note: this.data.note
            }
            
            // 如果关联了工单
            if (this.data.selectedTicket) {
              submitData.ticketId = this.data.selectedTicket._id
              submitData.ticketNo = this.data.selectedTicket.ticketNo
            }
            
            // 调用云函数提交
            const result = await wx.cloud.callFunction({
              name: 'requisitionManager',
              data: submitData
            })
            
            if (result.result.success) {
              // 清空已提交的商品
              const cart = wx.getStorageSync('materialCart') || {}
              selectedItems.forEach(item => {
                delete cart[item.cartKey]
              })
              wx.setStorageSync('materialCart', cart)
              
              wx.hideLoading()
              wx.showToast({
                title: '申领成功',
                icon: 'success',
                duration: 2000
              })
              
              // 跳转到申领记录页面（如果有的话）
              setTimeout(() => {
                wx.navigateBack()
              }, 2000)
            } else {
              wx.hideLoading()
              wx.showModal({
                title: '申领失败',
                content: result.result.error || '请重试',
                showCancel: false
              })
            }
          } catch (err) {
            console.error('[material-cart] 提交失败:', err)
            wx.hideLoading()
            wx.showToast({
              title: '网络错误',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 去选耗材
  goToMaterialList() {
    wx.navigateTo({
      url: '/pages/material-list/index'
    })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待处理',
      'processing': '处理中',
      'resolved': '已解决',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  },

  // 格式化时间
  formatTime(time) {
    if (!time) return ''
    const date = new Date(time)
    const now = new Date()
    const diff = now - date
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) {
      return '今天'
    } else if (days === 1) {
      return '昨天'
    } else if (days < 7) {
      return `${days}天前`
    } else {
      return `${date.getMonth() + 1}月${date.getDate()}日`
    }
  }
})