const wardrobe = require('../../utils/wardrobe')

Page({
  data: {
    selectedDate: '',
    days: [],
    itemOptions: [],
    selectedItems: [],
    todayCount: 0
  },

  onShow() {
    const selectedDate = this.data.selectedDate || wardrobe.formatLocalDate(new Date())
    this.setData({ selectedDate })
    this.loadData(selectedDate)
  },

  loadData(selectedDate) {
    const items = wardrobe.getItems().map(wardrobe.enrichItemForDisplay)
    const selectedIds = wardrobe.getWearLog(selectedDate)
    const itemOptions = items.map((item) => ({
      ...item,
      selected: selectedIds.includes(item.id)
    }))
    this.setData({
      days: wardrobe.getWearCalendar(21),
      itemOptions,
      selectedItems: wardrobe.hydrateWearLog(selectedDate, items),
      todayCount: wardrobe.getWearLog(wardrobe.formatLocalDate(new Date())).length
    })
  },

  onDateChange(event) {
    const selectedDate = event.detail.value
    this.setData({ selectedDate })
    this.loadData(selectedDate)
  },

  selectDay(event) {
    const selectedDate = event.currentTarget.dataset.date
    this.setData({ selectedDate })
    this.loadData(selectedDate)
  },

  toggleItem(event) {
    const id = event.currentTarget.dataset.id
    const itemOptions = this.data.itemOptions.map((item) => (
      item.id === id ? { ...item, selected: !item.selected } : item
    ))
    this.setData({ itemOptions })
  },

  saveRecord() {
    const ids = this.data.itemOptions.filter((item) => item.selected).map((item) => item.id)
    const result = wardrobe.setWearLog(this.data.selectedDate, ids)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已保存日历', icon: 'success' })
    this.loadData(this.data.selectedDate)
  },

  clearRecord() {
    const result = wardrobe.setWearLog(this.data.selectedDate, [])
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '已清空当天', icon: 'success' })
    this.loadData(this.data.selectedDate)
  }
})
