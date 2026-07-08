const wardrobe = require('../../utils/wardrobe')

function emptyForm() {
  return {
    name: '',
    topId: '',
    bottomId: '',
    shoesId: '',
    bagId: '',
    accessoryId: '',
    occasion: '',
    note: ''
  }
}

function uniqueItems(items) {
  const seen = {}
  return items.filter((item) => {
    if (!item.id || seen[item.id]) {
      return false
    }
    seen[item.id] = true
    return true
  })
}

Page({
  data: {
    slots: [],
    form: emptyForm(),
    occasionOptions: ['不选择'],
    occasionIndex: 0,
    occasionLabel: '不选择'
  },

  onLoad() {
    this.loadOptions()
  },

  loadOptions() {
    const items = wardrobe.getItems()
    const occasionOptions = ['不选择', ...wardrobe.getOccasions()]
    const slots = wardrobe.outfitSlots.map((slot) => {
      const matchedItems = items.filter((item) => slot.categories.includes(item.category))
      const options = uniqueItems([...matchedItems, ...items])
      return {
        ...slot,
        options: [{ id: '', name: `选择${slot.label}` }, ...options],
        index: 0,
        displayName: `选择${slot.label}`
      }
    })

    this.setData({ slots, occasionOptions })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  onSlotChange(event) {
    const slotIndex = Number(event.currentTarget.dataset.index)
    const optionIndex = Number(event.detail.value)
    const slot = this.data.slots[slotIndex]
    const selected = slot.options[optionIndex]

    this.setData({
      [`slots[${slotIndex}].index`]: optionIndex,
      [`slots[${slotIndex}].displayName`]: selected.name,
      [`form.${slot.key}`]: selected.id
    })
  },

  onOccasionChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      occasionIndex: index,
      occasionLabel: this.data.occasionOptions[index],
      'form.occasion': index === 0 ? '' : this.data.occasionOptions[index]
    })
  },

  saveOutfit() {
    const form = this.data.form
    const selectedCount = wardrobe.outfitSlots.filter((slot) => form[slot.key]).length
    if (!form.name.trim()) {
      wx.showToast({
        title: '请填写穿搭名字',
        icon: 'none'
      })
      return
    }
    if (selectedCount < 2) {
      wx.showToast({
        title: '至少选择 2 件衣物',
        icon: 'none'
      })
      return
    }

    wardrobe.upsertOutfit({
      ...form,
      name: form.name.trim(),
      note: form.note.trim()
    })

    wx.showToast({
      title: '已保存穿搭',
      icon: 'success'
    })

    wx.navigateBack()
  },

  goBack() {
    wx.navigateBack()
  }
})
