const wardrobe = require('../../utils/wardrobe')

Page({
  data: {
    weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    today: '',
    selectedDate: '',
    monthTitle: '',
    calendarDays: [],
    outfitOptions: [],
    selectedOutfitIndex: 0,
    selectedOutfitId: '',
    note: '',
    selectedPlan: null,
    canMarkWorn: false,
    plannedCount: 0
  },

  onShow() {
    const today = wardrobe.formatLocalDate(new Date())
    const selectedDate = this.data.selectedDate || today
    this.setData({ today, selectedDate })
    this.loadData()
  },

  loadData() {
    const items = wardrobe.getItems()
    const outfits = wardrobe.getOutfits().map((outfit) => wardrobe.hydrateOutfit(outfit, items))
    const plans = wardrobe.getOutfitPlans()
    const selectedPlan = plans[this.data.selectedDate] || null
    const selectedOutfitIndex = selectedPlan
      ? Math.max(0, outfits.findIndex((outfit) => outfit.id === selectedPlan.outfitId) + 1)
      : 0
    const selectedOutfit = selectedPlan
      ? outfits.find((outfit) => outfit.id === selectedPlan.outfitId) || null
      : null
    this.setData({
      outfitOptions: [{ id: '', name: '请选择穿搭' }, ...outfits],
      selectedOutfitIndex,
      selectedOutfitId: selectedPlan ? selectedPlan.outfitId : '',
      note: selectedPlan ? selectedPlan.note || '' : '',
      selectedPlan: selectedPlan && selectedOutfit ? { ...selectedPlan, outfit: selectedOutfit } : null,
      canMarkWorn: Boolean(selectedPlan && this.data.selectedDate <= this.data.today),
      plannedCount: Object.keys(plans).length,
      ...this.buildCalendar(this.data.selectedDate, plans, outfits)
    })
  },

  buildCalendar(selectedDate, plans, outfits) {
    const [year, month] = selectedDate.split('-').map(Number)
    const firstDay = new Date(year, month - 1, 1)
    const startWeekday = firstDay.getDay()
    const daysInMonth = new Date(year, month, 0).getDate()
    const outfitMap = outfits.reduce((map, outfit) => {
      map[outfit.id] = outfit
      return map
    }, {})
    const calendarDays = Array.from({ length: 42 }, (_, index) => {
      const day = index - startWeekday + 1
      if (day < 1 || day > daysInMonth) return { key: `blank-${index}`, inMonth: false }
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const plan = plans[date]
      const outfit = plan ? outfitMap[plan.outfitId] : null
      return {
        key: date,
        date,
        day,
        inMonth: true,
        isToday: date === this.data.today,
        selected: date === selectedDate,
        hasPlan: Boolean(outfit),
        planName: outfit ? outfit.name : ''
      }
    })
    return {
      monthTitle: `${year} 年 ${month} 月`,
      calendarDays
    }
  },

  changeMonth(event) {
    const offset = Number(event.currentTarget.dataset.offset) || 0
    const [year, month] = this.data.selectedDate.split('-').map(Number)
    const target = new Date(year, month - 1 + offset, 1)
    const selectedDate = wardrobe.formatLocalDate(target)
    this.setData({ selectedDate })
    this.loadData()
  },

  selectDay(event) {
    const selectedDate = event.currentTarget.dataset.date
    if (!selectedDate) return
    this.setData({ selectedDate })
    this.loadData()
  },

  onDateChange(event) {
    this.setData({ selectedDate: event.detail.value })
    this.loadData()
  },

  onOutfitChange(event) {
    const selectedOutfitIndex = Number(event.detail.value)
    const selected = this.data.outfitOptions[selectedOutfitIndex]
    this.setData({
      selectedOutfitIndex,
      selectedOutfitId: selected ? selected.id : ''
    })
  },

  onNoteInput(event) {
    this.setData({ note: event.detail.value })
  },

  savePlan() {
    const result = wardrobe.setOutfitPlan(this.data.selectedDate, this.data.selectedOutfitId, this.data.note)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: '计划已保存', icon: 'success' })
    this.loadData()
  },

  removePlan() {
    const result = wardrobe.deleteOutfitPlan(this.data.selectedDate)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({ title: result.changed ? '计划已取消' : '当天没有计划', icon: 'none' })
    this.loadData()
  },

  markWorn() {
    const result = wardrobe.markOutfitPlanWorn(this.data.selectedDate)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    wx.showToast({
      title: result.addedCount ? `已记录 ${result.addedCount} 件` : '当天已经记录过',
      icon: result.addedCount ? 'success' : 'none'
    })
    this.loadData()
  },

  onImageError(event) {
    const { id, imageUrl } = event.currentTarget.dataset
    if (wardrobe.clearItemImage(id, imageUrl)) this.loadData()
  },

  goAddOutfit() {
    wx.navigateTo({ url: '/pages/outfit-form/outfit-form' })
  }
})
