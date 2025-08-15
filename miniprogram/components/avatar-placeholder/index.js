// 头像占位图组件
Component({
  properties: {
    // 头像URL
    src: {
      type: String,
      value: ''
    },
    // 尺寸
    size: {
      type: String,
      value: '120rpx'
    },
    // 圆角
    round: {
      type: Boolean,
      value: true
    },
    // 默认图标
    defaultIcon: {
      type: String,
      value: '/assets/icons/user/user-icon.png'
    }
  },

  data: {
    loading: true,
    error: false,
    finalSrc: ''
  },

  lifetimes: {
    attached() {
      this.loadAvatar();
    }
  },

  observers: {
    'src': function(newSrc) {
      this.loadAvatar();
    }
  },

  methods: {
    loadAvatar() {
      const { src, defaultIcon } = this.properties;
      
      if (!src) {
        // 没有头像，使用默认图标
        this.setData({
          loading: false,
          error: false,
          finalSrc: defaultIcon
        });
        return;
      }
      
      // 开始加载
      this.setData({
        loading: true,
        error: false
      });
      
      // 设置最终的图片源
      this.setData({
        finalSrc: src
      });
    },
    
    onImageLoad() {
      // 图片加载成功
      this.setData({
        loading: false,
        error: false
      });
      
      this.triggerEvent('load');
    },
    
    onImageError(e) {
      // 图片加载失败
      console.error('[AvatarPlaceholder] 图片加载失败:', e.detail);
      
      this.setData({
        loading: false,
        error: true,
        finalSrc: this.properties.defaultIcon
      });
      
      this.triggerEvent('error', e.detail);
    }
  }
});