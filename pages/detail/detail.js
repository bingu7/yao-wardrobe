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

  onImageError() {
    if (this.data.item && wardrobe.clearItemImage(this.data.id, this.data.item.imageUrl)) {
      this.loadItem()
    }
  },

  exportImage() {
    const filePath = this.data.item && this.data.item.imageUrl
    if (!filePath) {
      wx.showToast({ title: '当前衣物没有图片', icon: 'none' })
      return
    }
    if (typeof wx.showShareImageMenu === 'function') {
      wx.showShareImageMenu({
        path: filePath,
        fail: (error) => {
          if (!(error && error.errMsg && error.errMsg.includes('cancel'))) {
            wx.showModal({
              title: '导出图片失败',
              content: `${(error && error.errMsg) || '微信未能打开图片菜单'}。请在真机微信中重试。`,
              showCancel: false
            })
          }
        }
      })
      return
    }
    if (typeof wx.saveImageToPhotosAlbum === 'function') {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: () => wx.showToast({ title: '图片已保存', icon: 'success' }),
        fail: (error) => wx.showModal({
          title: '保存图片失败',
          content: (error && error.errMsg) || '请检查相册权限后重试',
          showCancel: false
        })
      })
      return
    }
    wx.showModal({ title: '当前环境不支持', content: '请在手机微信中导出图片。', showCancel: false })
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
