const wardrobe = require('../../utils/wardrobe')
const CUSTOM_VISIBLE_LIMIT = 2

function emptyForm() {
  return {
    id: '',
    imageUrl: '',
    name: '',
    category: '',
    price: '',
    color: '',
    seasons: [],
    occasions: [],
    purchaseDate: '',
    status: '',
    note: ''
  }
}

function emptyErrors() {
  return {
    imageUrl: '',
    name: '',
    category: '',
    price: ''
  }
}

function emptyPickerIndexes() {
  return {
    categoryIndex: 0,
    statusIndex: 0
  }
}

Page({
  data: {
    isEditing: false,
    isSaving: false,
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
    seasonOptions: wardrobe.seasons.map((name) => ({ name, selected: false })),
    occasionOptions: [],
    customOccasions: [],
    visibleCustomOccasions: [],
    showAllCustomOccasions: false,
    hiddenCustomOccasionCount: 0,
    customOccasionToggleText: '',
    customOccasion: '',
    statuses: wardrobe.statuses,
    categoryIndex: 0,
    statusIndex: 0,
    form: emptyForm(),
    errors: emptyErrors()
  },

  hasVisited: false,
  isPickingImage: false,

  onShow() {
    this.refreshCategories()
    this.refreshOccasions()
    if (this.isPickingImage) {
      this.isPickingImage = false
      return
    }

    const editingId = wx.getStorageSync('wardrobeEditingId')
    if (editingId) {
      wx.removeStorageSync('wardrobeEditingId')
      this.loadItem(editingId)
      return
    }

    if (this.hasVisited) {
      this.setData({
        occasionOptions: this.buildOccasionOptions(this.data.form.occasions || [])
      })
      return
    }

    this.hasVisited = true
    this.setData({
      isEditing: false,
      form: emptyForm(),
      errors: emptyErrors(),
      ...emptyPickerIndexes(),
      customOccasion: '',
      seasonOptions: this.buildSeasonOptions([]),
      occasionOptions: this.buildOccasionOptions([])
    })
  },

  refreshCategories(selectedCategory) {
    const categories = wardrobe.getFormCategories()
    const customCategories = wardrobe.getCustomCategories()
    const customView = this.buildCustomView(customCategories, this.data.showAllCustomCategories)
    this.setData({
      categories,
      customCategories,
      visibleCustomCategories: customView.visibleItems,
      hiddenCustomCategoryCount: customView.hiddenCount,
      customCategoryToggleText: customView.toggleText,
      categoryPanelItems: this.buildCategoryPanelItems(categories, customCategories, selectedCategory || this.data.form.category),
      categoryIndex: selectedCategory ? Math.max(0, categories.indexOf(selectedCategory)) : this.data.categoryIndex
    })
  },

  refreshOccasions(selectedOccasions) {
    const customOccasions = wardrobe.getCustomOccasions()
    const customView = this.buildCustomView(customOccasions, this.data.showAllCustomOccasions)
    this.setData({
      customOccasions,
      visibleCustomOccasions: customView.visibleItems,
      hiddenCustomOccasionCount: customView.hiddenCount,
      customOccasionToggleText: customView.toggleText,
      occasionOptions: this.buildOccasionOptions(selectedOccasions || this.data.form.occasions || [])
    })
  },

  loadItem(id) {
    const item = wardrobe.getItem(id)
    if (!item) {
      wx.showToast({
        title: '衣物不存在',
        icon: 'none'
      })
      return
    }

    const categories = wardrobe.getFormCategories()
    this.setData({
      isEditing: true,
      categories,
      form: {
        ...emptyForm(),
        ...item
      },
      errors: emptyErrors(),
      seasonOptions: this.buildSeasonOptions(item.seasons || []),
      occasionOptions: this.buildOccasionOptions(item.occasions || []),
      customOccasions: wardrobe.getCustomOccasions(),
      categoryIndex: Math.max(0, categories.indexOf(item.category)),
      statusIndex: Math.max(0, wardrobe.statuses.indexOf(item.status))
    })
    this.refreshCategories(item.category)
    this.refreshOccasions(item.occasions || [])
  },

  buildCustomView(items, showAll) {
    const hiddenCount = Math.max(items.length - CUSTOM_VISIBLE_LIMIT, 0)
    const visibleItems = showAll ? items : items.slice(0, CUSTOM_VISIBLE_LIMIT)
    return {
      visibleItems,
      hiddenCount,
      toggleText: showAll ? '收起' : `展开 ${hiddenCount} 个`
    }
  },

  buildCategoryPanelItems(categories, customCategories, selectedCategory) {
    return categories.map((name, index) => {
      return {
        name,
        draftName: name,
        selected: name === selectedCategory,
        canMoveUp: index > 0,
        canMoveDown: index < categories.length - 1,
        sortIndex: index
      }
    })
  },

  noop() {},

  buildSeasonOptions(selectedSeasons) {
    return wardrobe.seasons.map((name) => ({
      name,
      selected: selectedSeasons.includes(name)
    }))
  },

  buildOccasionOptions(selectedOccasions) {
    return wardrobe.getOccasions().map((name) => ({
      name,
      selected: selectedOccasions.includes(name)
    }))
  },

  chooseImage() {
    this.isPickingImage = true
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          'form.imageUrl': res.tempFiles[0].tempFilePath,
          'errors.imageUrl': ''
        })
      },
      fail: () => {
        this.isPickingImage = false
      }
    })
  },

  removeImage() {
    this.setData({
      'form.imageUrl': '',
      'errors.imageUrl': '请上传衣物图片'
    })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    const value = event.detail.value
    this.setData({
      [`form.${field}`]: value,
      [`errors.${field}`]: ''
    })
  },

  onCustomCategoryInput(event) {
    this.setData({
      customCategory: event.detail.value
    })
  },

  openCategoryPanel() {
    this.refreshCategories()
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
      'form.category': category,
      'errors.category': '',
      categoryIndex: Math.max(0, categories.indexOf(category)),
      showCategoryPanel: false,
      categoryPanelItems: this.buildCategoryPanelItems(categories, this.data.customCategories, category)
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
    const customView = this.buildCustomView(customCategories, true)
    this.setData({
      categories,
      customCategories,
      visibleCustomCategories: customView.visibleItems,
      showAllCustomCategories: true,
      hiddenCustomCategoryCount: customView.hiddenCount,
      customCategoryToggleText: customView.toggleText,
      categoryPanelItems: this.buildCategoryPanelItems(categories, customCategories, result.category),
      showCategoryPanel: true,
      customCategory: '',
      categoryIndex: categories.indexOf(result.category),
      'form.category': result.category,
      'errors.category': ''
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
      'form.category': selectedCategory,
      'errors.category': ''
    })
    this.refreshCategories(selectedCategory)
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
    this.refreshCategories(this.data.form.category)
  },

  toggleCustomCategories() {
    const showAllCustomCategories = !this.data.showAllCustomCategories
    const customView = this.buildCustomView(this.data.customCategories, showAllCustomCategories)
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
      content: `确定删除“${category}”吗？已保存衣物不会被删除。`,
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
        const clearSelected = this.data.form.category === category
        const selectedCategory = clearSelected ? '' : this.data.form.category
        this.setData({
          'form.category': selectedCategory,
          categoryIndex: 0
        })
        this.refreshCategories(selectedCategory)
      }
    })
  },

  onCustomOccasionInput(event) {
    this.setData({
      customOccasion: event.detail.value
    })
  },

  addCustomOccasion() {
    const result = wardrobe.addCustomOccasion(this.data.customOccasion)
    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none'
      })
      return
    }

    const occasions = [...this.data.form.occasions, result.occasion]
    const customOccasions = wardrobe.getCustomOccasions()
    const customView = this.buildCustomView(customOccasions, true)
    this.setData({
      customOccasion: '',
      customOccasions,
      visibleCustomOccasions: customView.visibleItems,
      showAllCustomOccasions: true,
      hiddenCustomOccasionCount: customView.hiddenCount,
      customOccasionToggleText: customView.toggleText,
      'form.occasions': occasions,
      occasionOptions: this.buildOccasionOptions(occasions)
    })
    this.refreshOccasions(occasions)
    wx.showToast({
      title: '已添加场合',
      icon: 'success'
    })
  },

  toggleCustomOccasions() {
    const showAllCustomOccasions = !this.data.showAllCustomOccasions
    const customView = this.buildCustomView(this.data.customOccasions, showAllCustomOccasions)
    this.setData({
      showAllCustomOccasions,
      visibleCustomOccasions: customView.visibleItems,
      hiddenCustomOccasionCount: customView.hiddenCount,
      customOccasionToggleText: customView.toggleText
    })
  },

  deleteCustomOccasion(event) {
    const occasion = event.currentTarget.dataset.occasion
    wx.showModal({
      title: '删除场合',
      content: `确定删除“${occasion}”吗？已保存衣物不会被删除。`,
      confirmColor: '#7b3b32',
      success: (res) => {
        if (!res.confirm) {
          return
        }
        const result = wardrobe.deleteCustomOccasion(occasion)
        if (!result.ok) {
          wx.showToast({ title: result.message, icon: 'none' })
          return
        }
        const occasions = this.data.form.occasions.filter((item) => item !== occasion)
        this.setData({ 'form.occasions': occasions })
        this.refreshOccasions(occasions)
      }
    })
  },

  onCategoryChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      categoryIndex: index,
      'form.category': this.data.categories[index],
      'errors.category': ''
    })
  },

  onDateChange(event) {
    this.setData({
      'form.purchaseDate': event.detail.value
    })
  },

  onStatusChange(event) {
    const index = Number(event.detail.value)
    this.setData({
      statusIndex: index,
      'form.status': this.data.statuses[index]
    })
  },

  toggleSeason(event) {
    const season = event.currentTarget.dataset.season
    const seasons = this.data.form.seasons.includes(season)
      ? this.data.form.seasons.filter((item) => item !== season)
      : [...this.data.form.seasons, season]

    this.setData({
      'form.seasons': seasons,
      seasonOptions: this.buildSeasonOptions(seasons)
    })
  },

  toggleOccasion(event) {
    const occasion = event.currentTarget.dataset.occasion
    const occasions = this.data.form.occasions.includes(occasion)
      ? this.data.form.occasions.filter((item) => item !== occasion)
      : [...this.data.form.occasions, occasion]

    this.setData({
      'form.occasions': occasions,
      occasionOptions: this.buildOccasionOptions(occasions)
    })
  },

  validateForm() {
    const form = this.data.form
    const errors = emptyErrors()
    const priceText = String(form.price).trim()

    if (!form.imageUrl) {
      errors.imageUrl = '请上传衣物图片'
    }
    if (!form.name.trim()) {
      errors.name = '请填写衣物名字'
    }
    if (!form.category) {
      errors.category = '请选择衣物种类'
    }
    if (priceText !== '' && (!/^\d+(\.\d{1,2})?$/.test(priceText) || Number(priceText) < 0)) {
      errors.price = '价格需为大于或等于 0 的数字，最多 2 位小数'
    }

    this.setData({ errors })

    return !Object.keys(errors).some((key) => errors[key])
  },

  saveItem(event) {
    if (this.data.isSaving) {
      return
    }

    if (!this.validateForm()) {
      wx.showToast({
        title: '请检查必填信息',
        icon: 'none'
      })
      return
    }

    this.setData({ isSaving: true })

    const wasEditing = this.data.isEditing
    const continueAdding = event.currentTarget.dataset.continue === true || event.currentTarget.dataset.continue === 'true'
    const form = this.data.form
    const id = wardrobe.upsertItem({
      ...form,
      name: form.name.trim(),
      price: form.price === '' ? '' : Number(Number(form.price).toFixed(2))
    })

    wx.showToast({
      title: '已保存',
      icon: 'success'
    })

    this.setData({
      form: emptyForm(),
      isEditing: false,
      isSaving: false,
      errors: emptyErrors(),
      ...emptyPickerIndexes(),
      customCategory: '',
      customOccasion: '',
      seasonOptions: this.buildSeasonOptions([]),
      occasionOptions: this.buildOccasionOptions([])
    })

    if (continueAdding && !wasEditing) {
      return
    }

    wx.switchTab({
      url: '/pages/wardrobe/wardrobe'
    })
  }
})
