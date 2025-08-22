// 申领车页面
const app = getApp()

Page({
  data: {
    // 购物车数据
    cartItems: [],
    selectedCount: 0,
    totalPrice: '0.00',
    selectAll: false,
    
    // 用户信息
    userInfo: null,
    isManager: false,
    
    // 工单相关
    selectedTicket: null,
    selectedTicketId: '', // 用于TDesign Radio组件
    recentTickets: [],
    showTicketSelector: false,
    ticketTab: 'my',
    ticketSearchKeyword: '',
    allTickets: [],
    filteredTickets: [],
    
    // 备注
    note: '',
    
    // 占位图
    placeholderImage: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3E暂无图片%3C/text%3E%3C/svg%3E',
    
    // TDesign左滑删除按钮配置
    swipeRightBtns: [{
      text: '',  // 不显示文字，使用图标
      className: 'swipe-delete-btn'
    }],
    
    // 图标路径
    plusIcon: '/assets/icons/common/plus.png',
    
    // 配置项
    stockWarningThreshold: 0.8 // 库存预警阈值（80%）
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
    
    // 检查用户角色权限
    const validRoles = ['工程师', 'Engineer', '经理', 'Manager']
    if (!validRoles.includes(userInfo.roleGroup)) {
      wx.showModal({
        title: '权限不足',
        content: '只有工程师和经理可以申领耗材',
        showCancel: false,
        success: () => wx.navigateBack()
      })
      return
    }
    
    // 获取app实例和数据库（参考工单页面的做法）
    this.app = getApp()
    this.db = this.app.globalData.db || wx.cloud.database()
    
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
        const stockWarning = item.quantity > item.stock * this.data.stockWarningThreshold
        
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
  
  
  // 左滑删除操作
  onSwipeAction(e) {
    const index = e.currentTarget.dataset.index
    // 直接删除，不需要判断action
    this.removeItem(index)
  },
  
  // 删除单个商品
  removeItem(index) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该耗材吗？',
      success: (res) => {
        if (res.confirm) {
          const cartItems = [...this.data.cartItems]
          const removedItem = cartItems.splice(index, 1)[0]
          
          // 更新本地存储
          const cart = wx.getStorageSync('materialCart') || {}
          delete cart[removedItem.cartKey]
          wx.setStorageSync('materialCart', cart)
          
          this.setData({ cartItems }, () => {
            this.calculateTotal()
            wx.showToast({
              title: '已删除',
              icon: 'success'
            })
          })
        }
      }
    })
  },

  // 数量变化 - 适配TDesign Stepper
  onQuantityChange(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    const item = this.data.cartItems[index]
    
    if (value > item.stock) {
      wx.showToast({
        title: `最多可申领${item.stock}${item.unit}`,
        icon: 'none'
      })
      this.updateItemQuantity(index, item.stock)
      return
    }
    
    if (value === 0) {
      // 数量为0时删除
      this.removeItem(index)
      return
    }
    
    this.updateItemQuantity(index, value)
  },

  // 更新商品数量
  updateItemQuantity(index, quantity) {
    const cartItems = [...this.data.cartItems]
    const item = cartItems[index]
    item.quantity = quantity
    item.stockWarning = quantity > item.stock * this.data.stockWarningThreshold
    
    // 更新本地存储
    const cart = wx.getStorageSync('materialCart') || {}
    cart[item.cartKey].quantity = quantity
    wx.setStorageSync('materialCart', cart)
    
    this.setData({ cartItems }, () => {
      this.calculateTotal()
    })
  },

  // 清空全部购物车
  clearAllCart() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有申领耗材吗？',
      confirmText: '清空',
      confirmColor: '#e34d59',
      success: (res) => {
        if (res.confirm) {
          // 清空本地存储
          wx.removeStorageSync('materialCart')
          // 清空页面数据
          this.setData({
            cartItems: [],
            selectAll: false,
            totalPrice: '0.00',
            totalCount: 0,
            selectedCount: 0
          })
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  },

  // 长按显示删除菜单
  showDeleteMenu(e) {
    const { index } = e.currentTarget.dataset
    const item = this.data.cartItems[index]
    
    wx.showActionSheet({
      itemList: ['删除该耗材'],
      itemColor: '#FF4444',
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deleteItem(e)
        }
      }
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
  
  
  // 滚动事件监听
  onScroll(e) {
    // 滚动事件处理（如需要可以添加业务逻辑）
  },
  
  // 滚动到顶部
  onScrollToUpper(e) {
    // 滚动到顶部处理
  },
  
  // 滚动到底部
  onScrollToLower(e) {
    // 滚动到底部处理
  },
  

  // 加载最近工单（参考工单列表页的实现方式）
  async loadRecentTickets() {
    try {
      const openid = this.data.userInfo.openid || this.app.globalData.openid
      let query = {}
      
      if (this.data.isManager) {
        // 经理看所有处理中的工单
        query = { status: 'processing' }
      } else {
        // 工程师只看自己负责的处理中工单
        query = { 
          assigneeOpenid: openid, 
          status: 'processing' 
        }
      }
      
      // 查询处理中工单（最近3个）
      const res = await this.db.collection('tickets')
        .where(query)
        .orderBy('updateTime', 'desc')
        .limit(3)
        .get()
      
      // 格式化工单数据
      const tickets = res.data.map(ticket => this.formatTicket(ticket))
      
      this.setData({
        recentTickets: tickets
      })
    } catch (err) {
      console.error('[material-cart] 加载最近工单失败:', err)
      // 加载失败时设置空数组
      this.setData({
        recentTickets: []
      })
    }
  },

  // 快速选择工单
  quickSelectTicket(e) {
    const ticket = e.currentTarget.dataset.ticket
    this.setData({
      selectedTicket: {
        ...ticket,
        statusText: this.getStatusText(ticket.status)
      },
      selectedTicketId: ticket._id
    })
  },
  
  // 移除已选工单
  removeSelectedTicket() {
    this.setData({
      selectedTicket: null,
      selectedTicketId: ''
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

  // 加载工单列表（使用直接数据库查询）
  async loadTickets() {
    wx.showLoading({ title: '加载中...' })
    
    try {
      const openid = this.data.userInfo.openid || this.app.globalData.openid
      const _ = this.db.command
      let query = {}
      let limit = 20
      
      // 根据Tab构建查询条件
      if (this.data.ticketTab === 'all') {
        // 全部工单 - 根据角色判断
        if (this.data.isManager) {
          // 经理可以看所有工单
          query = {}
          limit = 50
        } else {
          // 工程师只能选择自己负责的工单（必须先接单）
          query = { assigneeOpenid: openid }
          limit = 30
        }
      } else if (this.data.ticketTab === 'recent') {
        // 最近工单
        if (this.data.isManager) {
          // 经理看所有最近工单
          query = {}
          limit = 20
        } else {
          // 工程师只看自己负责的最近工单
          query = { assigneeOpenid: openid }
          limit = 20
        }
      } else {
        // 我的工单 - 处理中的
        if (this.data.isManager) {
          // 经理看所有处理中工单
          query = { status: 'processing' }
          limit = 20
        } else {
          // 工程师只看自己负责的处理中工单
          query = { 
            assigneeOpenid: openid, 
            status: 'processing' 
          }
          limit = 20
        }
      }
      
      // 执行查询
      const res = await this.db.collection('tickets')
        .where(query)
        .orderBy('updateTime', 'desc')
        .limit(limit)
        .get()
      
      // 格式化工单数据
      const tickets = res.data.map(ticket => this.formatTicket(ticket))
      
      this.setData({
        allTickets: tickets,
        filteredTickets: this.filterTickets(tickets, this.data.ticketSearchKeyword)
      })
    } catch (err) {
      console.error('[material-cart] 加载工单失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      // 设置空数组避免显示错误
      this.setData({
        allTickets: [],
        filteredTickets: []
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 工单弹窗可见性变化
  onTicketPopupChange(e) {
    this.setData({
      showTicketSelector: e.detail.visible
    })
    if (e.detail.visible) {
      this.loadTickets()
    }
  },
  
  // 工单Tab切换 - 适配TDesign Tabs
  onTicketTabChange(e) {
    const tab = e.detail.value
    this.setData({
      ticketTab: tab
    }, () => {
      this.loadTickets()
    })
  },
  
  // 工单搜索
  onTicketSearch(e) {
    const keyword = e.detail.value
    this.setData({
      ticketSearchKeyword: keyword,
      filteredTickets: this.filterTickets(this.data.allTickets, keyword)
    })
  },
  
  // 清空搜索
  clearSearch() {
    this.setData({
      ticketSearchKeyword: '',
      filteredTickets: this.data.allTickets
    })
  },
  
  // 选择工单项
  selectTicketItem(e) {
    const ticketId = e.currentTarget.dataset.ticketId
    this.setData({
      selectedTicketId: ticketId
    })
  },
  
  // 确认工单选择
  confirmTicketSelection() {
    const ticketId = this.data.selectedTicketId
    if (ticketId) {
      const ticket = this.data.allTickets.find(t => t._id === ticketId)
      this.setData({
        selectedTicket: ticket ? {
          ...ticket,
          statusText: this.getStatusText(ticket.status)
        } : null
      })
    } else {
      this.setData({
        selectedTicket: null
      })
    }
    this.closeTicketSelector()
  },
  
  // 关闭工单选择器
  closeTicketSelector() {
    this.setData({
      showTicketSelector: false
    })
  },
  
  // 切换工单Tab（旧方法保留兼容）
  switchTicketTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ ticketTab: tab })
    this.loadTickets()
  },
  
  // TDesign Tabs组件的change事件处理
  onTicketTabChange(e) {
    const tab = e.detail.value
    this.setData({ ticketTab: tab })
    this.loadTickets()
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
  
  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
  },

  // 输入备注 - 适配TDesign Textarea
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
            
            // 检查云函数调用是否成功
            if (!result) {
              throw new Error('云函数调用失败：返回结果为空')
            }
            
            if (!result.result) {
              throw new Error('云函数调用失败：返回结果格式错误')
            }
            
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
              const errorMsg = result.result.error || result.result.message || '未知错误'
              console.error('[material-cart] 申领失败:', errorMsg)
              wx.showModal({
                title: '申领失败',
                content: errorMsg,
                showCancel: false
              })
            }
          } catch (err) {
            console.error('[material-cart] 提交失败:', err)
            wx.hideLoading()
            
            // 详细的错误处理
            let errorTitle = '提交失败'
            let errorContent = '请检查网络连接后重试'
            
            if (err.errCode) {
              // 微信云函数特定错误
              switch (err.errCode) {
                case -1:
                  errorContent = '网络连接失败，请检查网络后重试'
                  break
                case -502:
                  errorContent = '云函数执行超时，请稍后重试'
                  break
                case -503:
                  errorContent = '云函数不存在或未部署'
                  errorTitle = '系统错误'
                  break
                case -504:
                  errorContent = '云函数执行失败，请联系管理员'
                  errorTitle = '系统错误'
                  break
                default:
                  errorContent = `系统错误(${err.errCode})：${err.errMsg || '请联系管理员'}`
                  errorTitle = '系统错误'
              }
            } else if (err.message) {
              errorContent = err.message
            }
            
            wx.showModal({
              title: errorTitle,
              content: errorContent,
              showCancel: false
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
      'cancelled': '已取消',
      'closed': '已关闭',
      'paused': '已暂停'
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
  },

  // 格式化工单数据（参考工单列表页的实现）
  formatTicket(ticket) {
    if (!ticket) return null
    
    const id = ticket._id || ticket.id || ''
    if (!id) return null
    
    // 确保status字段是干净的字符串
    const cleanStatus = ticket.status ? String(ticket.status).trim() : 'pending'
    
    // 判断是否是暂停状态
    let displayStatus = cleanStatus
    if (cleanStatus === 'pending' && ticket.assigneeOpenid) {
      displayStatus = 'paused'
    }
    
    return {
      _id: id,
      ticketNo: ticket.ticketNo || '',
      title: ticket.title || '未命名工单',
      status: displayStatus,
      statusText: this.getStatusText(displayStatus),
      
      // 提交人信息 - 注意字段名是 submitterName
      submitterName: ticket.submitterName || ticket.submitter || '未知',
      company: ticket.company || '',
      department: ticket.department || '',
      location: ticket.location || '',
      
      // 负责人信息
      assigneeOpenid: ticket.assigneeOpenid || '',
      assigneeName: ticket.assigneeName || '',
      
      // 时间信息
      createTime: ticket.createTime,
      createTimeText: this.formatTime(ticket.createTime),
      updateTime: ticket.updateTime || ticket.createTime
    }
  }
})