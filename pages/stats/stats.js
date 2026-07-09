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
    },
    showImportPanel: false,
    backupText: ''
  },

  onShow() {
    this.loadStats()
  },

  noop() {},

  setStatsTab(event) {
    this.setData({
      activeStatsTab: event.currentTarget.dataset.key
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
  },

  copyBackup() {
    const data = JSON.stringify(wardrobe.exportData(), null, 2)
    wx.setClipboardData({
      data,
      success: () => {
        wx.showToast({ title: '备份已复制', icon: 'success' })
      }
    })
  },

  openImportPanel() {
    this.setData({
      showImportPanel: true,
      backupText: ''
    })
  },

  closeImportPanel() {
    this.setData({
      showImportPanel: false,
      backupText: ''
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

    let data = null
    try {
      data = JSON.parse(text)
    } catch (error) {
      wx.showToast({ title: '备份不是有效 JSON', icon: 'none' })
      return
    }

    wx.showModal({
      title: '恢复备份',
      content: '恢复会覆盖当前衣橱、穿搭、愿望和标签数据。确定继续吗？',
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        const result = wardrobe.importData(data)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        wx.showToast({ title: '已恢复备份', icon: 'success' })
        this.closeImportPanel()
        this.loadStats()
      }
    })
  }
})
