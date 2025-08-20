// 耗材列表页面
const app = getApp()
const MATERIAL_CATEGORIES = require('../../config/material-categories')

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
    // 页面显示时更新购物车数据
    this.loadCart()
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

  // 切换类目 - 优化过渡效果
  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    console.log('[material-list] 切换类目:', category, '当前类目:', this.data.currentCategory)
    
    if (category === this.data.currentCategory) return
    
    // 先更新类目，保持左侧高亮，但不清空数据
    this.setData({
      currentCategory: category,
      loading: true, // 立即显示加载状态
      page: 1,
      hasMore: true
    })
    
    // 延迟清空数据，避免闪烁
    setTimeout(() => {
      this.setData({
        materials: []
      })
      console.log('[material-list] 开始加载类目数据:', category)
      this.loadMaterials(true)
    }, 100)
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
    wx.navigateTo({
      url: `/pages/material-detail/index?id=${id}`
    })
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
    // TODO: 搜索页面待实现
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none',
      duration: 2000
    })
    // wx.navigateTo({
    //   url: '/pages/material-search/index'
    // })
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
  }
})