const wardrobe = require('../../utils/wardrobe')
const OCCASION_VISIBLE_LIMIT = 2

Page({
  data: {
    keyword: '',
    activeOccasion: '全部',
    occasionFilters: ['全部'],
    visibleOccasionFilters: ['全部'],
    showAllOccasions: false,
    canToggleOccasions: false,
    occasionToggleText: '',
    outfits: [],
    filteredOutfits: []
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const items = wardrobe.getItems()
    const outfits = wardrobe.getOutfits().map((outfit) => wardrobe.hydrateOutfit(outfit, items))
    const outfitOccasions = outfits.map((outfit) => outfit.occasion).filter(Boolean)
    const occasionFilters = ['全部', ...Array.from(new Set(outfitOccasions))]
    const activeOccasion = occasionFilters.includes(this.data.activeOccasion) ? this.data.activeOccasion : '全部'
    const occasionView = this.buildOccasionView(occasionFilters, this.data.showAllOccasions)

    this.setData({
      outfits,
      occasionFilters,
      visibleOccasionFilters: occasionView.visibleOccasionFilters,
      canToggleOccasions: occasionView.canToggle,
      occasionToggleText: occasionView.toggleText,
      activeOccasion
    })
    this.applyFilters()
  },

  buildOccasionView(occasionFilters, showAll) {
    const canToggle = occasionFilters.length > OCCASION_VISIBLE_LIMIT
    return {
      visibleOccasionFilters: showAll || !canToggle ? occasionFilters : occasionFilters.slice(0, OCCASION_VISIBLE_LIMIT),
      canToggle,
      toggleText: showAll ? '收起' : `展开 ${occasionFilters.length - OCCASION_VISIBLE_LIMIT} 个`
    }
  },

  applyFilters() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const filteredOutfits = this.data.outfits.filter((outfit) => {
      const pieceNames = outfit.pieces.map((piece) => piece.name).join(' ')
      const matchKeyword = !keyword || `${outfit.name} ${outfit.note || ''} ${pieceNames}`.toLowerCase().includes(keyword)
      const matchOccasion = this.data.activeOccasion === '全部' || outfit.occasion === this.data.activeOccasion
      return matchKeyword && matchOccasion
    })

    this.setData({ filteredOutfits })
  },

  onSearch(event) {
    this.setData({ keyword: event.detail.value })
    this.applyFilters()
  },

  setOccasion(event) {
    this.setData({ activeOccasion: event.currentTarget.dataset.occasion })
    this.applyFilters()
  },

  toggleOccasions() {
    const showAllOccasions = !this.data.showAllOccasions
    const occasionView = this.buildOccasionView(this.data.occasionFilters, showAllOccasions)
    this.setData({
      showAllOccasions,
      visibleOccasionFilters: occasionView.visibleOccasionFilters,
      canToggleOccasions: occasionView.canToggle,
      occasionToggleText: occasionView.toggleText
    })
  },

  goAdd() {
    wx.navigateTo({
      url: '/pages/outfit-form/outfit-form'
    })
  },

  deleteOutfit(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除穿搭',
      content: '确定删除这套穿搭吗？',
      confirmColor: '#7b3b32',
      success: (res) => {
        if (res.confirm) {
          wardrobe.deleteOutfit(id)
          this.loadData()
        }
      }
    })
  }
})
