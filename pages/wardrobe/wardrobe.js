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
