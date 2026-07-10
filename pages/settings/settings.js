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
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
      }
    })
  },

  exportBackupFile() {
    const userDataPath = wx.env && wx.env.USER_DATA_PATH
    if (!userDataPath) {
      wx.showToast({ title: '当前环境不支持导出文件', icon: 'none' })
      return
    }
    const fileName = `wardrobe-backup-${wardrobe.formatLocalDate(new Date())}.json`
    const filePath = `${userDataPath}/${fileName}`
    const backupText = JSON.stringify(wardrobe.exportData(), null, 2)
    wx.showLoading({ title: '正在导出', mask: true })
    wx.getFileSystemManager().writeFile({
      filePath,
      data: backupText,
      encoding: 'utf8',
      success: () => {
        wx.hideLoading()
        this.shareBackupFile(filePath, fileName)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '导出文件失败', icon: 'none' })
      }
    })
  },

  shareBackupFile(filePath, fileName) {
    if (typeof wx.shareFileMessage !== 'function') {
      wx.showModal({
        title: '备份文件已生成',
        content: `文件已保存至：${filePath}`,
        showCancel: false
      })
      return
    }
    wx.shareFileMessage({
      filePath,
      fileName,
      success: () => wx.showToast({ title: '请选择发送位置保存', icon: 'success' }),
      fail: (error) => {
        if (!(error && error.errMsg && error.errMsg.includes('cancel'))) {
          wx.showToast({ title: '分享文件失败', icon: 'none' })
        }
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
    this.restoreBackup(text, () => this.closeImportPanel())
  },

  importBackupFile() {
    if (typeof wx.chooseMessageFile !== 'function') {
      wx.showToast({ title: '当前环境不支持导入文件', icon: 'none' })
      return
    }
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]
        if (!file || !file.path) {
          wx.showToast({ title: '没有选择备份文件', icon: 'none' })
          return
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (content) => this.restoreBackup(content.data),
          fail: () => wx.showToast({ title: '读取备份文件失败', icon: 'none' })
        })
      }
    })
  },

  restoreBackup(rawData, onSuccess) {
    let data
    try {
      data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
    } catch (error) {
      wx.showToast({ title: '备份不是有效 JSON', icon: 'none' })
      return
    }

    wx.showModal({
      title: '导入备份',
      content: `将合并 ${data.items.length} 件衣物、${data.outfits.length} 套穿搭和 ${data.wishlist.length} 个愿望；本地已有数据会保留。确定继续吗？`,
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) return
        const result = wardrobe.importData(data)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '备份导入成功', icon: 'success' })
        if (onSuccess) onSuccess()
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
