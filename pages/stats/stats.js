const wardrobe = require('../../utils/wardrobe')

Page({
  data: {
    activeStatsTab: 'overview',
    statsTabs: [
      { key: 'overview', label: '概览' },
      { key: 'usage', label: '使用' },
      { key: 'distribution', label: '分布' },
      { key: 'data', label: '数据' }
    ],
    summary: {
      totalCount: 0,
      totalPrice: 0,
      averagePrice: 0,
      idleCount: 0,
      neverWornCount: 0,
      idleOver90Count: 0,
      totalWearCount: 0,
      wornItemCount: 0,
      averageCostPerWear: 0,
      categoryCounts: [],
      seasonCounts: [],
      occasionCounts: [],
      mostWornItems: [],
      highestCostPerWearItems: []
    }
  },

  onShow() {
    this.loadStats()
  },

  setStatsTab(event) {
    this.setData({
      activeStatsTab: event.currentTarget.dataset.key
    })
  },

  openSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  loadStats() {
    const items = wardrobe.getItems()
    const summary = wardrobe.summarize(items)
    const maxCount = Math.max(...summary.categoryCounts.map((item) => item.count), 1)
    const maxSeasonCount = Math.max(...summary.seasonCounts.map((item) => item.count), 1)
    const maxOccasionCount = Math.max(...summary.occasionCounts.map((item) => item.count), 1)
    this.setData({
      summary: {
        ...summary,
        categoryCounts: summary.categoryCounts.map((item) => ({
          ...item,
          percent: Math.round((item.count / maxCount) * 100)
        })),
        seasonCounts: summary.seasonCounts.map((item) => ({
          ...item,
          percent: Math.round((item.count / maxSeasonCount) * 100)
        })),
        occasionCounts: summary.occasionCounts.map((item) => ({
          ...item,
          percent: Math.round((item.count / maxOccasionCount) * 100)
        }))
      }
    })
  }
})
