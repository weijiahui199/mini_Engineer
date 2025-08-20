// 耗材详情页
const app = getApp()
const MATERIAL_CATEGORIES = require('../../config/material-categories')

Page({
  data: {
    materialId: '',
    material: {},
    images: [], // 图片数组
    selectedVariantId: '', // 选中的规格ID
    currentVariant: {}, // 当前选中的规格
    quantity: 1, // 申领数量
    categoryLabel: '', // 类目标签
    stockStatus: 'normal', // 库存状态
    stockStatusText: '库存充足',
    stockPercentage: 100, // 库存百分比
    
    // 用户相关
    userInfo: null,
    isManager: false,
    
    // 购物车
    cart: {},
    cartCount: 0,
    cartTotal: '0.00',
    
    loading: true
  },

  onLoad(options) {
    const { id } = options
    if (!id) {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
      return
    }
    
    this.setData({ materialId: id })
    
    // 获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo,
        isManager: userInfo.roleGroup === '经理' || userInfo.roleGroup === 'Manager'
      })
    }
    
    // 加载购物车
    this.loadCart()
    
    // 加载耗材详情
    this.loadMaterialDetail()
  },

  onShow() {
    // 刷新购物车信息
    this.loadCart()
  },

  // 加载耗材详情
  async loadMaterialDetail() {
    try {
      this.setData({ loading: true })
      
      const res = await wx.cloud.callFunction({
        name: 'materialManager',
        data: {
          action: 'detail',
          materialId: this.data.materialId
        }
      })
      
      if (res.result.success) {
        const material = res.result.data
        
        // 设置图片数组（使用defaultImage作为主图）
        const images = []
        if (material.defaultImage) {
          images.push(material.defaultImage)
        }
        // 如果有规格图片，也添加进去
        if (material.variants) {
          material.variants.forEach(v => {
            if (v.imageUrl && !images.includes(v.imageUrl)) {
              images.push(v.imageUrl)
            }
          })
        }
        // 如果没有图片，使用占位图（灰色背景的数据URL）
        if (images.length === 0) {
          // 使用数据URL作为占位图
          const placeholderDataUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect width="400" height="400" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="24"%3E暂无图片%3C/text%3E%3C/svg%3E'
          images.push(placeholderDataUrl)
        }
        
        // 获取类目标签
        const categoryLabel = MATERIAL_CATEGORIES.getCategoryLabel(material.category)
        
        // 默认选中第一个有库存的规格
        let selectedVariant = null
        let selectedVariantId = ''
        if (material.variants && material.variants.length > 0) {
          // 优先选择有库存的
          selectedVariant = material.variants.find(v => v.stock > 0) || material.variants[0]
          selectedVariantId = selectedVariant.variantId
        }
        
        // 计算库存状态
        const stockInfo = this.calculateStockStatus(selectedVariant)
        
        // 从购物车获取已有数量
        const cartKey = `${material._id}_${selectedVariantId}`
        const existingQuantity = this.data.cart[cartKey] ? this.data.cart[cartKey].quantity : 0
        
        this.setData({
          material,
          images,
          categoryLabel,
          selectedVariantId,
          currentVariant: selectedVariant,
          quantity: existingQuantity || 1,
          ...stockInfo,
          loading: false
        })
      } else {
        wx.showToast({
          title: res.result.error || '加载失败',
          icon: 'none'
        })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }
    } catch (err) {
      console.error('[material-detail] 加载失败:', err)
      wx.showToast({
        title: '网络错误',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  // 计算库存状态
  calculateStockStatus(variant) {
    if (!variant) {
      return {
        stockStatus: 'danger',
        stockStatusText: '暂无库存',
        stockPercentage: 0
      }
    }
    
    const stock = variant.stock || 0
    const safetyStock = variant.safetyStock || 0
    
    let stockStatus = 'normal'
    let stockStatusText = '库存充足'
    let stockPercentage = 100
    
    if (stock === 0) {
      stockStatus = 'danger'
      stockStatusText = '暂无库存'
      stockPercentage = 0
    } else if (stock <= safetyStock) {
      stockStatus = 'warning'
      stockStatusText = '库存偏低'
      stockPercentage = Math.min((stock / (safetyStock * 2)) * 100, 100)
    } else {
      stockStatus = 'normal'
      stockStatusText = '库存充足'
      // 假设最大库存是安全库存的3倍
      const maxStock = safetyStock * 3
      stockPercentage = Math.min((stock / maxStock) * 100, 100)
    }
    
    return {
      stockStatus,
      stockStatusText,
      stockPercentage: Math.max(0, Math.min(100, stockPercentage))
    }
  },

  // 选择规格
  selectVariant(e) {
    const variant = e.currentTarget.dataset.variant
    if (variant.stock === 0) {
      wx.showToast({
        title: '该规格暂无库存',
        icon: 'none'
      })
      return
    }
    
    const stockInfo = this.calculateStockStatus(variant)
    
    // 从购物车获取该规格已有数量
    const cartKey = `${this.data.material._id}_${variant.variantId}`
    const existingQuantity = this.data.cart[cartKey] ? this.data.cart[cartKey].quantity : 0
    
    this.setData({
      selectedVariantId: variant.variantId,
      currentVariant: variant,
      quantity: existingQuantity || 1,
      ...stockInfo
    })
  },

  // 减少数量
  decreaseQuantity() {
    if (this.data.quantity <= 1) return
    this.setData({
      quantity: this.data.quantity - 1
    })
  },

  // 增加数量
  increaseQuantity() {
    const maxStock = this.data.currentVariant.stock || 0
    if (this.data.quantity >= maxStock) {
      wx.showToast({
        title: `库存仅剩${maxStock}${this.data.material.unit}`,
        icon: 'none'
      })
      return
    }
    this.setData({
      quantity: this.data.quantity + 1
    })
  },

  // 输入数量
  onQuantityInput(e) {
    const value = parseInt(e.detail.value) || 0
    const maxStock = this.data.currentVariant.stock || 0
    
    if (value > maxStock) {
      wx.showToast({
        title: `最多可申领${maxStock}${this.data.material.unit}`,
        icon: 'none'
      })
      this.setData({
        quantity: maxStock
      })
      return
    }
    
    this.setData({
      quantity: Math.max(0, value)
    })
  },

  // 加载购物车
  loadCart() {
    try {
      const cart = wx.getStorageSync('materialCart') || {}
      let cartCount = 0
      let cartTotal = 0
      
      Object.values(cart).forEach(item => {
        cartCount += item.quantity || 0
        if (this.data.isManager && item.salePrice) {
          cartTotal += (item.salePrice * item.quantity)
        }
      })
      
      this.setData({
        cart,
        cartCount,
        cartTotal: cartTotal.toFixed(2)
      })
    } catch (e) {
      console.error('[material-detail] 加载购物车失败:', e)
    }
  },

  // 保存购物车
  saveCart() {
    try {
      wx.setStorageSync('materialCart', this.data.cart)
    } catch (e) {
      console.error('[material-detail] 保存购物车失败:', e)
    }
  },

  // 加入购物车
  addToCart() {
    if (!this.data.currentVariant || this.data.currentVariant.stock === 0) {
      wx.showToast({
        title: '请选择有库存的规格',
        icon: 'none'
      })
      return
    }
    
    if (this.data.quantity <= 0) {
      wx.showToast({
        title: '请输入正确的数量',
        icon: 'none'
      })
      return
    }
    
    const { material, currentVariant, quantity } = this.data
    const cartKey = `${material._id}_${currentVariant.variantId}`
    
    // 更新购物车
    const cart = { ...this.data.cart }
    
    if (quantity === 0) {
      // 数量为0时删除
      delete cart[cartKey]
    } else {
      // 添加或更新
      cart[cartKey] = {
        materialId: material._id,
        materialNo: material.materialNo,
        materialName: material.name,
        variantId: currentVariant.variantId,
        variantLabel: currentVariant.label,
        quantity: quantity,
        stock: currentVariant.stock,
        unit: material.unit,
        image: material.defaultImage || '' // 使用主图
      }
      
      // Manager可以看到价格信息
      if (this.data.isManager) {
        cart[cartKey].salePrice = currentVariant.salePrice || 0
        cart[cartKey].costPrice = currentVariant.costPrice || 0
      }
    }
    
    this.setData({ cart })
    this.saveCart()
    this.loadCart()
    
    // 显示成功提示
    wx.showToast({
      title: quantity === 0 ? '已移除' : '已加入申领车',
      icon: 'success',
      duration: 1500
    })
    
    // 震动反馈
    wx.vibrateShort()
  },

  // 预览图片
  previewImage(e) {
    const current = e.currentTarget.dataset.url
    wx.previewImage({
      current,
      urls: this.data.images
    })
  },

  // 跳转购物车
  goToCart() {
    if (this.data.cartCount === 0) {
      wx.showToast({
        title: '申领车还是空的',
        icon: 'none'
      })
      return
    }
    
    wx.navigateTo({
      url: '/pages/material-cart/index'
    })
  },

  // 返回
  goBack() {
    wx.navigateBack()
  }
})