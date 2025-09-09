// 耗材列表页面
const app = getApp()
const MATERIAL_CATEGORIES = require('../config/material-categories')
const CacheManager = require('../../../utils/cache-manager')
const RefreshManager = require('../../../utils/refresh-manager')

// 友好的错误提示文案
const ERROR_MESSAGES = {
  PERMISSION_DENIED: '您暂时没有权限访问耗材管理，请联系管理员',
  LOGIN_REQUIRED: '请先登录后再访问',
  LOAD_FAILED: '加载失败，请下拉刷新重试',
  NETWORK_ERROR: '网络不太稳定，请检查网络后重试',
  CATEGORY_ERROR: '类目信息有误，请刷新页面',
  STOCK_INSUFFICIENT: '库存不足，请减少申领数量',
  CART_EMPTY: '申领车还是空的，先选几个耗材吧',
  SAVE_FAILED: '保存失败，请重试',
  INVALID_QUANTITY: '请输入有效的数量'
}

Page({
  data: {
    // 列表数据
    materials: [],
    loading: false,  // 初始化为false，避免阻塞首次加载
    refreshing: false,
    hasMore: true,
    page: 1,
    pageSize: 20,
    total: 0,
    
    // 搜索和筛选
    keyword: '',
    searchValue: '',
    currentCategory: 'popular',
    categories: MATERIAL_CATEGORIES.categories,
    
    
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
    
    // 获取设备信息用于诊断底部栏定位问题
    this.logDeviceInfo()
    
    // 诊断各类目数据（开发时使用）
    // this.diagnoseCategoriesData()  // 生产环境注释掉
    
    // 检查权限：只有工程师和经理可以访问
    if (!userInfo || !userInfo.roleGroup) {
      wx.showToast({
        title: ERROR_MESSAGES.LOGIN_REQUIRED,
        icon: 'none',
        duration: 2000
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 2000)
      return
    }
    
    // 用户角色是'用户'时无权访问
    if (userInfo.roleGroup === '用户' || userInfo.roleGroup === 'User') {
      wx.showToast({
        title: ERROR_MESSAGES.PERMISSION_DENIED,
        icon: 'none',
        duration: 2000
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 2000)
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
    // 设置页面活跃状态
    RefreshManager.setPageActive('material-list', true)
    
    // 页面显示时更新购物车数据
    this.loadCart()
    // 同步更新材料列表中的数量显示
    this.syncMaterialQuantities()
    
    // 智能刷新决策
    const category = this.data.currentCategory
    const refreshKey = category === 'popular' ? 'materials_popular' : 'materials_other'
    
    // 检查是否需要刷新（例如：从详情页或购物车页面返回）
    const shouldRefresh = RefreshManager.shouldRefresh(refreshKey, {
      pageActive: true,
      forceRefresh: false
    })
    
    if (shouldRefresh) {
      console.log(`[material-list] onShow 检测到需要刷新，类目: ${category}`)
      this.loadMaterials(false) // 不是强制刷新，会先检查缓存
    } else {
      console.log(`[material-list] onShow 数据仍在有效期内，无需刷新`)
    }
  },
  
  onHide() {
    // 页面隐藏时设置为非活跃状态
    RefreshManager.setPageActive('material-list', false)
  },
  
  onUnload() {
    // 清理定时器
    if (this.cartUpdateTimer) {
      clearTimeout(this.cartUpdateTimer)
      this.cartUpdateTimer = null
    }
    // 清理防抖标记
    this.stockToastShown = false
  },

  // 加载购物车数据
  loadCart() {
    const cart = wx.getStorageSync('materialCart') || {}
    let cartCount = 0
    let cartTotal = 0
    
    Object.values(cart).forEach(item => {
      cartCount += item.quantity
      // Manager可以看价格，Engineer不计算总价
      if (this.data.userRole === 'Manager' && item.salePrice) {
        cartTotal += item.salePrice * item.quantity
      }
    })
    
    this.setData({
      cart,
      cartCount,
      cartTotal: cartTotal.toFixed(2)
    })
  },
  
  // 同步材料列表的数量显示（从购物车数据同步）
  syncMaterialQuantities() {
    if (!this.data.materials || this.data.materials.length === 0) {
      return
    }
    
    const cart = this.data.cart || {}
    const updatedMaterials = this.data.materials.map(material => {
      // 只处理单规格产品
      if (material.variants && material.variants.length === 1) {
        const cartKey = `${material._id}_${material.variants[0].variantId}`
        const cartItem = cart[cartKey]
        // 更新数量，如果购物车中没有则设为0
        return {
          ...material,
          quantity: cartItem ? cartItem.quantity : 0
        }
      }
      return material
    })
    
    // 批量更新材料列表
    this.setData({
      materials: updatedMaterials
    })
    
    console.log('[material-list] 同步材料数量完成')
  },

  // 保存购物车数据
  saveCart() {
    wx.setStorageSync('materialCart', this.data.cart)
  },

  // 加载耗材列表
  async loadMaterials(isRefresh = false) {
    // 防止重复加载（使用标记而不是data中的loading）
    if (this.isLoadingMaterials && !isRefresh) {
      console.log('[material-list] 正在加载中，跳过重复请求')
      return
    }
    
    const category = this.data.currentCategory
    const cacheKey = `materials_${category}`
    const refreshKey = category === 'popular' ? 'materials_popular' : 'materials_other'
    
    // 如果不是强制刷新，先尝试使用缓存
    if (!isRefresh) {
      // 检查是否需要刷新
      const shouldRefresh = RefreshManager.shouldRefresh(refreshKey, {
        pageActive: true,
        forceRefresh: false
      })
      
      if (!shouldRefresh) {
        // 尝试从缓存获取数据
        const cachedData = CacheManager.get(cacheKey, 'materials')
        if (cachedData && cachedData.list) {
          console.log(`[material-list] 使用缓存数据，类目: ${category}`)
          const materials = this.processMaterials(cachedData.list || [])
          this.setData({
            materials,
            page: cachedData.page || 1,
            hasMore: cachedData.hasMore || false,
            total: cachedData.total || 0,
            loading: false
          })
          this.isLoadingMaterials = false
          // 同步购物车数量
          this.syncMaterialQuantities()
          return
        }
      }
    } else {
      // 强制刷新时清除该类目的缓存
      console.log(`[material-list] 强制刷新，清除缓存: ${cacheKey}`)
      wx.removeStorageSync(cacheKey)
    }
    
    // 开始加载
    this.isLoadingMaterials = true
    
    if (isRefresh) {
      this.setData({
        page: 1,
        materials: [],
        hasMore: true
      })
    }
    
    this.setData({ loading: true })
    
    try {
      // 使用统一的类目处理方法
      const requestCategory = MATERIAL_CATEGORIES.processCategoryParam(this.data.currentCategory)
      
      // 验证类目是否有效
      if (!MATERIAL_CATEGORIES.isValidCategory(this.data.currentCategory)) {
        console.error('[material-list] 无效的类目:', this.data.currentCategory)
        wx.showToast({
          title: ERROR_MESSAGES.CATEGORY_ERROR,
          icon: 'none',
          duration: 2000
        })
        this.setData({ loading: false })
        return
      }
      
      console.log('[material-list] 请求参数:', {
        category: requestCategory,
        keyword: this.data.keyword,
        page: this.data.page,
        pageSize: this.data.pageSize
      })
      
      let res
      try {
        res = await wx.cloud.callFunction({
          name: 'materialManager',
          data: {
            action: 'list',
            category: requestCategory,
            keyword: this.data.keyword,
            page: this.data.page,
            pageSize: this.data.pageSize
          }
        })
        console.log('[material-list] 云函数返回:', res.result)
      } catch (cloudErr) {
        console.error('[material-list] 云函数调用失败，使用模拟数据:', cloudErr)
        // 使用模拟数据
        res = {
          result: {
            success: true,
            data: {
              list: this.getMockMaterials(requestCategory),
              total: 5,
              hasMore: false
            }
          }
        }
      }
      
      if (res.result.success) {
        const { list, total, hasMore } = res.result.data
        console.log('[material-list] 获取到材料数量:', list ? list.length : 0, '总数:', total)
        console.log('[material-list] 原始list数据:', list)
        
        // 使用新的处理方法
        const materials = this.processMaterials(list || [])
        console.log('[material-list] 处理后的材料数据:', materials)
        console.log('[material-list] 处理后的材料数量:', materials.length)
        
        const finalMaterials = isRefresh ? materials : [...this.data.materials, ...materials]
        console.log('[material-list] 最终设置的materials:', finalMaterials)
        
        // 缓存数据
        const category = this.data.currentCategory
        const cacheKey = `materials_${category}`
        const refreshKey = category === 'popular' ? 'materials_popular' : 'materials_other'
        
        // 保存到缓存
        CacheManager.set(cacheKey, {
          list: list || [],
          page: this.data.page,
          hasMore,
          total,
          timestamp: Date.now()
        }, 'materials')
        
        // 记录刷新时间
        RefreshManager.recordRefresh(refreshKey)
        console.log(`[material-list] 数据已缓存，类目: ${category}`)
        
        this.setData({
          materials: finalMaterials,
          total,
          hasMore,
          loading: false
        }, () => {
          // setData回调中打印，确保数据已更新
          console.log('[material-list] setData回调 - materials数量:', this.data.materials.length)
          console.log('[material-list] setData回调 - loading状态:', this.data.loading)
          
          // 详细验证第一个材料的数据结构
          if (this.data.materials.length > 0) {
            const firstMaterial = this.data.materials[0]
            console.log('[DEBUG] 第一个材料详细结构:', JSON.stringify(firstMaterial, null, 2))
            console.log('[DEBUG] 材料必需字段检查:')
            console.log('  - _id:', firstMaterial._id)
            console.log('  - name:', firstMaterial.name)
            console.log('  - description:', firstMaterial.description)
            console.log('  - variants数量:', firstMaterial.variants ? firstMaterial.variants.length : 0)
            console.log('  - stockStatus:', firstMaterial.stockStatus)
            console.log('  - stockStatusText:', firstMaterial.stockStatusText)
            console.log('  - priceRange:', firstMaterial.priceRange)
            console.log('  - stockInfo:', firstMaterial.stockInfo)
            console.log('  - quantity:', firstMaterial.quantity)
          }
          
          // 重置加载标记
          this.isLoadingMaterials = false
        })
      } else {
        wx.showToast({
          title: res.result.error || ERROR_MESSAGES.LOAD_FAILED,
          icon: 'none',
          duration: 2000
        })
        this.setData({ loading: false })
        this.isLoadingMaterials = false
      }
    } catch (err) {
      console.error('[material-list] 加载失败:', err)
      wx.showToast({
        title: ERROR_MESSAGES.NETWORK_ERROR,
        icon: 'none',
        duration: 2000
      })
      this.setData({ loading: false })
      this.isLoadingMaterials = false
    }
  },

  // 搜索提交
  handleSearch(e) {
    const searchValue = e.detail.value
    console.log('[material-list] 搜索:', searchValue)
    
    if (!searchValue.trim()) {
      return
    }
    
    // TODO: 实现搜索功能
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none'
    })
  },
  
  // 清空搜索
  handleClearSearch() {
    console.log('[material-list] 清空搜索')
    this.setData({
      searchValue: ''
    })
    // 重新加载默认数据
    this.loadMaterials(true)
  },

  // TDesign侧边栏切换事件
  onCategoryChange(e) {
    const category = e.detail.value
    console.log('[material-list] 切换类目:', category, '当前类目:', this.data.currentCategory)
    
    if (category === this.data.currentCategory) return
    
    // 更新当前类目
    this.setData({
      currentCategory: category,
      page: 1,
      hasMore: true
    })
    
    // 检查缓存
    const cacheKey = `materials_${category}`
    const refreshKey = category === 'popular' ? 'materials_popular' : 'materials_other'
    const cachedData = CacheManager.get(cacheKey, 'materials')
    
    // 如果有缓存且在有效期内，立即显示缓存数据
    if (cachedData && cachedData.list) {
      const shouldRefresh = RefreshManager.shouldRefresh(refreshKey, {
        pageActive: true,
        forceRefresh: false
      })
      
      if (!shouldRefresh) {
        console.log(`[material-list] 使用缓存快速切换，类目: ${category}`)
        const materials = this.processMaterials(cachedData.list || [])
        this.setData({
          materials,
          loading: false,
          total: cachedData.total || 0
        })
        // 同步购物车数量
        this.syncMaterialQuantities()
        return
      }
    }
    
    // 没有缓存或需要刷新，显示加载状态
    this.setData({
      loading: true,
      materials: [] // 清空当前数据
    })
    
    console.log('[material-list] 开始加载类目数据:', category)
    this.loadMaterials(false) // 不强制刷新，让 loadMaterials 内部决定
  },

  // 更新数量（点击步进器） - 优化性能
  updateQuantity(e) {
    const { id, action } = e.currentTarget.dataset
    
    // 防止快速连续点击
    const now = Date.now()
    const lastClickKey = `${id}_${action}_lastClick`
    if (this[lastClickKey] && now - this[lastClickKey] < 100) {
      return // 忽略100ms内的重复点击
    }
    this[lastClickKey] = now
    
    const material = this.data.materials.find(m => m._id === id)
    if (!material || !material.variants || material.variants.length !== 1) return
    
    const variant = material.variants[0]
    if (!variant) return
    const cartKey = `${id}_${variant.variantId}`
    let currentQuantity = this.data.cart[cartKey] ? this.data.cart[cartKey].quantity : 0
    
    if (action === 'minus' && currentQuantity > 0) {
      currentQuantity--
    } else if (action === 'plus') {
      if (currentQuantity >= variant.stock) {
        // 使用防抖的提示
        if (!this.stockToastShown) {
          this.stockToastShown = true
          wx.showToast({
            title: `库存仅剩${variant.stock}${material.unit || '个'}`,
            icon: 'none'
          })
          setTimeout(() => {
            this.stockToastShown = false
          }, 2000)
        }
        return
      }
      currentQuantity++
    }
    
    // 立即更新UI（乐观更新）
    const materialIndex = this.data.materials.findIndex(m => m._id === id)
    if (materialIndex !== -1) {
      const updatedMaterials = [...this.data.materials]
      updatedMaterials[materialIndex] = {
        ...updatedMaterials[materialIndex],
        quantity: currentQuantity
      }
      this.setData({
        [`materials[${materialIndex}].quantity`]: currentQuantity
      })
    }
    
    // 异步更新购物车
    this.updateCartItemDebounced(material, variant, currentQuantity)
  },
  
  // 输入数量（添加防抖）
  onQuantityInput(e) {
    const { id } = e.currentTarget.dataset
    const value = parseInt(e.detail.value) || 0
    
    const material = this.data.materials.find(m => m._id === id)
    if (!material || !material.variants || material.variants.length !== 1) return
    
    const variant = material.variants[0]
    if (!variant) return
    
    // 检查库存限制
    if (value > variant.stock) {
      // 使用防抖的提示
      if (!this.stockToastShown) {
        this.stockToastShown = true
        wx.showToast({
          title: `最多可申领${variant.stock}${material.unit || '个'}`,
          icon: 'none',
          duration: 2000
        })
        setTimeout(() => {
          this.stockToastShown = false
        }, 2000)
      }
      return
    }
    
    // 负数检查
    if (value < 0) {
      wx.showToast({
        title: ERROR_MESSAGES.INVALID_QUANTITY,
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    // 立即更新显示
    const materialIndex = this.data.materials.findIndex(m => m._id === id)
    if (materialIndex !== -1) {
      this.setData({
        [`materials[${materialIndex}].quantity`]: value
      })
    }
    
    // 使用防抖更新购物车
    this.updateCartItemDebounced(material, variant, value)
  },
  
  // 防抖的购物车更新
  updateCartItemDebounced(material, variant, quantity) {
    // 清除之前的定时器
    if (this.cartUpdateTimer) {
      clearTimeout(this.cartUpdateTimer)
    }
    
    // 设置新的定时器
    this.cartUpdateTimer = setTimeout(() => {
      this.updateCartItem(material, variant, quantity)
    }, 300) // 300ms后执行
  },
  
  // 更新购物车项
  updateCartItem(material, variant, quantity) {
    const cartKey = `${material._id}_${variant.variantId}`
    const cart = this.data.cart
    
    if (quantity === 0) {
      delete cart[cartKey]
    } else {
      // 基础购物车数据
      const cartItem = {
        materialId: material._id,
        materialNo: material.materialNo,
        materialName: material.name,
        variantId: variant.variantId,
        variantLabel: variant.label,
        quantity: quantity,
        stock: variant.stock,
        unit: material.unit
      }
      
      // Manager可以看到价格信息
      if (this.data.userRole === 'Manager') {
        cartItem.salePrice = variant.salePrice || 0
      }
      
      cart[cartKey] = cartItem
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
    console.log('[material-list] 选择规格，跳转到详情页:', id)
    
    // 跳转到耗材详情页进行规格选择
    wx.navigateTo({
      url: `/pages/material-detail/index?id=${id}`
    })
  },
  
  // 跳转到耗材详情页
  goToDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/material-detail/index?id=${id}`
    })
  },
  
  // 阻止事件冒泡
  stopPropagation(e) {
    // 阻止事件冒泡，防止触发卡片点击
    return false
  },
  
  // TDesign步进器数量变化
  onQuantityChange(e) {
    const { id } = e.currentTarget.dataset
    const newQuantity = e.detail.value
    const material = this.data.materials.find(m => m._id === id)
    if (!material) {
      console.error('[material-list] 未找到耗材:', id)
      return
    }
    
    console.log('[material-list] 数量变化:', id, newQuantity)
    
    // 检查是否有规格
    if (!material.variants || material.variants.length === 0) {
      console.error('[material-list] 耗材没有规格信息:', material)
      return
    }
    
    // 获取第一个规格（单规格产品）
    const variant = material.variants[0]
    if (!variant) {
      console.error('[material-list] 未找到规格信息')
      return
    }
    
    // 检查库存
    if (newQuantity > variant.stock) {
      wx.showToast({
        title: `库存仅剩${variant.stock}${material.unit || '个'}`,
        icon: 'none'
      })
      // 重置为最大库存量
      const materialIndex = this.data.materials.findIndex(m => m._id === id)
      if (materialIndex !== -1) {
        this.setData({
          [`materials[${materialIndex}].quantity`]: variant.stock
        })
      }
      this.updateCartItem(material, variant, variant.stock)
      return
    }
    
    // 更新显示的数量
    const materialIndex = this.data.materials.findIndex(m => m._id === id)
    if (materialIndex !== -1) {
      this.setData({
        [`materials[${materialIndex}].quantity`]: newQuantity
      })
    }
    
    // 更新购物车
    this.updateCartItem(material, variant, newQuantity)
  },

  // 跳转购物车
  goToCart() {
    if (this.data.cartCount === 0) {
      wx.showToast({
        title: ERROR_MESSAGES.CART_EMPTY,
        icon: 'none',
        duration: 2000
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/material-cart/index'
    })
  },
  
  // 添加新耗材（经理专用）
  addProduct() {
    if (!this.data.isManager) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/material-manage/index?action=add'
    })
  },
  
  // 管理类目（经理专用）
  manageCategories() {
    if (!this.data.isManager) {
      wx.showToast({
        title: '无权限操作',
        icon: 'none'
      })
      return
    }
    
    wx.showModal({
      title: '管理类目',
      content: '类目管理功能正在开发中',
      showCancel: false,
      confirmText: '知道了'
    })
    
    // TODO: 实现类目管理功能
    // wx.navigateTo({
    //   url: '/pages/category-manage/index'
    // })
  },

  // 下拉刷新
  async onRefresh() {
    this.setData({ refreshing: true })
    // 强制刷新，清除缓存
    const category = this.data.currentCategory
    const refreshKey = category === 'popular' ? 'materials_popular' : 'materials_other'
    RefreshManager.setForceRefreshFlag(refreshKey)
    await this.loadMaterials(true)
    this.setData({ refreshing: false })
  },

  // 系统下拉刷新
  async onPullDownRefresh() {
    console.log('[material-list] 执行系统下拉刷新')
    try {
      // 强制刷新，清除缓存
      const category = this.data.currentCategory
      const refreshKey = category === 'popular' ? 'materials_popular' : 'materials_other'
      RefreshManager.setForceRefreshFlag(refreshKey)
      await this.loadMaterials(true)
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      })
    } catch (err) {
      console.error('[material-list] 下拉刷新失败:', err)
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    } finally {
      wx.stopPullDownRefresh()
    }
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
    // 确保materials是数组
    if (!Array.isArray(materials)) {
      console.error('[material-list] processMaterials: 材料数据不是数组', materials)
      return []
    }
    
    // 检查是否为Manager角色（Manager可以看价格）
    const isManager = this.data.userRole === 'Manager'
    
    return materials.map(item => {
      // 确保item有基本结构
      if (!item || typeof item !== 'object') {
        console.warn('[material-list] 跳过无效的材料项:', item)
        return null
      }
      
      // 确保variants是数组
      if (!item.variants) {
        item.variants = []
      }
      if (!Array.isArray(item.variants)) {
        console.warn('[material-list] variants不是数组，转换为空数组:', item.variants)
        item.variants = []
      }
      
      // 计算库存状态
      let stockStatus = 'normal'
      let stockStatusText = '充足'
      
      // 计算实际总库存（以variants中的stock为准）
      const actualTotalStock = item.variants.reduce((sum, v) => sum + (v.stock || 0), 0)
      const totalStock = actualTotalStock || item.totalStock || 0
      const safetyStocks = item.variants.map(v => v.safetyStock || 0)
      const minSafetyStock = safetyStocks.length > 0 ? Math.min(...safetyStocks) : 0
      
      if (totalStock === 0) {
        stockStatus = 'danger'
        stockStatusText = '缺货'
      } else if (totalStock <= minSafetyStock) {
        stockStatus = 'warning'
        stockStatusText = '库存少'
      }
      
      // 计算价格范围（只有Manager可以看到价格）
      let priceRange = '--'
      let showPrice = false
      if (isManager && item.variants && item.variants.length > 0) {
        const prices = item.variants.map(v => v.salePrice || 0).filter(p => p > 0)
        if (prices.length > 0) {
          showPrice = true
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
        showPrice,  // 添加是否显示价格的标识
        stockInfo,
        quantity
      }
    }).filter(item => item !== null) // 过滤掉无效项
  },

  
  // 获取模拟数据（当云函数不可用时）
  getMockMaterials(category) {
    const mockData = {
      paper: [
        {
          _id: 'mock_001',
          materialNo: 'MT20250001',
          name: 'A4复印纸',
          category: 'paper',
          description: '70g A4白色复印纸，500张/包',
          unit: '包',
          totalStock: 100,
          variants: [
            {
              variantId: 'V001',
              label: '70g 500张/包',
              stock: 100,
              safetyStock: 20,
              salePrice: 25.00
            }
          ],
          status: 'active'
        },
        {
          _id: 'mock_002',
          materialNo: 'MT20250002',
          name: '便利贴',
          category: 'paper',
          description: '3x3英寸彩色便利贴',
          unit: '本',
          totalStock: 50,
          variants: [
            {
              variantId: 'V002',
              label: '黄色',
              stock: 20,
              safetyStock: 10,
              salePrice: 5.00
            },
            {
              variantId: 'V003',
              label: '粉色',
              stock: 30,
              safetyStock: 10,
              salePrice: 5.00
            }
          ],
          status: 'active'
        }
      ],
      writing: [
        {
          _id: 'mock_003',
          materialNo: 'MT20250003',
          name: '签字笔',
          category: 'writing',
          description: '0.5mm黑色签字笔',
          unit: '支',
          totalStock: 200,
          variants: [
            {
              variantId: 'V004',
              label: '黑色',
              stock: 150,
              safetyStock: 50,
              salePrice: 3.00
            },
            {
              variantId: 'V005',
              label: '蓝色',
              stock: 50,
              safetyStock: 20,
              salePrice: 3.00
            }
          ],
          status: 'active'
        }
      ],
      print: [
        {
          _id: 'mock_004',
          materialNo: 'MT20250004',
          name: '墨盒',
          category: 'print',
          description: 'HP 803 黑色墨盒',
          unit: '个',
          totalStock: 10,
          variants: [
            {
              variantId: 'V006',
              label: '标准装',
              stock: 10,
              safetyStock: 5,
              salePrice: 120.00
            }
          ],
          status: 'active'
        }
      ],
      clean: [
        {
          _id: 'mock_005',
          materialNo: 'MT20250005',
          name: '垃圾袋',
          category: 'clean',
          description: '45L黑色垃圾袋',
          unit: '卷',
          totalStock: 0,
          variants: [
            {
              variantId: 'V007',
              label: '45L 20只/卷',
              stock: 0,
              safetyStock: 10,
              salePrice: 8.00
            }
          ],
          status: 'active'
        }
      ]
    }
    
    // 如果是 'all' 或 'popular'，返回所有类目的数据
    if (category === 'all' || category === 'popular') {
      let allMaterials = []
      Object.values(mockData).forEach(items => {
        allMaterials = allMaterials.concat(items)
      })
      return allMaterials
    }
    
    // 返回特定类目的数据
    return mockData[category] || []
  },
  
  // 诊断各类目数据完整性（开发调试用）
  async diagnoseCategoriesData() {
    console.log('[material-list] ========== 开始诊断类目数据 ==========')
    
    const realCategories = MATERIAL_CATEGORIES.getRealCategories()
    console.log('[material-list] 系统定义的类目:', realCategories)
    
    try {
      // 检查每个类目的数据量
      for (const category of realCategories) {
        const res = await wx.cloud.callFunction({
          name: 'materialManager',
          data: {
            action: 'list',
            category: category,
            page: 1,
            pageSize: 1
          }
        })
        
        if (res.result.success) {
          console.log(`[material-list] 类目 "${category}" (${MATERIAL_CATEGORIES.getCategoryLabel(category)}) 有 ${res.result.data.total} 个产品`)
        } else {
          console.error(`[material-list] 类目 "${category}" 查询失败:`, res.result.error)
        }
      }
      
      // 检查所有产品（all）
      const allRes = await wx.cloud.callFunction({
        name: 'materialManager',
        data: {
          action: 'list',
          category: 'all',
          page: 1,
          pageSize: 1
        }
      })
      
      if (allRes.result.success) {
        console.log(`[material-list] 所有类目共有 ${allRes.result.data.total} 个产品`)
      }
      
    } catch (err) {
      console.error('[material-list] 诊断失败:', err)
    }
    
    console.log('[material-list] ========== 诊断完成 ==========')
  },

  // 获取设备信息用于诊断底部栏定位问题
  logDeviceInfo() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      console.log('[material-list] ========== 设备信息诊断 ==========')
      console.log('[material-list] 设备型号:', systemInfo.model)
      console.log('[material-list] 系统版本:', systemInfo.system)
      console.log('[material-list] 微信版本:', systemInfo.version)
      console.log('[material-list] 基础库版本:', systemInfo.SDKVersion)
      console.log('[material-list] 屏幕宽度:', systemInfo.screenWidth, 'px')
      console.log('[material-list] 屏幕高度:', systemInfo.screenHeight, 'px')
      console.log('[material-list] 窗口宽度:', systemInfo.windowWidth, 'px')
      console.log('[material-list] 窗口高度:', systemInfo.windowHeight, 'px')
      console.log('[material-list] 状态栏高度:', systemInfo.statusBarHeight, 'px')
      
      // 导航栏高度计算
      const navBarHeight = systemInfo.statusBarHeight + 44 // 44是标准导航栏高度
      console.log('[material-list] 导航栏总高度:', navBarHeight, 'px')
      
      console.log('[material-list] 安全区域:', {
        top: systemInfo.safeArea ? systemInfo.safeArea.top : 'N/A',
        right: systemInfo.safeArea ? systemInfo.safeArea.right : 'N/A',
        bottom: systemInfo.safeArea ? systemInfo.safeArea.bottom : 'N/A',
        left: systemInfo.safeArea ? systemInfo.safeArea.left : 'N/A',
        width: systemInfo.safeArea ? systemInfo.safeArea.width : 'N/A',
        height: systemInfo.safeArea ? systemInfo.safeArea.height : 'N/A'
      })
      
      // 计算底部安全区域
      const bottomSafeArea = systemInfo.screenHeight - (systemInfo.safeArea ? systemInfo.safeArea.bottom : systemInfo.screenHeight)
      console.log('[material-list] 底部安全区域高度:', bottomSafeArea, 'px')
      console.log('[material-list] 像素比:', systemInfo.pixelRatio)
      
      // 转换为 rpx 单位 (750rpx = 屏幕宽度)
      const rpxRatio = 750 / systemInfo.windowWidth
      console.log('[material-list] rpx转换比例:', rpxRatio)
      console.log('[material-list] 底部安全区域 (rpx):', Math.round(bottomSafeArea * rpxRatio), 'rpx')
      
      // 计算实际可用高度
      const availableHeight = systemInfo.windowHeight - navBarHeight - bottomSafeArea
      console.log('[material-list] 实际可用内容高度:', availableHeight, 'px')
      console.log('[material-list] 实际可用内容高度 (rpx):', Math.round(availableHeight * rpxRatio), 'rpx')
      
      // 底部栏高度信息
      const bottomBarHeight = 140 // CSS中定义的固定高度(rpx)
      const bottomBarHeightPx = bottomBarHeight / rpxRatio
      console.log('[material-list] 底部栏固定高度:', bottomBarHeight, 'rpx /', Math.round(bottomBarHeightPx), 'px')
      
      // 延迟获取DOM信息，确保页面渲染完成
      setTimeout(() => {
        // 诊断底部栏实际位置
        wx.createSelectorQuery()
          .select('.bottom-bar')
          .boundingClientRect(rect => {
            if (rect) {
              console.log('[material-list] 底部栏DOM信息:', {
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height,
                width: rect.width
              })
              console.log('[material-list] 底部栏实际高度:', rect.height, 'px')
              console.log('[material-list] 底部栏距离屏幕底部:', systemInfo.windowHeight - rect.bottom, 'px')
              
              // 检查是否符合预期
              const expectedBottom = bottomSafeArea
              const actualBottom = systemInfo.windowHeight - rect.bottom
              if (Math.abs(actualBottom - expectedBottom) > 2) {
                console.warn('[material-list] ⚠️ 底部栏位置异常！预期距底部:', expectedBottom, 'px, 实际:', actualBottom, 'px')
              } else {
                console.log('[material-list] ✅ 底部栏位置正常')
              }
            }
          })
          .exec()
          
        // 诊断主内容区域
        wx.createSelectorQuery()
          .select('.main-content')
          .boundingClientRect(rect => {
            if (rect) {
              console.log('[material-list] 主内容区域DOM信息:', {
                top: rect.top,
                bottom: rect.bottom,
                height: rect.height
              })
              
              // 检查主内容区域是否与底部栏有重叠
              wx.createSelectorQuery()
                .select('.bottom-bar')
                .boundingClientRect(bottomRect => {
                  if (bottomRect) {
                    const gap = bottomRect.top - rect.bottom
                    console.log('[material-list] 主内容与底部栏间隙:', gap, 'px')
                    if (gap < 0) {
                      console.warn('[material-list] ⚠️ 内容与底部栏重叠！')
                    }
                  }
                })
                .exec()
            }
          })
          .exec()
      }, 500) // 延迟500ms确保页面渲染完成
      
      console.log('[material-list] ========== 设备信息诊断完成 ==========')
    } catch (err) {
      console.error('[material-list] 获取设备信息失败:', err)
    }
  },

  // 监听页面滚动，检查底部栏是否被遮挡
  onPageScroll(e) {
    // 检查是否滚动到底部附近
    if (e.scrollTop > 0) {
      // 定期输出滚动位置，帮助诊断
      if (!this.scrollLogTimer) {
        this.scrollLogTimer = setTimeout(() => {
          console.log('[material-list] 页面滚动位置:', e.scrollTop, 'px')
          this.scrollLogTimer = null
        }, 1000) // 1秒内只输出一次日志
      }
    }
  },

  // 监听页面尺寸变化
  onResize(size) {
    console.log('[material-list] 页面尺寸变化:', {
      windowWidth: size.size.windowWidth,
      windowHeight: size.size.windowHeight
    })
    // 重新诊断设备信息
    this.logDeviceInfo()
  }
})