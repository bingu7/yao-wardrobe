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
    insights: {
      currentSeason: '',
      recentItems: [],
      staleItems: [],
      weeklyItems: [],
      todayRecordCount: 0
    },
    batchMode: false,
    selectedItemIds: [],
    batchCategories: [],
    batchOccasions: [],
    idleAlertDays: wardrobe.IDLE_ALERT_DAYS,
    showBatchCategoryPanel: false,
    showBatchOccasionPanel: false,
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

  noop() {},

  loadItems() {
    const rawItems = wardrobe.getItems()
    const items = rawItems.map(wardrobe.enrichItemForDisplay)
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
      insights: wardrobe.getHomeInsights(items),
      batchCategories: wardrobe.getFormCategories(),
      batchOccasions: wardrobe.getOccasions(),
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
      const searchText = [
        item.name,
        item.category,
        item.color,
        item.status,
        item.note,
        ...(Array.isArray(item.seasons) ? item.seasons : []),
        ...(Array.isArray(item.occasions) ? item.occasions : [])
      ].filter(Boolean).join(' ').toLowerCase()
      const matchKeyword = !keyword || searchText.includes(keyword)
      return matchCategory && matchKeyword
    }).map((item) => ({
      ...item,
      selected: this.data.selectedItemIds.includes(item.id)
    }))
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

  clearFilters() {
    this.setData({ keyword: '', activeCategory: '全部' })
    this.applyFilters()
  },

  exportBackup() {
    const fileName = `wardrobe-backup-${wardrobe.formatLocalDate(new Date())}.json`
    const userDataPath = wx.env && wx.env.USER_DATA_PATH
    if (!userDataPath) {
      wx.showToast({ title: '当前环境不支持文件导出', icon: 'none' })
      return
    }
    const filePath = `${userDataPath}/${fileName}`
    const backupText = JSON.stringify(wardrobe.exportData(), null, 2)
    wx.showLoading({ title: '正在生成备份', mask: true })
    wx.getFileSystemManager().writeFile({
      filePath,
      data: backupText,
      encoding: 'utf8',
      success: () => {
        wx.hideLoading()
        this.shareBackupFile(filePath, fileName, backupText)
      },
      fail: () => {
        wx.hideLoading()
        wx.showToast({ title: '生成备份文件失败', icon: 'none' })
      }
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
        if (!(error && error.errMsg && error.errMsg.includes('cancel'))) {
          copyBackupText()
        }
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
        if (!(error && error.errMsg && error.errMsg.includes('cancel'))) {
          this.importBackupFromClipboard()
        }
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
      content: `将恢复 ${backup.items.length} 件衣物、${backup.outfits.length} 套穿搭和 ${backup.wishlist.length} 个愿望，确定继续吗？`,
      confirmColor: '#7b3b32',
      success: (modal) => {
        if (!modal.confirm) return
        const result = wardrobe.importData(backup)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        this.loadItems()
        wx.showToast({ title: '导入成功', icon: 'success' })
      }
    })
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

  goAdd() {
    wx.switchTab({
      url: '/pages/add/add'
    })
  },

  openWearCalendar() {
    wx.navigateTo({
      url: '/pages/wear-calendar/wear-calendar'
    })
  },

  enterBatchMode() {
    this.setData({
      batchMode: true,
      selectedItemIds: []
    })
    this.applyFilters()
  },

  exitBatchMode() {
    this.setData({
      batchMode: false,
      selectedItemIds: [],
      showBatchCategoryPanel: false,
      showBatchOccasionPanel: false
    })
    this.applyFilters()
  },

  handleItemTap(event) {
    if (this.data.batchMode) {
      this.toggleItemSelection(event)
      return
    }
    this.goDetail(event)
  },

  toggleItemSelection(event) {
    const id = event.currentTarget.dataset.id
    const selectedItemIds = this.data.selectedItemIds.includes(id)
      ? this.data.selectedItemIds.filter((itemId) => itemId !== id)
      : [...this.data.selectedItemIds, id]
    this.setData({ selectedItemIds })
    this.applyFilters()
  },

  selectAllFiltered() {
    this.setData({
      selectedItemIds: Array.from(new Set([
        ...this.data.selectedItemIds,
        ...this.data.filteredItems.map((item) => item.id)
      ]))
    })
    this.applyFilters()
  },

  openBatchCategoryPanel() {
    if (!this.data.selectedItemIds.length) {
      wx.showToast({ title: '先选择衣物', icon: 'none' })
      return
    }
    this.setData({ showBatchCategoryPanel: true })
  },

  closeBatchCategoryPanel() {
    this.setData({ showBatchCategoryPanel: false })
  },

  applyBatchCategory(event) {
    const result = wardrobe.batchUpdateCategory(this.data.selectedItemIds, event.currentTarget.dataset.category)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已修改分类', icon: 'success' })
    this.exitBatchMode()
    this.loadItems()
  },

  openBatchOccasionPanel() {
    if (!this.data.selectedItemIds.length) {
      wx.showToast({ title: '先选择衣物', icon: 'none' })
      return
    }
    this.setData({ showBatchOccasionPanel: true })
  },

  closeBatchOccasionPanel() {
    this.setData({ showBatchOccasionPanel: false })
  },

  applyBatchOccasion(event) {
    const result = wardrobe.batchAddOccasions(this.data.selectedItemIds, [event.currentTarget.dataset.occasion])
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已添加场合', icon: 'success' })
    this.exitBatchMode()
    this.loadItems()
  },

  confirmBatchDelete() {
    if (!this.data.selectedItemIds.length) {
      wx.showToast({ title: '先选择衣物', icon: 'none' })
      return
    }
    wx.showModal({
      title: '批量删除',
      content: `确定删除选中的 ${this.data.selectedItemIds.length} 件衣物吗？`,
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) return
        const result = wardrobe.batchDeleteItems(this.data.selectedItemIds)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '已删除', icon: 'success' })
        this.exitBatchMode()
        this.loadItems()
      }
    })
  },

  goDetail(event) {
    wx.navigateTo({
      url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}`
    })
  }
})
