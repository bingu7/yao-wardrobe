const wardrobe = require('../../utils/wardrobe')
const CATEGORY_VISIBLE_LIMIT = 5

Page({
  data: {
    categories: [],
    visibleCategories: [],
    showAllCategories: false,
    categoryToggleText: '',
    canToggleCategories: false,
    activeCategory: '全部',
    keyword: '',
    items: [],
    filteredItems: [],
    isFiltering: false,
    summary: {
      totalCount: 0,
      totalPrice: 0,
      idleCount: 0
    }
  },

  onLoad() {
    this.searchDebounce = wardrobe.createDebounce(300)
  },

  onShow() {
    this.loadItems()
  },

  loadItems() {
    const items = wardrobe.getItems()
    const categories = wardrobe.getCategories(items)
    const activeCategory = categories.includes(this.data.activeCategory) ? this.data.activeCategory : '全部'
    const categoryView = this.buildCategoryView(categories, this.data.showAllCategories)
    this.setData({
      categories,
      visibleCategories: categoryView.visibleCategories,
      canToggleCategories: categoryView.canToggle,
      categoryToggleText: categoryView.toggleText,
      activeCategory,
      items,
      summary: wardrobe.summarize(items)
    })
    this.applyFilters()
  },

  buildCategoryView(categories, showAll) {
    const canToggle = categories.length > CATEGORY_VISIBLE_LIMIT
    return {
      visibleCategories: showAll || !canToggle ? categories : categories.slice(0, CATEGORY_VISIBLE_LIMIT),
      canToggle,
      toggleText: showAll ? '收起' : `展开 ${categories.length - CATEGORY_VISIBLE_LIMIT} 个`
    }
  },

  applyFilters() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const filteredItems = this.data.items.filter((item) => {
      const matchCategory = this.data.activeCategory === '全部' || item.category === this.data.activeCategory
      const matchKeyword = !keyword || item.name.toLowerCase().includes(keyword)
      return matchCategory && matchKeyword
    })
    this.setData({
      filteredItems,
      isFiltering: Boolean(keyword || this.data.activeCategory !== '全部')
    })
  },

  onSearch(event) {
    this.setData({ keyword: event.detail.value })
    this.searchDebounce(() => this.applyFilters())
  },

  setCategory(event) {
    this.setData({ activeCategory: event.currentTarget.dataset.category })
    this.applyFilters()
  },

  toggleCategories() {
    const showAllCategories = !this.data.showAllCategories
    const categoryView = this.buildCategoryView(this.data.categories, showAllCategories)
    this.setData({
      showAllCategories,
      visibleCategories: categoryView.visibleCategories,
      canToggleCategories: categoryView.canToggle,
      categoryToggleText: categoryView.toggleText
    })
  },

  clearFilters() {
    this.setData({ keyword: '', activeCategory: '全部' })
    this.applyFilters()
  },

  exportBackup() {
    const fileName = `wardrobe-backup-${wardrobe.formatLocalDate()}.json`
    const userDataPath = wx.env && wx.env.USER_DATA_PATH
    if (!userDataPath) {
      wx.showToast({ title: '当前环境不支持文件导出', icon: 'none' })
      return
    }
    const filePath = `${userDataPath}/${fileName}`
    wx.showLoading({ title: '正在生成备份', mask: true })
    Promise.resolve(wardrobe.exportData()).then((backup) => {
      wx.getFileSystemManager().writeFile({
        filePath,
        data: JSON.stringify(backup, null, 2),
        encoding: 'utf8',
        success: () => {
          wx.hideLoading()
          this.shareBackupFile(filePath, fileName, JSON.stringify(backup, null, 2))
        },
        fail: () => {
          wx.hideLoading()
          wx.showToast({ title: '生成备份文件失败', icon: 'none' })
        }
      })
    }).catch(() => {
      wx.hideLoading()
      wx.showToast({ title: '生成备份文件失败', icon: 'none' })
    })
  },

  shareBackupFile(filePath, fileName, backupText) {
    const copyBackupText = () => {
      wx.setClipboardData({
        data: backupText,
        success: () => wx.showModal({
          title: '备份内容已复制',
          content: '请粘贴到微信文件传输助手或记事本中保存。以后可从剪贴板导入。',
          showCancel: false
        }),
        fail: () => wx.showModal({
          title: '备份文件已生成',
          content: `文件路径：${filePath}`,
          showCancel: false
        })
      })
    }
    if (typeof wx.shareFileMessage !== 'function') {
      copyBackupText()
      return
    }
        wx.shareFileMessage({
          filePath,
          fileName,
          success: () => wx.showToast({ title: '请选择发送位置保存', icon: 'success' }),
          fail: (error) => {
            if (error && error.errMsg && error.errMsg.includes('cancel')) {
              return
            }
            copyBackupText()
          }
        })
  },

  importBackup() {
    if (typeof wx.chooseMessageFile !== 'function') {
      this.importBackupFromClipboard()
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
          success: (content) => this.confirmBackupImport(content.data),
          fail: () => wx.showToast({ title: '读取备份文件失败', icon: 'none' })
        })
      },
      fail: (error) => {
        if (error && error.errMsg && error.errMsg.includes('cancel')) {
          return
        }
        this.importBackupFromClipboard()
      }
    })
  },

  importBackupFromClipboard() {
    wx.getClipboardData({
      success: (res) => this.confirmBackupImport(res.data),
      fail: () => wx.showToast({ title: '读取备份失败', icon: 'none' })
    })
  },

  confirmBackupImport(rawData) {
    let backup
    try {
      backup = typeof rawData === 'string' ? JSON.parse(rawData) : rawData
    } catch (error) {
      wx.showToast({ title: '备份内容不是有效 JSON', icon: 'none' })
      return
    }
    if (!backup || !Array.isArray(backup.items) || !Array.isArray(backup.outfits) || !Array.isArray(backup.wishlist)) {
      wx.showToast({ title: '备份缺少必要数据', icon: 'none' })
      return
    }
    wx.showModal({
      title: '导入备份',
      content: `将合并 ${backup.items.length} 件衣物，未包含在文件中的本地数据不会被删除。确定继续吗？`,
      confirmColor: '#7b3b32',
      success: (modal) => {
        if (!modal.confirm) {
          return
        }
        const result = wardrobe.importData(backup)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.loadItems()
        wx.showToast({ title: '导入成功，本地数据已保留', icon: 'success' })
      }
    })
  },

  goAdd() {
    wx.switchTab({
      url: '/pages/add/add'
    })
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`
    })
  }
})
