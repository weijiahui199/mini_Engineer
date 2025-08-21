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
    placeholderImage: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"%3E%3Crect width="160" height="160" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3E暂无图片%3C/text%3E%3C/svg%3E',
    
    // 滚动视图高度
    scrollViewHeight: 0
  },

  onLoad() {
    console.log('=== 申领车页面加载 ===')
    
    // 获取系统信息以调试宽度问题
    const systemInfo = wx.getSystemInfoSync()
    console.log('系统信息:', {
      screenWidth: systemInfo.screenWidth,
      windowWidth: systemInfo.windowWidth,
      windowHeight: systemInfo.windowHeight,
      pixelRatio: systemInfo.pixelRatio,
      model: systemInfo.model
    })
    
    // 使用系统导航栏后，动态计算可用高度
    // 需要在onReady中计算实际高度
    
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
  
  onReady() {
    // 页面渲染完成后计算高度
    setTimeout(() => {
      this.calculateScrollViewHeight()
    }, 100)
  },

  onShow() {
    console.log('=== 页面显示 ===')
    // 刷新购物车数据
    this.loadCartData()
    
    // 页面显示后检查元素宽度和高度
    setTimeout(() => {
      this.checkElementWidths()
      this.checkScrollability()
      this.calculateScrollViewHeight()
    }, 300)
  },
  
  // 动态计算scroll-view高度
  calculateScrollViewHeight() {
    console.log('=== 动态计算scroll-view高度 ===')
    const query = wx.createSelectorQuery()
    const systemInfo = wx.getSystemInfoSync()
    
    // 使用系统导航栏后，只需计算页面内部元素
    query.select('.action-bar').boundingClientRect()
    query.select('.info-banner').boundingClientRect()
    query.select('.bottom-bar').boundingClientRect()
    
    query.exec((res) => {
      const actionBarHeight = res[0] ? res[0].height : 60
      const infoBannerHeight = res[1] ? res[1].height : 60
      const bottomBarHeight = res[2] ? res[2].height : 80
      
      // 计算可用高度：窗口高度 - 操作栏 - 信息栏 - 底部栏
      const scrollViewHeight = systemInfo.windowHeight - actionBarHeight - infoBannerHeight - bottomBarHeight
      
      console.log('动态计算结果:', {
        windowHeight: systemInfo.windowHeight,
        actionBarHeight,
        infoBannerHeight,
        bottomBarHeight,
        scrollViewHeight
      })
      
      this.setData({
        scrollViewHeight
      })
    })
  },
  
  // 检查元素宽度（调试用）
  checkElementWidths() {
    console.log('=== 检查元素宽度 ===')
    const query = wx.createSelectorQuery()
    
    // 检查主要容器
    query.select('.container').boundingClientRect()
    query.select('.action-bar').boundingClientRect()
    query.select('.content-wrapper').boundingClientRect()
    query.select('.content-scroll').boundingClientRect()
    query.select('.list-container').boundingClientRect()
    query.select('.list-item-card').boundingClientRect()
    
    query.exec((res) => {
      const screenWidth = wx.getSystemInfoSync().windowWidth
      const elements = [
        { name: 'container', rect: res[0] },
        { name: 'action-bar', rect: res[1] },
        { name: 'content-wrapper', rect: res[2] },
        { name: 'content-scroll', rect: res[3] },
        { name: 'list-container', rect: res[4] },
        { name: 'list-item-card', rect: res[5] }
      ]
      
      console.log(`屏幕宽度: ${screenWidth}px`)
      
      elements.forEach(({ name, rect }) => {
        if (rect) {
          console.log(`${name}:`, {
            width: rect.width,
            left: rect.left,
            right: rect.right,
            超出: rect.width > screenWidth ? `是(${rect.width - screenWidth}px)` : '否'
          })
          
          if (rect.width > screenWidth) {
            console.error(`⚠️ ${name} 超出屏幕宽度！超出: ${rect.width - screenWidth}px`)
          }
        } else {
          console.log(`${name}: 未找到元素`)
        }
      })
    })
  },
  
  // 检查滚动能力（调试用）
  checkScrollability() {
    console.log('=== 检查滚动能力 ===')
    const query = wx.createSelectorQuery()
    const systemInfo = wx.getSystemInfoSync()
    
    // 检查各个容器的高度
    query.select('.container').boundingClientRect()
    query.select('.content-wrapper').boundingClientRect()
    query.select('.content-scroll').boundingClientRect()
    query.select('.content-scroll').scrollOffset()
    query.select('.bottom-bar').boundingClientRect()
    query.select('.section-card').boundingClientRect()
    
    query.exec((res) => {
      console.log('系统高度信息:', {
        screenHeight: systemInfo.screenHeight,
        windowHeight: systemInfo.windowHeight,
        safeArea: systemInfo.safeArea
      })
      
      if (res[0]) {
        console.log('container 高度:', {
          height: res[0].height,
          top: res[0].top,
          bottom: res[0].bottom
        })
      }
      
      if (res[1]) {
        console.log('content-wrapper 高度:', {
          height: res[1].height,
          top: res[1].top,
          bottom: res[1].bottom
        })
      }
      
      if (res[2]) {
        console.log('content-scroll 高度:', {
          height: res[2].height,
          top: res[2].top,
          bottom: res[2].bottom,
          scrollHeight: res[2].scrollHeight
        })
      }
      
      if (res[3]) {
        console.log('content-scroll 滚动信息:', {
          scrollTop: res[3].scrollTop,
          scrollHeight: res[3].scrollHeight
        })
      }
      
      if (res[4]) {
        console.log('bottom-bar 位置:', {
          height: res[4].height,
          top: res[4].top,
          bottom: res[4].bottom
        })
      }
      
      if (res[5]) {
        console.log('最后一个section-card:', {
          height: res[5].height,
          top: res[5].top,
          bottom: res[5].bottom
        })
      }
      
      // 检查是否可滚动
      if (res[2] && res[3]) {
        const scrollableHeight = res[2].height
        const contentHeight = res[3].scrollHeight || res[2].scrollHeight
        const canScroll = contentHeight > scrollableHeight
        
        console.log('滚动状态:', {
          可滚动: canScroll,
          容器高度: scrollableHeight,
          内容高度: contentHeight,
          差值: contentHeight - scrollableHeight
        })
        
        if (!canScroll) {
          console.warn('⚠️ 页面无法滚动！内容高度小于或等于容器高度')
        }
      }
    })
  },
  
  // 测试滚动功能
  testScroll() {
    console.log('=== 测试滚动功能 ===')
    
    // 创建 scroll-view 的上下文
    const scrollViewContext = wx.createSelectorQuery().select('.content-scroll')
    
    if (scrollViewContext) {
      // 获取 scroll-view 的信息
      scrollViewContext.node((node) => {
        if (node) {
          console.log('ScrollView 节点信息:', node)
        }
      }).exec()
      
      // 获取滚动信息
      scrollViewContext.scrollOffset((res) => {
        console.log('ScrollView 滚动信息:', {
          scrollTop: res.scrollTop,
          scrollLeft: res.scrollLeft,
          scrollHeight: res.scrollHeight,
          scrollWidth: res.scrollWidth
        })
        
        // 尝试程序滚动到底部
        if (res.scrollHeight > 0) {
          console.log('尝试滚动到底部...')
          this.setData({
            scrollTop: res.scrollHeight
          }, () => {
            console.log('已设置 scrollTop 为:', res.scrollHeight)
          })
        }
      }).exec()
    }
  },

  // 加载购物车数据
  loadCartData() {
    console.log('加载购物车数据...')
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
        console.log('购物车数据已设置:', {
          itemCount: cartItems.length,
          items: cartItems
        })
        this.calculateTotal()
        
        // 数据加载后再次检查宽度
        if (cartItems.length > 0) {
          setTimeout(() => {
            this.checkElementWidths()
          }, 100)
        }
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
    if (action === 'minus' && newQuantity > 0) {
      newQuantity--
      // 如果数量减到0，删除该项
      if (newQuantity === 0) {
        this.deleteItem(e)
        return
      }
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

  // 清空全部购物车
  clearAllCart() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有申领耗材吗？',
      confirmText: '清空',
      confirmColor: '#FF4444',
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
    // 每10次滚动输出一次日志，避免日志过多
    if (!this.scrollLogCount) this.scrollLogCount = 0
    this.scrollLogCount++
    if (this.scrollLogCount % 10 === 0) {
      console.log('滚动中...', {
        scrollTop: e.detail.scrollTop,
        scrollHeight: e.detail.scrollHeight,
        deltaY: e.detail.deltaY
      })
    }
  },
  
  // 滚动到顶部
  onScrollToUpper(e) {
    console.log('滚动到顶部', e)
  },
  
  // 滚动到底部
  onScrollToLower(e) {
    console.log('滚动到底部', e)
    // 检查底部内容是否被遮挡
    this.checkBottomContent()
  },
  
  // 检查底部内容
  checkBottomContent() {
    const query = wx.createSelectorQuery()
    query.select('.notice-card').boundingClientRect()
    query.select('.bottom-bar').boundingClientRect()
    query.select('.bottom-safe-area').boundingClientRect()
    
    query.exec((res) => {
      console.log('底部内容位置:', {
        noticeCard: res[0] ? { bottom: res[0].bottom, visible: res[0].top < wx.getSystemInfoSync().windowHeight } : null,
        bottomBar: res[1] ? { top: res[1].top, height: res[1].height } : null,
        safeArea: res[2] ? { height: res[2].height } : null
      })
      
      if (res[0] && res[1]) {
        const overlap = res[0].bottom - res[1].top
        if (overlap > 0) {
          console.error(`⚠️ 底部内容被遮挡！遮挡高度: ${overlap}px`)
        }
      }
    })
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
      }
    })
  },

  // 选择工单
  selectTicket() {
    console.log('打开工单选择弹窗')
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
    console.log('关闭工单选择弹窗')
    // 添加关闭动画
    this.setData({
      showTicketSelector: false,
      ticketSearchKeyword: '' // 清空搜索关键词
    })
  },
  
  // 弹窗手势 - 开始触摸
  onSheetTouchStart(e) {
    this.sheetStartY = e.touches[0].clientY
    this.sheetStartTime = Date.now()
    console.log('弹窗触摸开始:', this.sheetStartY)
  },
  
  // 弹窗手势 - 移动
  onSheetTouchMove(e) {
    const currentY = e.touches[0].clientY
    const deltaY = currentY - this.sheetStartY
    
    // 如果向下滑动超过50px，显示关闭提示
    if (deltaY > 50) {
      // 可以添加视觉反馈
    }
  },
  
  // 弹窗手势 - 结束触摸
  onSheetTouchEnd(e) {
    const endY = e.changedTouches[0].clientY
    const deltaY = endY - this.sheetStartY
    const deltaTime = Date.now() - this.sheetStartTime
    const velocity = deltaY / deltaTime
    
    console.log('弹窗触摸结束:', {
      deltaY,
      deltaTime,
      velocity
    })
    
    // 如果向下滑动超过100px或速度超过0.5，关闭弹窗
    if (deltaY > 100 || velocity > 0.5) {
      this.closeTicketSelector()
    }
  },
  
  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，仅用于阻止事件冒泡
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