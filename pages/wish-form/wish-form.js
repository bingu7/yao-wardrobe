const wardrobe = require('../../utils/wardrobe')
const CUSTOM_VISIBLE_LIMIT = 2

function emptyForm() {
  return {
    imageUrl: '',
    name: '',
    category: '',
    expectedPrice: '',
    matchItemId: '',
    note: ''
  }
}

Page({
  data: {
    form: emptyForm(),
    categories: [],
    customCategories: [],
    visibleCustomCategories: [],
    showAllCustomCategories: false,
    hiddenCustomCategoryCount: 0,
    customCategoryToggleText: '',
    categoryPanelItems: [],
    showCategoryPanel: false,
    isCategoryEditing: false,
    customCategory: '',
    categoryIndex: 0,
    matchOptions: [{ id: '', name: '不选择已有衣物' }],
    matchIndex: 0,
    matchLabel: '不选择已有衣物',
    showMatchPanel: false
  },

  onLoad() {
    this.loadOptions()
  },

  onShow() {
    this.refreshOptions()
  },

  refreshOptions() {
    const items = wardrobe.getItems()
    const customCategories = wardrobe.getCustomCategories()
    const customView = wardrobe.buildCustomView(customCategories, this.data.showAllCustomCategories)
    // 刷新分类面板和匹配列表，但不重置表单已填写的内容
    this.setData({
      categories: wardrobe.getFormCategories(),
      customCategories,
      visibleCustomCategories: customView.visibleItems,
      hiddenCustomCategoryCount: customView.hiddenCount,
      customCategoryToggleText: customView.toggleText,
      categoryPanelItems: wardrobe.buildCategoryPanelItems(wardrobe.getFormCategories(), customCategories, this.data.form.category),
      matchOptions: [{ id: '', name: '不选择已有衣物' }, ...items]
    })
  },

  loadOptions() {
    const items = wardrobe.getItems()
    const customCategories = wardrobe.getCustomCategories()
    const customView = wardrobe.buildCustomView(customCategories, this.data.showAllCustomCategories)
    this.setData({
      categories: wardrobe.getFormCategories(),
      customCategories,
      visibleCustomCategories: customView.visibleItems,
      hiddenCustomCategoryCount: customView.hiddenCount,
      customCategoryToggleText: customView.toggleText,
      categoryPanelItems: wardrobe.buildCategoryPanelItems(wardrobe.getFormCategories(), customCategories, this.data.form.category),
      matchOptions: [{ id: '', name: '不选择已有衣物' }, ...items]
    })
  },

  noop() {},

  chooseImage() {
    const oldImageUrl = this.data.form.imageUrl
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        wardrobe.persistImage(tempPath).then((savedPath) => {
          if (oldImageUrl && oldImageUrl !== savedPath) {
            wardrobe.removeImageFile(oldImageUrl)
          }
          this.setData({
            'form.imageUrl': savedPath
          })
        })
      }
    })
  },

  removeImage() {
    const oldUrl = this.data.form.imageUrl
    wardrobe.removeImageFile(oldUrl)
    this.setData({
      'form.imageUrl': ''
    })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({
      [`form.${field}`]: event.detail.value
    })
  },

  onCustomCategoryInput(event) {
    this.setData({
      customCategory: event.detail.value
    })
  },

  openCategoryPanel() {
    this.loadOptions()
    this.setData({
      showCategoryPanel: true
    })
  },

  closeCategoryPanel() {
    this.setData({
      showCategoryPanel: false,
      isCategoryEditing: false
    })
  },

  toggleCategoryEditing() {
    this.setData({
      isCategoryEditing: !this.data.isCategoryEditing
    })
  },

  startCategoryEditing() {
    this.setData({
      isCategoryEditing: true
    })
  },

  selectCategoryFromPanel(event) {
    if (this.data.isCategoryEditing) {
      return
    }
    const category = event.currentTarget.dataset.category
    const categories = this.data.categories
    this.setData({
      categoryIndex: Math.max(0, categories.indexOf(category)),
      'form.category': category,
      showCategoryPanel: false,
      categoryPanelItems: wardrobe.buildCategoryPanelItems(categories, this.data.customCategories, category)
    })
  },

  onCategoryDraftInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      [`categoryPanelItems[${index}].draftName`]: event.detail.value
    })
  },

  addCustomCategory() {
    const result = wardrobe.addCustomCategory(this.data.customCategory)
    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
      return
    }

    const categories = wardrobe.getFormCategories()
    const customCategories = wardrobe.getCustomCategories()
    const customView = wardrobe.buildCustomView(customCategories, true)
    this.setData({
      categories,
      customCategories,
      visibleCustomCategories: customView.visibleItems,
      showAllCustomCategories: true,
      hiddenCustomCategoryCount: customView.hiddenCount,
      customCategoryToggleText: customView.toggleText,
      categoryPanelItems: wardrobe.buildCategoryPanelItems(categories, customCategories, result.category),
      showCategoryPanel: true,
      customCategory: '',
      categoryIndex: categories.indexOf(result.category),
      'form.category': result.category
    })
    wx.showToast({
      title: '已添加分类',
      icon: 'success'
    })
  },

  renameCategoryFromPanel(event) {
    const index = Number(event.currentTarget.dataset.index)
    const item = this.data.categoryPanelItems[index]
    if (!item) {
      return
    }
    const result = wardrobe.renameCustomCategory(item.name, item.draftName)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const selectedCategory = this.data.form.category === item.name ? result.category : this.data.form.category
    this.setData({
      'form.category': selectedCategory
    })
    this.loadOptions()
    wx.showToast({ title: '已更新分类', icon: 'success' })
  },

  moveCategoryFromPanel(event) {
    const category = event.currentTarget.dataset.category
    const direction = Number(event.currentTarget.dataset.direction)
    const result = wardrobe.moveCustomCategory(category, direction)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.loadOptions()
  },

  toggleCustomCategories() {
    const showAllCustomCategories = !this.data.showAllCustomCategories
    const customView = wardrobe.buildCustomView(this.data.customCategories, showAllCustomCategories)
    this.setData({
      showAllCustomCategories,
      visibleCustomCategories: customView.visibleItems,
      hiddenCustomCategoryCount: customView.hiddenCount,
      customCategoryToggleText: customView.toggleText
    })
  },

  deleteCustomCategory(event) {
    const category = event.currentTarget.dataset.category
    wx.showModal({
      title: '删除分类',
      content: `确定删除“${category}”吗？已保存愿望不会被删除。`,
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        const result = wardrobe.deleteCustomCategory(category)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        const categories = wardrobe.getFormCategories()
        const customCategories = wardrobe.getCustomCategories()
        const customView = wardrobe.buildCustomView(customCategories, this.data.showAllCustomCategories)
        const clearSelected = this.data.form.category === category
        const selectedCategory = clearSelected ? '' : this.data.form.category
        this.setData({
          categories,
          customCategories,
          visibleCustomCategories: customView.visibleItems,
          hiddenCustomCategoryCount: customView.hiddenCount,
          customCategoryToggleText: customView.toggleText,
          categoryPanelItems: wardrobe.buildCategoryPanelItems(categories, customCategories, selectedCategory),
          'form.category': selectedCategory,
          categoryIndex: 0
        })
      }
    })
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      categoryIndex: index,
      'form.category': this.data.categories[index]
    })
  },

  // ── 匹配衣物面板 ──

  openMatchPanel() {
    this.setData({ showMatchPanel: true })
  },

  closeMatchPanel() {
    this.setData({ showMatchPanel: false })
  },

  selectMatchItem(event) {
    const id = event.currentTarget.dataset.id
    const name = event.currentTarget.dataset.name
    const options = this.data.matchOptions
    const index = options.findIndex((opt) => opt.id === id)
    this.setData({
      matchIndex: index >= 0 ? index : 0,
      matchLabel: name,
      'form.matchItemId': id,
      showMatchPanel: false
    })
  },

  saveWish() {
    const form = this.data.form
    const priceText = String(form.expectedPrice).trim()
    if (!form.name.trim() || !form.category) {
      wx.showToast({
        title: '请填写名字和种类',
        icon: 'none'
      })
      return
    }
    if (priceText !== '' && (!/^\d+(\.\d{1,2})?$/.test(priceText) || Number(priceText) < 0)) {
      wx.showToast({
        title: '预计价格格式不对',
        icon: 'none'
      })
      return
    }

    wardrobe.addWishlistItem({
      ...form,
      name: form.name.trim(),
      expectedPrice: priceText === '' ? '' : Number(Number(priceText).toFixed(2)),
      note: form.note.trim()
    })

    wx.showToast({
      title: '已加入愿望清单',
      icon: 'success'
    })

    wx.navigateBack()
  },

  goBack() {
    wx.navigateBack()
  }
})
