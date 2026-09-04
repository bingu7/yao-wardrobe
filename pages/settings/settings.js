const wardrobe = require('../../utils/wardrobe')

function getRuntimePlatform() {
  try {
    if (typeof wx.getDeviceInfo === 'function') {
      return String(wx.getDeviceInfo().platform || '').toLowerCase()
    }
    if (typeof wx.getSystemInfoSync === 'function') {
      return String(wx.getSystemInfoSync().platform || '').toLowerCase()
    }
  } catch (error) {
    return ''
  }
  return ''
}

Page({
  data: {
    backupText: '',
    showImportPanel: false,
    backupFileReady: false,
    backupFileName: '',
    backupActionMessage: '',
    isDevtools: false,
    canSaveToDisk: false
  },

  onLoad() {
    const platform = getRuntimePlatform()
    this.setData({
      isDevtools: platform === 'devtools',
      canSaveToDisk: ['windows', 'mac'].includes(platform) && typeof wx.saveFileToDisk === 'function'
    })
  },

  noop() {},

  async copyBackup() {
    wx.showLoading({ title: '正在打包图片', mask: true })
    try {
      const data = JSON.stringify(await wardrobe.exportDataWithImages(), null, 2)
      wx.hideLoading()
      wx.setClipboardData({
        data,
        success: () => wx.showToast({ title: '已复制完整备份', icon: 'success' }),
        fail: () => wx.showToast({ title: '复制失败，请导出文件', icon: 'none' })
      })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '备份未生成', content: error.message || '图片读取失败', showCancel: false })
    }
  },

  async exportBackupFile() {
    const userDataPath = wx.env && wx.env.USER_DATA_PATH
    if (!userDataPath) {
      wx.showToast({ title: '当前环境不支持导出文件', icon: 'none' })
      return
    }
    const fileName = `wardrobe-backup-${wardrobe.formatLocalDate(new Date())}.json`
    const filePath = `${userDataPath}/${fileName}`
    wx.showLoading({ title: '正在打包图片', mask: true })
    let backupText
    try {
      backupText = JSON.stringify(await wardrobe.exportDataWithImages(), null, 2)
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '备份未生成', content: error.message || '图片读取失败', showCancel: false })
      return
    }
    wx.getFileSystemManager().writeFile({
      filePath,
      data: backupText,
      encoding: 'utf8',
      success: () => {
        wx.hideLoading()
        this.preparedBackupFilePath = filePath
        this.preparedBackupText = backupText
        this.setData({
          backupFileReady: true,
          backupFileName: fileName,
          backupActionMessage: '备份已生成，请选择下面一种方式保存。'
        })
        wx.showToast({ title: '备份已生成', icon: 'success' })
      },
      fail: (error) => {
        wx.hideLoading()
        wx.showModal({
          title: '生成备份文件失败',
          content: (error && error.errMsg) || '请检查本机存储空间后重试',
          showCancel: false
        })
      }
    })
  },

  sharePreparedBackupFile() {
    const filePath = this.preparedBackupFilePath
    const fileName = this.data.backupFileName
    if (!filePath) {
      wx.showToast({ title: '请先生成备份文件', icon: 'none' })
      return
    }
    if (this.data.isDevtools) {
      this.showBackupActionMessage(
        '微信开发者工具不支持文件分享。请点击工具栏“预览”，在手机微信中打开后再分享；当前也可以使用“复制已生成备份”。',
        '请在真机中测试'
      )
      return
    }
    if (typeof wx.shareFileMessage !== 'function') {
      this.showBackupActionMessage(
        '当前微信不支持文件分享，请使用“复制已生成备份”。',
        '当前环境不支持'
      )
      return
    }
    this.setData({ backupActionMessage: '正在打开微信文件分享…' })
    wx.shareFileMessage({
      filePath,
      fileName,
      success: () => {
        this.setData({ backupActionMessage: '备份文件已交给微信分享。' })
        wx.showToast({ title: '请选择发送位置保存', icon: 'success' })
      },
      fail: (error) => {
        if (!(error && error.errMsg && error.errMsg.includes('cancel'))) {
          this.showBackupActionMessage(
            `${(error && error.errMsg) || '微信未能打开文件分享'}。可改用“复制已生成备份”保存。`,
            '分享备份文件失败'
          )
        } else {
          this.setData({ backupActionMessage: '已取消分享，备份文件仍保留在本次页面中。' })
        }
      }
    })
  },

  copyPreparedBackup() {
    if (!this.preparedBackupText) {
      wx.showToast({ title: '请先生成备份文件', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.preparedBackupText,
      success: () => {
        this.setData({ backupActionMessage: '完整备份内容已复制，可粘贴到文件传输助手或记事本保存。' })
        wx.showToast({ title: '备份内容已复制', icon: 'success' })
      },
      fail: () => this.showBackupActionMessage('剪贴板写入失败，请在真机微信中重试。', '复制失败')
    })
  },

  savePreparedBackupToDisk() {
    if (this.data.isDevtools) {
      this.showBackupActionMessage(
        '微信开发者工具不支持保存到电脑。此按钮只会在 Windows 或 Mac 版微信客户端中显示。',
        '当前是开发者工具'
      )
      return
    }
    if (!this.preparedBackupFilePath || !this.data.canSaveToDisk || typeof wx.saveFileToDisk !== 'function') {
      this.showBackupActionMessage('当前设备不支持保存到磁盘，请使用分享或复制备份。', '当前环境不支持')
      return
    }
    this.setData({ backupActionMessage: '正在打开系统保存窗口…' })
    wx.saveFileToDisk({
      filePath: this.preparedBackupFilePath,
      success: () => {
        this.setData({ backupActionMessage: '备份文件已保存到电脑。' })
        wx.showToast({ title: '备份已保存', icon: 'success' })
      },
      fail: (error) => {
        if (!(error && error.errMsg && error.errMsg.includes('cancel'))) {
          this.showBackupActionMessage(
            (error && error.errMsg) || '请重新选择保存位置',
            '保存备份失败'
          )
        } else {
          this.setData({ backupActionMessage: '已取消保存，备份文件仍保留在本次页面中。' })
        }
      }
    })
  },

  showBackupActionMessage(content, title) {
    this.setData({ backupActionMessage: content })
    wx.showModal({ title: title || '操作提示', content, showCancel: false })
  },

  exportAllImages() {
    const imagePaths = Array.from(new Set([
      ...wardrobe.getItems(),
      ...wardrobe.getWishlist()
    ].map((record) => record.imageUrl).filter(Boolean)))
    if (!imagePaths.length) {
      wx.showToast({ title: '当前没有可导出的图片', icon: 'none' })
      return
    }
    if (typeof wx.saveImageToPhotosAlbum !== 'function') {
      wx.showModal({ title: '当前环境不支持', content: '请在手机微信中导出图片。', showCancel: false })
      return
    }
    wx.showModal({
      title: '保存全部图片',
      content: `将 ${imagePaths.length} 张原图保存到系统相册，首次使用需要允许相册权限。确定继续吗？`,
      confirmColor: '#7b3b32',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '正在保存图片', mask: true })
        let savedCount = 0
        let lastError = null
        for (const filePath of imagePaths) {
          try {
            await this.saveImageToAlbum(filePath)
            savedCount += 1
          } catch (error) {
            lastError = error
            const message = String((error && error.errMsg) || '')
            if (/auth deny|authorize:fail/i.test(message)) break
          }
        }
        wx.hideLoading()
        if (savedCount === imagePaths.length) {
          wx.showToast({ title: `已保存 ${savedCount} 张图片`, icon: 'success' })
          return
        }
        const errorMessage = String((lastError && lastError.errMsg) || '')
        const permissionDenied = /auth deny|authorize:fail/i.test(errorMessage)
        wx.showModal({
          title: `已保存 ${savedCount}/${imagePaths.length} 张`,
          content: permissionDenied
            ? '相册权限未开启，请在小程序设置中允许保存到相册后重试。'
            : `${errorMessage || '部分图片保存失败'}。请在真机微信中重试。`,
          showCancel: false
        })
      }
    })
  },

  saveImageToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject })
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
    const validation = wardrobe.validateBackup(rawData)
    if (!validation.ok) {
      wx.showToast({ title: validation.message, icon: 'none' })
      return
    }
    const data = validation.backup

    wx.showModal({
      title: '导入备份',
      content: `将合并 ${data.items.length} 件衣物、${data.outfits.length} 套穿搭和 ${data.wishlist.length} 个愿望；本地已有数据会保留。确定继续吗？`,
      confirmColor: '#7b3b32',
      success: async (res) => {
        if (!res.confirm) return
        const hasImages = [...data.items, ...data.wishlist].some((record) => record.imageRef)
        wx.showLoading({ title: hasImages ? '正在恢复图片' : '正在恢复数据', mask: true })
        const result = await wardrobe.importDataWithImages(data)
        wx.hideLoading()
        if (!result.ok) {
          wx.showModal({ title: '备份导入失败', content: result.message, showCancel: false })
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
      content: '会删除本机保存的衣物、图片、穿搭、愿望、穿着记录和自定义标签。建议先导出完整备份文件。',
      confirmText: '清空',
      confirmColor: '#9b3b34',
      success: (res) => {
        if (!res.confirm) return
        wardrobe.clearAllData()
        // clearAllData 会删除已导出的备份文件，页面里保留的备份入口一并作废
        this.preparedBackupFilePath = ''
        this.preparedBackupText = ''
        this.setData({
          backupFileReady: false,
          backupFileName: '',
          backupActionMessage: ''
        })
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
