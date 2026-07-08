const wardrobe = require('../../utils/wardrobe')

Page({
  data: {
    summary: {
      totalCount: 0,
      totalPrice: 0,
      averagePrice: 0,
      idleCount: 0,
      totalWearCount: 0,
      wornItemCount: 0,
      averageCostPerWear: 0,
      categoryCounts: []
    }
  },

  onShow() {
    const items = wardrobe.getItems()
    const summary = wardrobe.summarize(items)
    const maxCount = Math.max(...summary.categoryCounts.map((item) => item.count), 1)
    this.setData({
      summary: {
        ...summary,
        categoryCounts: summary.categoryCounts.map((item) => ({
          ...item,
          percent: Math.round((item.count / maxCount) * 100)
        }))
      }
    })
  }
})
