const wardrobe = require('../../utils/wardrobe')

Page({
  data: {
    backupText: '',
    showImportPanel: false
  },

  noop() {},

  copyBackup() {
    const data = JSON.stringify(wardrobe.exportData(), null, 2)
    wx.setClipboardData({
      data,
      success: () => {
        wx.showToast({ title: '备份已复制', icon: 'success' })
      }
    })
  },

  openImportPanel() {
    this.setData({
      backupText: '',
      showImportPanel: true
    })
  },

  closeImportPanel() {
    this.setData({
      backupText: '',
      showImportPanel: false
    })
  },

  onBackupInput(event) {
    this.setData({
      backupText: event.detail.value
    })
  },

  confirmImport() {
    const text = this.data.backupText.trim()
    if (!text) {
      wx.showToast({ title: '请粘贴备份内容', icon: 'none' })
      return
    }

    let data = null
    try {
      data = JSON.parse(text)
    } catch (error) {
      wx.showToast({ title: '备份不是有效 JSON', icon: 'none' })
      return
    }

    wx.showModal({
      title: '恢复备份',
      content: '恢复会覆盖当前衣橱、穿搭、愿望和标签数据。确定继续吗？',
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) return
        const result = wardrobe.importData(data)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '已恢复备份', icon: 'success' })
        this.closeImportPanel()
      }
    })
  },

  clearAllData() {
    wx.showModal({
      title: '清空本地数据',
      content: '会删除本机保存的衣物、穿搭、愿望、穿着记录和自定义标签。建议先复制备份。',
      confirmText: '清空',
      confirmColor: '#9b3b34',
      success: (res) => {
        if (!res.confirm) return
        wardrobe.clearAllData()
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  },

  openPrivacy() {
    wx.navigateTo({
      url: '/pages/legal/legal?type=privacy'
    })
  },

  openAgreement() {
    wx.navigateTo({
      url: '/pages/legal/legal?type=agreement'
    })
  }
})
