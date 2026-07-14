const wardrobe = require('../../utils/wardrobe')

Page({
  data: {
    selectedDate: '',
    days: [],
    itemOptions: [],
    selectedItems: [],
    todayCount: 0,
    today: ''
  },

  onShow() {
    const today = wardrobe.formatLocalDate(new Date())
    const selectedDate = this.data.selectedDate && this.data.selectedDate <= today ? this.data.selectedDate : today
    this.setData({ selectedDate, today })
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

  onImageError(event) {
    const { id, imageUrl } = event.currentTarget.dataset
    if (wardrobe.clearItemImage(id, imageUrl)) this.loadData(this.data.selectedDate)
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
