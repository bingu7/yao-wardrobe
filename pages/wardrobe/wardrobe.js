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
      toggleText: canToggle ? (showAll ? '收起' : `展开 ${categories.length - CATEGORY_VISIBLE_LIMIT} 个`) : ''
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

  onImageError(event) {
    const { id, imageUrl } = event.currentTarget.dataset
    if (wardrobe.clearItemImage(id, imageUrl)) this.loadItems()
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
