// 耗材列表页面
const app = getApp()

Page({
  data: {
    // 列表数据
    materials: [],
    loading: true,
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    total: 0,
    
    // 搜索和筛选
    keyword: '',
    searchValue: '',
    currentCategory: 'popular',
    categories: [
      { value: 'popular', label: '常用', icon: '🔥' },
      { value: 'paper', label: '纸张', icon: '📄' },
      { value: 'writing', label: '书写', icon: '✏️' },
      { value: 'print', label: '打印耗材', icon: '🖨️' },
      { value: 'clean', label: '清洁/杂项', icon: '🧹' }
    ],
    
    // 仓库信息
    currentWarehouse: '总部仓',
    stockStrategy: '实时扣减',
    
    // 购物车
    cart: {},
    cartCount: 0,
    cartTotal: '0.00',
    
    // 用户信息
    userInfo: null,
    userRole: 'Engineer',
    isManager: false
  },

  onLoad() {
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    console.log('[material-list] 用户信息:', userInfo)
    
    // 检查权限：只有工程师和经理可以访问
    if (!userInfo || !userInfo.roleGroup) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    // 用户角色是'用户'时无权访问
    if (userInfo.roleGroup === '用户' || userInfo.roleGroup === 'User') {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    // 设置用户角色
    const userRole = userInfo.roleGroup === '经理' || userInfo.roleGroup === 'Manager' ? 'Manager' : 'Engineer'
    
    this.setData({
      userInfo,
      userRole,
      isManager: userRole === 'Manager',
      currentCategory: 'popular' // 默认显示常用类目
    })
    
    // 加载购物车数据
    this.loadCart()
    
    // 加载耗材列表
    this.loadMaterials()
  },

  onShow() {
    // 页面显示时更新购物车数据
    this.loadCart()
  },

  // 加载购物车数据
  loadCart() {
    const cart = wx.getStorageSync('materialCart') || {}
    let cartCount = 0
    let cartTotal = 0
    
    Object.values(cart).forEach(item => {
      cartCount += item.quantity
      cartTotal += (item.salePrice || 0) * item.quantity
    })
    
    this.setData({
      cart,
      cartCount,
      cartTotal: cartTotal.toFixed(2)
    })
  },

  // 保存购物车数据
  saveCart() {
    wx.setStorageSync('materialCart', this.data.cart)
  },

  // 加载耗材列表
  async loadMaterials(isRefresh = false) {
    if (isRefresh) {
      this.setData({
        page: 1,
        materials: [],
        hasMore: true
      })
    }
    
    this.setData({ loading: true })
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'materialManager',
        data: {
          action: 'list',
          category: this.data.currentCategory === 'popular' ? 'all' : this.data.currentCategory,
          keyword: this.data.keyword,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      })
      
      if (res.result.success) {
        const { list, total, hasMore } = res.result.data
        
        // 使用新的处理方法
        const materials = this.processMaterials(list)
        
        this.setData({
          materials: isRefresh ? materials : [...this.data.materials, ...materials],
          total,
          hasMore,
          loading: false
        })
      } else {
        wx.showToast({
          title: res.result.error || '加载失败',
          icon: 'none'
        })
        this.setData({ loading: false })
      }
    } catch (err) {
      console.error('[material-list] 加载失败:', err)
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 搜索
  onSearch(e) {
    const keyword = e.detail.value
    this.setData({
      keyword,
      searchValue: keyword
    })
    this.loadMaterials(true)
  },

  // 清空搜索
  onClearSearch() {
    this.setData({
      keyword: '',
      searchValue: ''
    })
    this.loadMaterials(true)
  },

  // 切换类目
  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    if (category === this.data.currentCategory) return
    
    this.setData({
      currentCategory: category,
      materials: [],
      page: 1,
      hasMore: true
    })
    this.loadMaterials(true)
  },

  // 更新数量（点击步进器）
  updateQuantity(e) {
    const { id, action } = e.currentTarget.dataset
    const material = this.data.materials.find(m => m._id === id)
    if (!material || material.variants.length !== 1) return
    
    const variant = material.variants[0]
    const cartKey = `${id}_${variant.variantId}`
    let currentQuantity = this.data.cart[cartKey] ? this.data.cart[cartKey].quantity : 0
    
    if (action === 'minus' && currentQuantity > 0) {
      currentQuantity--
    } else if (action === 'plus') {
      if (currentQuantity >= variant.stock) {
        wx.showToast({
          title: '库存不足',
          icon: 'none'
        })
        return
      }
      currentQuantity++
    }
    
    this.updateCartItem(material, variant, currentQuantity)
  },
  
  // 输入数量
  onQuantityInput(e) {
    const { id } = e.currentTarget.dataset
    const value = parseInt(e.detail.value) || 0
    
    const material = this.data.materials.find(m => m._id === id)
    if (!material || material.variants.length !== 1) return
    
    const variant = material.variants[0]
    
    if (value > variant.stock) {
      wx.showToast({
        title: `库存仅剩${variant.stock}${material.unit || '个'}`,
        icon: 'none'
      })
      return
    }
    
    this.updateCartItem(material, variant, value)
  },
  
  // 更新购物车项
  updateCartItem(material, variant, quantity) {
    const cartKey = `${material._id}_${variant.variantId}`
    const cart = this.data.cart
    
    if (quantity === 0) {
      delete cart[cartKey]
    } else {
      cart[cartKey] = {
        materialId: material._id,
        materialNo: material.materialNo,
        materialName: material.name,
        variantId: variant.variantId,
        variantLabel: variant.label,
        quantity: quantity,
        stock: variant.stock,
        salePrice: variant.salePrice || 0,
        unit: material.unit
      }
    }
    
    this.setData({ cart })
    this.saveCart()
    this.loadCart()
    this.updateMaterialCartQuantity(material._id)
  },

  // 更新耗材的购物车数量显示
  updateMaterialCartQuantity(materialId) {
    const materials = this.data.materials.map(item => {
      if (item._id === materialId) {
        let cartQuantity = 0
        item.variants.forEach(v => {
          const cartKey = `${item._id}_${v.variantId}`
          if (this.data.cart[cartKey]) {
            cartQuantity += this.data.cart[cartKey].quantity
          }
        })
        return { ...item, cartQuantity }
      }
      return item
    })
    this.setData({ materials })
  },

  // 选择规格（多规格产品）
  selectSpec(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/material-detail/index?id=${id}`
    })
  },

  // 跳转购物车
  goToCart() {
    if (this.data.cartCount === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/material-cart/index'
    })
  },

  // 下拉刷新
  async onRefresh() {
    this.setData({ refreshing: true })
    await this.loadMaterials(true)
    this.setData({ refreshing: false })
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return
    
    this.setData({
      page: this.data.page + 1
    })
    this.loadMaterials()
  },

  // 管理入口（Manager专用）
  onManageTap() {
    if (!this.data.isManager) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/material-manage/index'
    })
  },

  // 返回上一页
  goBack() {
    wx.navigateBack()
  },

  // 打开搜索页面
  openSearch() {
    wx.navigateTo({
      url: '/pages/material-search/index'
    })
  },

  // 步进器点击事件
  onStepperTap(e) {
    const { id, variantid, action } = e.currentTarget.dataset
    const cartKey = `${id}_${variantid}`
    const cart = this.data.cart
    
    // 获取当前数量
    let currentQuantity = cart[cartKey] ? cart[cartKey].quantity : 0
    
    // 获取耗材信息
    const material = this.data.materials.find(m => m._id === id)
    const variant = material.variants.find(v => v.variantId === variantid)
    
    if (action === 'plus') {
      // 增加数量
      if (currentQuantity >= variant.stock) {
        wx.showToast({
          title: '库存不足',
          icon: 'none'
        })
        return
      }
      currentQuantity++
    } else if (action === 'minus') {
      // 减少数量
      if (currentQuantity <= 0) return
      currentQuantity--
    }
    
    // 更新购物车
    if (currentQuantity === 0) {
      delete cart[cartKey]
    } else {
      cart[cartKey] = {
        materialId: id,
        materialNo: material.materialNo,
        materialName: material.name,
        variantId: variantid,
        variantLabel: variant.label,
        quantity: currentQuantity,
        stock: variant.stock,
        salePrice: variant.salePrice || 0,
        unit: material.unit
      }
    }
    
    this.setData({ cart })
    this.saveCart()
    this.loadCart()
    this.updateMaterialCartQuantity(id)
  },

  // 添加类目（Manager专用）
  addCategory() {
    if (this.data.userRole !== 'Manager') return
    
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 添加产品（Manager专用）
  addProduct() {
    if (this.data.userRole !== 'Manager') return
    
    wx.navigateTo({
      url: '/pages/material-manage/index?action=add'
    })
  },

  // 处理材料数据，添加库存状态
  processMaterials(materials) {
    return materials.map(item => {
      // 计算库存状态
      let stockStatus = 'normal'
      let stockStatusText = '充足'
      
      const totalStock = item.totalStock || 0
      const minSafetyStock = Math.min(...item.variants.map(v => v.safetyStock || 0))
      
      if (totalStock === 0) {
        stockStatus = 'danger'
        stockStatusText = '缺货'
      } else if (totalStock <= minSafetyStock) {
        stockStatus = 'warning'
        stockStatusText = '库存少'
      }
      
      // 计算价格范围
      let priceRange = '--'
      if (item.variants && item.variants.length > 0) {
        const prices = item.variants.map(v => v.salePrice || 0).filter(p => p > 0)
        if (prices.length > 0) {
          const minPrice = Math.min(...prices)
          const maxPrice = Math.max(...prices)
          priceRange = minPrice === maxPrice ? 
            minPrice.toFixed(2) : 
            `${minPrice.toFixed(2)}-${maxPrice.toFixed(2)}`
        }
      }
      
      // 库存信息
      let stockInfo = `${totalStock}${item.unit || '个'}`
      if (item.variants.length > 1) {
        const stocks = item.variants.map(v => v.stock || 0)
        const minStock = Math.min(...stocks)
        const maxStock = Math.max(...stocks)
        stockInfo = minStock === maxStock ? 
          `${minStock}${item.unit || '个'}` :
          `${minStock}-${maxStock}${item.unit || '个'}`
      }
      
      // 从购物车获取数量（单规格）
      let quantity = 0
      if (item.variants.length === 1) {
        const cartKey = `${item._id}_${item.variants[0].variantId}`
        const cartItem = this.data.cart[cartKey]
        quantity = cartItem ? cartItem.quantity : 0
      }
      
      return {
        ...item,
        stockStatus,
        stockStatusText,
        priceRange,
        stockInfo,
        quantity
      }
    })
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return
    
    this.setData({
      page: this.data.page + 1
    })
    this.loadMaterials()
  }
})