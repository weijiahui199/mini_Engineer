// 图标文字组合组件
Component({
  properties: {
    icon: {
      type: String,
      value: ''
    }
  },
  
  data: {
    // 使用emoji或文字作为图标的备用方案
    iconMap: {
      'check': '✓',
      'camera': '📷',
      'user': '👤',
      'close': '✕',
      'edit': '✏️',
      'setting': '⚙️',
      'add': '+',
      'minus': '-',
      'arrow-right': '→',
      'arrow-left': '←',
      'arrow-up': '↑',
      'arrow-down': '↓'
    }
  }
})