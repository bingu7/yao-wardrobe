const wardrobe = require('../../utils/wardrobe')
const CUSTOM_VISIBLE_LIMIT = 2
const OCCASION_VISIBLE_LIMIT = 4

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
    visibleOccasionOptions: [],
    showAllOccasionOptions: false,
    hiddenOccasionOptionCount: 0,
    occasionOptionToggleText: '',
    occasionPanelItems: [],
    showOccasionPanel: false,
    customOccasions: [],
    customOccasion: '',
    statuses: wardrobe.statuses,
    categoryIndex: 0,
    statusIndex: 0,
    showStatusPanel: false,
    showDatePanel: false,
    form: emptyForm(),
    errors: emptyErrors()
  },

  hasVisited: false,
  isPickingImage: false,
  originalImageUrl: '',
  pendingImageUrl: '',

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
      this.refreshOccasions(this.data.form.occasions || [])
      return
    }

    this.hasVisited = true
    this.cleanupPendingImage()
    this.originalImageUrl = ''
    this.setData({
      isEditing: false,
      form: emptyForm(),
      errors: emptyErrors(),
      ...emptyPickerIndexes(),
      customOccasion: '',
      seasonOptions: this.buildSeasonOptions([]),
      occasionOptions: this.buildOccasionOptions([])
    })
    this.refreshOccasions([])
  },

  refreshCategories(selectedCategory) {
    const categories = wardrobe.getFormCategories()
    const customCategories = wardrobe.getCustomCategories()
    const customView = wardrobe.buildCustomView(customCategories, this.data.showAllCustomCategories)
    this.setData({
      categories,
      customCategories,
      visibleCustomCategories: customView.visibleItems,
      hiddenCustomCategoryCount: customView.hiddenCount,
      customCategoryToggleText: customView.toggleText,
      categoryPanelItems: wardrobe.buildCategoryPanelItems(categories, customCategories, selectedCategory || this.data.form.category),
      categoryIndex: selectedCategory ? Math.max(0, categories.indexOf(selectedCategory)) : this.data.categoryIndex
    })
  },

  refreshOccasions(selectedOccasions) {
    const occasions = wardrobe.getOccasions()
    const selected = selectedOccasions || this.data.form.occasions || []
    const occasionOptions = this.buildOccasionOptions(selected)
    const occasionView = this.buildOccasionView(occasionOptions, this.data.showAllOccasionOptions)
    this.setData({
      customOccasions: occasions,
      occasionOptions,
      visibleOccasionOptions: occasionView.visibleItems,
      hiddenOccasionOptionCount: occasionView.hiddenCount,
      occasionOptionToggleText: occasionView.toggleText,
      occasionPanelItems: this.buildOccasionPanelItems(occasions, selected)
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

    this.cleanupPendingImage()
    this.originalImageUrl = item.imageUrl || ''
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
      customOccasions: wardrobe.getOccasions(),
      categoryIndex: Math.max(0, categories.indexOf(item.category)),
      statusIndex: Math.max(0, wardrobe.statuses.indexOf(item.status))
    })
    this.refreshCategories(item.category)
    this.refreshOccasions(item.occasions || [])
  },

  buildOccasionView(items, showAll) {
    const hiddenCount = Math.max(items.length - OCCASION_VISIBLE_LIMIT, 0)
    return {
      visibleItems: showAll ? items : items.slice(0, OCCASION_VISIBLE_LIMIT),
      hiddenCount,
      toggleText: showAll ? '收起' : `展开 ${hiddenCount} 个`
    }
  },

  buildOccasionPanelItems(occasions, selectedOccasions) {
    return occasions.map((name, index) => ({
      name,
      draftName: name,
      selected: selectedOccasions.includes(name),
      canMoveUp: index > 0,
      canMoveDown: index < occasions.length - 1,
      sortIndex: index
    }))
  },

  noop() {},

  buildSeasonOptions(selectedSeasons) {
    return wardrobe.seasons.map((name) => ({
      name,
      selected: selectedSeasons.includes(name)
    }))
  },

  buildOccasionOptions(selectedOccasions) {
    const selected = selectedOccasions || []
    const occasions = Array.from(new Set([...wardrobe.getOccasions(), ...selected]))
    return occasions.map((name) => ({
      name,
      selected: selected.includes(name)
    }))
  },

  chooseImage() {
    this.isPickingImage = true
    const previousPendingImageUrl = this.pendingImageUrl
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        // 保存到持久化存储，这样关闭小程序后图片不会丢失
        wardrobe.persistImage(tempPath).then((savedPath) => {
          if (previousPendingImageUrl && previousPendingImageUrl !== savedPath) {
            wardrobe.removeImageFile(previousPendingImageUrl)
          }
          this.pendingImageUrl = savedPath
          this.isPickingImage = false
          this.setData({
            'form.imageUrl': savedPath,
            'errors.imageUrl': ''
          })
        }).catch(() => {
          this.isPickingImage = false
          wx.showToast({
            title: '图片保存失败，请重试',
            icon: 'none'
          })
        })
      },
      fail: () => {
        this.isPickingImage = false
      }
    })
  },

  removeImage() {
    const oldUrl = this.data.form.imageUrl
    if (oldUrl && oldUrl === this.pendingImageUrl) {
      wardrobe.removeImageFile(oldUrl)
      this.pendingImageUrl = ''
    }
    this.setData({
      'form.imageUrl': '',
      'errors.imageUrl': ''
    })
  },

  onImageError() {
    const imageUrl = this.data.form.imageUrl
    if (imageUrl === this.pendingImageUrl) {
      wardrobe.removeImageFile(imageUrl)
      this.pendingImageUrl = ''
    } else if (this.data.form.id) {
      wardrobe.clearItemImage(this.data.form.id, imageUrl)
      this.originalImageUrl = ''
    }
    this.setData({ 'form.imageUrl': '' })
  },

  cleanupPendingImage() {
    if (this.pendingImageUrl && this.pendingImageUrl !== this.originalImageUrl) {
      wardrobe.removeImageFile(this.pendingImageUrl)
    }
    this.pendingImageUrl = ''
  },

  onUnload() {
    this.cleanupPendingImage()
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
      content: `确定删除“${category}”吗？已保存衣物和愿望会归到“其他”。`,
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
    this.setData({
      customOccasion: '',
      'form.occasions': occasions,
      showAllOccasionOptions: true
    })
    this.refreshOccasions(occasions)
    wx.showToast({
      title: '已添加场合',
      icon: 'success'
    })
  },

  toggleOccasionOptions() {
    const showAllOccasionOptions = !this.data.showAllOccasionOptions
    const occasionView = this.buildOccasionView(this.data.occasionOptions, showAllOccasionOptions)
    this.setData({
      showAllOccasionOptions,
      visibleOccasionOptions: occasionView.visibleItems,
      hiddenOccasionOptionCount: occasionView.hiddenCount,
      occasionOptionToggleText: occasionView.toggleText
    })
  },

  openOccasionPanel() {
    this.refreshOccasions(this.data.form.occasions || [])
    this.setData({
      showOccasionPanel: true
    })
  },

  closeOccasionPanel() {
    this.setData({
      showOccasionPanel: false
    })
  },

  onOccasionDraftInput(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      [`occasionPanelItems[${index}].draftName`]: event.detail.value
    })
  },

  renameOccasionFromPanel(event) {
    const index = Number(event.currentTarget.dataset.index)
    const item = this.data.occasionPanelItems[index]
    if (!item) {
      return
    }
    const result = wardrobe.renameCustomOccasion(item.name, item.draftName)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    const occasions = this.data.form.occasions.map((occasion) => (
      occasion === item.name ? result.occasion : occasion
    ))
    this.setData({ 'form.occasions': occasions })
    this.refreshOccasions(occasions)
    wx.showToast({ title: '已更新场合', icon: 'success' })
  },

  moveOccasionFromPanel(event) {
    const occasion = event.currentTarget.dataset.occasion
    const direction = Number(event.currentTarget.dataset.direction)
    const result = wardrobe.moveCustomOccasion(occasion, direction)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      return
    }
    this.refreshOccasions(this.data.form.occasions)
  },

  deleteCustomOccasion(event) {
    const occasion = event.currentTarget.dataset.occasion
    wx.showModal({
      title: '删除场合',
      content: `确定删除“${occasion}”吗？已保存衣物和穿搭里的这个场合也会移除。`,
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

  // ── 状态面板 ──

  openStatusPanel() {
    this.setData({ showStatusPanel: true })
  },

  closeStatusPanel() {
    this.setData({ showStatusPanel: false })
  },

  selectStatus(event) {
    const status = event.currentTarget.dataset.status
    const index = this.data.statuses.indexOf(status)
    this.setData({
      statusIndex: index >= 0 ? index : 0,
      'form.status': status,
      showStatusPanel: false
    })
  },

  // ── 日期面板 ──

  openDatePanel() {
    this.setData({
      showDatePanel: true
    })
  },

  closeDatePanel() {
    this.setData({ showDatePanel: false })
  },

  onDateChange(event) {
    this.setData({
      'form.purchaseDate': event.detail.value,
      showDatePanel: false
    })
  },

  selectQuickDate(event) {
    const offset = Number(event.currentTarget.dataset.offset)
    if (offset === -999) {
      // 清空
      this.setData({
        'form.purchaseDate': '',
        showDatePanel: false
      })
      return
    }
    const d = new Date()
    d.setDate(d.getDate() + offset)
    const date = wardrobe.formatLocalDate(d)
    this.setData({
      'form.purchaseDate': date,
      showDatePanel: false
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
    })
    this.refreshOccasions(occasions)
  },

  validateForm() {
    const form = this.data.form
    const errors = emptyErrors()
    const priceText = String(form.price).trim()

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
    if (wasEditing && this.originalImageUrl && this.originalImageUrl !== form.imageUrl) {
      wardrobe.removeImageFileIfUnused(this.originalImageUrl)
    }
    this.originalImageUrl = ''
    this.pendingImageUrl = ''

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
