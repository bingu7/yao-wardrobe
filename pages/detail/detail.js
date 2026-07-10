const wardrobe = require('../../utils/wardrobe')

Page({
  data: {
    id: '',
    item: null,
    seasonText: '',
    occasionText: '',
    costPerWear: 0
  },

  onLoad(options) {
    this.setData({ id: options.id || '' })
  },

  onShow() {
    this.loadItem()
  },

  loadItem() {
    const item = wardrobe.getItem(this.data.id)
    this.setData({
      item: item || null,
      seasonText: item && Array.isArray(item.seasons) ? item.seasons.join('、') : '',
      occasionText: item && Array.isArray(item.occasions) ? item.occasions.join('、') : '',
      costPerWear: item ? wardrobe.getCostPerWear(item) : 0
    })
  },

  markWornToday() {
    const result = wardrobe.markWorn(this.data.id)
    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
      return
    }
    this.loadItem()
    wx.showToast({
      title: result.message,
      icon: 'success'
    })
  },

  editItem() {
    wx.setStorageSync('wardrobeEditingId', this.data.id)
    wx.switchTab({
      url: '/pages/add/add'
    })
  },

  confirmDelete() {
    wx.showModal({
      title: '删除衣物',
      content: '删除后不能恢复，确定要删除吗？',
      confirmColor: '#7b3b32',
      success: (res) => {
        if (res.confirm) {
          wardrobe.deleteItem(this.data.id)
          wx.showToast({
            title: '已删除',
            icon: 'success'
          })
          wx.switchTab({
            url: '/pages/wardrobe/wardrobe'
          })
        }
      }
    })
  },

  goHome() {
    wx.switchTab({
      url: '/pages/wardrobe/wardrobe'
    })
  }
})
