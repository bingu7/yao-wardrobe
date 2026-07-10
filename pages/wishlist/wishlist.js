const wardrobe = require('../../utils/wardrobe')
const CATEGORY_VISIBLE_LIMIT = 5

Page({
  data: {
    keyword: '',
    activeCategory: '全部',
    categories: ['全部'],
    visibleCategories: ['全部'],
    showAllCategories: false,
    categoryToggleText: '',
    canToggleCategories: false,
    wishlist: [],
    filteredWishlist: [],
    isFiltering: false
  },

  onLoad() {
    this.searchDebounce = wardrobe.createDebounce(300)
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const items = wardrobe.getItems()
    const itemMap = items.reduce((map, item) => {
      map[item.id] = item
      return map
    }, {})
    const wishlist = wardrobe.getWishlist().map((wish) => ({
      ...wish,
      matchItem: itemMap[wish.matchItemId] || null
    }))
    const wishCategories = wishlist.map((item) => item.category).filter(Boolean)
    const categories = ['全部', ...Array.from(new Set(wishCategories))]
    const activeCategory = categories.includes(this.data.activeCategory) ? this.data.activeCategory : '全部'
    const categoryView = this.buildCategoryView(categories, this.data.showAllCategories)

    this.setData({
      wishlist,
      categories,
      visibleCategories: categoryView.visibleCategories,
      canToggleCategories: categoryView.canToggle,
      categoryToggleText: categoryView.toggleText,
      activeCategory
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
    const filteredWishlist = this.data.wishlist.filter((item) => {
      const matchName = item.matchItem ? item.matchItem.name : ''
      const text = `${item.name} ${item.category} ${item.note || ''} ${matchName}`.toLowerCase()
      const matchKeyword = !keyword || text.includes(keyword)
      const matchCategory = this.data.activeCategory === '全部' || item.category === this.data.activeCategory
      return matchKeyword && matchCategory
    })

    this.setData({
      filteredWishlist,
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

  goAdd() {
    wx.navigateTo({
      url: '/pages/wish-form/wish-form'
    })
  },

  deleteWish(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除愿望',
      content: '确定从愿望清单移除吗？',
      confirmColor: '#7b3b32',
      success: (res) => {
        if (res.confirm) {
          wardrobe.deleteWishlistItem(id)
          this.loadData()
        }
      }
    })
  },

  purchaseWish(event) {
    const result = wardrobe.purchaseWishlistItem(event.currentTarget.dataset.id)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadData()
    wx.showToast({ title: '已加入衣橱', icon: 'success' })
  }
})
