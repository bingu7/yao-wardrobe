const wardrobe = require('../../utils/wardrobe')
const CATEGORY_VISIBLE_LIMIT = 2

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
    summary: {
      totalCount: 0,
      totalPrice: 0,
      idleCount: 0
    },
    // 管理面板
    showManagePanel: false,
    manageTab: 'category', // 'category' or 'occasion'
    customCategory: '',
    customOccasion: '',
    categoryPanelItems: [],
    occasionPanelItems: [],
    isCategoryEditing: false,
    showAllCustomCategories: false,
    showAllCustomOccasions: false
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
    this.setData({ filteredItems })
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

  goAdd() {
    wx.switchTab({ url: '/pages/add/add' })
  },

  goDetail(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` })
  },

  // ── 管理面板 ──

  openManagePanel() {
    this.refreshManagePanel('category')
    this.setData({ showManagePanel: true })
  },

  closeManagePanel() {
    this.setData({ showManagePanel: false, isCategoryEditing: false })
  },

  switchManageTab(event) {
    const tab = event.currentTarget.dataset.tab
    this.refreshManagePanel(tab)
  },

  refreshManagePanel(tab) {
    if (tab === 'category') {
      this.setData({
        manageTab: 'category',
        categoryPanelItems: wardrobe.buildCategoryPanelItems(wardrobe.getFormCategories(), wardrobe.getCustomCategories(), ''),
        customCategory: '',
        isCategoryEditing: false
      })
    } else {
      this.setData({
        manageTab: 'occasion',
        occasionPanelItems: this.buildOccasionPanelItems(wardrobe.getOccasions()),
        customOccasion: '',
        isCategoryEditing: false
      })
    }
  },

  buildOccasionPanelItems(occasions) {
    return occasions.map((name, index) => ({
      name,
      draftName: name,
      canMoveUp: index > 0,
      canMoveDown: index < occasions.length - 1,
      sortIndex: index
    }))
  },

  // ── 分类管理 ──

  noop() {},

  toggleCategoryEditing() {
    this.setData({ isCategoryEditing: !this.data.isCategoryEditing })
  },

  onCustomCategoryInput(event) {
    this.setData({ customCategory: event.detail.value })
  },

  addCustomCategory() {
    const result = wardrobe.addCustomCategory(this.data.customCategory)
    if (!result.ok) { wx.showToast({ title: result.message, icon: 'none' }); return }
    this.setData({
      customCategory: '',
      categoryPanelItems: wardrobe.buildCategoryPanelItems(wardrobe.getFormCategories(), wardrobe.getCustomCategories(), result.category)
    })
    wx.showToast({ title: '已添加分类', icon: 'success' })
  },

  onCategoryDraftInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ [`categoryPanelItems[${index}].draftName`]: event.detail.value })
  },

  renameCategoryFromPanel(event) {
    const index = Number(event.currentTarget.dataset.index)
    const item = this.data.categoryPanelItems[index]
    if (!item) return
    const result = wardrobe.renameCustomCategory(item.name, item.draftName)
    if (!result.ok) { wx.showToast({ title: result.message, icon: 'none' }); return }
    this.setData({
      categoryPanelItems: wardrobe.buildCategoryPanelItems(wardrobe.getFormCategories(), wardrobe.getCustomCategories(), result.category)
    })
    this.loadItems()
    wx.showToast({ title: '已更新分类', icon: 'success' })
  },

  moveCategoryFromPanel(event) {
    const category = event.currentTarget.dataset.category
    const direction = Number(event.currentTarget.dataset.direction)
    wardrobe.moveCustomCategory(category, direction)
    this.setData({
      categoryPanelItems: wardrobe.buildCategoryPanelItems(wardrobe.getFormCategories(), wardrobe.getCustomCategories(), '')
    })
  },

  deleteCustomCategory(event) {
    const category = event.currentTarget.dataset.category
    wx.showModal({
      title: '删除分类',
      content: `确定删除"${category}"吗？相关衣物将归为「其他」。`,
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) return
        wardrobe.deleteCustomCategory(category)
        this.setData({
          categoryPanelItems: wardrobe.buildCategoryPanelItems(wardrobe.getFormCategories(), wardrobe.getCustomCategories(), '')
        })
        this.loadItems()
      }
    })
  },

  // ── 场合管理 ──

  onCustomOccasionInput(event) {
    this.setData({ customOccasion: event.detail.value })
  },

  addCustomOccasion() {
    const result = wardrobe.addCustomOccasion(this.data.customOccasion)
    if (!result.ok) { wx.showToast({ title: result.message, icon: 'none' }); return }
    this.setData({
      customOccasion: '',
      occasionPanelItems: this.buildOccasionPanelItems(wardrobe.getOccasions())
    })
    wx.showToast({ title: '已添加场合', icon: 'success' })
  },

  onOccasionDraftInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({ [`occasionPanelItems[${index}].draftName`]: event.detail.value })
  },

  renameOccasionFromPanel(event) {
    const index = Number(event.currentTarget.dataset.index)
    const item = this.data.occasionPanelItems[index]
    if (!item) return
    const result = wardrobe.renameCustomOccasion(item.name, item.draftName)
    if (!result.ok) { wx.showToast({ title: result.message, icon: 'none' }); return }
    this.setData({
      occasionPanelItems: this.buildOccasionPanelItems(wardrobe.getOccasions())
    })
    wx.showToast({ title: '已更新场合', icon: 'success' })
  },

  moveOccasionFromPanel(event) {
    const occasion = event.currentTarget.dataset.occasion
    const direction = Number(event.currentTarget.dataset.direction)
    wardrobe.moveCustomOccasion(occasion, direction)
    this.setData({
      occasionPanelItems: this.buildOccasionPanelItems(wardrobe.getOccasions())
    })
  },

  deleteCustomOccasion(event) {
    const occasion = event.currentTarget.dataset.occasion
    wx.showModal({
      title: '删除场合',
      content: `确定删除"${occasion}"吗？`,
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) return
        wardrobe.deleteCustomOccasion(occasion)
        this.setData({
          occasionPanelItems: this.buildOccasionPanelItems(wardrobe.getOccasions())
        })
      }
    })
  }
})